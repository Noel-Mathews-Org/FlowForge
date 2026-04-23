FROM python:3.12-slim AS builder
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt


FROM python:3.12-slim AS runner
WORKDIR /app

COPY --from=builder /install /usr/local


RUN addgroup --system stgroup && adduser --system --group stuser
COPY --chown=stuser:stgroup . .

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

USER stuser

EXPOSE 8003
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8003"]
