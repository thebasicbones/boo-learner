"""Global exception handlers for FastAPI application"""

import logging

from fastapi import Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError

from app.exceptions import (
    CircularDependencyError,
    DatabaseError,
    NotFoundError,
    ValidationError,
)

# Configure logging
logger = logging.getLogger(__name__)


def register_exception_handlers(app):
    """
    Register all global exception handlers with the FastAPI application.

    Args:
        app: FastAPI application instance
    """

    @app.exception_handler(NotFoundError)
    async def not_found_handler(request: Request, exc: NotFoundError):
        """
        Handle NotFoundError exceptions.
        Returns HTTP 404 with consistent error format.
        """
        logger.warning(
            f"Resource not found: {exc.resource_id} - Path: {request.url.path}",
            extra={"resource_id": exc.resource_id, "path": request.url.path},
        )

        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={
                "error": "NotFoundError",
                "message": str(exc),
                "details": {"resource_id": exc.resource_id},
            },
        )

    @app.exception_handler(ValidationError)
    async def validation_error_handler(request: Request, exc: ValidationError):
        """
        Handle ValidationError exceptions.
        Returns HTTP 422 with consistent error format.
        """
        logger.warning(
            f"Validation error: {exc.message} - Path: {request.url.path}",
            extra={"error_message": exc.message, "details": exc.details, "path": request.url.path},
        )

        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={"error": "ValidationError", "message": exc.message, "details": exc.details},
        )

    @app.exception_handler(CircularDependencyError)
    async def circular_dependency_error_handler(request: Request, exc: CircularDependencyError):
        """
        Handle CircularDependencyError exceptions.
        Returns HTTP 422 with consistent error format.
        """
        logger.warning(
            f"Circular dependency detected: {exc.cycle_path} - Path: {request.url.path}",
            extra={"cycle_path": exc.cycle_path, "path": request.url.path},
        )

        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "error": "CircularDependencyError",
                "message": str(exc),
                "details": {"cycle_path": exc.cycle_path},
            },
        )

    @app.exception_handler(DatabaseError)
    async def database_error_handler(request: Request, exc: DatabaseError):
        """
        Handle DatabaseError exceptions with different error types.
        Maps error_type to appropriate HTTP status codes:
        - connection: HTTP 503
        - timeout: HTTP 503
        - duplicate: HTTP 409
        - general: HTTP 500
        """
        # Determine status code based on error type
        if exc.error_type in ("connection", "timeout"):
            status_code = status.HTTP_503_SERVICE_UNAVAILABLE
            log_level = "error"
        elif exc.error_type == "duplicate":
            status_code = status.HTTP_409_CONFLICT
            log_level = "warning"
        else:  # general or unknown
            status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
            log_level = "error"

        # Log with appropriate level
        log_message = f"Database error ({exc.error_type}): {exc.message} - Path: {request.url.path}"
        if log_level == "error":
            logger.error(
                log_message,
                extra={
                    "error_type": exc.error_type,
                    "message": exc.message,
                    "details": exc.details,
                    "path": request.url.path,
                },
            )
        else:
            logger.warning(
                log_message,
                extra={
                    "error_type": exc.error_type,
                    "message": exc.message,
                    "details": exc.details,
                    "path": request.url.path,
                },
            )

        # Map error_type to legacy error names for backward compatibility
        error_name_map = {
            "connection": "DatabaseConnectionError",
            "timeout": "DatabaseTimeoutError",
            "duplicate": "DuplicateResourceError",
            "general": "DatabaseError",
        }
        error_name = error_name_map.get(exc.error_type, "DatabaseError")

        return JSONResponse(
            status_code=status_code,
            content={
                "error": error_name,
                "message": exc.message,
                "details": {"info": exc.details} if exc.details else {},
            },
        )

    @app.exception_handler(RequestValidationError)
    async def request_validation_error_handler(request: Request, exc: RequestValidationError):
        """
        Handle Pydantic validation errors from request parsing.
        Returns HTTP 422 with consistent error format.
        """
        # Convert Pydantic errors to JSON-serializable format
        errors = []
        for error in exc.errors():
            error_dict = {
                "loc": list(error.get("loc", [])),
                "msg": error.get("msg", ""),
                "type": error.get("type", ""),
            }
            # Only include input if it's JSON serializable
            if "input" in error:
                try:
                    # Try to include the input value
                    error_dict["input"] = error["input"]
                except (TypeError, ValueError):
                    # Skip if not serializable
                    pass
            errors.append(error_dict)

        logger.warning(
            f"Request validation error - Path: {request.url.path}",
            extra={"errors": errors, "path": request.url.path},
        )

        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "error": "ValidationError",
                "message": "Request validation failed",
                "details": {"validation_errors": errors},
            },
        )

    @app.exception_handler(SQLAlchemyError)
    async def sqlalchemy_error_handler(request: Request, exc: SQLAlchemyError):
        """
        Handle SQLAlchemy database errors.
        Returns HTTP 500 without exposing sensitive database details.
        """
        logger.error(
            f"Database error - Path: {request.url.path}",
            exc_info=True,
            extra={"path": request.url.path},
        )

        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": "DatabaseError",
                "message": "A database error occurred",
                "details": {},
            },
        )

    @app.exception_handler(Exception)
    async def generic_exception_handler(request: Request, exc: Exception):
        """
        Handle all other unexpected exceptions.
        Returns HTTP 500 with generic error message.
        """
        logger.error(
            f"Unexpected error - Path: {request.url.path}",
            exc_info=True,
            extra={"path": request.url.path, "error_type": type(exc).__name__},
        )

        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": "InternalServerError",
                "message": "An unexpected error occurred",
                "details": {},
            },
        )
