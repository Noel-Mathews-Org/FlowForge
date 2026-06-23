# notification-worker
FROM python:3.12-slim AS builder
WORKDIR /app
COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --prefix=/install -r requirements.txt

FROM python:3.12-slim AS runner
WORKDIR /app
COPY --from=builder /install /usr/local
RUN addgroup --system workergroup && adduser --system --group workeruser
COPY --chown=workeruser:workergroup . .
USER workeruser
CMD ["python", "worker.py"]

