from __future__ import annotations

import hashlib
import os
import re
import secrets
import smtplib
import sqlite3
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from typing import Any

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

CODE_TTL_SECONDS = int(os.getenv("SXRON_AUTH_CODE_TTL", "300"))
RESEND_SECONDS = int(os.getenv("SXRON_AUTH_RESEND_SECONDS", "60"))
MAX_ATTEMPTS = int(os.getenv("SXRON_AUTH_MAX_ATTEMPTS", "5"))
SESSION_DAYS = int(os.getenv("SXRON_AUTH_SESSION_DAYS", "30"))
DEBUG_AUTH = os.getenv("SXRON_AUTH_DEBUG", "false").lower() in {"1", "true", "yes"}

EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
PHONE_RE = re.compile(r"^\+[1-9]\d{7,14}$")


def _utc() -> datetime:
    return datetime.now(timezone.utc)


def _iso(value: datetime) -> str:
    return value.isoformat()


def _normalize_email(value: str) -> str:
    value = value.strip().lower()
    if not EMAIL_RE.fullmatch(value) or len(value) > 254:
        raise HTTPException(status_code=400, detail="Введите корректный email")
    return value


def _normalize_phone(value: str) -> str:
    value = value.strip().replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
    if value.startswith("00"):
        value = "+" + value[2:]
    if not PHONE_RE.fullmatch(value):
        raise HTTPException(status_code=400, detail="Введите номер в международном формате, например +79991234567")
    return value


def _hash_code(code: str, salt: str) -> str:
    return hashlib.sha256(f"{salt}:{code}".encode("utf-8")).hexdigest()


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def _ensure_schema(db: Any) -> None:
    columns = {row[1] for row in db.execute("PRAGMA table_info(users)").fetchall()}
    additions = {
        "email": "TEXT",
        "email_verified": "INTEGER NOT NULL DEFAULT 0",
        "phone": "TEXT",
        "phone_verified": "INTEGER NOT NULL DEFAULT 0",
        "auth_method": "TEXT",
    }
    for name, definition in additions.items():
        if name not in columns:
            db.execute(f"ALTER TABLE users ADD COLUMN {name} {definition}")

    db.executescript(
        """
        CREATE TABLE IF NOT EXISTS auth_challenges (
            id TEXT PRIMARY KEY,
            client_id TEXT,
            user_id INTEGER,
            channel TEXT NOT NULL,
            purpose TEXT NOT NULL,
            destination TEXT NOT NULL,
            code_hash TEXT NOT NULL,
            code_salt TEXT NOT NULL,
            attempts INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            consumed_at TEXT,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_auth_challenges_destination
        ON auth_challenges(destination, purpose, created_at);

        CREATE TABLE IF NOT EXISTS auth_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            token_hash TEXT NOT NULL UNIQUE,
            created_at TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            revoked_at TEXT,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        """
    )


def _send_email(destination: str, code: str) -> None:
    mode = os.getenv("SXRON_EMAIL_MODE", "smtp").lower()
    if mode == "console":
        print(f"[SXRON AUTH] EMAIL {destination}: {code}", flush=True)
        return

    host = os.getenv("SMTP_HOST", "").strip()
    username = os.getenv("SMTP_USERNAME", "").strip()
    password = os.getenv("SMTP_PASSWORD", "")
    sender = os.getenv("SMTP_FROM", username).strip()
    port = int(os.getenv("SMTP_PORT", "587"))
    use_tls = os.getenv("SMTP_USE_TLS", "true").lower() in {"1", "true", "yes"}

    if not host or not sender:
        raise HTTPException(status_code=503, detail="Почтовый сервер не настроен")

    message = EmailMessage()
    message["Subject"] = "Код подтверждения SXRON"
    message["From"] = sender
    message["To"] = destination
    message.set_content(
        f"Ваш код подтверждения SXRON: {code}\n\n"
        f"Код действует {CODE_TTL_SECONDS // 60} минут. Никому его не сообщайте."
    )

    try:
        with smtplib.SMTP(host, port, timeout=20) as smtp:
            if use_tls:
                smtp.starttls()
            if username:
                smtp.login(username, password)
            smtp.send_message(message)
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Не удалось отправить код на email") from exc


