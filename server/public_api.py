from __future__ import annotations

import hashlib
from typing import Any

from fastapi import Header, HTTPException
from pydantic import BaseModel

import server.main as base

app = base.app
base.APP_VERSION = "1.2.16"
base.app.version = base.APP_VERSION
init_db = base.init_db


# =========================================================
# SYSTEM ROLES
# =========================================================


def role_label(user: Any, connection: Any) -> str:
    if base.is_owner(user):
        return "Владелец"
    if connection.execute("SELECT 1 FROM admins WHERE user_id = ?", (user["id"],)).fetchone():
        return "Администратор"
    return "Пользователь"


_original_user_dict = base.user_dict


def role_aware_user_dict(user: Any, connection: Any) -> dict[str, Any]:
    data = _original_user_dict(user, connection)
    data["profile_status"] = role_label(user, connection)
    return data


base.user_dict = role_aware_user_dict


# =========================================================
# PUBLIC SELLER PROFILE
# =========================================================


@app.get("/public/sellers/{user_id}")
def get_public_seller(user_id: int) -> dict[str, Any]:
    with base.db() as connection:
        user = connection.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="Продавец не найден")

        seller = base.user_dict(user, connection)
        listings_rows = connection.execute(
            "SELECT * FROM products WHERE created_by = ? AND available = 1 ORDER BY id DESC",
            (user_id,),
        ).fetchall()

    if not seller.get("username_visible", True):
        seller["username"] = None
    if not seller.get("badges_visible", True):
        seller["verified"] = False
    if not seller.get("activity_visible", True):
        seller["is_online"] = False
        seller["last_seen_at"] = None

    seller["is_owner"] = base.is_owner(user)
    seller["active_listings_count"] = len(listings_rows)
    seller["listings_count"] = max(int(seller.get("listings_count") or 0), len(listings_rows))

    return {
        "seller": seller,
        "listings": [base.product_dict(row) for row in listings_rows],
        "rating": seller.get("rating"),
        "reviews_count": int(seller.get("reviews_count") or 0),
        "reviews": [],
    }


# =========================================================
# ADMIN AUTHORIZATION
# =========================================================


def _admin_user(authorization: str | None) -> tuple[Any, bool]:
    token = authorization[7:].strip() if authorization and authorization.lower().startswith("bearer ") else None
    if not token:
        raise HTTPException(status_code=401, detail="Требуется авторизация")

    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    with base.db() as connection:
        user = connection.execute(
            "SELECT u.* FROM auth_sessions s "
            "JOIN users u ON u.id = s.user_id "
            "WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > ?",
            (token_hash, base.now()),
        ).fetchone()

    if not user:
        raise HTTPException(status_code=401, detail="Сессия истекла")
    if not base.is_admin(user["id"]):
        raise HTTPException(status_code=403, detail="Доступ только для администратора")

    return user, base.is_owner(user)


def _value(row: Any, key: str, default: Any = None) -> Any:
    try:
        return row[key]
    except (KeyError, IndexError):
        return default


def _admin_user_summary(row: Any, connection: Any) -> dict[str, Any]:
    listings_count = connection.execute(
        "SELECT COUNT(*) FROM products WHERE created_by = ?",
        (row["id"],),
    ).fetchone()[0]
    is_admin = connection.execute(
        "SELECT 1 FROM admins WHERE user_id = ?",
        (row["id"],),
    ).fetchone() is not None

    return {
        "id": row["id"],
        "client_id": row["client_id"],
        "display_name": row["display_name"] or row["first_name"] or "Пользователь",
        "username": row["username"],
        "first_name": row["first_name"],
        "last_name": row["last_name"],
        "email": _value(row, "email"),
        "email_verified": bool(_value(row, "email_verified", False)),
        "phone_verified": bool(_value(row, "phone_verified", False)),
        "created_at": row["created_at"],
        "last_seen_at": row["last_seen_at"],
        "listings_count": listings_count,
        "is_admin": is_admin,
        "is_owner": base.is_owner(row),
        "role": role_label(row, connection),
    }


def _admin_profile(row: Any, connection: Any) -> dict[str, Any]:
    profile = base.user_dict(row, connection)
    profile.update(_admin_user_summary(row, connection))
    profile["client_id"] = row["client_id"]
    profile["city_id"] = row["city_id"]
    return profile


# =========================================================
# ADMIN DASHBOARD
# =========================================================


