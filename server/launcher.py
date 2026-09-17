from __future__ import annotations

import uvicorn

try:
    from server.mail_config import register_mail_config
    from server.public_api import app, init_db
    from server.auth import register_auth
    from server.session_tracking import register_session_tracking
except ModuleNotFoundError:
    # PyInstaller may execute this launcher with server/ as its import root.
    from mail_config import register_mail_config
    from public_api import app, init_db
    from auth import register_auth
    from session_tracking import register_session_tracking

# The auth schema extends the base application schema, so initialize
# the base SQLite tables before creating auth tables and admin-center tables.
init_db()

try:
    import server.admin_center  # noqa: F401 - registers admin control center routes
except ModuleNotFoundError:
    import admin_center  # noqa: F401 - registers admin control center routes

# Load the persistent SMTP configuration before importing/registering auth.
# auth.py reads the SMTP_* variables when sending verification messages.
register_mail_config(app)
register_auth(app)
register_session_tracking(app)


if __name__ == "__main__":
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=8000,
        log_level="info",
    )
