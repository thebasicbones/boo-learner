"""FastAPI router for resource endpoints"""

from fastapi import APIRouter, Depends, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from sqlalchemy.ext.asyncio import AsyncSession

from app.database_factory import get_db
from app.schemas import ErrorResponse, ResourceCreate, ResourceResponse, ResourceUpdate
from app.services.resource_service import ResourceService

router = APIRouter(prefix="/api", tags=["resources"])


@router.post(
    "/resources",
    response_model=ResourceResponse,
    status_code=status.HTTP_201_CREATED,
    responses={
        201: {"description": "Resource created successfully"},
        422: {"model": ErrorResponse, "description": "Validation error"},
        500: {"model": ErrorResponse, "description": "Internal server error"},
    },
)
async def create_resource(
    data: ResourceCreate, db: AsyncSession | AsyncIOMotorDatabase = Depends(get_db)
) -> ResourceResponse:
    """
    Create a new resource.

    Args:
        data: Resource creation data containing name, description, and dependencies
        db: Database connection (injected by FastAPI)

    Returns:
        ResourceResponse: The created resource with a unique identifier

    Raises:
        ValidationError: If dependencies are invalid or would create a circular dependency
        HTTPException: 422 for validation errors, 500 for server errors

    Example::

        POST /api/resources
        {
            "name": "Frontend App",
            "description": "React frontend application",
            "dependencies": ["backend-api-id", "auth-service-id"]
        }

    Parameters:
        - **name**: Resource name (required, 1-100 characters)
        - **description**: Resource description (optional, max 500 characters)
        - **dependencies**: List of resource IDs this resource depends on
    """
    service = ResourceService(db)
    resource = await service.create_resource(data)
    return resource


@router.get(
    "/resources",
    response_model=list[ResourceResponse],
    status_code=status.HTTP_200_OK,
    responses={
        200: {"description": "List of all resources"},
        500: {"model": ErrorResponse, "description": "Internal server error"},
    },
)
async def list_resources(
    db: AsyncSession | AsyncIOMotorDatabase = Depends(get_db),
) -> list[ResourceResponse]:
    """
    Get all resources.

    Returns a list of all resources in the system.
    """
    service = ResourceService(db)
    resources = await service.get_all_resources()
    return resources


@router.get(
    "/resources/{resource_id}",
    response_model=ResourceResponse,
    status_code=status.HTTP_200_OK,
    responses={
        200: {"description": "Resource retrieved successfully"},
        404: {"model": ErrorResponse, "description": "Resource not found"},
        500: {"model": ErrorResponse, "description": "Internal server error"},
    },
)
async def get_resource(
    resource_id: str, db: AsyncSession | AsyncIOMotorDatabase = Depends(get_db)
) -> ResourceResponse:
    """
    Get a single resource by ID.

    - **resource_id**: The unique identifier of the resource

    Returns the resource data.
    """
    service = ResourceService(db)
    resource = await service.get_resource(resource_id)
    return resource


@router.put(
    "/resources/{resource_id}",
    response_model=ResourceResponse,
    status_code=status.HTTP_200_OK,
    responses={
        200: {"description": "Resource updated successfully"},
        404: {"model": ErrorResponse, "description": "Resource not found"},
        422: {"model": ErrorResponse, "description": "Validation error"},
        500: {"model": ErrorResponse, "description": "Internal server error"},
    },
)
async def update_resource(
    resource_id: str,
    data: ResourceUpdate,
    db: AsyncSession | AsyncIOMotorDatabase = Depends(get_db),
) -> ResourceResponse:
    """
    Update an existing resource.

    - **resource_id**: The unique identifier of the resource to update
    - **name**: Updated resource name (optional, 1-100 characters)
    - **description**: Updated resource description (optional, max 500 characters)
    - **dependencies**: Updated list of resource IDs this resource depends on (optional)

    Returns the updated resource.
    """
    service = ResourceService(db)
    resource = await service.update_resource(resource_id, data)
    return resource


@router.delete(
    "/resources/{resource_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={
        204: {"description": "Resource deleted successfully"},
        404: {"model": ErrorResponse, "description": "Resource not found"},
        500: {"model": ErrorResponse, "description": "Internal server error"},
    },
)
async def delete_resource(
    resource_id: str,
    cascade: bool = Query(False, description="Delete all downstream dependencies"),
    db: AsyncSession | AsyncIOMotorDatabase = Depends(get_db),
) -> None:
    """
    Delete a resource.

    - **resource_id**: The unique identifier of the resource to delete
    - **cascade**: If true, delete all resources that depend on this resource (default: false)

    Returns 204 No Content on success.
    """
    service = ResourceService(db)
    await service.delete_resource(resource_id, cascade)
    return None


@router.get(
    "/search",
    response_model=list[ResourceResponse],
    status_code=status.HTTP_200_OK,
    responses={
        200: {"description": "Search results in topological order"},
        422: {"model": ErrorResponse, "description": "Circular dependency detected"},
        500: {"model": ErrorResponse, "description": "Internal server error"},
    },
)
async def search_resources(
    q: str | None = Query(None, description="Search query for name or description"),
    db: AsyncSession | AsyncIOMotorDatabase = Depends(get_db),
) -> list[ResourceResponse]:
    """
    Search for resources and return them in topological order.

    Args:
        q: Search query to match against name or description (optional)
        db: Database connection (injected by FastAPI)

    Returns:
        list[ResourceResponse]: List of matching resources in topological order

    Raises:
        ValidationError: If circular dependency is detected in results
        HTTPException: 422 for circular dependencies, 500 for server errors

    Example::

        GET /api/search?q=frontend

    Returns all resources matching "frontend" in name or description,
    ordered so dependencies appear before dependents.

    Parameters:
        - **q**: Search query to match against name or description (optional)

    Note:
        If no query is provided, returns all resources in topological order.
        Dependencies always appear before dependents in the results.
    """
    service = ResourceService(db)
    resources = await service.search_resources(q)
    return resources
