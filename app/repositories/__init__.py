"""Data Access Repositories"""

from app.repositories.base_resource_repository import BaseResourceRepository
from app.repositories.sqlalchemy_resource_repository import SQLAlchemyResourceRepository

__all__ = ["SQLAlchemyResourceRepository", "BaseResourceRepository"]
