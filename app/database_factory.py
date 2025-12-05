"""
Database factory for creating database connections and repositories
"""
from motor.motor_asyncio import AsyncIOMotorDatabase
from config.settings import get_settings

from app.database_mongodb import (
    init_database as init_mongodb,
    close_database as close_mongodb,
    get_db_client
)
from app.repositories.mongodb_resource_repository import MongoDBResourceRepository

async def init_database():
    """Initialize the database connection."""
    settings = get_settings()
    await init_mongodb()

async def close_database():
    """Close the database connection."""
    await close_mongodb()

def get_db() -> AsyncIOMotorDatabase:
    """
    Get database connection for dependency injection.
    
    Returns:
        AsyncIOMotorDatabase: MongoDB database instance
    """
    return get_db_client()

def get_repository(db: AsyncIOMotorDatabase) -> MongoDBResourceRepository:
    """
    Get the MongoDB repository instance.
    
    Args:
        db: MongoDB database instance
        
    Returns:
        MongoDBResourceRepository: Repository instance for database operations
    """
    return MongoDBResourceRepository(db)
