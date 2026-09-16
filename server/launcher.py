from __future__ import annotations

import uvicorn

try:
    from server.main import app
    from server.auth import register_auth
except ModuleNotFoundError:
    # PyInstaller may execute this launcher with server/ as its import root.
    from main import app
    from auth import register_auth

register_auth(app)


if __name__ == "__main__":
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=8000,
        log_level="info",
    )
