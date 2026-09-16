from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any

from fastapi import FastAPI, Header, HTTPException, Request


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _client_ip(request: Request) -> str:
    # Never trust forwarded headers by default. They are only accepted when the
    # deployment explicitly declares that a trusted reverse proxy is in front.
    direct = request.client.host if request.client else "unknown"
    if direct and direct != "unknown":
        return direct
    return "unknown"


def _device_info(user_agent: str) -> dict[str, str]:
    ua = user_agent or ""
    ua_lower = ua.lower()

    if "windows" in ua_lower:
        platform = "Windows"
    elif "mac os" in ua_lower or "macintosh" in ua_lower:
        platform = "macOS"
    elif "android" in ua_lower:
        platform = "Android"
    elif "iphone" in ua_lower or "ipad" in ua_lower or "ios" in ua_lower:
        platform = "iOS"
    elif "linux" in ua_lower:
        platform = "Linux"
    else:
        platform = "Unknown"

    if "electron" in ua_lower:
        client_type = "Desktop"
    elif "telegram" in ua_lower:
        client_type = "Telegram"
    elif "mobile" in ua_lower:
        client_type = "Mobile browser"
    else:
        client_type = "Browser"

    browser = "Unknown"
    if "edg/" in ua_lower:
        browser = "Edge"
    elif "chrome/" in ua_lower:
        browser = "Chrome"
    elif "firefox/" in ua_lower:
        browser = "Firefox"
    elif "safari/" in ua_lower and "chrome/" not in ua_lower:
        browser = "Safari"
    elif "electron/" in ua_lower:
        browser = "Electron"

    return {
        "platform": platform,
        "client_type": client_type,
        "browser": browser,
        "device": f"{platform} / {client_type}",
    }


def _ensure_schema(connection: Any) -> None:
    user_columns = {row[1] for row in connection.execute("PRAGMA table_info(users)").fetchall()}
    additions = {
        "last_ip": "TEXT",
        "last_user_agent": "TEXT",
        "last_device": "TEXT",
        "last_platform": "TEXT",
        "last_client_type": "TEXT",
    }
    for name, definition in additions.items():
        if name not in user_columns:
            connection.execute(f"ALTER TABLE users ADD COLUMN {name} {definition}")

    connection.executescript(
        """
        CREATE TABLE IF NOT EXISTS auth_session_meta (
            session_id INTEGER PRIMARY KEY,
            ip_address TEXT,
            user_agent TEXT,
            device TEXT,
            platform TEXT,
            client_type TEXT,
            first_seen_at TEXT NOT NULL,
            last_seen_at TEXT NOT NULL,
            FOREIGN KEY(session_id) REFERENCES auth_sessions(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_auth_session_meta_ip
        ON auth_session_meta(ip_address);
        CREATE INDEX IF NOT EXISTS idx_auth_session_meta_last_seen
        ON auth_session_meta(last_seen_at);
        """
    )


def _token_from_request(request: Request) -> str | None:
    value = request.headers.get("authorization", "")
    if value.lower().startswith("bearer "):
        token = value[7:].strip()
        return token or None
    return None


def _session_row(connection: Any, token: str | None) -> Any:
    if not token:
        return None
    return connection.execute(
        "SELECT s.id AS session_id, s.user_id, s.expires_at, s.revoked_at, u.client_id "
        "FROM auth_sessions s JOIN users u ON u.id = s.user_id "
        "WHERE s.token_hash = ?",
        (__import__("hashlib").sha256(token.encode("utf-8")).hexdigest(),),
    ).fetchone()


