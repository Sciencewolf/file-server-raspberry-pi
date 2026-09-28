FROM python:3.13-slim

LABEL org.opencontainers.image.authors="Márton Áron" \
      org.opencontainers.image.title="file-api"

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    DATA_DIR=/app/data

ARG UID=1000
ARG GID=1000
RUN groupadd --gid "${GID}" app \
 && useradd --uid "${UID}" --gid "${GID}" --no-create-home --shell /usr/sbin/nologin app

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
RUN mkdir -p /app/data && chown app:app /app/data

USER app

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/connection', timeout=3)" || exit 1

CMD ["gunicorn", "server:app", \
     "--bind", "0.0.0.0:8080", \
     "--workers", "1", \
     "--threads", "8", \
     "--worker-class", "gthread", \
     "--timeout", "120", \
     "--worker-tmp-dir", "/dev/shm", \
     "--access-logfile", "-"]