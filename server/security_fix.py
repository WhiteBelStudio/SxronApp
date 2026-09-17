from __future__ import annotations

import hashlib
from typing import Any

from fastapi import Header, HTTPException


def register(app: Any) -> None:
    from server.main import db, is_admin, now

    # Remove the legacy security endpoint. It incorrectly queried metadata
    # columns from auth_sessions instead of auth_session_meta and caused HTTP 500.
    app.router.routes = [
        route
        for route in app.router.routes
        if getattr(route, "path", None) != "/admin/center/security/sessions"
    ]

    @app.get("/admin/center/security/sessions")
    def center_security_sessions(authorization: str | None = Header(default=None)) -> dict[str, Any]:
        token = authorization[7:].strip() if authorization and authorization.lower().startswith("bearer ") else None
        if not token:
            raise HTTPException(status_code=401, detail="Требуется авторизация")

        token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
        with db() as connection:
            actor = connection.execute(
                "SELECT u.id FROM auth_sessions s JOIN users u ON u.id=s.user_id "
                "WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>?",
                (token_hash, now()),
            ).fetchone()
            if not actor:
                raise HTTPException(status_code=401, detail="Сессия истекла")
            if not is_admin(actor["id"]):
                raise HTTPException(status_code=403, detail="Доступ только для администратора")

            has_meta = connection.execute(
                "SELECT 1 FROM sqlite_master WHERE type='table' AND name='auth_session_meta'"
            ).fetchone()
            if not has_meta:
                rows = connection.execute(
                    "SELECT s.id,s.user_id,s.created_at,s.expires_at,s.revoked_at,"
                    "u.display_name,u.username "
                    "FROM auth_sessions s JOIN users u ON u.id=s.user_id "
                    "ORDER BY s.id DESC LIMIT 300"
                ).fetchall()
            else:
                rows = connection.execute(
                    "SELECT s.id,s.user_id,s.created_at,s.expires_at,s.revoked_at,"
                    "m.ip_address,m.user_agent,m.device,m.platform,m.client_type,"
                    "m.first_seen_at,m.last_seen_at,u.display_name,u.username "
                    "FROM auth_sessions s JOIN users u ON u.id=s.user_id "
                    "LEFT JOIN auth_session_meta m ON m.session_id=s.id "
                    "ORDER BY s.id DESC LIMIT 300"
                ).fetchall()

        return {"sessions": [dict(row) for row in rows]}