def _send_sms(destination: str, code: str) -> None:
    mode = os.getenv("SXRON_SMS_MODE", "twilio").lower()
    if mode == "console":
        print(f"[SXRON AUTH] SMS {destination}: {code}", flush=True)
        return

    sid = os.getenv("TWILIO_ACCOUNT_SID", "").strip()
    token = os.getenv("TWILIO_AUTH_TOKEN", "")
    sender = os.getenv("TWILIO_FROM", "").strip()
    if not sid or not token or not sender:
        raise HTTPException(status_code=503, detail="SMS-провайдер не настроен")

    url = f"https://api.twilio.com/2010-04-01/Accounts/{urllib.parse.quote(sid)}/Messages.json"
    body = urllib.parse.urlencode(
        {
            "From": sender,
            "To": destination,
            "Body": f"SXRON: код подтверждения {code}. Действует {CODE_TTL_SECONDS // 60} минут.",
        }
    ).encode("utf-8")
    request = urllib.request.Request(url, data=body, method="POST")
    auth = (f"{sid}:{token}").encode("utf-8")
    import base64
    request.add_header("Authorization", "Basic " + base64.b64encode(auth).decode("ascii"))
    request.add_header("Content-Type", "application/x-www-form-urlencoded")

    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            if response.status >= 300:
                raise RuntimeError("Twilio rejected the request")
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Не удалось отправить SMS-код") from exc


def _delivery(channel: str, destination: str, code: str) -> None:
    if channel == "email":
        _send_email(destination, code)
    else:
        _send_sms(destination, code)


def _public_user(db: Any, user: sqlite3.Row) -> dict[str, Any]:
    listings = db.execute(
        "SELECT COUNT(*) FROM products WHERE created_by = ?", (user["id"],)
    ).fetchone()[0]
    active = db.execute(
        "SELECT COUNT(*) FROM products WHERE created_by = ? AND available = 1", (user["id"],)
    ).fetchone()[0]
    return {
        "id": user["id"],
        "username": user["username"],
        "first_name": user["first_name"],
        "last_name": user["last_name"],
        "avatar_url": user["avatar_url"],
        "email": user["email"],
        "email_verified": bool(user["email_verified"]),
        "phone": user["phone"],
        "phone_verified": bool(user["phone_verified"]),
        "city": None,
        "created_at": user["created_at"],
        "bio": user["bio"],
        "listings_count": listings,
        "active_listings_count": active,
        "sold_count": 0,
        "views_count": 0,
        "rating": None,
        "reviews_count": 0,
        "last_seen_at": user["last_seen_at"],
        "is_online": True,
        "verified": bool(user["phone_verified"]),
    }


def _session(db: Any, user_id: int) -> str:
    token = secrets.token_urlsafe(48)
    now = _utc()
    db.execute(
        "INSERT INTO auth_sessions(user_id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?)",
        (user_id, _hash_token(token), _iso(now), _iso(now + timedelta(days=SESSION_DAYS))),
    )
    return token


def _user_by_session(db: Any, token: str | None) -> sqlite3.Row:
    if not token:
        raise HTTPException(status_code=401, detail="Требуется авторизация")
    row = db.execute(
        """SELECT u.* FROM auth_sessions s JOIN users u ON u.id = s.user_id
           WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > ?""",
        (_hash_token(token), _iso(_utc())),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=401, detail="Сессия истекла")
    return row


