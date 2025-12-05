# boo-learner

A course learner app

## Features

- RESTful API with FastAPI framework
- CRUD operations for resources
- Topological sorting for dependency management
- Resource dependency tracking and validation
- Circular dependency detection
- Cascade delete functionality
- MongoDB database backend with Motor async driver
## Technology Stack

- **Framework**: FastAPI 0.104.1
- **Server**: Uvicorn with ASGI
- **Database**: MongoDB with Motor
- **Validation**: Pydantic 2.5.0
- **Testing**: Pytest, Hypothesis (property-based testing)
- **Code Quality**: Black, Ruff, MyPy
## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd boo_learner
```

2. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Configure environment variables:
```bash
cp .env .env.local
# Edit .env.local with your configuration
```

## Database Setup

### MongoDB

1. Install MongoDB locally or use MongoDB Atlas
2. Update the `.env` file with your MongoDB connection string:
```
MONGODB_URL=mongodb://localhost:27017
MONGODB_DATABASE=boo_learner
```

3. Start MongoDB service (if running locally):
```bash
mongod
```

## Running the Application

Start the development server:
```bash
uvicorn main:app --reload
```

The API will be available at `http://localhost:8000`

## API Documentation

Once the server is running, you can access:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## API Endpoints

### Resources

- `POST /resources` - Create a new resource
- `GET /resources` - List all resources
- `GET /resources/{resource_id}` - Get a specific resource
- `PUT /resources/{resource_id}` - Update a resource
- `DELETE /resources/{resource_id}` - Delete a resource
- `GET /resources/search?q={query}` - Search resources
- `GET /resources/sorted` - Get resources in topological order

## Development

### Running Tests

Run all tests:
```bash
pytest
```

Run with coverage:
```bash
pytest --cov=app --cov-report=html
```

Run property-based tests:
```bash
pytest tests/test_property_*.py
```

### Code Quality

Format code with Black:
```bash
black .
```

Lint with Ruff:
```bash
ruff check .
```

Type check with MyPy:
```bash
mypy app/
```

## Project Structure

```
boo_learner/
├── app/
│   ├── __init__.py
│   ├── models/              # Database models
│   ├── repositories/        # Data access layer
│   ├── routers/            # API endpoints
│   ├── services/           # Business logic
│   ├── database_factory.py # Database factory
│   ├── database_mongodb.py  # Database implementation
│   ├── exceptions.py       # Custom exceptions
│   ├── error_handlers.py   # Error handlers
│   └── schemas.py          # Pydantic schemas
├── config/
│   ├── __init__.py
│   └── settings.py         # Configuration
├── tests/                  # Test suite
├── .env                    # Environment variables
├── main.py                 # Application entry point
├── requirements.txt        # Dependencies
└── README.md              # This file
```

## Architecture

The project follows a layered architecture:

1. **Routers** - API endpoints and request handling
2. **Services** - Business logic and orchestration
3. **Repositories** - Data access layer with abstract interfaces
4. **Models/Schemas** - Data structures and validation

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## License

MIT License

## Author

annu12340 <annujolly17@gmail.com>