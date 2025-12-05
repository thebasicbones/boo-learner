"""Resource Service for business logic and coordination"""

import time
from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.database_factory import get_repository
from app.exceptions import CircularDependencyError, NotFoundError, ValidationError
from app.observability import create_metrics_instrumentor, get_meter, observability_error_handler
from app.schemas import ResourceCreate, ResourceResponse, ResourceUpdate
from app.services.topological_sort_service import TopologicalSortService


class ResourceService:
    """Service class for resource business logic"""

    def __init__(self, db: AsyncIOMotorDatabase):
        """
        Initialize service with database instance.

        Args:
            db: Database connection (AsyncIOMotorDatabase for MongoDB)
        """
        self.db = db
        self.repository = get_repository(db)
        self.topo_service = TopologicalSortService()

        # Initialize metrics instrumentor
        with observability_error_handler("init_metrics"):
            meter = get_meter(__name__)
            self.metrics = create_metrics_instrumentor(meter)

        # Database type for metrics
        self.db_type = "mongodb"

    async def create_resource(self, data: ResourceCreate) -> ResourceResponse:
        """
        Create a new resource with circular dependency validation.

        Args:
            data: ResourceCreate schema with resource data

        Returns:
            ResourceResponse with the created resource

        Raises:
            ValidationError: If dependencies are invalid or would create a cycle
        """
        start_time = time.time()

        try:
            # Resolve dependency names to IDs
            resolved_dependencies = await self._resolve_dependencies(data.dependencies)
            
            # Create a new data object with resolved dependencies
            resolved_data = ResourceCreate(
                name=data.name,
                description=data.description,
                dependencies=resolved_dependencies
            )
            
            # Validate dependencies and check cycles
            temp_id = "temp_new_resource_id"
            await self._validate_and_check_cycles(temp_id, resolved_dependencies)

            # Create the resource
            resource = await self.repository.create(resolved_data)

            # Record successful operation
            duration = time.time() - start_time
            with observability_error_handler("record_create_metrics"):
                self.metrics.record_operation_complete(
                    operation="create", db_type=self.db_type, duration=duration, status="success"
                )
                self.metrics.increment_resource_count(self.db_type, delta=1)

            return self._resource_to_response(resource)

        except ValidationError:
            # Record validation error
            duration = time.time() - start_time
            with observability_error_handler("record_create_error"):
                self.metrics.record_operation_error(
                    operation="create",
                    db_type=self.db_type,
                    error_type="validation",
                    duration=duration,
                )
            raise
        except Exception:
            # Record unexpected error
            duration = time.time() - start_time
            with observability_error_handler("record_create_error"):
                self.metrics.record_operation_error(
                    operation="create",
                    db_type=self.db_type,
                    error_type="database",
                    duration=duration,
                )
            raise

    async def get_resource(self, resource_id: str) -> ResourceResponse:
        """
        Get a single resource by ID.

        Args:
            resource_id: The unique identifier of the resource

        Returns:
            ResourceResponse with the resource data

        Raises:
            NotFoundError: If resource doesn't exist
        """
        start_time = time.time()

        try:
            resource = await self.repository.get_by_id(resource_id)

            if not resource:
                raise NotFoundError(resource_id)

            # Record successful operation
            duration = time.time() - start_time
            with observability_error_handler("record_read_metrics"):
                self.metrics.record_operation_complete(
                    operation="read", db_type=self.db_type, duration=duration, status="success"
                )

            return self._resource_to_response(resource)

        except NotFoundError:
            # Record not found error
            duration = time.time() - start_time
            with observability_error_handler("record_read_error"):
                self.metrics.record_operation_error(
                    operation="read",
                    db_type=self.db_type,
                    error_type="not_found",
                    duration=duration,
                )
            raise
        except Exception:
            # Record unexpected error
            duration = time.time() - start_time
            with observability_error_handler("record_read_error"):
                self.metrics.record_operation_error(
                    operation="read", db_type=self.db_type, error_type="database", duration=duration
                )
            raise

    async def get_all_resources(self) -> list[ResourceResponse]:
        """
        Get all resources.

        Returns:
            List of ResourceResponse objects
        """
        resources = await self.repository.get_all()
        return [self._resource_to_response(r) for r in resources]

    async def update_resource(self, resource_id: str, data: ResourceUpdate) -> ResourceResponse:
        """
        Update an existing resource with dependency validation.

        Args:
            resource_id: The unique identifier of the resource to update
            data: ResourceUpdate schema with updated data

        Returns:
            ResourceResponse with the updated resource

        Raises:
            NotFoundError: If resource doesn't exist
            ValidationError: If dependencies are invalid or would create a cycle
        """
        start_time = time.time()

        try:
            # Check if resource exists
            existing_resource = await self.repository.get_by_id(resource_id)
            if not existing_resource:
                raise NotFoundError(resource_id)

            # Resolve dependency names to IDs if being updated
            resolved_dependencies = None
            if data.dependencies is not None:
                resolved_dependencies = await self._resolve_dependencies(data.dependencies)
                await self._validate_and_check_cycles(resource_id, resolved_dependencies)
            
            # Create a new data object with resolved dependencies
            resolved_data = ResourceUpdate(
                name=data.name,
                description=data.description,
                dependencies=resolved_dependencies
            )

            # Update the resource
            updated_resource = await self.repository.update(resource_id, resolved_data)

            # Record successful operation
            duration = time.time() - start_time
            with observability_error_handler("record_update_metrics"):
                self.metrics.record_operation_complete(
                    operation="update", db_type=self.db_type, duration=duration, status="success"
                )

            return self._resource_to_response(updated_resource)

        except NotFoundError:
            # Record not found error
            duration = time.time() - start_time
            with observability_error_handler("record_update_error"):
                self.metrics.record_operation_error(
                    operation="update",
                    db_type=self.db_type,
                    error_type="not_found",
                    duration=duration,
                )
            raise
        except ValidationError:
            # Record validation error
            duration = time.time() - start_time
            with observability_error_handler("record_update_error"):
                self.metrics.record_operation_error(
                    operation="update",
                    db_type=self.db_type,
                    error_type="validation",
                    duration=duration,
                )
            raise
        except Exception:
            # Record unexpected error
            duration = time.time() - start_time
            with observability_error_handler("record_update_error"):
                self.metrics.record_operation_error(
                    operation="update",
                    db_type=self.db_type,
                    error_type="database",
                    duration=duration,
                )
            raise

    async def delete_resource(self, resource_id: str, cascade: bool = False) -> None:
        """
        Delete a resource with optional cascade.

        Args:
            resource_id: The unique identifier of the resource to delete
            cascade: If True, delete all resources that depend on this resource

        Raises:
            NotFoundError: If resource doesn't exist
        """
        start_time = time.time()

        try:
            # Count resources before delete for cascade metrics
            if cascade:
                all_resources = await self.repository.get_all()
                initial_count = len(all_resources)

            success = await self.repository.delete(resource_id, cascade)

            if not success:
                raise NotFoundError(resource_id)

            # Calculate cascade delete count if applicable
            cascade_count = 1
            if cascade:
                all_resources_after = await self.repository.get_all()
                cascade_count = initial_count - len(all_resources_after)

            # Record successful operation
            duration = time.time() - start_time
            with observability_error_handler("record_delete_metrics"):
                self.metrics.record_operation_complete(
                    operation="delete",
                    db_type=self.db_type,
                    duration=duration,
                    status="success",
                    cascade=cascade,
                )
                self.metrics.increment_resource_count(self.db_type, delta=-cascade_count)

                if cascade and cascade_count > 1:
                    self.metrics.record_cascade_delete(cascade_count, self.db_type)

        except NotFoundError:
            # Record not found error
            duration = time.time() - start_time
            with observability_error_handler("record_delete_error"):
                self.metrics.record_operation_error(
                    operation="delete",
                    db_type=self.db_type,
                    error_type="not_found",
                    duration=duration,
                )
            raise
        except Exception:
            # Record unexpected error
            duration = time.time() - start_time
            with observability_error_handler("record_delete_error"):
                self.metrics.record_operation_error(
                    operation="delete",
                    db_type=self.db_type,
                    error_type="database",
                    duration=duration,
                )
            raise

    async def search_resources(self, query: str | None = None) -> list[ResourceResponse]:
        """
        Search for resources and return them in topological order.

        Args:
            query: Search string to match against name or description.
                   If None or empty, returns all resources.

        Returns:
            List of ResourceResponse objects in topological order

        Raises:
            ValidationError: If circular dependency is detected in results
        """
        start_time = time.time()

        try:
            # Search for matching resources
            resources = await self.repository.search(query)

            if not resources:
                # Record successful empty search
                duration = time.time() - start_time
                with observability_error_handler("record_search_metrics"):
                    self.metrics.record_operation_complete(
                        operation="search",
                        db_type=self.db_type,
                        duration=duration,
                        status="success",
                        result_count=0,
                    )
                return []

            # Convert to dict format for topological sort
            resource_dicts = [
                {
                    "id": self._get_resource_id(r),
                    "name": self._get_resource_name(r),
                    "description": self._get_resource_description(r),
                    "dependencies": self._get_resource_dependencies(r),
                    "created_at": self._get_resource_created_at(r),
                    "updated_at": self._get_resource_updated_at(r),
                }
                for r in resources
            ]

            # Sort topologically
            try:
                sorted_dicts = self.topo_service.topological_sort(resource_dicts)
            except CircularDependencyError as e:
                raise ValidationError(
                    "Circular dependency detected in search results", {"cycle": str(e)}
                )

            # Convert back to ResourceResponse
            results = [
                ResourceResponse(
                    id=r["id"],
                    name=r["name"],
                    description=r["description"],
                    dependencies=r["dependencies"],
                    created_at=r["created_at"],
                    updated_at=r["updated_at"],
                )
                for r in sorted_dicts
            ]

            # Record successful operation
            duration = time.time() - start_time
            with observability_error_handler("record_search_metrics"):
                self.metrics.record_operation_complete(
                    operation="search",
                    db_type=self.db_type,
                    duration=duration,
                    status="success",
                    result_count=len(results),
                )

            return results

        except ValidationError:
            # Record validation error (circular dependency)
            duration = time.time() - start_time
            with observability_error_handler("record_search_error"):
                self.metrics.record_operation_error(
                    operation="search",
                    db_type=self.db_type,
                    error_type="circular_dependency",
                    duration=duration,
                )
            raise
        except Exception:
            # Record unexpected error
            duration = time.time() - start_time
            with observability_error_handler("record_search_error"):
                self.metrics.record_operation_error(
                    operation="search",
                    db_type=self.db_type,
                    error_type="database",
                    duration=duration,
                )
            raise

    async def _resolve_dependencies(self, dependencies: list[str]) -> list[str]:
        """
        Resolve dependency names or IDs to IDs.
        
        Accepts either resource IDs or resource names and returns a list of IDs.
        If a dependency is already an ID that exists, it's kept as-is.
        If it's a name, it's resolved to the corresponding ID.

        Args:
            dependencies: List of resource IDs or names

        Returns:
            List of resolved resource IDs

        Raises:
            ValidationError: If any dependency cannot be resolved
        """
        if not dependencies:
            return []

        resolved_ids = []
        all_resources = await self.repository.get_all()
        
        # Create lookup maps for both ID and name
        id_map = {self._get_resource_id(r): r for r in all_resources}
        name_map = {self._get_resource_name(r): self._get_resource_id(r) for r in all_resources}

        for dep in dependencies:
            dep_stripped = dep.strip()
            
            # Check if it's already a valid ID
            if dep_stripped in id_map:
                resolved_ids.append(dep_stripped)
            # Check if it's a resource name
            elif dep_stripped in name_map:
                resolved_ids.append(name_map[dep_stripped])
            else:
                # Not found as either ID or name
                raise ValidationError(
                    "Invalid dependency: resource not found",
                    {
                        "dependency": dep_stripped,
                        "message": f"No resource found with ID or name '{dep_stripped}'"
                    }
                )

        return resolved_ids

    async def _validate_dependencies_exist(self, dependency_ids: list[str]) -> None:
        """
        Validate that all dependency IDs exist in the database.
        
        Note: This method expects IDs that have already been resolved.
        Use _resolve_dependencies() first to convert names to IDs.

        Args:
            dependency_ids: List of resource IDs to validate

        Raises:
            ValidationError: If any dependency ID doesn't exist
        """
        if not dependency_ids:
            return

        # Check each dependency
        for dep_id in dependency_ids:
            resource = await self.repository.get_by_id(dep_id)
            if not resource:
                raise ValidationError(
                    "Invalid dependency: resource ID not found",
                    {
                        "dependency_id": dep_id,
                        "message": f"Resource with ID '{dep_id}' does not exist"
                    }
                )

    async def _validate_and_check_cycles(self, resource_id: str, dependencies: list[str]) -> None:
        """
        Validate dependencies exist and check for circular dependencies.

        Args:
            resource_id: ID of resource being created/updated
            dependencies: List of dependency IDs

        Raises:
            ValidationError: If dependencies don't exist or would create cycle
        """
        # Validate all dependency IDs exist
        if dependencies:
            await self._validate_dependencies_exist(dependencies)

        # Get all existing resources
        existing_resources = await self.repository.get_all()

        # Convert to dict format for validation
        resource_dicts = [
            {
                "id": self._get_resource_id(r),
                "dependencies": self._get_resource_dependencies(r),
            }
            for r in existing_resources
        ]

        # Validate no cycles would be created
        try:
            self.topo_service.validate_no_cycles(resource_dicts, resource_id, dependencies)
        except CircularDependencyError as e:
            raise ValidationError(
                "Cannot create/update resource: would create circular dependency",
                {"cycle": str(e)},
            )

    @staticmethod
    def _get_resource_id(resource: dict[str, Any] | Any) -> str:
        """Extract resource ID from either dict or object."""
        return resource["id"] if isinstance(resource, dict) else resource.id

    @staticmethod
    def _get_resource_name(resource: dict[str, Any] | Any) -> str:
        """Extract resource name from either dict or object."""
        return resource["name"] if isinstance(resource, dict) else resource.name

    @staticmethod
    def _get_resource_description(resource: dict[str, Any] | Any) -> str | None:
        """Extract resource description from either dict or object."""
        return resource.get("description") if isinstance(resource, dict) else resource.description

    @staticmethod
    def _get_resource_dependencies(resource: dict[str, Any] | Any) -> list[str]:
        """Extract resource dependencies from either dict or object."""
        if isinstance(resource, dict):
            return resource.get("dependencies", [])
        else:
            return [d.id for d in resource.dependencies]

    @staticmethod
    def _get_resource_created_at(resource: dict[str, Any] | Any):
        """Extract resource created_at from either dict or object."""
        return resource["created_at"] if isinstance(resource, dict) else resource.created_at

    @staticmethod
    def _get_resource_updated_at(resource: dict[str, Any] | Any):
        """Extract resource updated_at from either dict or object."""
        return resource["updated_at"] if isinstance(resource, dict) else resource.updated_at

    def _resource_to_response(self, resource: dict[str, Any]) -> ResourceResponse:
        """
        Convert a resource dictionary to ResourceResponse schema.

        Args:
            resource: Resource data dictionary from MongoDB

        Returns:
            ResourceResponse schema
        """
        return ResourceResponse(
            id=self._get_resource_id(resource),
            name=self._get_resource_name(resource),
            description=self._get_resource_description(resource),
            dependencies=self._get_resource_dependencies(resource),
            created_at=self._get_resource_created_at(resource),
            updated_at=self._get_resource_updated_at(resource),
        )
