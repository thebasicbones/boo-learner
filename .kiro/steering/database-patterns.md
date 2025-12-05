# Database Patterns

## Repository Pattern

All database operations go through repository classes:

- Base interface: `app/repositories/base_resource_repository.py`
- MongoDB implementation: `app/repositories/mongodb_resource_repository.py`
- Factory pattern: `app/database_factory.py`

## Database Connection

- Use dependency injection for database connections
- Connection managed through FastAPI dependencies
- MongoDB client configured in `app/database_mongodb.py`

## Data Access

- Never access database directly from routers
- Use repository methods for all CRUD operations
- Keep database-specific logic in repository layer

## Transactions

- Use MongoDB sessions for multi-document operations
- Ensure proper error handling and rollback

## Schema Design

- Define Pydantic schemas in `app/schemas.py`
- Separate request/response models when needed
- Use validation for all input data
