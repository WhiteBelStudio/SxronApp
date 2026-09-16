from __future__ import annotations

import uvicorn

try:
    from server.main import app, init_db
    from server.auth import register_auth
    from server.session_tracking import register_session_tracking
except ModuleNotFoundError:
    # PyInstaller may execute this launcher with server/ as its import root.
    from main import app, init_db
    from auth import register_auth
    from session_tracking import register_session_tracking

# The auth schema extends the base application schema, so initialize
# the base SQLite tables before creating auth tables.
init_db()
register_auth(app)
register_session_tracking(app)


if __name__ == "__main__":
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=8000,
        log_level="info",
    )