def _challenge(db: Any, *, client_id: str, user_id: int | None, channel: str, purpose: str, destination: str) -> dict[str, Any]:
    recent = db.execute(
        "SELECT created_at FROM auth_challenges WHERE destination = ? AND purpose = ? ORDER BY created_at DESC LIMIT 1",
        (destination, purpose),
    ).fetchone()
    if recent:
        try:
            last = datetime.fromisoformat(recent["created_at"])
            if (_utc() - last).total_seconds() < RESEND_SECONDS:
                raise HTTPException(status_code=429, detail=f"Повторная отправка доступна через {RESEND_SECONDS} секунд")
        except ValueError:
            pass

    code = _code()
    salt = secrets.token_hex(16)
    challenge_id = secrets.token_urlsafe(24)
    created = _utc()
    db.execute(
        """INSERT INTO auth_challenges
           (id, client_id, user_id, channel, purpose, destination, code_hash, code_salt, created_at, expires_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (challenge_id, client_id, user_id, channel, purpose, destination, _hash_code(code, salt), salt,
         _iso(created), _iso(created + timedelta(seconds=CODE_TTL_SECONDS))),
    )
    _delivery(channel, destination, code)
    result = {
        "challenge_id": challenge_id,
        "channel": channel,
        "destination": destination,
        "expires_in": CODE_TTL_SECONDS,
    }
    if DEBUG_AUTH:
        result["debug_code"] = code
    return result


class AuthStart(BaseModel):
    method: str = Field(pattern="^(email|phone)$")
    identifier: str = Field(min_length=3, max_length=254)


class AuthVerify(BaseModel):
    challenge_id: str = Field(min_length=10, max_length=200)
    code: str = Field(min_length=6, max_length=6)


class AuthResend(BaseModel):
    challenge_id: str = Field(min_length=10, max_length=200)


class AuthLoginStart(BaseModel):
    identifier: str = Field(min_length=3, max_length=254)


def register_auth(app: FastAPI) -> None:
    from server.main import db, is_admin, is_owner

    with db() as connection:
        _ensure_schema(connection)

    def current_session(authorization: str | None) -> sqlite3.Row:
        token = authorization[7:].strip() if authorization and authorization.lower().startswith("bearer ") else None
        with db() as connection:
            return _user_by_session(connection, token)

    @app.post("/auth/start")
    def auth_start(data: AuthStart, x_sxron_client_id: str | None = Header(default=None)) -> dict[str, Any]:
        client_id = (x_sxron_client_id or "").strip()
        if not client_id:
            raise HTTPException(status_code=400, detail="Не найден идентификатор клиента")

        with db() as connection:
            if data.method == "email":
                identifier = _normalize_email(data.identifier)
                existing = connection.execute("SELECT * FROM users WHERE email = ?", (identifier,)).fetchone()
                if existing and existing["email_verified"]:
                    raise HTTPException(status_code=409, detail="Этот email уже зарегистрирован. Используйте вход.")
                user = connection.execute("SELECT * FROM users WHERE client_id = ?", (client_id,)).fetchone()
                if user:
                    connection.execute("UPDATE users SET email = ?, auth_method = 'email' WHERE id = ?", (identifier, user["id"]))
                    user_id = user["id"]
                else:
                    cur = connection.execute(
                        "INSERT INTO users(client_id, email, auth_method, first_name, created_at, last_seen_at) VALUES (?, ?, 'email', 'Пользователь', ?, ?)",
                        (client_id, identifier, _iso(_utc()), _iso(_utc())),
                    )
                    user_id = cur.lastrowid
                result = _challenge(connection, client_id=client_id, user_id=user_id, channel="email", purpose="register_email", destination=identifier)
                result["next"] = "verify_email"
                return result

            identifier = _normalize_phone(data.identifier)
            existing = connection.execute("SELECT * FROM users WHERE phone = ?", (identifier,)).fetchone()
            if existing and existing["phone_verified"]:
                raise HTTPException(status_code=409, detail="Этот номер уже зарегистрирован. Используйте вход.")
            user = connection.execute("SELECT * FROM users WHERE client_id = ?", (client_id,)).fetchone()
            if user:
                connection.execute("UPDATE users SET phone = ?, auth_method = 'phone' WHERE id = ?", (identifier, user["id"]))
                user_id = user["id"]
            else:
                cur = connection.execute(
                    "INSERT INTO users(client_id, phone, auth_method, first_name, created_at, last_seen_at) VALUES (?, ?, 'phone', 'Пользователь', ?, ?)",
                    (client_id, identifier, _iso(_utc()), _iso(_utc())),
                )
                user_id = cur.lastrowid
            result = _challenge(connection, client_id=client_id, user_id=user_id, channel="sms", purpose="register_phone", destination=identifier)
            result["next"] = "verify_phone"
            return result

    @app.post("/auth/verify")
    def auth_verify(data: AuthVerify) -> dict[str, Any]:
        with db() as connection:
            challenge = connection.execute("SELECT * FROM auth_challenges WHERE id = ?", (data.challenge_id,)).fetchone()
            if not challenge or challenge["consumed_at"]:
                raise HTTPException(status_code=400, detail="Код недействителен")
            if datetime.fromisoformat(challenge["expires_at"]) <= _utc():
                raise HTTPException(status_code=400, detail="Срок действия кода истёк")
            if challenge["attempts"] >= MAX_ATTEMPTS:
                raise HTTPException(status_code=429, detail="Слишком много попыток")
            if not secrets.compare_digest(_hash_code(data.code, challenge["code_salt"]), challenge["code_hash"]):
                connection.execute("UPDATE auth_challenges SET attempts = attempts + 1 WHERE id = ?", (data.challenge_id,))
                raise HTTPException(status_code=400, detail="Неверный код")

            connection.execute("UPDATE auth_challenges SET consumed_at = ? WHERE id = ?", (_iso(_utc()), data.challenge_id))
            user = connection.execute("SELECT * FROM users WHERE id = ?", (challenge["user_id"],)).fetchone()
            if not user:
                raise HTTPException(status_code=404, detail="Пользователь не найден")

            if challenge["purpose"] == "register_email":
                connection.execute("UPDATE users SET email_verified = 1, last_seen_at = ? WHERE id = ?", (_iso(_utc()), user["id"]))
                result = _challenge(connection, client_id=challenge["client_id"], user_id=user["id"], channel="sms", purpose="register_phone", destination=user["phone"] if user["phone"] else "") if user["phone"] else None
                if result:
                    result["next"] = "verify_phone"
                    return result
                return {"authenticated": False, "next": "phone", "user_id": user["id"]}

            connection.execute("UPDATE users SET phone_verified = 1, last_seen_at = ? WHERE id = ?", (_iso(_utc()), user["id"]))
            token = _session(connection, user["id"])
            user = connection.execute("SELECT * FROM users WHERE id = ?", (user["id"],)).fetchone()
            return {
                "authenticated": True,
                "session_token": token,
                "user": _public_user(connection, user),
                "is_admin": is_admin(user["id"]),
                "is_owner": is_owner(user),
            }

    @app.post("/auth/phone/start")
    def phone_start(x_sxron_client_id: str | None = Header(default=None)) -> dict[str, Any]:
        client_id = (x_sxron_client_id or "").strip()
        with db() as connection:
            user = connection.execute("SELECT * FROM users WHERE client_id = ?", (client_id,)).fetchone()
            if not user:
                raise HTTPException(status_code=401, detail="Пользователь не найден")
            if not user["phone"]:
                raise HTTPException(status_code=400, detail="Сначала укажите номер телефона")
            result = _challenge(connection, client_id=client_id, user_id=user["id"], channel="sms", purpose="register_phone", destination=user["phone"])
            result["next"] = "verify_phone"
            return result

    @app.post("/auth/resend")
    def auth_resend(data: AuthResend) -> dict[str, Any]:
        with db() as connection:
            challenge = connection.execute("SELECT * FROM auth_challenges WHERE id = ?", (data.challenge_id,)).fetchone()
            if not challenge:
                raise HTTPException(status_code=404, detail="Запрос не найден")
            result = _challenge(
                connection,
                client_id=challenge["client_id"],
                user_id=challenge["user_id"],
                channel=challenge["channel"],
                purpose=challenge["purpose"],
                destination=challenge["destination"],
            )
            return result

    @app.post("/auth/login/start")
    def login_start(data: AuthLoginStart, x_sxron_client_id: str | None = Header(default=None)) -> dict[str, Any]:
        identifier = data.identifier.strip()
        with db() as connection:
            if "@" in identifier:
                identifier = _normalize_email(identifier)
                user = connection.execute("SELECT * FROM users WHERE email = ?", (identifier,)).fetchone()
                channel, purpose = "email", "login_email"
            else:
                identifier = _normalize_phone(identifier)
                user = connection.execute("SELECT * FROM users WHERE phone = ?", (identifier,)).fetchone()
                channel, purpose = "sms", "login_phone"
            if not user:
                raise HTTPException(status_code=404, detail="Аккаунт не найден")
            if channel == "email" and not user["email_verified"]:
                raise HTTPException(status_code=400, detail="Email ещё не подтверждён")
            result = _challenge(connection, client_id=(x_sxron_client_id or ""), user_id=user["id"], channel=channel, purpose=purpose, destination=identifier)
            result["next"] = "verify_login"
            return result

    @app.post("/auth/login/verify")
    def login_verify(data: AuthVerify) -> dict[str, Any]:
        with db() as connection:
            challenge = connection.execute("SELECT * FROM auth_challenges WHERE id = ?", (data.challenge_id,)).fetchone()
            if not challenge or challenge["consumed_at"]:
                raise HTTPException(status_code=400, detail="Код недействителен")
            if datetime.fromisoformat(challenge["expires_at"]) <= _utc():
                raise HTTPException(status_code=400, detail="Срок действия кода истёк")
            if challenge["attempts"] >= MAX_ATTEMPTS:
                raise HTTPException(status_code=429, detail="Слишком много попыток")
            if not secrets.compare_digest(_hash_code(data.code, challenge["code_salt"]), challenge["code_hash"]):
                connection.execute("UPDATE auth_challenges SET attempts = attempts + 1 WHERE id = ?", (data.challenge_id,))
                raise HTTPException(status_code=400, detail="Неверный код")
            connection.execute("UPDATE auth_challenges SET consumed_at = ? WHERE id = ?", (_iso(_utc()), data.challenge_id))
            user = connection.execute("SELECT * FROM users WHERE id = ?", (challenge["user_id"],)).fetchone()
            if not user:
                raise HTTPException(status_code=404, detail="Пользователь не найден")
            if not user["phone_verified"]:
                if not user["phone"]:
                    return {"authenticated": False, "next": "phone"}
                result = _challenge(connection, client_id=challenge["client_id"], user_id=user["id"], channel="sms", purpose="register_phone", destination=user["phone"])
                result["next"] = "verify_phone"
                return result
            token = _session(connection, user["id"])
            user = connection.execute("SELECT * FROM users WHERE id = ?", (user["id"],)).fetchone()
            return {"authenticated": True, "session_token": token, "user": _public_user(connection, user), "is_admin": is_admin(user["id"]), "is_owner": is_owner(user)}

    @app.get("/auth/me")
    def auth_me(authorization: str | None = Header(default=None)) -> dict[str, Any]:
        user = current_session(authorization)
        with db() as connection:
            user = connection.execute("SELECT * FROM users WHERE id = ?", (user["id"],)).fetchone()
            return {"user": _public_user(connection, user), "is_admin": is_admin(user["id"]), "is_owner": is_owner(user)}

    @app.post("/auth/logout")
    def auth_logout(authorization: str | None = Header(default=None)) -> dict[str, bool]:
        token = authorization[7:].strip() if authorization and authorization.lower().startswith("bearer ") else None
        if token:
            with db() as connection:
                connection.execute("UPDATE auth_sessions SET revoked_at = ? WHERE token_hash = ?", (_iso(_utc()), _hash_token(token)))
        return {"ok": True}
