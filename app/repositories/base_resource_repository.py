"""Abstract base repository interface for resource operations"""

from abc import ABC, abstractmethod

from app.schemas import ResourceCreate, ResourceUpdate


class BaseResourceRepository(ABC):
    """
    Abstract base class defining the repository interface for resource operations.

    This interface abstracts database-specific operations, allowing different
    implementations (e.g., SQLAlchemy, MongoDB) while maintaining a consistent
    API for the service layer.
    """

    @abstractmethod
    async def get_all(self) -> list:
        """
        Retrieve all resources from the database.

        Returns:
            List of all resource objects with their dependencies loaded.
            The exact type depends on the implementation (SQLAlchemy models,
            dictionaries, etc.) but should be convertible to ResourceResponse schema.
        """
        pass

    @abstractmethod
    async def get_by_id(self, resource_id: str) -> object | None:
        """
        Retrieve a single resource by its unique identifier.

        Args:
            resource_id: The unique identifier (UUID string) of the resource

        Returns:
            Resource object if found, None otherwise. The resource should have
            its dependencies loaded.
        """
        pass

    @abstractmethod
    async def create(self, data: ResourceCreate) -> object:
        """
        Create a new resource in the database.

        Args:
            data: ResourceCreate schema containing:
                - name: Resource name (required, 1-100 characters)
                - description: Optional description (max 500 characters)
                - dependencies: List of resource IDs this resource depends on

        Returns:
            The newly created resource object with all fields populated,
            including generated id, created_at, and updated_at timestamps.

        Raises:
            Implementation-specific exceptions for validation errors,
            constraint violations, or database errors.
        """
        pass

    @abstractmethod
    async def update(self, resource_id: str, data: ResourceUpdate) -> object | None:
        """
        Update an existing resource with partial or complete data.

        Args:
            resource_id: The unique identifier of the resource to update
            data: ResourceUpdate schema containing optional fields:
                - name: Updated resource name (optional)
                - description: Updated description (optional)
                - dependencies: Updated list of dependency IDs (optional)

        Returns:
            Updated resource object if found, None if resource doesn't exist.
            Only provided fields should be updated; omitted fields remain unchanged.

        Raises:
            Implementation-specific exceptions for validation errors,
            constraint violations, or database errors.
        """
        pass

    @abstractmethod
    async def delete(self, resource_id: str, cascade: bool = False) -> bool:
        """
        Delete a resource from the database.

        Args:
            resource_id: The unique identifier of the resource to delete
            cascade: If True, recursively delete all resources that depend on
                    this resource (directly or transitively). If False, only
                    delete the specified resource.

        Returns:
            True if the resource was found and deleted, False if the resource
            was not found.

        Raises:
            Implementation-specific exceptions for constraint violations
            (e.g., if cascade=False and dependents exist) or database errors.
        """
        pass

    @abstractmethod
    async def search(self, query: str | None = None) -> list:
        """
        Search for resources by name or description.

        Args:
            query: Search string to match against resource name or description
                  using case-insensitive partial matching. If None or empty,
                  returns all resources.

        Returns:
            List of matching resource objects with dependencies loaded.
            Results should include any resource where the query string appears
            in the name or description (case-insensitive).
        """
        pass
