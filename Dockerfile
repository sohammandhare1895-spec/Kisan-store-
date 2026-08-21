# ═══════════════════════════════════════════════════════════════
# Kisan Store — Dockerfile
# Ships the Flask backend + the static website in one container.
# The Flask app serves /api/* endpoints AND the site itself, so the
# browser switches to server-backed mode automatically.
#
#   docker compose up --build   →  http://localhost:8000
# ═══════════════════════════════════════════════════════════════

FROM python:3.12-slim

WORKDIR /app

# System deps: none beyond the base image — Flask is pure Python.
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

# The whole repo (site + data + backend). The front-end also works
# from this container when served over HTTP.
COPY . /app

# Uploads live outside the code for easy volume mounting.
RUN mkdir -p /app/uploads

ENV PORT=8000 \
    PYTHONPATH=/app/backend \
    PYTHONUNBUFFERED=1

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health')" || exit 1

CMD ["python", "backend/app.py"]
