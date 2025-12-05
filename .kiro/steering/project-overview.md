# Project Overview

This is a FastAPI-based resource management system with MongoDB backend.

## Architecture

- **Framework**: FastAPI
- **Database**: MongoDB
- **Structure**: Repository pattern with services layer
- **API**: RESTful endpoints for resource management with dependency tracking

## Key Components

- `app/routers/`: API route handlers
- `app/services/`: Business logic layer
- `app/repositories/`: Data access layer
- `app/models/`: Data models
- `app/schemas.py`: Pydantic schemas for validation
- `config/settings.py`: Application configuration

## Development Standards

- Use type hints for all function parameters and return values
- Follow PEP 8 style guidelines
- Keep business logic in services, not routers
- Use dependency injection for database connections
- Write descriptive docstrings for classes and functions

## Testing

- Tests are located in `tests/` directory
- Use pytest for testing
- Run tests with: `pytest`
- Configuration in `pytest.ini`

## Running the Application

- Start server: `./run.sh` or `uvicorn main:app --reload`
- API docs available at: `/docs` (Swagger UI)
- Frontend available at: `/` (static files)
