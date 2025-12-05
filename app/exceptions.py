"""Custom exception classes for the application"""


class NotFoundError(Exception):
    """Exception raised when a resource is not found"""

    def __init__(self, resource_id: str):
        self.resource_id = resource_id
        super().__init__(f"Resource not found: {resource_id}")


class ValidationError(Exception):
    """Exception raised when validation fails"""

    def __init__(self, message: str, details: dict | None = None):
        self.message = message
        self.details = details or {}
        super().__init__(message)


class CircularDependencyError(Exception):
    """Exception raised when a circular dependency is detected"""

    def __init__(self, cycle_path: list[str]):
        self.cycle_path = cycle_path
        cycle_str = " → ".join(cycle_path)
        super().__init__(f"Circular dependency detected: {cycle_str}")


class DatabaseError(Exception):
    """Database operation error with optional context"""

    def __init__(self, message: str, error_type: str = "general", details: str | None = None):
        self.message = message
        self.error_type = error_type  # "connection", "timeout", "duplicate", "general"
        self.details = details
        super().__init__(message)
