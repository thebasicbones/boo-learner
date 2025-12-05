"""
Example script to populate the database with sample data
"""
import asyncio
from app.database_mongodb import init_database
from app.database_factory import get_repository
from app.schemas import ResourceCreate


async def populate_data():
    """Populate database with example resources."""
    await init_database()
    repository = get_repository()
    
    # Create sample resources
    resources = [
        ResourceCreate(
            name="Foundation",
            description="Base resource with no dependencies",
            dependencies=[]
        ),
        ResourceCreate(
            name="Core Module",
            description="Depends on Foundation",
            dependencies=[]  # Will be updated after Foundation is created
        ),
        ResourceCreate(
            name="Advanced Feature",
            description="Depends on Core Module",
            dependencies=[]  # Will be updated after Core Module is created
        ),
    ]
    
    created_resources = []
    for resource_data in resources:
        created = await repository.create(resource_data)
        created_resources.append(created)
        print(f"Created: {created.name} (ID: {created.id})")
    
    # Update dependencies
    from app.schemas import ResourceUpdate
    
    await repository.update(
        created_resources[1].id,
        ResourceUpdate(dependencies=[created_resources[0].id])
    )
    print(f"Updated {created_resources[1].name} to depend on {created_resources[0].name}")
    
    await repository.update(
        created_resources[2].id,
        ResourceUpdate(dependencies=[created_resources[1].id])
    )
    print(f"Updated {created_resources[2].name} to depend on {created_resources[1].name}")
    
    print("\nSample data populated successfully!")


if __name__ == "__main__":
    asyncio.run(populate_data())
