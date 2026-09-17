from __future__ import annotations

import base64
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
SESSION_HOURS = int(os.getenv("SXRON_AUTH_SESSION_HOURS", "12"))
DEBUG_AUTH = os.getenv("SXRON_AUTH_DEBUG", "false").lower() in {"1", "true", "yes"}
OWNER_CLIENT_ID = os.getenv("SXRON_OWNER_CLIENT_ID", "sxron-owner-nikitinka7644").strip()
OWNER_EMAIL = os.getenv("SXRON_OWNER_EMAIL", "neoneonhorizon@gmail.com").strip().lower()
OWNER_USERNAME = os.getenv("SXRON_OWNER_USERNAME", "Nikitinka7644").strip()
OWNER_PASSWORD_HASH = os.getenv("SXRON_OWNER_PASSWORD_HASH", "").strip()
OWNER_PASSWORD_SALT = os.getenv("SXRON_OWNER_PASSWORD_SALT", "").strip()

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


def _validate_password(password: str) -> str:
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Пароль должен содержать минимум 8 символов")
    if len(password) > 128:
        raise HTTPException(status_code=400, detail="Пароль слишком длинный")
    return password


def _hash_code(code: str, salt: str) -> str:
    return hashlib.sha256(f"{salt}:{code}".encode("utf-8")).hexdigest()


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _hash_password(password: str, salt: bytes | None = None) -> tuple[str, str]:
    password = _validate_password(password)
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=2**14, r=8, p=1, dklen=64)
    return base64.b64encode(digest).decode("ascii"), base64.b64encode(salt).decode("ascii")


def _verify_password(password: str, stored_hash: str | None, stored_salt: str | None) -> bool:
    if not stored_hash or not stored_salt:
        return False
    try:
        expected, _ = _hash_password(password, base64.b64decode(stored_salt))
    except Exception:
        return False
    return secrets.compare_digest(expected, stored_hash)


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
        "password_hash": "TEXT",
        "password_salt": "TEXT",
    }
    for name, definition in additions.items():
        if name not in columns:
            db.execute(f"ALTER TABLE users ADD COLUMN {name} {definition}")

    challenge_columns = {row[1] for row in db.execute("PRAGMA table_info(auth_challenges)").fetchall()}
    if challenge_columns:
        if "password_hash" not in challenge_columns:
            db.execute("ALTER TABLE auth_challenges ADD COLUMN password_hash TEXT")
        if "password_salt" not in challenge_columns:
            db.execute("ALTER TABLE auth_challenges ADD COLUMN password_salt TEXT")

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
            password_hash TEXT,
            password_salt TEXT,
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
    message.set_content(f"Ваш код подтверждения SXRON:\n\n{code}\n\nКод действует {CODE_TTL_SECONDS // 60} минут. Никому его не сообщайте.")
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
    body = urllib.parse.urlencode({"From": sender, "To": destination, "Body": f"SXRON: код подтверждения {code}. Действует {CODE_TTL_SECONDS // 60} минут."}).encode("utf-8")
    request = urllib.request.Request(url, data=body, method="POST")
    auth = f"{sid}:{token}".encode("utf-8")
    request.add_header("Authorization", "Basic " + base64.b64encode(auth).decode("ascii"))
    request.add_header("Content-Type", "application/x-www-form-urlencoded")
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            if response.status >= 300:
                raise RuntimeError("Twilio rejected the request")
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Не удалось отправить SMS-код") from exc


def _delivery(channel: str, destination: str, code: str) -> None:
    _send_email(destination, code) if channel == "email" else _send_sms(destination, code)


def _public_user(db: Any, user: sqlite3.Row) -> dict[str, Any]:
    listings = db.execute("SELECT COUNT(*) FROM products WHERE created_by = ?", (user["id"],)).fetchone()[0]
    active = db.execute("SELECT COUNT(*) FROM products WHERE created_by = ? AND available = 1", (user["id"],)).fetchone()[0]
    return {
        "id": user["id"], "username": user["username"], "first_name": user["first_name"], "last_name": user["last_name"],
        "avatar_url": user["avatar_url"], "email": user["email"], "email_verified": bool(user["email_verified"]),
        "phone": user["phone"], "phone_verified": bool(user["phone_verified"]), "city": None,
        "created_at": user["created_at"], "bio": user["bio"], "listings_count": listings, "active_listings_count": active,
        "sold_count": 0, "views_count": 0, "rating": None, "reviews_count": 0, "last_seen_at": user["last_seen_at"],
        "is_online": True, "verified": bool(user["phone_verified"]),
    }


