"""Integration tests for API endpoints

These tests use parameterized fixtures to run against both SQLite and MongoDB,
ensuring the API layer works correctly with both backends.
"""

import os

import pytest
from httpx import AsyncClient
from motor.motor_asyncio import AsyncIOMotorClient

from app.database_factory import get_db
from app.database_sqlalchemy import AsyncSessionLocal, drop_sqlalchemy_db, init_sqlalchemy_db
from main import app


@pytest.fixture(params=["sqlite", "mongodb"])
async def client(request, mongodb_available):
    """Create a test client with database dependency override for both backends"""
    backend = request.param

    if backend == "sqlite":
        # Setup SQLite
        await drop_sqlalchemy_db()
        await init_sqlalchemy_db()

        async def override_get_db():
            async with AsyncSessionLocal() as session:
                yield session

        app.dependency_overrides[get_db] = override_get_db

        async with AsyncClient(app=app, base_url="http://test") as ac:
            yield ac

        app.dependency_overrides.clear()
        await drop_sqlalchemy_db()

    elif backend == "mongodb":
        if not mongodb_available:
            pytest.skip("MongoDB is not available for testing")

        # Setup MongoDB
        mongodb_url = os.getenv("DATABASE_URL", "mongodb://localhost:27017")
        test_db_name = f"fastapi_crud_test_api_{os.getpid()}"

        client_instance = AsyncIOMotorClient(mongodb_url)
        db = client_instance[test_db_name]

        # Create indexes
        await db.resources.create_index("name")
        await db.resources.create_index("dependencies")

        async def override_get_db():
            yield db

        app.dependency_overrides[get_db] = override_get_db

        async with AsyncClient(app=app, base_url="http://test") as ac:
            yield ac

        app.dependency_overrides.clear()

        # Cleanup
        await client_instance.drop_database(test_db_name)
        client_instance.close()


@pytest.mark.asyncio
async def test_create_resource(client: AsyncClient):
    """Test POST /api/resources endpoint"""
    response = await client.post(
        "/api/resources",
        json={"name": "Test Resource", "description": "A test resource", "dependencies": []},
    )

    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Test Resource"
    assert data["description"] == "A test resource"
    assert "id" in data
    assert "created_at" in data


@pytest.mark.asyncio
async def test_list_resources(client: AsyncClient):
    """Test GET /api/resources endpoint"""
    # Create a resource first
    await client.post("/api/resources", json={"name": "Resource 1", "dependencies": []})

    # List all resources
    response = await client.get("/api/resources")

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1


@pytest.mark.asyncio
async def test_get_resource(client: AsyncClient):
    """Test GET /api/resources/{id} endpoint"""
    # Create a resource first
    create_response = await client.post(
        "/api/resources", json={"name": "Resource 1", "dependencies": []}
    )
    resource_id = create_response.json()["id"]

    # Get the resource
    response = await client.get(f"/api/resources/{resource_id}")

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == resource_id
    assert data["name"] == "Resource 1"


@pytest.mark.asyncio
async def test_get_nonexistent_resource(client: AsyncClient):
    """Test GET /api/resources/{id} with non-existent ID"""
    response = await client.get("/api/resources/nonexistent-id")

    assert response.status_code == 404
    data = response.json()
    assert data["error"] == "NotFoundError"
    assert "message" in data
    assert "details" in data


@pytest.mark.asyncio
async def test_update_resource(client: AsyncClient):
    """Test PUT /api/resources/{id} endpoint"""
    # Create a resource first
    create_response = await client.post(
        "/api/resources", json={"name": "Original Name", "dependencies": []}
    )
    resource_id = create_response.json()["id"]

    # Update the resource
    response = await client.put(f"/api/resources/{resource_id}", json={"name": "Updated Name"})

    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Updated Name"


@pytest.mark.asyncio
async def test_delete_resource(client: AsyncClient):
    """Test DELETE /api/resources/{id} endpoint"""
    # Create a resource first
    create_response = await client.post(
        "/api/resources", json={"name": "To Delete", "dependencies": []}
    )
    resource_id = create_response.json()["id"]

    # Delete the resource
    response = await client.delete(f"/api/resources/{resource_id}")

    assert response.status_code == 204

    # Verify it's deleted
    get_response = await client.get(f"/api/resources/{resource_id}")
    assert get_response.status_code == 404


@pytest.mark.asyncio
async def test_search_resources(client: AsyncClient):
    """Test GET /api/search endpoint"""
    # Create some resources
    await client.post("/api/resources", json={"name": "Database", "dependencies": []})
    await client.post("/api/resources", json={"name": "API Server", "dependencies": []})

    # Search for resources
    response = await client.get("/api/search?q=Database")

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


@pytest.mark.asyncio
async def test_search_with_topological_sort(client: AsyncClient):
    """Test that search returns results in topological order"""
    # Create resources with dependencies
    db_response = await client.post("/api/resources", json={"name": "Database", "dependencies": []})
    db_id = db_response.json()["id"]

    api_response = await client.post(
        "/api/resources", json={"name": "API", "dependencies": [db_id]}
    )
    api_id = api_response.json()["id"]

    await client.post("/api/resources", json={"name": "Frontend", "dependencies": [api_id]})

    # Search (empty query returns all in topological order)
    response = await client.get("/api/search")

    assert response.status_code == 200
    data = response.json()

    # Verify topological order: Database -> API -> Frontend
    names = [r["name"] for r in data]
    assert names.index("Database") < names.index("API")
    assert names.index("API") < names.index("Frontend")


@pytest.mark.asyncio
async def test_cascade_delete(client: AsyncClient):
    """Test DELETE with cascade parameter"""
    # Create resources with dependencies
    db_response = await client.post("/api/resources", json={"name": "Database", "dependencies": []})
    db_id = db_response.json()["id"]

    api_response = await client.post(
        "/api/resources", json={"name": "API", "dependencies": [db_id]}
    )
    api_id = api_response.json()["id"]

    # Delete with cascade
    response = await client.delete(f"/api/resources/{db_id}?cascade=true")

    assert response.status_code == 204

    # Verify both are deleted
    db_get = await client.get(f"/api/resources/{db_id}")
    assert db_get.status_code == 404

    api_get = await client.get(f"/api/resources/{api_id}")
    assert api_get.status_code == 404


@pytest.mark.asyncio
async def test_invalid_data_returns_422(client: AsyncClient):
    """Test that invalid data returns 422 status code"""
    response = await client.post(
        "/api/resources", json={"name": "", "dependencies": []}  # Empty name
    )

    assert response.status_code == 422
