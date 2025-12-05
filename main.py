"""
boo-learner - FastAPI CRUD Backend
A course learner app
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database_factory import init_database, close_database
from app.routers import resources
from app.error_handlers import register_error_handlers
from config.settings import get_settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifespan events."""
    # Startup
    settings = get_settings()
    await init_database()
    yield
    # Shutdown
    await close_database()


# Create FastAPI application
app = FastAPI(
    title="boo-learner",
    description="A course learner app",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register error handlers
register_error_handlers(app)

# Include routers
app.include_router(resources.router, prefix="/resources", tags=["resources"])


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "Welcome to boo-learner",
        "docs": "/docs",
        "redoc": "/redoc"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}
