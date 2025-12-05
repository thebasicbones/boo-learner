"""Pydantic schemas for request/response validation"""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, field_validator


class ResourceBase(BaseModel):
    """Base schema with shared validation logic for resource operations"""

    @field_validator("name", check_fields=False)
    @classmethod
    def validate_name(cls, v: str | None) -> str | None:
        """Validate that name is not just whitespace"""
        if v is not None:
            if not v.strip():
                raise ValueError("Name cannot be empty or whitespace only")
            return v.strip()
        return v

    @field_validator("description", check_fields=False)
    @classmethod
    def validate_description(cls, v: str | None) -> str | None:
        """Strip whitespace from description"""
        if v is not None:
            stripped = v.strip()
            return stripped if stripped else None
        return v

    @field_validator("dependencies", check_fields=False)
    @classmethod
    def validate_dependencies(cls, v: list[str] | None) -> list[str] | None:
        """Validate that dependencies list contains unique IDs"""
        if v is not None and len(v) != len(set(v)):
            raise ValueError("Dependencies must be unique")
        return v


class ResourceCreate(ResourceBase):
    """Schema for creating a new resource"""

    name: str = Field(
        ..., min_length=1, max_length=100, description="Resource name (required, 1-100 characters)"
    )
    description: str | None = Field(
        None, max_length=500, description="Resource description (optional, max 500 characters)"
    )
    dependencies: list[str] = Field(
        default_factory=list, description="List of resource IDs this resource depends on"
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "name": "Frontend Service",
                    "description": "React-based frontend application",
                    "dependencies": ["backend-api-uuid", "auth-service-uuid"],
                }
            ]
        }
    }


class ResourceUpdate(ResourceBase):
    """Schema for updating an existing resource"""

    name: str | None = Field(
        None, min_length=1, max_length=100, description="Resource name (optional, 1-100 characters)"
    )
    description: str | None = Field(
        None, max_length=500, description="Resource description (optional, max 500 characters)"
    )
    dependencies: list[str] | None = Field(
        None, description="List of resource IDs this resource depends on"
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "name": "Updated Frontend Service",
                    "description": "React-based frontend with new features",
                    "dependencies": ["backend-api-uuid"],
                }
            ]
        }
    }


class ResourceResponse(BaseModel):
    """Schema for resource response"""

    id: str = Field(..., description="Unique resource identifier")
    name: str = Field(..., description="Resource name")
    description: str | None = Field(None, description="Resource description")
    dependencies: list[str] = Field(
        default_factory=list, description="List of resource IDs this resource depends on"
    )
    created_at: datetime = Field(..., description="Resource creation timestamp")
    updated_at: datetime = Field(..., description="Resource last update timestamp")

    model_config = {
        "from_attributes": True,
        "json_schema_extra": {
            "examples": [
                {
                    "id": "550e8400-e29b-41d4-a716-446655440000",
                    "name": "Frontend Service",
                    "description": "React-based frontend application",
                    "dependencies": ["backend-api-uuid", "auth-service-uuid"],
                    "created_at": "2024-01-15T10:30:00Z",
                    "updated_at": "2024-01-15T10:30:00Z",
                }
            ]
        },
    }


class ErrorResponse(BaseModel):
    """Schema for consistent error responses"""

    error: str = Field(..., description="Error type/category")
    message: str = Field(..., description="Human-readable error description")
    details: dict[str, Any] | None = Field(None, description="Additional error details")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "error": "ValidationError",
                    "message": "Invalid resource data provided",
                    "details": {"name": "Name cannot be empty or whitespace only"},
                },
                {
                    "error": "NotFoundError",
                    "message": "Resource not found",
                    "details": {"resource_id": "550e8400-e29b-41d4-a716-446655440000"},
                },
                {
                    "error": "CircularDependencyError",
                    "message": "Circular dependency detected",
                    "details": {"cycle": "A → B → C → A"},
                },
            ]
        }
    }