def _session(db: Any, user_id: int, remember: bool = True) -> str:
    token = secrets.token_urlsafe(48)
    now = _utc()
    lifetime = timedelta(days=SESSION_DAYS) if remember else timedelta(hours=SESSION_HOURS)
    db.execute("INSERT INTO auth_sessions(user_id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?)",
               (user_id, _hash_token(token), _iso(now), _iso(now + lifetime)))
    return token


def _user_by_session(db: Any, token: str | None) -> sqlite3.Row:
    if not token:
        raise HTTPException(status_code=401, detail="Требуется авторизация")
    row = db.execute("SELECT u.* FROM auth_sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > ?",
                     (_hash_token(token), _iso(_utc()))).fetchone()
    if not row:
        raise HTTPException(status_code=401, detail="Сессия истекла")
    return row


def _challenge(db: Any, *, client_id: str, user_id: int | None, channel: str, purpose: str, destination: str) -> dict[str, Any]:
    recent = db.execute("SELECT created_at FROM auth_challenges WHERE destination = ? AND purpose = ? ORDER BY created_at DESC LIMIT 1", (destination, purpose)).fetchone()
    if recent:
        try:
            if (_utc() - datetime.fromisoformat(recent["created_at"])).total_seconds() < RESEND_SECONDS:
                raise HTTPException(status_code=429, detail=f"Повторная отправка доступна через {RESEND_SECONDS} секунд")
        except ValueError:
            pass
    code = _code()
    salt = secrets.token_hex(16)
    challenge_id = secrets.token_urlsafe(24)
    created = _utc()
    db.execute("INSERT INTO auth_challenges(id, client_id, user_id, channel, purpose, destination, code_hash, code_salt, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
               (challenge_id, client_id, user_id, channel, purpose, destination, _hash_code(code, salt), salt, _iso(created), _iso(created + timedelta(seconds=CODE_TTL_SECONDS))))
    _delivery(channel, destination, code)
    result: dict[str, Any] = {"challenge_id": challenge_id, "channel": channel, "destination": destination, "expires_in": CODE_TTL_SECONDS}
    if DEBUG_AUTH:
        result["debug_code"] = code
    return result


class AuthStart(BaseModel):
    method: str = Field(pattern="^(email|phone)$")
    identifier: str = Field(min_length=3, max_length=254)
    password: str | None = Field(default=None, min_length=8, max_length=128)


class AuthVerify(BaseModel):
    challenge_id: str = Field(min_length=10, max_length=200)
    code: str = Field(pattern=r"^\d{6}$")


class AuthResend(BaseModel):
    challenge_id: str = Field(min_length=10, max_length=200)


class AuthLogin(BaseModel):
    identifier: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=8, max_length=128)
    remember: bool = True


class AuthLoginStart(BaseModel):
    identifier: str = Field(min_length=3, max_length=254)


class AuthPasswordSet(BaseModel):
    password: str = Field(min_length=8, max_length=128)


