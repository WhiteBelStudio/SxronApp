from __future__ import annotations

import secrets
import string
from datetime import datetime, timezone

from fastapi import Header, HTTPException

import server.auth as auth
import server.main as base

BOOTSTRAP_ID = "owner-password-1.2.0"
PASSWORD_ALPHABET = string.ascii_letters + string.digits


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _owner_from_session(authorization: str | None):
    token = authorization[7:].strip() if authorization and authorization.lower().startswith("bearer ") else None
    with base.db() as connection:
        user = auth._user_by_session(connection, token)
    if not base.is_owner(user):
        raise HTTPException(status_code=403, detail="Доступ только для владельца")
    return user, token


def register(app) -> None:
    base.init_db()
    with base.db() as connection:
        connection.execute(
            "CREATE TABLE IF NOT EXISTS sxron_bootstrap_markers (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL)"
        )

    @app.post("/auth/owner/bootstrap")
    def owner_bootstrap(authorization: str | None = Header(default=None)) -> dict[str, object]:
        user, _ = _owner_from_session(authorization)
        with base.db() as connection:
            marker = connection.execute(
                "SELECT 1 FROM sxron_bootstrap_markers WHERE id = ?",
                (BOOTSTRAP_ID,),
            ).fetchone()
            if marker:
                return {"initialized": False}

            alphabet = PASSWORD_ALPHABET
            password = "SXRON-" + "".join(secrets.choice(alphabet) for _ in range(18)) + "!7"
            password_hash, password_salt = auth._hash_password(password)
            timestamp = _now()
            connection.execute(
                "UPDATE users SET password_hash = ?, password_salt = ?, email_verified = 1, auth_method = 'owner', last_seen_at = ? WHERE id = ?",
                (password_hash, password_salt, timestamp, user["id"]),
            )
            connection.execute(
                "UPDATE auth_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL",
                (timestamp, user["id"]),
            )
            connection.execute(
                "INSERT OR IGNORE INTO admins(user_id, added_at) VALUES (?, ?)",
                (user["id"], timestamp),
            )
            connection.execute(
                "INSERT INTO sxron_bootstrap_markers(id, applied_at) VALUES (?, ?)",
                (BOOTSTRAP_ID, timestamp),
            )
            session_token = auth._session(connection, user["id"], True)

            return {
                "initialized": True,
                "email": auth.OWNER_EMAIL,
                "password": password,
                "session_token": session_token,
                "message": "Пароль владельца 1.2.0 установлен один раз. Сохраните его.",
            }


register(base.app)
