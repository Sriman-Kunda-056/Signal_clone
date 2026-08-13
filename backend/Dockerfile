# Pinned to a stable LTS-ish Python rather than the 3.14 used in local dev —
# all our deps (fastapi, sqlalchemy, bcrypt, python-jose) ship prebuilt
# manylinux wheels for 3.12, so no compiler toolchain is needed in the image.
FROM python:3.12-slim

WORKDIR /app

# Install deps first so this layer is cached across builds that only change
# application code (the common case).
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# On a host with a persistent disk mounted here, the SQLite file survives
# redeploys; otherwise app startup auto-reseeds if the table's empty.
RUN mkdir -p /app/data

EXPOSE 8000

# Render assigns the listen port dynamically via $PORT; falls back to 8000
# for local `docker run` / any host that doesn't set it.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
