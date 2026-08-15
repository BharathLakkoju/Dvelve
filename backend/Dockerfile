FROM python:3.11-slim-bookworm

# weasyprint (PDF export) needs Cairo/Pango/GDK-Pixbuf at the system level —
# these aren't installable via pip. See CLAUDE.md: "don't assume it just works
# cross-platform."
RUN apt-get update && apt-get install -y --no-install-recommends \
    libcairo2 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libgdk-pixbuf2.0-0 \
    libffi-dev \
    shared-mime-info \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Render injects $PORT at runtime and routes traffic to it; default kept for
# local `docker run`.
ENV PORT=8000
EXPOSE 8000

CMD uvicorn main:app --host 0.0.0.0 --port ${PORT}
