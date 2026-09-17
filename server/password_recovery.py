from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

import server.auth as auth
import server.main as base

RECOVERY_TTL_SECONDS = int(__import__("os").getenv("SXRON_OWNER_RECOVERY_TTL", "900"))


def _utc() -> datetime:
    return datetime.now(timezone.utc)


def _iso(value: datetime) -> str:
    return value.isoformat()


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _ensure_schema() -> None:
    with base.db() as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS owner_recovery_tokens (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                token_hash TEXT NOT NULL UNIQUE,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                used_at TEXT,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            )
            """
        )
        connection.execute(
            "CREATE INDEX IF NOT EXISTS idx_owner_recovery_tokens_user ON owner_recovery_tokens(user_id, created_at)"
        )


class RecoveryStart(BaseModel):
    email: str = Field(min_length=3, max_length=254)


class RecoveryVerify(BaseModel):
    challenge_id: str = Field(min_length=10, max_length=200)
    code: str = Field(pattern=r"^\d{6}$")


class RecoveryReset(BaseModel):
    reset_token: str = Field(min_length=40, max_length=200)
    password: str = Field(min_length=8, max_length=128)


def register(app: FastAPI) -> None:
    _ensure_schema()

    @app.post("/auth/recovery/start")
    def recovery_start(data: RecoveryStart) -> dict[str, Any]:
        email = auth._normalize_email(data.email)
        with base.db() as connection:
            owner = connection.execute(
                "SELECT * FROM users WHERE email = ? AND email_verified = 1",
                (email,),
            ).fetchone()

            # Deliberately do not reveal whether this email belongs to the owner.
            if not owner or not base.is_owner(owner):
                return {
                    "accepted": True,
                    "message": "Если адрес принадлежит владельцу SXRON, код восстановления будет отправлен.",
                }

            recent = connection.execute(
                "SELECT created_at FROM auth_challenges WHERE destination = ? AND purpose = 'owner_recovery' ORDER BY created_at DESC LIMIT 1",
                (email,),
            ).fetchone()
            if recent:
                try:
                    elapsed = (_utc() - datetime.fromisoformat(recent["created_at"])).total_seconds()
                    if elapsed < auth.RESEND_SECONDS:
                        raise HTTPException(
                            status_code=429,
                            detail=f"Повторная отправка доступна через {auth.RESEND_SECONDS} секунд",
                        )
                except ValueError:
                    pass

            code = auth._code()
            salt = secrets.token_hex(16)
            challenge_id = secrets.token_urlsafe(24)
            created = _utc()
            connection.execute(
                "INSERT INTO auth_challenges(id, client_id, user_id, channel, purpose, destination, code_hash, code_salt, created_at, expires_at) VALUES (?, ?, ?, 'email', 'owner_recovery', ?, ?, ?, ?, ?)",
                (
                    challenge_id,
                    "owner-recovery",
                    owner["id"],
                    email,
                    auth._hash_code(code, salt),
                    salt,
                    _iso(created),
                    _iso(created + timedelta(seconds=auth.CODE_TTL_SECONDS)),
                ),
            )
            auth._send_email(email, code)

            response: dict[str, Any] = {
                "accepted": True,
                "challenge_id": challenge_id,
                "destination": email,
                "expires_in": auth.CODE_TTL_SECONDS,
            }
            if auth.DEBUG_AUTH:
                response["debug_code"] = code
            return response

    @app.post("/auth/recovery/verify")
    def recovery_verify(data: RecoveryVerify) -> dict[str, Any]:
        with base.db() as connection:
            challenge = connection.execute(
                "SELECT * FROM auth_challenges WHERE id = ? AND purpose = 'owner_recovery'",
                (data.challenge_id,),
            ).fetchone()
            if not challenge or challenge["consumed_at"]:
                raise HTTPException(status_code=400, detail="Код недействителен")
            if datetime.fromisoformat(challenge["expires_at"]) <= _utc():
                raise HTTPException(status_code=400, detail="Срок действия кода истёк")
            if challenge["attempts"] >= auth.MAX_ATTEMPTS:
                raise HTTPException(status_code=429, detail="Слишком много попыток")
            if not secrets.compare_digest(
                auth._hash_code(data.code, challenge["code_salt"]),
                challenge["code_hash"],
            ):
                connection.execute(
                    "UPDATE auth_challenges SET attempts = attempts + 1 WHERE id = ?",
                    (data.challenge_id,),
                )
                raise HTTPException(status_code=400, detail="Неверный код")

            user = connection.execute(
                "SELECT * FROM users WHERE id = ?",
                (challenge["user_id"],),
            ).fetchone()
            if not user or not base.is_owner(user) or not user["email_verified"]:
                raise HTTPException(status_code=403, detail="Восстановление владельца недоступно")

            connection.execute(
                "UPDATE auth_challenges SET consumed_at = ? WHERE id = ?",
                (_iso(_utc()), data.challenge_id),
            )

            raw_token = secrets.token_urlsafe(48)
            now = _utc()
            connection.execute(
                "INSERT INTO owner_recovery_tokens(user_id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?)",
                (
                    user["id"],
                    _hash_token(raw_token),
                    _iso(now),
                    _iso(now + timedelta(seconds=RECOVERY_TTL_SECONDS)),
                ),
            )

            return {
                "verified": True,
                "reset_token": raw_token,
                "expires_in": RECOVERY_TTL_SECONDS,
            }

    @app.post("/auth/recovery/reset")
    def recovery_reset(data: RecoveryReset) -> dict[str, Any]:
        with base.db() as connection:
            token_hash = _hash_token(data.reset_token)
            recovery = connection.execute(
                "SELECT * FROM owner_recovery_tokens WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?",
                (token_hash, _iso(_utc())),
            ).fetchone()
            if not recovery:
                raise HTTPException(status_code=401, detail="Ссылка восстановления недействительна или истекла")

            user = connection.execute(
                "SELECT * FROM users WHERE id = ?",
                (recovery["user_id"],),
            ).fetchone()
            if not user or not base.is_owner(user):
                raise HTTPException(status_code=403, detail="Восстановление владельца недоступно")

            password_hash, password_salt = auth._hash_password(data.password)
            now = _iso(_utc())
            connection.execute(
                "UPDATE users SET password_hash = ?, password_salt = ?, email_verified = 1, auth_method = 'owner', last_seen_at = ? WHERE id = ?",
                (password_hash, password_salt, now, user["id"]),
            )
            connection.execute(
                "UPDATE owner_recovery_tokens SET used_at = ? WHERE id = ?",
                (now, recovery["id"]),
            )
            connection.execute(
                "UPDATE auth_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL",
                (now, user["id"]),
            )
            connection.execute(
                "INSERT OR IGNORE INTO admins(user_id, added_at) VALUES (?, ?)",
                (user["id"], now),
            )

            fresh_user = connection.execute(
                "SELECT * FROM users WHERE id = ?",
                (user["id"],),
            ).fetchone()
            session_token = auth._session(connection, fresh_user["id"], True)
            return {
                "authenticated": True,
                "session_token": session_token,
                "user_id": fresh_user["id"],
                "message": "Пароль владельца изменён. Все старые сессии завершены.",
            }


register_app = register
register_app(base.app)
