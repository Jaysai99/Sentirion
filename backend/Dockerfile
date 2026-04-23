# ── Sentirion Backend ─────────────────────────────────────────────────────────
FROM python:3.11-slim

WORKDIR /app

# System deps needed by lxml and some torch wheels
RUN apt-get update && apt-get install -y --no-install-recommends \
        gcc g++ && \
    rm -rf /var/lib/apt/lists/*

# Install Python dependencies before copying source so layer is cached
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY . .

# SEC filings are persisted via a Docker volume; create the mount point
RUN mkdir -p sec_data

EXPOSE 3001

# HOST=0.0.0.0 makes the server reachable from outside the container
ENV HOST=0.0.0.0
ENV PORT=3001
ENV LOG_LEVEL=INFO

CMD ["python", "app.py"]
