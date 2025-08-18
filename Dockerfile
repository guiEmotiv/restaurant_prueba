FROM python:3.12-alpine

WORKDIR /app

# Install system deps
RUN apk add --no-cache curl bash

# Install Python deps
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ ./backend/

# Copy frontend build (for production)
COPY frontend/dist/ ./frontend/dist/

# Create data directory
RUN mkdir -p /app/data

# Environment
ENV PYTHONPATH=/app/backend

EXPOSE 8000

# Command
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "--workers", "2", "--reload", "backend.wsgi:application"]