"""Pytest configuration and shared fixtures for dual-backend testing

This module provides parameterized fixtures that allow tests to run against
both SQLite and MongoDB backends, ensuring backend abstraction transparency.
"""

import os
import socket
from collections.abc import AsyncGenerator

import pytest
from motor.motor_asyncio import AsyncIOMotorClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.models.sqlalchemy_resource import Base
from app.repositories.base_resource_repository import BaseResourceRepository
from app.repositories.mongodb_resource_repository import MongoDBResourceRepository
from app.repositories.sqlalchemy_resource_repository import SQLAlchemyResourceRepository


def is_mongodb_available() -> bool:
    """
    Check if MongoDB is available for testing.

    Returns:
        bool: True if MongoDB is reachable, False otherwise
    """
    mongodb_url = os.getenv("DATABASE_URL", "mongodb://localhost:27017")

    # Parse host and port from URL
    if "://" in mongodb_url:
        host_port = mongodb_url.split("://")[1].split("/")[0]
        if ":" in host_port:
            host, port = host_port.split(":")
            port = int(port)
        else:
            host = host_port
            port = 27017
    else:
        host = "localhost"
        port = 27017

    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(1)
        result = sock.connect_ex((host, port))
        sock.close()
        return result == 0
    except Exception:
        return False


@pytest.fixture(scope="session")
def mongodb_available() -> bool:
    """
    Session-scoped fixture to check MongoDB availability once.

    Returns:
        bool: True if MongoDB is available for testing
    """
    return is_mongodb_available()


@pytest.fixture
async def sqlalchemy_repository() -> AsyncGenerator[SQLAlchemyResourceRepository, None]:
    """
    Create a SQLAlchemy repository with in-memory SQLite database.

    This fixture provides a clean, isolated SQLite database for each test.
    The database is created in memory and disposed after the test completes.

    Yields:
        SQLAlchemyResourceRepository: Repository instance for testing
    """
    # Create in-memory SQLite database
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    # Enable foreign keys and create tables
    async with engine.begin() as conn:
        await conn.exec_driver_sql("PRAGMA foreign_keys=ON")
        await conn.run_sync(Base.metadata.create_all)

    # Create session factory
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    # Provide repository with session
    async with async_session() as session:
        repository = SQLAlchemyResourceRepository(session)
        yield repository

    # Cleanup: dispose engine
    await engine.dispose()


@pytest.fixture
async def mongodb_repository(
    mongodb_available: bool,
) -> AsyncGenerator[MongoDBResourceRepository, None]:
    """
    Create a MongoDB repository with test database.

    This fixture provides a clean, isolated MongoDB database for each test.
    The database is created with a unique name and dropped after the test completes.

    Args:
        mongodb_available: Session fixture indicating MongoDB availability

    Yields:
        MongoDBResourceRepository: Repository instance for testing

    Raises:
        pytest.skip: If MongoDB is not available
    """
    if not mongodb_available:
        pytest.skip("MongoDB is not available for testing")

    # Use unique test database name to avoid conflicts
    mongodb_url = os.getenv("DATABASE_URL", "mongodb://localhost:27017")
    test_db_name = f"fastapi_crud_test_{os.getpid()}"

    # Create MongoDB client and database
    client = AsyncIOMotorClient(mongodb_url)
    db = client[test_db_name]

    # Create indexes for performance
    await db.resources.create_index("name")
    await db.resources.create_index("dependencies")

    # Provide repository
    repository = MongoDBResourceRepository(db)
    yield repository

    # Cleanup: drop test database and close client
    await client.drop_database(test_db_name)
    client.close()


@pytest.fixture(params=["sqlite", "mongodb"])
async def db_backend(
    request: pytest.FixtureRequest,
    sqlalchemy_repository: SQLAlchemyResourceRepository,
    mongodb_repository: MongoDBResourceRepository,
    mongodb_available: bool,
) -> AsyncGenerator[tuple[str, BaseResourceRepository], None]:
    """
    Parameterized fixture that provides both SQLite and MongoDB backends.

    This fixture allows tests to run against both database backends automatically,
    ensuring that both implementations satisfy the same correctness properties.

    Args:
        request: Pytest fixture request object
        sqlalchemy_repository: SQLAlchemy repository fixture
        mongodb_repository: MongoDB repository fixture
        mongodb_available: MongoDB availability check

    Yields:
        tuple[str, BaseResourceRepository]: Tuple of (backend_name, repository)

    Raises:
        pytest.skip: If MongoDB backend is requested but not available
    """
    backend_type = request.param

    if backend_type == "sqlite":
        yield ("sqlite", sqlalchemy_repository)
    elif backend_type == "mongodb":
        if not mongodb_available:
            pytest.skip("MongoDB is not available for testing")
        yield ("mongodb", mongodb_repository)
    else:
        raise ValueError(f"Unknown backend type: {backend_type}")


@pytest.fixture
async def clean_sqlalchemy_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Create a clean SQLAlchemy database session for testing.

    This fixture provides a fresh database session with all tables created.
    Useful for tests that need direct database access.

    Yields:
        AsyncSession: SQLAlchemy async session
    """
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    async with engine.begin() as conn:
        await conn.exec_driver_sql("PRAGMA foreign_keys=ON")
        await conn.run_sync(Base.metadata.create_all)

    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        yield session

    await engine.dispose()


@pytest.fixture
async def clean_mongodb_db(mongodb_available: bool) -> AsyncGenerator[AsyncIOMotorClient, None]:
    """
    Create a clean MongoDB database for testing.

    This fixture provides a fresh MongoDB database with indexes created.
    Useful for tests that need direct database access.

    Args:
        mongodb_available: MongoDB availability check

    Yields:
        AsyncIOMotorClient: MongoDB database instance

    Raises:
        pytest.skip: If MongoDB is not available
    """
    if not mongodb_available:
        pytest.skip("MongoDB is not available for testing")

    mongodb_url = os.getenv("DATABASE_URL", "mongodb://localhost:27017")
    test_db_name = f"fastapi_crud_test_clean_{os.getpid()}"

    client = AsyncIOMotorClient(mongodb_url)
    db = client[test_db_name]

    await db.resources.create_index("name")
    await db.resources.create_index("dependencies")

    yield db

    await client.drop_database(test_db_name)
    client.close()


# Pytest configuration
def pytest_configure(config):
    """
    Configure pytest with custom markers.

    Args:
        config: Pytest configuration object
    """
    config.addinivalue_line("markers", "property: mark test as a property-based test")
    config.addinivalue_line("markers", "integration: mark test as an integration test")
    config.addinivalue_line("markers", "mongodb: mark test as requiring MongoDB")
    config.addinivalue_line("markers", "sqlite: mark test as requiring SQLite")
