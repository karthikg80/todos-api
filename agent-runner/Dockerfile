FROM python:3.11-slim

WORKDIR /app

# Install dependencies first for better layer caching
COPY agent-runner/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy agent-runner source
COPY agent-runner/ .

# Default command — overridden per Railway service via startCommand
CMD ["python", "main.py", "daily"]
