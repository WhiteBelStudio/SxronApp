# SXRON standalone API

SXRON is a standalone application. Telegram is not used for authentication or application startup.

## Local run

```bash
cd server
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Linux/macOS activation:

```bash
source .venv/bin/activate
```

The API is available at `http://127.0.0.1:8000` and its health endpoint is `/health`.

## Frontend

Set the frontend environment variable:

```env
VITE_API_URL=http://127.0.0.1:8000
```

For a production deployment, set `VITE_API_URL` to the public HTTPS address of the deployed SXRON API.

## Authentication

The client generates a persistent anonymous SXRON client ID in local storage and sends it as:

`X-SXRON-Client-ID`

There is no Telegram init data, Telegram WebApp SDK, bot token, or Telegram account dependency.

## Owner

Set `SXRON_OWNER_CLIENT_ID` on the API server to the client ID that should own the application. The owner can manage administrators.

The database is SQLite and should be placed on persistent storage in production by setting `SXRON_DATA_DIR`.
