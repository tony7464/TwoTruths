# Build the React client, then run the API with gunicorn.
FROM node:22-bookworm-slim AS client
WORKDIR /src
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

FROM python:3.12-slim
WORKDIR /app
COPY server/requirements.txt server/requirements.txt
RUN pip install --no-cache-dir -r server/requirements.txt
COPY server/ server/
COPY --from=client /src/dist client/dist
ENV FLASK_DEBUG=0
# Set TRUST_PROXY=1 when this process sits behind a proxy.
RUN useradd --create-home appuser \
    && mkdir -p /app/server/instance \
    && chown appuser:appuser /app/server/instance
USER appuser
WORKDIR /app/server
HEALTHCHECK CMD python -c "import urllib.request,os;urllib.request.urlopen('http://127.0.0.1:%s/api/health' % os.environ.get('PORT','8000'))"
# Listens on PORT, or 8000 if PORT is unset. Publish that same port.
CMD flask db upgrade && gunicorn app:app --bind 0.0.0.0:${PORT:-8000}
