from __future__ import annotations

import os

import uvicorn

try:
    import server.auth as auth_module
    from server.mail_config import register_mail_config
    from server.public_api import app, init_db
    from server.main import db
    from server.auth import register_auth
    from server.session_tracking import register_session_tracking
except ModuleNotFoundError:
    # PyInstaller may execute this launcher with server/ as its import root.
    import auth as auth_module
    from mail_config import register_mail_config
    from public_api import app, init_db
    from main import db
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

# Never let a legacy fallback password overwrite a password already stored in DB.
owner_email = os.getenv("SXRON_OWNER_EMAIL", auth_module.OWNER_EMAIL).strip().lower()
env_password_hash = os.getenv("SXRON_OWNER_PASSWORD_HASH", "").strip()
env_password_salt = os.getenv("SXRON_OWNER_PASSWORD_SALT", "").strip()
with db() as connection:
    existing_owner = connection.execute(
        "SELECT password_hash, password_salt FROM users WHERE email = ?",
        (owner_email,),
    ).fetchone()

if existing_owner and existing_owner["password_hash"] and existing_owner["password_salt"]:
    auth_module.OWNER_PASSWORD_HASH = existing_owner["password_hash"]
    auth_module.OWNER_PASSWORD_SALT = existing_owner["password_salt"]
else:
    auth_module.OWNER_PASSWORD_HASH = env_password_hash
    auth_module.OWNER_PASSWORD_SALT = env_password_salt

register_auth(app)

# Public API historically carried its own version constant; override it with
# the actual packaged release version before health/version endpoints are used.
try:
    import server.release_version  # noqa: F401
except ModuleNotFoundError:
    import release_version  # noqa: F401

try:
    from server.password_recovery import register as register_password_recovery
except ModuleNotFoundError:
    from password_recovery import register as register_password_recovery

try:
    import server.owner_bootstrap  # noqa: F401 - registers the one-time 1.2.0 owner password bootstrap
except ModuleNotFoundError:
    import owner_bootstrap  # noqa: F401

register_session_tracking(app)


if __name__ == "__main__":
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=8000,
        log_level="info",
    )
