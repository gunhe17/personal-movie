FROM python:3.11-slim

WORKDIR /app

# Install uv
RUN pip install uv

# Copy all files (including app directory for build)
COPY . .

# Install dependencies
RUN uv sync

# Expose port
EXPOSE 8000

# Run application (use uv run to activate venv)
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