@app.get("/admin/dashboard")
def admin_dashboard(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    user, owner = _admin_user(authorization)
    with base.db() as connection:
        stats = {
            "users": connection.execute("SELECT COUNT(*) FROM users").fetchone()[0],
            "products": connection.execute("SELECT COUNT(*) FROM products").fetchone()[0],
            "active_products": connection.execute("SELECT COUNT(*) FROM products WHERE available = 1").fetchone()[0],
            "sold_products": connection.execute("SELECT COUNT(*) FROM products WHERE status = 'sold'").fetchone()[0],
            "admins": connection.execute("SELECT COUNT(*) FROM admins").fetchone()[0],
            "categories": connection.execute("SELECT COUNT(*) FROM categories").fetchone()[0],
            "cities": connection.execute("SELECT COUNT(*) FROM cities").fetchone()[0],
        }

    return {
        "version": base.APP_VERSION,
        "user": {
            "id": user["id"],
            "display_name": user["display_name"] or user["first_name"] or "Пользователь",
            "username": user["username"],
            "email": _value(user, "email"),
            "email_verified": bool(_value(user, "email_verified", False)),
        },
        "is_owner": owner,
        "stats": stats,
    }


@app.get("/admin/users")
def admin_users(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    _admin_user(authorization)
    with base.db() as connection:
        rows = connection.execute(
            "SELECT * FROM users ORDER BY id DESC LIMIT 500",
        ).fetchall()
        users = [_admin_user_summary(row, connection) for row in rows]
    return {"users": users}


@app.get("/admin/users/{user_id}")
def admin_get_user(user_id: int, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    _admin_user(authorization)
    with base.db() as connection:
        row = connection.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        return {"user": _admin_profile(row, connection)}


class AdminProfileUpdate(BaseModel):
    display_name: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    username: str | None = None
    bio: str | None = None
    avatar_url: str | None = None
    city_id: int | None = None
    profile_accent: str | None = None
    profile_banner: str | None = None
    avatar_shape: str | None = None
    username_visible: bool | None = None
    badges_visible: bool | None = None
    activity_visible: bool | None = None


@app.patch("/admin/users/{user_id}")
def admin_update_user(
    user_id: int,
    data: AdminProfileUpdate,
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    actor, owner = _admin_user(authorization)
    if not owner:
        raise HTTPException(status_code=403, detail="Редактировать профили может только владелец")

    allowed_text = {
        "display_name": 60,
        "first_name": 120,
        "last_name": 120,
        "username": 120,
        "bio": 500,
        "avatar_url": 2_000_000,
    }
    allowed_accent = {"cyan", "violet", "blue", "sunset"}
    allowed_banner = {"aurora", "violet", "ocean", "sunset"}
    allowed_shape = {"rounded", "circle", "square"}

    updates: dict[str, Any] = {}
    payload = data.model_dump(exclude_unset=True)

    for field, max_length in allowed_text.items():
        if field not in payload:
            continue
        value = payload[field]
        if value is None:
            value = ""
        if not isinstance(value, str):
            raise HTTPException(status_code=400, detail=f"Поле {field} должно быть строкой")
        if len(value) > max_length:
            raise HTTPException(status_code=400, detail=f"Поле {field} слишком длинное")
        updates[field] = value.strip()

    enum_fields = {
        "profile_accent": allowed_accent,
        "profile_banner": allowed_banner,
        "avatar_shape": allowed_shape,
    }
    for field, variants in enum_fields.items():
        if field in payload:
            value = payload[field]
            if value not in variants:
                raise HTTPException(status_code=400, detail=f"Недопустимое значение {field}")
            updates[field] = value

    for field in ("username_visible", "badges_visible", "activity_visible"):
        if field in payload:
            updates[field] = int(bool(payload[field]))

    if "city_id" in payload:
        city_id = payload["city_id"]
        if city_id is not None:
            try:
                city_id = int(city_id)
            except (TypeError, ValueError):
                raise HTTPException(status_code=400, detail="Некорректный город")
            with base.db() as connection:
                if not connection.execute("SELECT 1 FROM cities WHERE id = ?", (city_id,)).fetchone():
                    raise HTTPException(status_code=400, detail="Город не найден")
        updates["city_id"] = city_id

    with base.db() as connection:
        target = connection.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        if not target:
            raise HTTPException(status_code=404, detail="Пользователь не найден")

        if base.is_owner(target) and target["id"] != actor["id"]:
            raise HTTPException(status_code=403, detail="Профиль владельца нельзя изменять из чужой сессии")

        if "username" in updates and updates["username"]:
            duplicate = connection.execute(
                "SELECT id FROM users WHERE username = ? AND id != ?",
                (updates["username"], user_id),
            ).fetchone()
            if duplicate:
                raise HTTPException(status_code=400, detail="Этот username уже занят")

        if updates:
            connection.execute(
                f"UPDATE users SET {', '.join(f'{key}=?' for key in updates)}, last_seen_at=? WHERE id=?",
                [*updates.values(), base.now(), user_id],
            )

        fresh = connection.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        connection.execute(
            "UPDATE users SET profile_status = ? WHERE id = ?",
            (role_label(fresh, connection), user_id),
        )
        fresh = connection.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        return {"ok": True, "user": _admin_profile(fresh, connection)}


# =========================================================
# ADMIN ROLES
# =========================================================


@app.get("/admin/admins")
def admin_admins(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    _admin_user(authorization)
    with base.db() as connection:
        rows = connection.execute(
            "SELECT u.id, u.client_id, u.username, u.first_name, u.last_name, u.email, a.added_at "
            "FROM admins a JOIN users u ON u.id = a.user_id ORDER BY a.user_id",
        ).fetchall()

    return {
        "admins": [
            {**dict(row), "role": "owner" if base.is_owner(row) else "admin"}
            for row in rows
        ]
    }


@app.post("/admin/admins/{user_id}")
def admin_add_user(user_id: int, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    actor, owner = _admin_user(authorization)
    if not owner:
        raise HTTPException(status_code=403, detail="Добавлять администраторов может только владелец")

    with base.db() as connection:
        target = connection.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        if not target:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        connection.execute(
            "INSERT OR IGNORE INTO admins(user_id, added_at) VALUES (?, ?)",
            (user_id, base.now()),
        )
        connection.execute(
            "UPDATE users SET profile_status = ? WHERE id = ?",
            (role_label(target, connection), user_id),
        )

    return {"ok": True, "message": "Администратор добавлен", "actor_id": actor["id"]}


@app.delete("/admin/admins/{user_id}")
def admin_remove_user(user_id: int, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    actor, owner = _admin_user(authorization)
    if not owner:
        raise HTTPException(status_code=403, detail="Удалять администраторов может только владелец")

    with base.db() as connection:
        target = connection.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        if not target:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        if base.is_owner(target):
            raise HTTPException(status_code=400, detail="Нельзя удалить владельца")

        connection.execute("DELETE FROM admins WHERE user_id = ?", (user_id,))
        connection.execute(
            "UPDATE users SET profile_status = ? WHERE id = ?",
            (role_label(target, connection), user_id),
        )

    return {"ok": True, "message": "Администратор удалён", "actor_id": actor["id"]}


# =========================================================
# USER-OWNED PROFILE UPDATE
# =========================================================


base.app.router.routes = [
    route
    for route in base.app.router.routes
    if not (
        getattr(route, "path", None) == "/me/profile"
        and "PUT" in (getattr(route, "methods", set()) or set())
    )
]


@app.put("/me/profile")
def update_profile(
    data: base.ProfileUpdate,
    x_sxron_client_id: str | None = Header(default=None),
):
    user = base.current_user(x_sxron_client_id)
    updates: dict[str, Any] = {}

    for field in (
        "display_name",
        "bio",
        "avatar_url",
        "profile_accent",
        "profile_banner",
        "avatar_shape",
        "username_visible",
        "badges_visible",
        "activity_visible",
    ):
        value = getattr(data, field)
        if value is not None:
            updates[field] = (
                int(value)
                if field in ("username_visible", "badges_visible", "activity_visible")
                else (value.strip() if isinstance(value, str) else value)
            )

    if data.city_id is not None:
        with base.db() as connection:
            if not connection.execute("SELECT 1 FROM cities WHERE id = ?", (data.city_id,)).fetchone():
                raise HTTPException(status_code=400, detail="Город не найден")
        updates["city_id"] = data.city_id

    if updates:
        with base.db() as connection:
            connection.execute(
                f"UPDATE users SET {', '.join(f'{key}=?' for key in updates)}, last_seen_at=? WHERE id=?",
                [*updates.values(), base.now(), user["id"]],
            )

    with base.db() as connection:
        fresh = connection.execute("SELECT * FROM users WHERE id=?", (user["id"],)).fetchone()
        connection.execute(
            "UPDATE users SET profile_status=? WHERE id=?",
            (role_label(fresh, connection), fresh["id"]),
        )
        fresh = connection.execute("SELECT * FROM users WHERE id=?", (user["id"],)).fetchone()
        result = base.user_dict(fresh, connection)

    return {
        "user": result,
        "is_admin": base.is_admin(user["id"]),
        "is_owner": base.is_owner(user),
    }
