"""Data Access Repositories"""

from app.repositories.base_resource_repository import BaseResourceRepository
from app.repositories.mongodb_resource_repository import MongoDBResourceRepository

__all__ = ["MongoDBResourceRepository", "BaseResourceRepository"]
