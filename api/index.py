from __future__ import annotations

import os

# Vercel Functions have ephemeral storage. Keep the SQLite database in /tmp
# when no persistent data directory is configured, so the API can initialize
# and serve requests instead of failing on read-only project files.
os.environ.setdefault("SXRON_DATA_DIR", "/tmp/sxron-data")
os.environ.setdefault("SXRON_CORS_ORIGINS", "*")

from server.main import app as fastapi_app


async def app(scope, receive, send):
    """Expose the existing FastAPI app under Vercel's /api function path.

    Vercel invokes this function for /api/*, while the standalone FastAPI
    application defines routes such as /health and /products. Strip the
    Vercel /api prefix before passing HTTP requests to FastAPI.
    """
    if scope["type"] == "http":
        path = scope.get("path", "")

        if path == "/api":
            scope = dict(scope)
            scope["path"] = "/"
            scope["raw_path"] = b"/"
        elif path.startswith("/api/"):
            scope = dict(scope)
            stripped = path[4:] or "/"
            scope["path"] = stripped
            scope["raw_path"] = stripped.encode("utf-8")

    await fastapi_app(scope, receive, send)


__all__ = ["app"]