def register_session_tracking(app: FastAPI) -> None:
    from server.main import db, is_admin

    with db() as connection:
        _ensure_schema(connection)

    @app.middleware("http")
    async def session_tracking_middleware(request: Request, call_next):
        response = await call_next(request)
        ip = _client_ip(request)
        ua = request.headers.get("user-agent", "")[:1000]
        info = _device_info(ua)
        token = _token_from_request(request)
        client_id = request.headers.get("x-sxron-client-id", "").strip()

        try:
            with db() as connection:
                if token:
                    row = _session_row(connection, token)
                    if row and not row["revoked_at"] and row["expires_at"] > _now():
                        timestamp = _now()
                        existing = connection.execute(
                            "SELECT session_id FROM auth_session_meta WHERE session_id = ?",
                            (row["session_id"],),
                        ).fetchone()
                        if existing:
                            connection.execute(
                                "UPDATE auth_session_meta SET ip_address = ?, user_agent = ?, device = ?, platform = ?, client_type = ?, last_seen_at = ? WHERE session_id = ?",
                                (ip, ua, info["device"], info["platform"], info["client_type"], timestamp, row["session_id"]),
                            )
                        else:
                            connection.execute(
                                "INSERT INTO auth_session_meta(session_id, ip_address, user_agent, device, platform, client_type, first_seen_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                                (row["session_id"], ip, ua, info["device"], info["platform"], info["client_type"], timestamp, timestamp),
                            )
                        connection.execute(
                            "UPDATE users SET last_seen_at = ?, last_ip = ?, last_user_agent = ?, last_device = ?, last_platform = ?, last_client_type = ? WHERE id = ?",
                            (timestamp, ip, ua, info["device"], info["platform"], info["client_type"], row["user_id"]),
                        )
                elif client_id:
                    user = connection.execute("SELECT id FROM users WHERE client_id = ?", (client_id,)).fetchone()
                    if user:
                        connection.execute(
                            "UPDATE users SET last_seen_at = ?, last_ip = ?, last_user_agent = ?, last_device = ?, last_platform = ?, last_client_type = ? WHERE id = ?",
                            (_now(), ip, ua, info["device"], info["platform"], info["client_type"], user["id"]),
                        )
        except Exception:
            # Tracking must never break the marketplace request itself.
            pass
        return response

    @app.get("/auth/sessions")
    def my_sessions(authorization: str | None = Header(default=None)) -> dict[str, Any]:
        token = authorization[7:].strip() if authorization and authorization.lower().startswith("bearer ") else None
        if not token:
            raise HTTPException(status_code=401, detail="Требуется авторизация")
        with db() as connection:
            row = _session_row(connection, token)
            if not row or row["revoked_at"] or row["expires_at"] <= _now():
                raise HTTPException(status_code=401, detail="Сессия истекла")
            rows = connection.execute(
                "SELECT s.id, s.created_at, s.expires_at, s.revoked_at, m.ip_address, m.user_agent, m.device, m.platform, m.client_type, m.first_seen_at, m.last_seen_at "
                "FROM auth_sessions s LEFT JOIN auth_session_meta m ON m.session_id = s.id "
                "WHERE s.user_id = ? ORDER BY s.created_at DESC",
                (row["user_id"],),
            ).fetchall()
        return {"sessions": [dict(item) for item in rows]}

    @app.post("/auth/sessions/revoke-all")
    def revoke_all_sessions(authorization: str | None = Header(default=None)) -> dict[str, Any]:
        token = authorization[7:].strip() if authorization and authorization.lower().startswith("bearer ") else None
        if not token:
            raise HTTPException(status_code=401, detail="Требуется авторизация")
        with db() as connection:
            row = _session_row(connection, token)
            if not row:
                raise HTTPException(status_code=401, detail="Сессия не найдена")
            connection.execute("UPDATE auth_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL", (_now(), row["user_id"]))
        return {"ok": True}

    @app.delete("/auth/sessions/{session_id}")
    def revoke_session(session_id: int, authorization: str | None = Header(default=None)) -> dict[str, Any]:
        token = authorization[7:].strip() if authorization and authorization.lower().startswith("bearer ") else None
        if not token:
            raise HTTPException(status_code=401, detail="Требуется авторизация")
        with db() as connection:
            current = _session_row(connection, token)
            if not current:
                raise HTTPException(status_code=401, detail="Сессия не найдена")
            target = connection.execute("SELECT user_id FROM auth_sessions WHERE id = ?", (session_id,)).fetchone()
            if not target or target["user_id"] != current["user_id"]:
                raise HTTPException(status_code=404, detail="Сессия не найдена")
            connection.execute("UPDATE auth_sessions SET revoked_at = ? WHERE id = ?", (_now(), session_id))
        return {"ok": True}

    @app.get("/admin/sessions")
    def admin_sessions(authorization: str | None = Header(default=None)) -> dict[str, Any]:
        token = authorization[7:].strip() if authorization and authorization.lower().startswith("bearer ") else None
        if not token:
            raise HTTPException(status_code=401, detail="Требуется авторизация")
        with db() as connection:
            current = _session_row(connection, token)
            if not current or not is_admin(current["user_id"]):
                raise HTTPException(status_code=403, detail="Доступ только для администратора")
            rows = connection.execute(
                "SELECT s.id, s.user_id, u.client_id, u.username, u.first_name, u.last_name, s.created_at, s.expires_at, s.revoked_at, "
                "m.ip_address, m.user_agent, m.device, m.platform, m.client_type, m.first_seen_at, m.last_seen_at "
                "FROM auth_sessions s JOIN users u ON u.id = s.user_id LEFT JOIN auth_session_meta m ON m.session_id = s.id "
                "ORDER BY s.created_at DESC LIMIT 500"
            ).fetchall()
        return {"sessions": [dict(item) for item in rows]}
