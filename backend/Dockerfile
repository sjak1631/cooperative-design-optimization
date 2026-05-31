FROM python:3.11-slim

WORKDIR /app

# Install build tools needed for torch/botorch
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ git curl \
    && rm -rf /var/lib/apt/lists/*

# Create a virtualenv (avoids PEP 668 externally-managed issues)
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Upgrade pip inside the venv, then install uv for fast resolution
RUN pip install --no-cache-dir --upgrade pip uv

# Copy project definition first (layer cache)
COPY pyproject.toml ./

# Install all Python dependencies into the venv
RUN uv pip install --no-cache -e .

# Copy application source
COPY app/ ./app/

# Create directory for SQLite database
RUN mkdir -p /data

ENV PYTHONUNBUFFERED=1 \
    DATABASE_URL="sqlite+aiosqlite:////data/study.db"

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
