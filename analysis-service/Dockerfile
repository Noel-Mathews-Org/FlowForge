# analysis-service
FROM python:3.11-slim AS builder
WORKDIR /app
COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --prefix=/install -r requirements.txt
    
    
FROM python:3.11-slim AS runner
WORKDIR /app
COPY --from=builder /install /usr/local
RUN addgroup --system stgroup && adduser --system --group stuser
ENV MPLCONFIGDIR=/tmp/matplotlib
RUN mkdir -p /tmp/matplotlib && chown -R stuser:stgroup /tmp/matplotlib
COPY --chown=stuser:stgroup . .
USER stuser
EXPOSE 8004
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8004"]
