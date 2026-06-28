# ffmpeg is an apt package (not pip-installable), so we use a Dockerfile rather
# than nixpacks. opencv-python-headless avoids the libGL system-lib rabbit hole.
FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Railway provides $PORT.
ENV PORT=8788
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
