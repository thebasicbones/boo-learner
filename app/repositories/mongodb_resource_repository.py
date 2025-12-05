"""MongoDB resource repository for database operations"""

import logging
import re
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo.errors import (
    ConnectionFailure,
    DuplicateKeyError,
    ExecutionTimeout,
    ServerSelectionTimeoutError,
    WriteError,
)

from app.exceptions import (
    DatabaseError,
    ValidationError,
)
from app.repositories.base_resource_repository import BaseResourceRepository
from app.schemas import ResourceCreate, ResourceUpdate

logger = logging.getLogger(__name__)


class MongoDBResourceRepository(BaseResourceRepository):
    """MongoDB implementation of the resource repository interface"""

    def __init__(self, db: AsyncIOMotorDatabase):
        """
        Initialize repository with MongoDB database instance.

        Args:
            db: AsyncIOMotorDatabase instance for database operations
        """
        self.db = db
        self.collection = db.resources

    def _document_to_dict(self, document: dict[str, Any]) -> dict[str, Any]:
        """
        Convert MongoDB document to application dictionary format.

        This method transforms MongoDB's internal representation to match
        the application's expected format:
        - Maps '_id' to 'id'
        - Ensures all required fields are present
        - Converts datetime objects to UTC

        Args:
            document: MongoDB document dictionary

        Returns:
            Dictionary with application-compatible field names and types
        """
        if not document:
            return None

        # Ensure datetimes are timezone-aware (UTC)
        created_at = document["created_at"]
        updated_at = document["updated_at"]

        # MongoDB stores datetimes as UTC but returns them as naive datetime objects
        # We need to make them timezone-aware
        if created_at and created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=UTC)
        if updated_at and updated_at.tzinfo is None:
            updated_at = updated_at.replace(tzinfo=UTC)

        return {
            "id": document["_id"],
            "name": document["name"],
            "description": document.get("description"),
            "dependencies": document.get("dependencies", []),
            "created_at": created_at,
            "updated_at": updated_at,
        }

    def _dict_to_document(
        self, data: dict[str, Any], resource_id: str | None = None
    ) -> dict[str, Any]:
        """
        Convert application dictionary to MongoDB document format.

        This method prepares data for MongoDB storage:
        - Maps 'id' to '_id'
        - Generates UUID for new resources
        - Ensures UTC timestamps
        - Handles optional fields

        Args:
            data: Application data dictionary
            resource_id: Optional resource ID for updates (uses existing ID)

        Returns:
            MongoDB document dictionary ready for insertion/update
        """
        now = datetime.now(UTC)

        document = {
            "_id": resource_id or str(uuid4()),
            "name": data.get("name"),
            "description": data.get("description"),
            "dependencies": data.get("dependencies", []),
            "updated_at": now,
        }

        # Only set created_at for new documents
        if not resource_id:
            document["created_at"] = now

        return document

    async def get_all(self) -> list[dict[str, Any]]:
        """
        Retrieve all resources from MongoDB.

        Returns:
            List of all resource dictionaries with dependencies loaded
        """
        try:
            cursor = self.collection.find({})
            documents = await cursor.to_list(length=None)
            return [self._document_to_dict(doc) for doc in documents]
        except (ConnectionFailure, ServerSelectionTimeoutError) as e:
            logger.error(f"MongoDB connection error in get_all: {e}")
            raise DatabaseError(
                "Failed to retrieve resources due to connection error",
                error_type="connection",
                details=str(e),
            )
        except ExecutionTimeout as e:
            logger.error(f"MongoDB timeout in get_all: {e}")
            raise DatabaseError(
                "Database operation timed out while retrieving resources",
                error_type="timeout",
                details="operation=get_all",
            )
        except Exception as e:
            logger.error(f"Unexpected error in get_all: {e}")
            raise

    async def get_by_id(self, resource_id: str) -> dict[str, Any] | None:
        """
        Retrieve a single resource by ID.

        Args:
            resource_id: The unique identifier of the resource

        Returns:
            Resource dictionary if found, None otherwise
        """
        try:
            document = await self.collection.find_one({"_id": resource_id})
            return self._document_to_dict(document) if document else None
        except (ConnectionFailure, ServerSelectionTimeoutError) as e:
            logger.error(f"MongoDB connection error in get_by_id: {e}")
            raise DatabaseError(
                f"Failed to retrieve resource {resource_id} due to connection error",
                error_type="connection",
                details=str(e),
            )
        except ExecutionTimeout as e:
            logger.error(f"MongoDB timeout in get_by_id: {e}")
            raise DatabaseError(
                f"Database operation timed out while retrieving resource {resource_id}",
                error_type="timeout",
                details="operation=get_by_id",
            )
        except Exception as e:
            logger.error(f"Unexpected error in get_by_id: {e}")
            raise

    async def create(self, data: ResourceCreate) -> dict[str, Any]:
        """
        Create a new resource in MongoDB.

        Args:
            data: ResourceCreate schema with resource data

        Returns:
            The newly created resource dictionary

        Raises:
            DatabaseError: If resource with same ID already exists (error_type="duplicate"),
                          if connection fails (error_type="connection"),
                          or if operation times out (error_type="timeout")
            ValidationError: If data validation fails
        """
        try:
            # Convert Pydantic model to dictionary
            resource_data = {
                "name": data.name,
                "description": data.description,
                "dependencies": data.dependencies,
            }

            # Create MongoDB document with UUID
            document = self._dict_to_document(resource_data)

            # Insert into MongoDB
            await self.collection.insert_one(document)

            # Return the created resource
            return self._document_to_dict(document)

        except DuplicateKeyError as e:
            logger.error(f"Duplicate key error in create: {e}")
            raise DatabaseError(
                f"Resource with ID {document['_id']} already exists",
                error_type="duplicate",
                details="Resource with this ID already exists",
            )
        except WriteError as e:
            logger.error(f"MongoDB write error in create: {e}")
            # Check if it's a validation error
            if "validation" in str(e).lower():
                raise ValidationError("Data validation failed", details={"error": str(e)})
            raise
        except (ConnectionFailure, ServerSelectionTimeoutError) as e:
            logger.error(f"MongoDB connection error in create: {e}")
            raise DatabaseError(
                "Failed to create resource due to connection error",
                error_type="connection",
                details=str(e),
            )
        except ExecutionTimeout as e:
            logger.error(f"MongoDB timeout in create: {e}")
            raise DatabaseError(
                "Database operation timed out while creating resource",
                error_type="timeout",
                details="operation=create",
            )
        except Exception as e:
            logger.error(f"Unexpected error in create: {e}")
            raise

    async def update(self, resource_id: str, data: ResourceUpdate) -> dict[str, Any] | None:
        """
        Update an existing resource with partial or complete data.

        Args:
            resource_id: The unique identifier of the resource to update
            data: ResourceUpdate schema with updated data

        Returns:
            Updated resource dictionary if found, None if resource doesn't exist

        Raises:
            ValidationError: If data validation fails
            DatabaseError: If connection fails (error_type="connection")
                          or if operation times out (error_type="timeout")
        """
        try:
            # Check if resource exists
            existing = await self.get_by_id(resource_id)
            if not existing:
                return None

            # Build update document with only provided fields
            update_fields = {}
            if data.name is not None:
                update_fields["name"] = data.name
            if data.description is not None:
                update_fields["description"] = data.description
            if data.dependencies is not None:
                update_fields["dependencies"] = data.dependencies

            # Always update the updated_at timestamp
            update_fields["updated_at"] = datetime.now(UTC)

            # Perform the update
            result = await self.collection.update_one({"_id": resource_id}, {"$set": update_fields})

            if result.modified_count == 0 and result.matched_count == 0:
                return None

            # Retrieve and return the updated resource
            return await self.get_by_id(resource_id)

        except WriteError as e:
            logger.error(f"MongoDB write error in update: {e}")
            if "validation" in str(e).lower():
                raise ValidationError("Data validation failed", details={"error": str(e)})
            raise
        except (ConnectionFailure, ServerSelectionTimeoutError) as e:
            logger.error(f"MongoDB connection error in update: {e}")
            raise DatabaseError(
                f"Failed to update resource {resource_id} due to connection error",
                error_type="connection",
                details=str(e),
            )
        except ExecutionTimeout as e:
            logger.error(f"MongoDB timeout in update: {e}")
            raise DatabaseError(
                f"Database operation timed out while updating resource {resource_id}",
                error_type="timeout",
                details="operation=update",
            )
        except Exception as e:
            logger.error(f"Unexpected error in update: {e}")
            raise

    async def delete(self, resource_id: str, cascade: bool = False) -> bool:
        """
        Delete a resource from MongoDB.

        Args:
            resource_id: The unique identifier of the resource to delete
            cascade: If True, recursively delete all resources that depend on this resource

        Returns:
            True if resource was deleted, False if not found

        Raises:
            DatabaseError: If connection fails (error_type="connection")
                          or if operation times out (error_type="timeout")
        """
        try:
            # Check if resource exists
            existing = await self.get_by_id(resource_id)
            if not existing:
                return False

            if cascade:
                # Find and delete all dependents recursively
                dependents_to_delete = await self._get_all_dependents(resource_id)

                # Delete all dependents first
                if dependents_to_delete:
                    await self.collection.delete_many({"_id": {"$in": dependents_to_delete}})
                    logger.info(f"Deleted {len(dependents_to_delete)} dependent resources")
            else:
                # Non-cascade delete: remove this resource ID from all other resources' dependencies
                # This ensures that dependents are preserved but their dependency lists are updated
                await self.collection.update_many(
                    {"dependencies": resource_id}, {"$pull": {"dependencies": resource_id}}
                )
                logger.info(
                    f"Removed resource {resource_id} from dependency lists of other resources"
                )

            # Delete the resource itself
            result = await self.collection.delete_one({"_id": resource_id})

            return result.deleted_count > 0

        except (ConnectionFailure, ServerSelectionTimeoutError) as e:
            logger.error(f"MongoDB connection error in delete: {e}")
            raise DatabaseError(
                f"Failed to delete resource {resource_id} due to connection error",
                error_type="connection",
                details=str(e),
            )
        except ExecutionTimeout as e:
            logger.error(f"MongoDB timeout in delete: {e}")
            raise DatabaseError(
                f"Database operation timed out while deleting resource {resource_id}",
                error_type="timeout",
                details="operation=delete",
            )
        except Exception as e:
            logger.error(f"Unexpected error in delete: {e}")
            raise

    async def _get_all_dependents(self, resource_id: str) -> list[str]:
        """
        Get all resources that depend on the given resource (transitively).

        This method performs a breadth-first search to find all resources
        that directly or indirectly depend on the specified resource.

        Args:
            resource_id: The resource ID to find dependents for

        Returns:
            List of resource IDs that depend on this resource
        """
        all_dependents = set()
        to_process = [resource_id]

        while to_process:
            current_id = to_process.pop(0)

            # Find direct dependents (resources that have current_id in their dependencies)
            cursor = self.collection.find({"dependencies": current_id})
            direct_dependents = await cursor.to_list(length=None)

            for dependent in direct_dependents:
                dependent_id = dependent["_id"]
                if dependent_id not in all_dependents:
                    all_dependents.add(dependent_id)
                    to_process.append(dependent_id)

        return list(all_dependents)

    async def search(self, query: str | None = None) -> list[dict[str, Any]]:
        """
        Search for resources by name or description.

        Args:
            query: Search string to match against name or description.
                   If None or empty, returns all resources.

        Returns:
            List of matching resource dictionaries with dependencies loaded

        Raises:
            DatabaseError: If connection fails (error_type="connection")
                          or if operation times out (error_type="timeout")
        """
        try:
            # Build search filter
            if query and query.strip():
                # Escape regex special characters to prevent regex parsing errors
                # This ensures that special characters like '[', ']', '(', ')' are treated literally
                escaped_query = re.escape(query.strip())

                # Case-insensitive regex search on name and description
                search_pattern = {"$regex": escaped_query, "$options": "i"}
                filter_query = {"$or": [{"name": search_pattern}, {"description": search_pattern}]}
            else:
                # Return all resources if no query provided
                filter_query = {}

            # Execute search
            cursor = self.collection.find(filter_query)
            documents = await cursor.to_list(length=None)

            return [self._document_to_dict(doc) for doc in documents]

        except (ConnectionFailure, ServerSelectionTimeoutError) as e:
            logger.error(f"MongoDB connection error in search: {e}")
            raise DatabaseError(
                "Failed to search resources due to connection error",
                error_type="connection",
                details=str(e),
            )
        except ExecutionTimeout as e:
            logger.error(f"MongoDB timeout in search: {e}")
            raise DatabaseError(
                "Database operation timed out while searching resources",
                error_type="timeout",
                details="operation=search",
            )
        except Exception as e:
            logger.error(f"Unexpected error in search: {e}")
            raise
