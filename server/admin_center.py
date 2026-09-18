from __future__ import annotations

from typing import Any

from fastapi import Header, HTTPException
from pydantic import BaseModel, Field

import server.main as base
import server.public_api as public_api


APP_VERSION = "1.2.16"


def _ensure_schema() -> None:
    with base.db() as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS admin_audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                admin_id INTEGER NOT NULL,
                action TEXT NOT NULL,
                target_type TEXT,
                target_id INTEGER,
                details TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY(admin_id) REFERENCES users(id) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                reporter_id INTEGER,
                target_user_id INTEGER,
                product_id INTEGER,
                reason TEXT NOT NULL,
                comment TEXT DEFAULT '',
                status TEXT NOT NULL DEFAULT 'open',
                admin_id INTEGER,
                created_at TEXT NOT NULL,
                resolved_at TEXT,
                FOREIGN KEY(reporter_id) REFERENCES users(id) ON DELETE SET NULL,
                FOREIGN KEY(target_user_id) REFERENCES users(id) ON DELETE SET NULL,
                FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE SET NULL,
                FOREIGN KEY(admin_id) REFERENCES users(id) ON DELETE SET NULL
            );
            CREATE TABLE IF NOT EXISTS reviews (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                reviewer_id INTEGER,
                seller_id INTEGER NOT NULL,
                product_id INTEGER,
                rating INTEGER NOT NULL,
                text TEXT DEFAULT '',
                status TEXT NOT NULL DEFAULT 'pending',
                admin_id INTEGER,
                created_at TEXT NOT NULL,
                moderated_at TEXT,
                FOREIGN KEY(reviewer_id) REFERENCES users(id) ON DELETE SET NULL,
                FOREIGN KEY(seller_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE SET NULL,
                FOREIGN KEY(admin_id) REFERENCES users(id) ON DELETE SET NULL
            );
            CREATE TABLE IF NOT EXISTS broadcasts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                message TEXT NOT NULL,
                audience TEXT NOT NULL DEFAULT 'all',
                status TEXT NOT NULL DEFAULT 'draft',
                created_by INTEGER,
                created_at TEXT NOT NULL,
                FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
            );
            CREATE TABLE IF NOT EXISTS app_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL DEFAULT '',
                updated_at TEXT NOT NULL,
                updated_by INTEGER,
                FOREIGN KEY(updated_by) REFERENCES users(id) ON DELETE SET NULL
            );
            """
        )
        cols = {row[1] for row in connection.execute("PRAGMA table_info(users)").fetchall()}
        if "is_blocked" not in cols:
            connection.execute("ALTER TABLE users ADD COLUMN is_blocked INTEGER NOT NULL DEFAULT 0")
        if "blocked_until" not in cols:
            connection.execute("ALTER TABLE users ADD COLUMN blocked_until TEXT")
        if "blocked_reason" not in cols:
            connection.execute("ALTER TABLE users ADD COLUMN blocked_reason TEXT")
        admin_cols = {row[1] for row in connection.execute("PRAGMA table_info(admins)").fetchall()}
        if "role" not in admin_cols:
            connection.execute("ALTER TABLE admins ADD COLUMN role TEXT NOT NULL DEFAULT 'admin'")

        # Старые базы SXRON могли быть созданы до трекинга устройств.
        # Добавляем все поля, которые использует раздел "Безопасность".
        session_table = connection.execute(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name='auth_sessions'"
        ).fetchone()
        if session_table:
            session_cols = {
                row[1] for row in connection.execute("PRAGMA table_info(auth_sessions)").fetchall()
            }
            for name, definition in {
                "ip_address": "TEXT",
                "user_agent": "TEXT",
                "device": "TEXT",
                "platform": "TEXT",
                "client_type": "TEXT",
            }.items():
                if name not in session_cols:
                    connection.execute(
                        f"ALTER TABLE auth_sessions ADD COLUMN {name} {definition}"
                    )


class ProductModeration(BaseModel):
    status: str | None = None
    available: bool | None = None
    name: str | None = Field(default=None, max_length=200)
    description: str | None = Field(default=None, max_length=4000)
    price: float | None = Field(default=None, ge=0)
    category_id: int | None = None
    city_id: int | None = None


class ReportCreate(BaseModel):
    target_user_id: int | None = None
    product_id: int | None = None
    reason: str = Field(min_length=2, max_length=120)
    comment: str = Field(default="", max_length=2000)


class ModerationDecision(BaseModel):
    status: str


class AdminRoleUpdate(BaseModel):
    role: str


class DirectoryUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    slug: str | None = Field(default=None, max_length=120)
    icon: str | None = Field(default=None, max_length=12)


class SettingUpdate(BaseModel):
    value: str = Field(max_length=4000)


class BroadcastCreate(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    message: str = Field(min_length=1, max_length=10000)
    audience: str = Field(default="all", max_length=40)


def _actor(authorization: str | None) -> tuple[Any, bool, str]:
    user, owner = public_api._admin_user(authorization)
    with base.db() as connection:
        row = connection.execute("SELECT role FROM admins WHERE user_id = ?", (user["id"],)).fetchone()
    role = "owner" if owner else (row["role"] if row and row["role"] in {"admin", "moderator"} else "admin")
    return user, owner, role


def _require(authorization: str | None, area: str = "admin") -> tuple[Any, bool, str]:
    actor, owner, role = _actor(authorization)
    if owner:
        return actor, owner, role
    if area == "security" and role != "admin":
        raise HTTPException(status_code=403, detail="Раздел доступен администраторам")
    if area == "settings":
        raise HTTPException(status_code=403, detail="Настройки доступны только владельцу")
    return actor, owner, role


def _audit(actor_id: int, action: str, target_type: str | None = None, target_id: int | None = None, details: str = "") -> None:
    with base.db() as connection:
        connection.execute(
            "INSERT INTO admin_audit_logs(admin_id, action, target_type, target_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (actor_id, action, target_type, target_id, details, base.now()),
        )


def _user_center(row: Any, connection: Any) -> dict[str, Any]:
    data = public_api._admin_profile(row, connection)
    admin = connection.execute("SELECT role FROM admins WHERE user_id = ?", (row["id"],)).fetchone()
    sessions = connection.execute(
        "SELECT COUNT(*) FROM auth_sessions WHERE user_id = ? AND revoked_at IS NULL AND expires_at > ?",
        (row["id"], base.now()),
    ).fetchone()[0] if connection.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='auth_sessions'").fetchone() else 0
    data.update({
        "is_blocked": bool(row["is_blocked"]),
        "blocked_until": row["blocked_until"],
        "blocked_reason": row["blocked_reason"],
        "admin_role": "owner" if base.is_owner(row) else (admin["role"] if admin else None),
        "active_sessions": sessions,
    })
    return data


def register(app: Any) -> None:
    _ensure_schema()
    base.APP_VERSION = APP_VERSION
    app.version = APP_VERSION

    @app.get("/admin/center/dashboard")
    def center_dashboard(authorization: str | None = Header(default=None)) -> dict[str, Any]:
        actor, owner, role = _require(authorization)
        with base.db() as connection:
            stats = {
                "users": connection.execute("SELECT COUNT(*) FROM users").fetchone()[0],
                "active_users": connection.execute("SELECT COUNT(*) FROM users WHERE is_blocked = 0").fetchone()[0],
                "blocked_users": connection.execute("SELECT COUNT(*) FROM users WHERE is_blocked = 1").fetchone()[0],
                "products": connection.execute("SELECT COUNT(*) FROM products").fetchone()[0],
                "active_products": connection.execute("SELECT COUNT(*) FROM products WHERE available = 1 AND status = 'active'").fetchone()[0],
                "pending_products": connection.execute("SELECT COUNT(*) FROM products WHERE status = 'pending'").fetchone()[0],
                "sold_products": connection.execute("SELECT COUNT(*) FROM products WHERE status = 'sold'").fetchone()[0],
                "reports": connection.execute("SELECT COUNT(*) FROM reports WHERE status = 'open'").fetchone()[0],
                "reviews": connection.execute("SELECT COUNT(*) FROM reviews WHERE status = 'pending'").fetchone()[0],
                "admins": connection.execute("SELECT COUNT(*) FROM admins").fetchone()[0],
                "categories": connection.execute("SELECT COUNT(*) FROM categories").fetchone()[0],
                "cities": connection.execute("SELECT COUNT(*) FROM cities").fetchone()[0],
            }
            recent = [dict(row) for row in connection.execute(
                "SELECT l.id, l.action, l.target_type, l.target_id, l.details, l.created_at, u.display_name, u.username "
                "FROM admin_audit_logs l LEFT JOIN users u ON u.id = l.admin_id ORDER BY l.id DESC LIMIT 12"
            ).fetchall()]
        return {"version": APP_VERSION, "is_owner": owner, "role": role, "user": {"id": actor["id"], "display_name": actor["display_name"] or actor["first_name"] or "Пользователь", "username": actor["username"], "email": public_api._value(actor, "email")}, "stats": stats, "recent": recent}

    @app.get("/admin/center/users")
    def center_users(search: str | None = None, state: str = "all", authorization: str | None = Header(default=None)) -> dict[str, Any]:
        _require(authorization)
        with base.db() as connection:
            sql = "SELECT * FROM users WHERE 1=1"
            values: list[Any] = []
            if state == "blocked": sql += " AND is_blocked = 1"
            if state == "active": sql += " AND is_blocked = 0"
            if state == "admins": sql += " AND id IN (SELECT user_id FROM admins)"
            if state == "new": sql += " AND created_at >= ?"; values.append(base.now()[:10])
            if search:
                pattern = f"%{search.strip().lower()}%"
                sql += " AND (LOWER(COALESCE(display_name,'')) LIKE ? OR LOWER(COALESCE(username,'')) LIKE ? OR LOWER(COALESCE(email,'')) LIKE ? OR CAST(id AS TEXT) LIKE ? OR LOWER(COALESCE(client_id,'')) LIKE ?)"
                values.extend([pattern, pattern, pattern, pattern, pattern])
            sql += " ORDER BY id DESC LIMIT 500"
            rows = connection.execute(sql, values).fetchall()
            return {"users": [_user_center(row, connection) for row in rows]}

    @app.get("/admin/center/users/{user_id}")
    def center_user(user_id: int, authorization: str | None = Header(default=None)) -> dict[str, Any]:
        _require(authorization)
        with base.db() as connection:
            row = connection.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
            if not row: raise HTTPException(status_code=404, detail="Пользователь не найден")
            return {"user": _user_center(row, connection)}

    @app.post("/admin/center/users/{user_id}/block")
    def center_block_user(user_id: int, reason: str = "Нарушение правил", authorization: str | None = Header(default=None)) -> dict[str, Any]:
        actor, owner, _ = _require(authorization)
        with base.db() as connection:
            target = connection.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
            if not target: raise HTTPException(status_code=404, detail="Пользователь не найден")
            if base.is_owner(target): raise HTTPException(status_code=400, detail="Владельца нельзя заблокировать")
            connection.execute("UPDATE users SET is_blocked = 1, blocked_reason = ?, last_seen_at = ? WHERE id = ?", (reason[:500], base.now(), user_id))
            table = connection.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='auth_sessions'").fetchone()
            if table: connection.execute("UPDATE auth_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL", (base.now(), user_id))
        _audit(actor["id"], "Заблокировал пользователя", "user", user_id, reason[:500])
        return {"ok": True}

    @app.post("/admin/center/users/{user_id}/unblock")
    def center_unblock_user(user_id: int, authorization: str | None = Header(default=None)) -> dict[str, Any]:
        actor, _, _ = _require(authorization)
        with base.db() as connection:
            target = connection.execute("SELECT id FROM users WHERE id = ?", (user_id,)).fetchone()
            if not target: raise HTTPException(status_code=404, detail="Пользователь не найден")
            connection.execute("UPDATE users SET is_blocked = 0, blocked_until = NULL, blocked_reason = NULL WHERE id = ?", (user_id,))
        _audit(actor["id"], "Разблокировал пользователя", "user", user_id)
        return {"ok": True}

    @app.post("/admin/center/users/{user_id}/terminate-sessions")
    def center_terminate_sessions(user_id: int, authorization: str | None = Header(default=None)) -> dict[str, Any]:
        actor, _, _ = _require(authorization, "security")
        with base.db() as connection:
            if not connection.execute("SELECT id FROM users WHERE id = ?", (user_id,)).fetchone(): raise HTTPException(status_code=404, detail="Пользователь не найден")
            if not connection.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='auth_sessions'").fetchone(): return {"ok": True, "count": 0}
            cursor = connection.execute("UPDATE auth_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL", (base.now(), user_id))
            count = cursor.rowcount
        _audit(actor["id"], "Завершил все сессии пользователя", "user", user_id)
        return {"ok": True, "count": count}

    @app.get("/admin/center/products")
    def center_products(search: str | None = None, status: str = "all", authorization: str | None = Header(default=None)) -> dict[str, Any]:
        _require(authorization)
        with base.db() as connection:
            sql = "SELECT p.*, c.name AS category_name, ci.name AS city_name, u.display_name AS seller_name, u.username AS seller_username FROM products p LEFT JOIN categories c ON c.id=p.category_id LEFT JOIN cities ci ON ci.id=p.city_id LEFT JOIN users u ON u.id=p.created_by WHERE 1=1"
            values: list[Any] = []
            if status == "hidden": sql += " AND p.available = 0"
            elif status == "active": sql += " AND p.available = 1 AND p.status = 'active'"
            elif status != "all": sql += " AND p.status = ?"; values.append(status)
            if search:
                pattern = f"%{search.lower().strip()}%"
                sql += " AND (LOWER(p.name) LIKE ? OR LOWER(p.description) LIKE ? OR CAST(p.id AS TEXT) LIKE ? OR LOWER(COALESCE(u.username,'')) LIKE ? OR LOWER(COALESCE(u.display_name,'')) LIKE ?)"
                values.extend([pattern, pattern, pattern, pattern, pattern])
            sql += " ORDER BY p.id DESC LIMIT 500"
            rows = connection.execute(sql, values).fetchall()
            return {"products": [dict(row) for row in rows]}

    @app.patch("/admin/center/products/{product_id}")
    def center_product_update(product_id: int, data: ProductModeration, authorization: str | None = Header(default=None)) -> dict[str, Any]:
        actor, _, _ = _require(authorization, "moderation")
        payload = data.model_dump(exclude_unset=True)
        updates: dict[str, Any] = {}
        allowed_status = {"active", "pending", "rejected", "hidden", "sold"}
        if "status" in payload:
            if payload["status"] not in allowed_status: raise HTTPException(status_code=400, detail="Недопустимый статус")
            updates["status"] = payload["status"]
        for key in ("name", "description"):
            if key in payload: updates[key] = str(payload[key] or "").strip()
        for key in ("price", "category_id", "city_id"):
            if key in payload: updates[key] = payload[key]
        if "available" in payload: updates["available"] = int(bool(payload["available"]))
        if updates:
            updates["updated_at"] = base.now()
            with base.db() as connection:
                target = connection.execute("SELECT id FROM products WHERE id = ?", (product_id,)).fetchone()
                if not target: raise HTTPException(status_code=404, detail="Объявление не найдено")
                connection.execute(f"UPDATE products SET {', '.join(f'{key}=?' for key in updates)} WHERE id=?", [*updates.values(), product_id])
        _audit(actor["id"], "Изменил объявление", "product", product_id, str(payload))
        return {"ok": True}

    @app.delete("/admin/center/products/{product_id}")
    def center_product_delete(product_id: int, authorization: str | None = Header(default=None)) -> dict[str, Any]:
        actor, _, _ = _require(authorization, "moderation")
        with base.db() as connection:
            if not connection.execute("SELECT id FROM products WHERE id = ?", (product_id,)).fetchone(): raise HTTPException(status_code=404, detail="Объявление не найдено")
            connection.execute("DELETE FROM products WHERE id = ?", (product_id,))
        _audit(actor["id"], "Удалил объявление", "product", product_id)
        return {"ok": True}

    @app.get("/admin/center/reports")
    def center_reports(status: str = "all", authorization: str | None = Header(default=None)) -> dict[str, Any]:
        _require(authorization)
        with base.db() as connection:
            sql = "SELECT r.*, ru.display_name AS reporter_name, ru.username AS reporter_username, tu.display_name AS target_name, tu.username AS target_username, p.name AS product_name, au.display_name AS admin_name FROM reports r LEFT JOIN users ru ON ru.id=r.reporter_id LEFT JOIN users tu ON tu.id=r.target_user_id LEFT JOIN products p ON p.id=r.product_id LEFT JOIN users au ON au.id=r.admin_id WHERE 1=1"
            values: list[Any] = []
            if status != "all": sql += " AND r.status = ?"; values.append(status)
            sql += " ORDER BY r.id DESC LIMIT 500"
            return {"reports": [dict(row) for row in connection.execute(sql, values).fetchall()]}

    @app.post("/reports")
    def create_report(data: ReportCreate, x_sxron_client_id: str | None = Header(default=None)) -> dict[str, Any]:
        reporter = base.current_user(x_sxron_client_id)
        with base.db() as connection:
            if data.product_id and not connection.execute("SELECT id FROM products WHERE id = ?", (data.product_id,)).fetchone(): raise HTTPException(status_code=404, detail="Объявление не найдено")
            connection.execute("INSERT INTO reports(reporter_id,target_user_id,product_id,reason,comment,status,created_at) VALUES (?,?,?,?,?,?,?)", (reporter["id"],data.target_user_id,data.product_id,data.reason.strip(),data.comment.strip(),"open",base.now()))
            report_id = connection.execute("SELECT last_insert_rowid()").fetchone()[0]
        return {"ok": True, "id": report_id}

    @app.post("/admin/center/reports/{report_id}/resolve")
    def center_report_resolve(report_id: int, data: ModerationDecision, authorization: str | None = Header(default=None)) -> dict[str, Any]:
        actor, _, _ = _require(authorization, "moderation")
        if data.status not in {"confirmed", "rejected", "open"}: raise HTTPException(status_code=400, detail="Недопустимый статус жалобы")
        with base.db() as connection:
            if not connection.execute("SELECT id FROM reports WHERE id = ?", (report_id,)).fetchone(): raise HTTPException(status_code=404, detail="Жалоба не найдена")
            connection.execute("UPDATE reports SET status=?, admin_id=?, resolved_at=? WHERE id=?", (data.status,actor["id"],None if data.status=="open" else base.now(),report_id))
        _audit(actor["id"], "Рассмотрел жалобу", "report", report_id, data.status)
        return {"ok": True}

    @app.get("/admin/center/reviews")
    def center_reviews(status: str = "all", authorization: str | None = Header(default=None)) -> dict[str, Any]:
        _require(authorization)
        with base.db() as connection:
            sql = "SELECT r.*, ru.display_name AS reviewer_name, su.display_name AS seller_name, p.name AS product_name FROM reviews r LEFT JOIN users ru ON ru.id=r.reviewer_id JOIN users su ON su.id=r.seller_id LEFT JOIN products p ON p.id=r.product_id WHERE 1=1"
            values: list[Any] = []
            if status != "all": sql += " AND r.status = ?"; values.append(status)
            sql += " ORDER BY r.id DESC LIMIT 500"
            return {"reviews": [dict(row) for row in connection.execute(sql, values).fetchall()]}

    @app.post("/admin/center/reviews/{review_id}/moderate")
    def center_review_moderate(review_id: int, data: ModerationDecision, authorization: str | None = Header(default=None)) -> dict[str, Any]:
        actor, _, _ = _require(authorization, "moderation")
        if data.status not in {"approved", "rejected", "pending"}: raise HTTPException(status_code=400, detail="Недопустимый статус отзыва")
        with base.db() as connection:
            if not connection.execute("SELECT id FROM reviews WHERE id = ?", (review_id,)).fetchone(): raise HTTPException(status_code=404, detail="Отзыв не найден")
            connection.execute("UPDATE reviews SET status=?, admin_id=?, moderated_at=? WHERE id=?", (data.status,actor["id"],None if data.status=="pending" else base.now(),review_id))
        _audit(actor["id"], "Промодерировал отзыв", "review", review_id, data.status)
        return {"ok": True}

    @app.post("/reviews")
    def create_review(seller_id: int, rating: int, text: str = "", product_id: int | None = None, x_sxron_client_id: str | None = Header(default=None)) -> dict[str, Any]:
        reviewer = base.current_user(x_sxron_client_id)
        if not 1 <= int(rating) <= 5: raise HTTPException(status_code=400, detail="Оценка должна быть от 1 до 5")
        with base.db() as connection:
            if not connection.execute("SELECT id FROM users WHERE id = ?", (seller_id,)).fetchone(): raise HTTPException(status_code=404, detail="Продавец не найден")
            connection.execute("INSERT INTO reviews(reviewer_id,seller_id,product_id,rating,text,status,created_at) VALUES (?,?,?,?,?,?,?)", (reviewer["id"],seller_id,product_id,int(rating),text[:2000],"pending",base.now()))
        return {"ok": True}

    @app.get("/admin/center/audit")
    def center_audit(limit: int = 200, authorization: str | None = Header(default=None)) -> dict[str, Any]:
        _require(authorization, "security")
        limit = max(1, min(limit, 500))
        with base.db() as connection:
            rows = connection.execute("SELECT l.*, u.display_name, u.username FROM admin_audit_logs l LEFT JOIN users u ON u.id=l.admin_id ORDER BY l.id DESC LIMIT ?", (limit,)).fetchall()
        return {"logs": [dict(row) for row in rows]}

    @app.get("/admin/center/admins")
    def center_admins(authorization: str | None = Header(default=None)) -> dict[str, Any]:
        _require(authorization)
        with base.db() as connection:
            rows = connection.execute(
                "SELECT a.user_id, a.added_at, COALESCE(a.role,'admin') AS role, "
                "u.client_id, u.display_name, u.username, u.first_name, u.last_name, u.email "
                "FROM admins a JOIN users u ON u.id=a.user_id ORDER BY a.added_at"
            ).fetchall()
        admins = []
        for row in rows:
            item = dict(row)
            item["role"] = "owner" if base.is_owner(row) else (
                row["role"] if row["role"] in {"admin", "moderator"} else "admin"
            )
            admins.append(item)
        return {"admins": admins}

    @app.patch("/admin/center/admins/{user_id}")
    def center_admin_role(user_id: int, data: AdminRoleUpdate, authorization: str | None = Header(default=None)) -> dict[str, Any]:
        actor, owner, _ = _require(authorization, "settings")
        if not owner: raise HTTPException(status_code=403, detail="Только владелец может менять роли")
        if data.role not in {"admin", "moderator"}: raise HTTPException(status_code=400, detail="Недопустимая роль")
        with base.db() as connection:
            target = connection.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
            if not target: raise HTTPException(status_code=404, detail="Пользователь не найден")
            if base.is_owner(target): raise HTTPException(status_code=400, detail="Роль владельца нельзя изменить")
            connection.execute("UPDATE admins SET role = ? WHERE user_id = ?", (data.role, user_id))
            if not connection.execute("SELECT 1 FROM admins WHERE user_id = ?", (user_id,)).fetchone():
                connection.execute("INSERT INTO admins(user_id,added_at,role) VALUES (?,?,?)", (user_id,base.now(),data.role))
        _audit(actor["id"], "Изменил роль администратора", "user", user_id, data.role)
        return {"ok": True}

    @app.get("/admin/center/directory")
    def center_directory(kind: str, authorization: str | None = Header(default=None)) -> dict[str, Any]:
        _require(authorization)
        table = "categories" if kind == "categories" else "cities" if kind == "cities" else None
        if not table: raise HTTPException(status_code=400, detail="Неизвестный справочник")
        with base.db() as connection:
            rows = connection.execute(f"SELECT * FROM {table} ORDER BY id").fetchall()
        return {kind: [dict(row) for row in rows]}

    @app.post("/admin/center/directory/{kind}")
    def center_directory_add(kind: str, data: DirectoryUpdate, authorization: str | None = Header(default=None)) -> dict[str, Any]:
        actor, owner, _ = _require(authorization, "settings")
        if not owner: raise HTTPException(status_code=403, detail="Только владелец может менять справочники")
        table = "categories" if kind == "categories" else "cities" if kind == "cities" else None
        if not table: raise HTTPException(status_code=400, detail="Неизвестный справочник")
        slug = (data.slug or data.name.lower().replace(" ", "-")).strip()
        with base.db() as connection:
            try:
                if table == "categories": connection.execute("INSERT INTO categories(name,slug,icon) VALUES (?,?,?)", (data.name.strip(),slug,(data.icon or "◈").strip()))
                else: connection.execute("INSERT INTO cities(name,slug) VALUES (?,?)", (data.name.strip(),slug))
            except Exception as exc:
                raise HTTPException(status_code=400, detail="Запись с таким названием или slug уже существует") from exc
        _audit(actor["id"], f"Добавил {kind}")
        return {"ok": True}

    @app.patch("/admin/center/directory/{kind}/{item_id}")
    def center_directory_update(kind: str, item_id: int, data: DirectoryUpdate, authorization: str | None = Header(default=None)) -> dict[str, Any]:
        actor, owner, _ = _require(authorization, "settings")
        if not owner: raise HTTPException(status_code=403, detail="Только владелец может менять справочники")
        table = "categories" if kind == "categories" else "cities" if kind == "cities" else None
        if not table: raise HTTPException(status_code=400, detail="Неизвестный справочник")
        with base.db() as connection:
            if not connection.execute(f"SELECT id FROM {table} WHERE id = ?", (item_id,)).fetchone(): raise HTTPException(status_code=404, detail="Запись не найдена")
            if table == "categories": connection.execute("UPDATE categories SET name=?,slug=?,icon=? WHERE id=?", (data.name.strip(),(data.slug or data.name.lower().replace(" ", "-")).strip(),(data.icon or "◈").strip(),item_id))
            else: connection.execute("UPDATE cities SET name=?,slug=? WHERE id=?", (data.name.strip(),(data.slug or data.name.lower().replace(" ", "-")).strip(),item_id))
        _audit(actor["id"], f"Изменил {kind}", kind[:-1], item_id)
        return {"ok": True}

    @app.delete("/admin/center/directory/{kind}/{item_id}")
    def center_directory_delete(kind: str, item_id: int, authorization: str | None = Header(default=None)) -> dict[str, Any]:
        actor, owner, _ = _require(authorization, "settings")
        if not owner: raise HTTPException(status_code=403, detail="Только владелец может менять справочники")
        table = "categories" if kind == "categories" else "cities" if kind == "cities" else None
        if not table: raise HTTPException(status_code=400, detail="Неизвестный справочник")
        with base.db() as connection:
            usage_column = "category_id" if table == "categories" else "city_id"
            used = connection.execute(f"SELECT COUNT(*) FROM products WHERE {usage_column} = ?", (item_id,)).fetchone()[0]
            if used: raise HTTPException(status_code=400, detail="Нельзя удалить запись, пока она используется объявлениями")
            connection.execute(f"DELETE FROM {table} WHERE id=?", (item_id,))
        _audit(actor["id"], f"Удалил {kind}", kind[:-1], item_id)
        return {"ok": True}

    @app.get("/admin/center/settings")
    def center_settings(authorization: str | None = Header(default=None)) -> dict[str, Any]:
        _require(authorization, "settings")
        with base.db() as connection:
            rows = connection.execute("SELECT key,value,updated_at FROM app_settings ORDER BY key").fetchall()
        return {"settings": [dict(row) for row in rows]}

    @app.patch("/admin/center/settings/{key}")
    def center_setting(key: str, data: SettingUpdate, authorization: str | None = Header(default=None)) -> dict[str, Any]:
        actor, owner, _ = _require(authorization, "settings")
        if not owner: raise HTTPException(status_code=403, detail="Только владелец может изменять настройки")
        with base.db() as connection:
            connection.execute("INSERT INTO app_settings(key,value,updated_at,updated_by) VALUES (?,?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at,updated_by=excluded.updated_by", (key,data.value,base.now(),actor["id"]))
        _audit(actor["id"], "Изменил системную настройку", "setting", None, key)
        return {"ok": True}

    @app.get("/admin/center/broadcasts")
    def center_broadcasts(authorization: str | None = Header(default=None)) -> dict[str, Any]:
        _require(authorization)
        with base.db() as connection:
            rows = connection.execute("SELECT b.*,u.display_name AS creator_name FROM broadcasts b LEFT JOIN users u ON u.id=b.created_by ORDER BY b.id DESC LIMIT 200").fetchall()
        return {"broadcasts": [dict(row) for row in rows]}

    @app.post("/admin/center/broadcasts")
    def center_broadcast_create(data: BroadcastCreate, authorization: str | None = Header(default=None)) -> dict[str, Any]:
        actor, _, _ = _require(authorization)
        if data.audience not in {"all", "active", "sellers", "buyers", "city"}: raise HTTPException(status_code=400, detail="Недопустимая аудитория")
        with base.db() as connection:
            connection.execute("INSERT INTO broadcasts(title,message,audience,status,created_by,created_at) VALUES (?,?,?,?,?,?)", (data.title.strip(),data.message.strip(),data.audience,"draft",actor["id"],base.now()))
        _audit(actor["id"], "Создал рассылку", "broadcast")
        return {"ok": True}

    @app.post("/admin/center/broadcasts/{broadcast_id}/queue")
    def center_broadcast_queue(broadcast_id: int, authorization: str | None = Header(default=None)) -> dict[str, Any]:
        actor, _, _ = _require(authorization)
        with base.db() as connection:
            if not connection.execute("SELECT id FROM broadcasts WHERE id=?", (broadcast_id,)).fetchone(): raise HTTPException(status_code=404, detail="Рассылка не найдена")
            connection.execute("UPDATE broadcasts SET status='queued' WHERE id=?", (broadcast_id,))
        _audit(actor["id"], "Поставил рассылку в очередь", "broadcast", broadcast_id)
        return {"ok": True}

    @app.get("/admin/center/security/sessions")
    def center_security_sessions(authorization: str | None = Header(default=None)) -> dict[str, Any]:
        _require(authorization, "security")
        with base.db() as connection:
            if not connection.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='auth_sessions'").fetchone(): return {"sessions": []}
            rows = connection.execute("SELECT s.id,s.user_id,s.created_at,s.expires_at,s.revoked_at,s.ip_address,s.user_agent,s.device,s.platform,s.client_type,u.display_name,u.username FROM auth_sessions s JOIN users u ON u.id=s.user_id ORDER BY s.id DESC LIMIT 300").fetchall()
        return {"sessions": [dict(row) for row in rows]}


register_app = register
register_app(base.app)
