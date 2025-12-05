# Coding Standards

## Python Style

- Follow PEP 8 conventions
- Use 4 spaces for indentation
- Maximum line length: 88 characters (Black formatter standard)
- Use meaningful variable and function names

## Type Hints

Always use type hints:
```python
def process_resource(resource_id: str, data: dict) -> Resource:
    pass
```

## Error Handling

- Use custom exceptions from `app/exceptions.py`
- Handle errors in `app/error_handlers.py`
- Return appropriate HTTP status codes

## Async/Await

- Use async/await for I/O operations
- Database operations should be async
- API endpoints should be async

## Documentation

- Add docstrings to all public functions and classes
- Use Google-style docstrings
- Document parameters, return values, and exceptions

## Imports

- Group imports: standard library, third-party, local
- Use absolute imports from project root
- Avoid circular imports
