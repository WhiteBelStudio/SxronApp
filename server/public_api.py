from __future__ import annotations

import hashlib
from typing import Any

from fastapi import Header, HTTPException

import server.main as base

app = base.app
base.APP_VERSION = "1.1.17"
base.app.version = base.APP_VERSION
init_db = base.init_db


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


@app.get("/public/sellers/{user_id}")
def get_public_seller(user_id: int) -> dict[str, Any]:
    """Return the public seller card, statistics, reviews and active listings."""
    with base.db() as connection:
        user = connection.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="Продавец не найден")
        seller = base.user_dict(user, connection)
        listings_rows = connection.execute(
            "SELECT * FROM products WHERE created_by = ? AND available = 1 ORDER BY id DESC",
            (user_id,),
        ).fetchall()
        reviews_count = int(seller.get("reviews_count") or 0)
        rating = seller.get("rating")

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
    seller["reviews_count"] = reviews_count
    seller["rating"] = rating

    listings = [base.product_dict(row) for row in listings_rows]
    return {
        "seller": seller,
        "listings": listings,
        "rating": rating,
        "reviews_count": reviews_count,
        "reviews": [],
    }


def _admin_user(authorization: str | None) -> tuple[Any, bool]:
    """Resolve an authenticated admin from the bearer session."""
    token = authorization[7:].strip() if authorization and authorization.lower().startswith("bearer ") else None
    if not token:
        raise HTTPException(status_code=401, detail="Требуется авторизация")
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    with base.db() as connection:
        user = connection.execute(
            "SELECT u.* FROM auth_sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > ?",
            (token_hash, base.now()),
        ).fetchone()
    if not user:
        raise HTTPException(status_code=401, detail="Сессия истекла")
    if not base.is_admin(user["id"]):
        raise HTTPException(status_code=403, detail="Доступ только для администратора")
    return user, base.is_owner(user)


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
            "email": user["email"],
            "email_verified": bool(user["email_verified"]),
        },
        "is_owner": owner,
        "stats": stats,
    }


@app.get("/admin/users")
def admin_users(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    _admin_user(authorization)
    with base.db() as connection:
        rows = connection.execute(
            "SELECT u.*, EXISTS(SELECT 1 FROM admins a WHERE a.user_id = u.id) AS is_admin FROM users u ORDER BY u.id DESC LIMIT 200"
        ).fetchall()
        result: list[dict[str, Any]] = []
        for row in rows:
            listings = connection.execute("SELECT COUNT(*) FROM products WHERE created_by = ?", (row["id"],)).fetchone()[0]
            result.append({
                "id": row["id"],
                "display_name": row["display_name"] or row["first_name"] or "Пользователь",
                "username": row["username"],
                "email": row["email"],
                "email_verified": bool(row["email_verified"]),
                "phone_verified": bool(row["phone_verified"]),
                "created_at": row["created_at"],
                "last_seen_at": row["last_seen_at"],
                "listings_count": listings,
                "is_admin": bool(row["is_admin"]),
                "is_owner": base.is_owner(row),
            })
    return {"users": result}


@app.get("/admin/admins")
def admin_admins(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    _admin_user(authorization)
    with base.db() as connection:
        rows = connection.execute(
            "SELECT u.id, u.client_id, u.username, u.first_name, u.last_name, u.email, a.added_at FROM admins a JOIN users u ON u.id = a.user_id ORDER BY a.user_id"
        ).fetchall()
    return {"admins": [{**dict(row), "role": "owner" if base.is_owner(row) else "admin"} for row in rows]}


@app.post("/admin/admins/{user_id}")
def admin_add_user(user_id: int, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    actor, owner = _admin_user(authorization)
    if not owner:
        raise HTTPException(status_code=403, detail="Добавлять администраторов может только владелец")
    with base.db() as connection:
        target = connection.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        if not target:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        connection.execute("INSERT OR IGNORE INTO admins(user_id, added_at) VALUES (?, ?)", (user_id, base.now()))
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
    return {"ok": True, "message": "Администратор удалён", "actor_id": actor["id"]}


# Replace the old profile-update route so clients cannot write a custom profile status.
base.app.router.routes = [
    route for route in base.app.router.routes
    if not (getattr(route, "path", None) == "/me/profile" and "PUT" in (getattr(route, "methods", set()) or set()))
]


@app.put("/me/profile")
def update_profile(data: base.ProfileUpdate, x_sxron_client_id: str | None = Header(default=None)):
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
            updates[field] = int(value) if field in ("username_visible", "badges_visible", "activity_visible") else (value.strip() if isinstance(value, str) else value)

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
        connection.execute("UPDATE users SET profile_status=? WHERE id=?", (role_label(fresh, connection), fresh["id"]))
        fresh = connection.execute("SELECT * FROM users WHERE id=?", (user["id"],)).fetchone()
        result = base.user_dict(fresh, connection)
    return {"user": result, "is_admin": base.is_admin(user["id"]), "is_owner": base.is_owner(user)}
