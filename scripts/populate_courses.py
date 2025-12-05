#!/usr/bin/env python3
"""
Populate the database with real-world example courses.
This script creates a comprehensive computer science curriculum with proper dependencies.
"""

import asyncio
import sys
from datetime import datetime, UTC
from pathlib import Path

# Add parent directory to path to import app modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from motor.motor_asyncio import AsyncIOMotorClient
from config.settings import get_settings


async def populate_database():
    """Populate the database with example courses."""
    
    # Get settings
    settings = get_settings()
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.mongodb_database]
    collection = db["resources"]
    
    # Clear existing data
    print("Clearing existing courses...")
    await collection.delete_many({})
    
    # Define real-world courses with dependencies
    courses = [
        # Foundational Courses
        {
            "name": "Introduction to Programming",
            "description": "Learn the fundamentals of programming using Python. Cover variables, loops, functions, and basic data structures.",
            "dependencies": [],
            "completed": False
        },
        {
            "name": "Discrete Mathematics",
            "description": "Study logic, set theory, combinatorics, graph theory, and mathematical proofs essential for computer science.",
            "dependencies": [],
            "completed": False
        },
        {
            "name": "Calculus I",
            "description": "Introduction to differential and integral calculus, limits, derivatives, and applications.",
            "dependencies": [],
            "completed": False
        },
        
        # Second Level
        {
            "name": "Data Structures",
            "description": "Learn arrays, linked lists, stacks, queues, trees, graphs, and hash tables. Understand time and space complexity.",
            "dependencies": ["Introduction to Programming"],
            "completed": False
        },
        {
            "name": "Object-Oriented Programming",
            "description": "Master OOP concepts including classes, inheritance, polymorphism, encapsulation, and design patterns.",
            "dependencies": ["Introduction to Programming"],
            "completed": False
        },
        {
            "name": "Computer Architecture",
            "description": "Understand CPU design, memory hierarchy, instruction sets, and how hardware executes programs.",
            "dependencies": ["Introduction to Programming"],
            "completed": False
        },
        {
            "name": "Linear Algebra",
            "description": "Study vectors, matrices, linear transformations, eigenvalues, and applications in computer science.",
            "dependencies": ["Calculus I"],
            "completed": False
        },
        
        # Third Level
        {
            "name": "Algorithms",
            "description": "Study sorting, searching, dynamic programming, greedy algorithms, and algorithm analysis techniques.",
            "dependencies": ["Data Structures", "Discrete Mathematics"],
            "completed": False
        },
        {
            "name": "Database Systems",
            "description": "Learn relational databases, SQL, normalization, transactions, and database design principles.",
            "dependencies": ["Data Structures"],
            "completed": False
        },
        {
            "name": "Operating Systems",
            "description": "Explore process management, memory management, file systems, and concurrent programming.",
            "dependencies": ["Data Structures", "Computer Architecture"],
            "completed": False
        },
        {
            "name": "Web Development",
            "description": "Build modern web applications using HTML, CSS, JavaScript, and popular frameworks like React or Vue.",
            "dependencies": ["Object-Oriented Programming"],
            "completed": False
        },
        {
            "name": "Software Engineering",
            "description": "Learn software development lifecycle, testing, version control, agile methodologies, and project management.",
            "dependencies": ["Object-Oriented Programming"],
            "completed": False
        },
        
        # Fourth Level
        {
            "name": "Machine Learning",
            "description": "Introduction to supervised and unsupervised learning, neural networks, and practical ML applications.",
            "dependencies": ["Algorithms", "Linear Algebra"],
            "completed": False
        },
        {
            "name": "Computer Networks",
            "description": "Study network protocols, TCP/IP, HTTP, network security, and distributed systems fundamentals.",
            "dependencies": ["Operating Systems"],
            "completed": False
        },
        {
            "name": "Compiler Design",
            "description": "Learn lexical analysis, parsing, semantic analysis, code generation, and optimization techniques.",
            "dependencies": ["Algorithms", "Computer Architecture"],
            "completed": False
        },
        {
            "name": "Mobile App Development",
            "description": "Build native and cross-platform mobile applications for iOS and Android using modern frameworks.",
            "dependencies": ["Object-Oriented Programming", "Web Development"],
            "completed": False
        },
        {
            "name": "Cloud Computing",
            "description": "Learn cloud platforms (AWS, Azure, GCP), containerization, microservices, and serverless architecture.",
            "dependencies": ["Database Systems", "Web Development"],
            "completed": False
        },
        
        # Advanced Level
        {
            "name": "Deep Learning",
            "description": "Advanced neural networks, CNNs, RNNs, transformers, and state-of-the-art deep learning architectures.",
            "dependencies": ["Machine Learning"],
            "completed": False
        },
        {
            "name": "Distributed Systems",
            "description": "Study distributed algorithms, consensus protocols, fault tolerance, and building scalable systems.",
            "dependencies": ["Computer Networks", "Algorithms"],
            "completed": False
        },
        {
            "name": "Cybersecurity",
            "description": "Learn cryptography, network security, ethical hacking, secure coding practices, and threat analysis.",
            "dependencies": ["Computer Networks", "Operating Systems"],
            "completed": False
        },
        {
            "name": "DevOps & CI/CD",
            "description": "Master continuous integration, deployment pipelines, infrastructure as code, and monitoring tools.",
            "dependencies": ["Cloud Computing", "Software Engineering"],
            "completed": False
        },
        {
            "name": "Computer Graphics",
            "description": "Study 3D rendering, shaders, ray tracing, animation, and graphics programming with OpenGL or WebGL.",
            "dependencies": ["Linear Algebra", "Algorithms"],
            "completed": False
        },
        {
            "name": "Natural Language Processing",
            "description": "Process and analyze human language using ML techniques, transformers, and large language models.",
            "dependencies": ["Machine Learning"],
            "completed": False
        },
        {
            "name": "Blockchain Technology",
            "description": "Understand distributed ledgers, smart contracts, consensus mechanisms, and cryptocurrency fundamentals.",
            "dependencies": ["Distributed Systems", "Cybersecurity"],
            "completed": False
        },
    ]
    
    print(f"\nInserting {len(courses)} courses...")
    
    # Create a mapping of course names to IDs for dependency resolution
    course_map = {}
    
    # First pass: Insert all courses without dependencies
    now = datetime.now(UTC)
    for course in courses:
        result = await collection.insert_one({
            "name": course["name"],
            "description": course["description"],
            "dependencies": [],
            "completed": course["completed"],
            "created_at": now,
            "updated_at": now
        })
        course_map[course["name"]] = str(result.inserted_id)
        print(f"  ✓ Added: {course['name']}")
    
    # Second pass: Update dependencies with actual IDs
    print("\nUpdating dependencies...")
    for course in courses:
        if course["dependencies"]:
            dependency_ids = [
                course_map[dep_name] 
                for dep_name in course["dependencies"]
                if dep_name in course_map
            ]
            
            await collection.update_one(
                {"name": course["name"]},
                {"$set": {"dependencies": dependency_ids}}
            )
            print(f"  ✓ Updated dependencies for: {course['name']}")
    
    # Print summary
    total_courses = await collection.count_documents({})
    print(f"\n{'='*60}")
    print(f"✅ Successfully populated database with {total_courses} courses!")
    print(f"{'='*60}")
    
    # Print some statistics
    courses_with_deps = await collection.count_documents({"dependencies": {"$ne": []}})
    foundation_courses = await collection.count_documents({"dependencies": []})
    
    print(f"\nStatistics:")
    print(f"  • Foundation courses (no dependencies): {foundation_courses}")
    print(f"  • Courses with dependencies: {courses_with_deps}")
    print(f"  • Total courses: {total_courses}")
    
    # Close connection
    client.close()
    print("\n🎓 Database is ready! Start the server and explore your learning path.\n")


if __name__ == "__main__":
    asyncio.run(populate_database())