def register_auth(app: FastAPI) -> None:
    from server.main import db, init_db, is_admin, is_owner

    init_db()
    with db() as connection:
        _ensure_schema(connection)
        timestamp = _iso(_utc())
        owner = connection.execute("SELECT * FROM users WHERE email = ?", (OWNER_EMAIL,)).fetchone()
        if not owner:
            connection.execute(
                "INSERT INTO users(client_id, username, first_name, email, email_verified, auth_method, password_hash, password_salt, created_at, last_seen_at) VALUES (?, ?, ?, ?, 1, 'owner', ?, ?, ?, ?)",
                (OWNER_CLIENT_ID, OWNER_USERNAME, OWNER_USERNAME, OWNER_EMAIL, OWNER_PASSWORD_HASH or None, OWNER_PASSWORD_SALT or None, timestamp, timestamp),
            )
            owner = connection.execute("SELECT * FROM users WHERE email = ?", (OWNER_EMAIL,)).fetchone()
        else:
            if OWNER_PASSWORD_HASH and OWNER_PASSWORD_SALT:
                connection.execute(
                    "UPDATE users SET client_id = ?, username = ?, first_name = ?, email_verified = 1, auth_method = 'owner', password_hash = ?, password_salt = ?, last_seen_at = ? WHERE id = ?",
                    (OWNER_CLIENT_ID, OWNER_USERNAME, OWNER_USERNAME, OWNER_PASSWORD_HASH, OWNER_PASSWORD_SALT, timestamp, owner["id"]),
                )
            else:
                connection.execute(
                    "UPDATE users SET client_id = ?, username = ?, first_name = ?, email_verified = 1, auth_method = 'owner', last_seen_at = ? WHERE id = ?",
                    (OWNER_CLIENT_ID, OWNER_USERNAME, OWNER_USERNAME, timestamp, owner["id"]),
                )
            owner = connection.execute("SELECT * FROM users WHERE id = ?", (owner["id"],)).fetchone()
        connection.execute("INSERT OR IGNORE INTO admins(user_id, added_at) VALUES (?, ?)", (owner["id"], timestamp))

    def result_for(connection: sqlite3.Connection, user: sqlite3.Row, remember: bool = True) -> dict[str, Any]:
        token = _session(connection, user["id"], remember)
        user = connection.execute("SELECT * FROM users WHERE id = ?", (user["id"],)).fetchone()
        return {"authenticated": True, "session_token": token, "user": _public_user(connection, user), "is_admin": is_admin(user["id"]), "is_owner": is_owner(user)}

    @app.post("/auth/owner")
    def owner_login(x_sxron_client_id: str | None = Header(default=None)) -> dict[str, Any]:
        client_id = (x_sxron_client_id or "").strip()
        if not OWNER_CLIENT_ID or not client_id or not secrets.compare_digest(client_id, OWNER_CLIENT_ID):
            raise HTTPException(status_code=403, detail="Вход владельца недоступен для этого клиента")
        with db() as connection:
            user = connection.execute("SELECT * FROM users WHERE client_id = ?", (client_id,)).fetchone()
            if not user:
                raise HTTPException(status_code=404, detail="Владелец не найден")
            connection.execute("UPDATE users SET last_seen_at = ? WHERE id = ?", (_iso(_utc()), user["id"]))
            connection.execute("INSERT OR IGNORE INTO admins(user_id, added_at) VALUES (?, ?)", (user["id"], _iso(_utc())))
            return result_for(connection, user, True)

    @app.post("/auth/start")
    def auth_start(data: AuthStart, x_sxron_client_id: str | None = Header(default=None)) -> dict[str, Any]:
        client_id = (x_sxron_client_id or "").strip()
        if not client_id:
            raise HTTPException(status_code=400, detail="Не найден идентификатор клиента")
        password_hash = password_salt = None
        if data.password:
            password_hash, password_salt = _hash_password(data.password)
        with db() as connection:
            if data.method == "email":
                identifier = _normalize_email(data.identifier)
                existing = connection.execute("SELECT * FROM users WHERE email = ?", (identifier,)).fetchone()
                if existing and existing["email_verified"]:
                    raise HTTPException(status_code=409, detail="Этот email уже зарегистрирован. Используйте вход.")
                user = connection.execute("SELECT * FROM users WHERE client_id = ?", (client_id,)).fetchone()
                if user:
                    connection.execute("UPDATE users SET email = ?, auth_method = 'email', password_hash = COALESCE(?, password_hash), password_salt = COALESCE(?, password_salt) WHERE id = ?", (identifier, password_hash, password_salt, user["id"]))
                    user_id = user["id"]
                else:
                    cur = connection.execute("INSERT INTO users(client_id, email, auth_method, password_hash, password_salt, first_name, created_at, last_seen_at) VALUES (?, ?, 'email', ?, ?, 'Пользователь', ?, ?)", (client_id, identifier, password_hash, password_salt, _iso(_utc()), _iso(_utc())))
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
                connection.execute("UPDATE users SET phone = ?, auth_method = 'phone', password_hash = COALESCE(?, password_hash), password_salt = COALESCE(?, password_salt) WHERE id = ?", (identifier, password_hash, password_salt, user["id"]))
                user_id = user["id"]
            else:
                cur = connection.execute("INSERT INTO users(client_id, phone, auth_method, password_hash, password_salt, first_name, created_at, last_seen_at) VALUES (?, ?, 'phone', ?, ?, 'Пользователь', ?, ?)", (client_id, identifier, password_hash, password_salt, _iso(_utc()), _iso(_utc())))
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
                user = connection.execute("SELECT * FROM users WHERE id = ?", (user["id"],)).fetchone()
                if not user["phone"]:
                    return {"authenticated": False, "next": "phone", "user_id": user["id"]}
                result = _challenge(connection, client_id=challenge["client_id"], user_id=user["id"], channel="sms", purpose="register_phone", destination=user["phone"])
                result["next"] = "verify_phone"
                return result
            connection.execute("UPDATE users SET phone_verified = 1, last_seen_at = ? WHERE id = ?", (_iso(_utc()), user["id"]))
            user = connection.execute("SELECT * FROM users WHERE id = ?", (user["id"],)).fetchone()
            return result_for(connection, user, True)

    @app.post("/auth/login")
    def login(data: AuthLogin) -> dict[str, Any]:
        identifier = data.identifier.strip()
        with db() as connection:
            if "@" in identifier:
                identifier = _normalize_email(identifier)
                user = connection.execute("SELECT * FROM users WHERE email = ?", (identifier,)).fetchone()
                if user and not user["email_verified"]:
                    raise HTTPException(status_code=400, detail="Email ещё не подтверждён")
            else:
                identifier = _normalize_phone(identifier)
                user = connection.execute("SELECT * FROM users WHERE phone = ?", (identifier,)).fetchone()
                if user and not user["phone_verified"]:
                    raise HTTPException(status_code=400, detail="Телефон ещё не подтверждён")
            if not user:
                raise HTTPException(status_code=404, detail="Аккаунт не найден. Сначала зарегистрируйтесь.")
            if not user["password_hash"]:
                raise HTTPException(status_code=409, detail="Для старого аккаунта сначала выполните вход по коду и задайте пароль")
            if not _verify_password(data.password, user["password_hash"], user["password_salt"]):
                raise HTTPException(status_code=401, detail="Неверный email/телефон или пароль")
            connection.execute("UPDATE users SET last_seen_at = ? WHERE id = ?", (_iso(_utc()), user["id"]))
            user = connection.execute("SELECT * FROM users WHERE id = ?", (user["id"],)).fetchone()
            return result_for(connection, user, data.remember)

    @app.post("/auth/password/set")
    def password_set(data: AuthPasswordSet, authorization: str | None = Header(default=None)) -> dict[str, Any]:
        token = authorization[7:].strip() if authorization and authorization.lower().startswith("bearer ") else None
        with db() as connection:
            user = _user_by_session(connection, token)
            password_hash, password_salt = _hash_password(data.password)
            connection.execute("UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?", (password_hash, password_salt, user["id"]))
            return {"ok": True}

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
            if challenge["purpose"] == "login_email" and not user["email_verified"]:
                raise HTTPException(status_code=400, detail="Email не подтверждён")
            if challenge["purpose"] == "login_phone" and not user["phone_verified"]:
                raise HTTPException(status_code=400, detail="Телефон не подтверждён")
            return result_for(connection, user, True)

    @app.post("/auth/phone/start")
    def phone_start(x_sxron_client_id: str | None = Header(default=None)) -> dict[str, Any]:
        client_id = (x_sxron_client_id or "").strip()
        with db() as connection:
            user = connection.execute("SELECT * FROM users WHERE client_id = ?", (client_id,)).fetchone()
            if not user or not user["phone"]:
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
            return _challenge(connection, client_id=challenge["client_id"] or "", user_id=challenge["user_id"], channel=challenge["channel"], purpose=challenge["purpose"], destination=challenge["destination"])

    @app.get("/auth/me")
    def auth_me(authorization: str | None = Header(default=None)) -> dict[str, Any]:
        token = authorization[7:].strip() if authorization and authorization.lower().startswith("bearer ") else None
        with db() as connection:
            user = _user_by_session(connection, token)
            return {"user": _public_user(connection, user), "is_admin": is_admin(user["id"]), "is_owner": is_owner(user)}

    @app.post("/auth/logout")
    def auth_logout(authorization: str | None = Header(default=None)) -> dict[str, bool]:
        token = authorization[7:].strip() if authorization and authorization.lower().startswith("bearer ") else None
        if token:
            with db() as connection:
                connection.execute("UPDATE auth_sessions SET revoked_at = ? WHERE token_hash = ?", (_iso(_utc()), _hash_token(token)))
        return {"ok": True}
