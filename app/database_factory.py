"""
Database factory for creating database connections and repositories
"""
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
def get_repository():
    """Get the appropriate repository based on database type."""
    settings = get_settings()
return MongoDBResourceRepository()
