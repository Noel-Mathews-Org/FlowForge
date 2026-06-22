FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN addgroup --system workergroup && adduser --system --group workeruser
COPY --chown=workeruser:workergroup . .
USER workeruser
CMD ["python", "worker.py"]

