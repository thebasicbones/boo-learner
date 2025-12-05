#!/bin/bash
# boo-learner - Development Server Startup Script

echo "Starting boo-learner..."
echo "Database: mongodb"
echo ""

# Activate virtual environment if it exists
if [ -d "venv" ]; then
    source venv/bin/activate
fi

# Run the development server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
