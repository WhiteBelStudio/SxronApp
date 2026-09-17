from __future__ import annotations

import os

# Vercel Functions have ephemeral storage. Keep SQLite in /tmp unless a
# persistent data directory is explicitly configured.
os.environ.setdefault("SXRON_DATA_DIR", "/tmp/sxron-data")
os.environ.setdefault("SXRON_CORS_ORIGINS", "*")

from server.main import app as fastapi_app


async def app(scope, receive, send):
    """Route every /api/* request to the FastAPI application.

    Vercel's catch-all Python function receives the original /api path.
    FastAPI defines the routes without the /api prefix, so strip it first.
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
