from __future__ import annotations

import os

# Vercel Functions have ephemeral storage. Keep the SQLite database in /tmp
# when no persistent data directory is configured, so the API can initialize
# and serve requests instead of failing on read-only project files.
os.environ.setdefault("SXRON_DATA_DIR", "/tmp/sxron-data")
os.environ.setdefault("SXRON_CORS_ORIGINS", "*")

from server.main import app

__all__ = ["app"]
