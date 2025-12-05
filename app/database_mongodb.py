"""
MongoDB database configuration and connection management
"""
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from config.settings import get_settings

# Global MongoDB client and database
client: AsyncIOMotorClient | None = None
database: AsyncIOMotorDatabase | None = None


async def init_database():
    """Initialize MongoDB connection."""
    global client, database
    
    settings = get_settings()
    
    client = AsyncIOMotorClient(settings.mongodb_url)
    database = client[settings.mongodb_database]
    
    # Create indexes
    await database.resources.create_index("name")
    await database.resources.create_index("dependencies")


async def close_database():
    """Close MongoDB connection."""
    global client
    if client:
        client.close()


def get_db_client() -> AsyncIOMotorDatabase:
    """Get MongoDB database instance."""
    if database is None:
        raise RuntimeError("Database not initialized. Call init_database() first.")
    return database
