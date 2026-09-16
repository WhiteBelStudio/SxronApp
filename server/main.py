from __future__ import annotations

import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

APP_VERSION = "1.0.5"
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = Path(os.getenv("SXRON_DATA_DIR", BASE_DIR / "data"))
DB_PATH = DATA_DIR / "sxron.db"
OWNER_CLIENT_ID = os.getenv("SXRON_OWNER_CLIENT_ID", "").strip()

app = FastAPI(title="SXRON API", version=APP_VERSION)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in os.getenv("SXRON_CORS_ORIGINS", "*").split(",") if origin.strip()],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def db() -> sqlite3.Connection:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def init_db() -> None:
    with db() as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                client_id TEXT NOT NULL UNIQUE,
                username TEXT,
                first_name TEXT,
                last_name TEXT,
                avatar_url TEXT,
                city_id INTEGER,
                bio TEXT,
                created_at TEXT NOT NULL,
                last_seen_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS cities (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                slug TEXT UNIQUE
            );

            CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                slug TEXT UNIQUE,
                icon TEXT
            );

            CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                price REAL NOT NULL DEFAULT 0,
                category_id INTEGER,
                city_id INTEGER,
                condition TEXT,
                delivery TEXT,
                image_url TEXT,
                available INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
                FOREIGN KEY (city_id) REFERENCES cities(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS favorites (
                user_id INTEGER NOT NULL,
                product_id INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                PRIMARY KEY (user_id, product_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS admins (
                user_id INTEGER PRIMARY KEY,
                role TEXT NOT NULL DEFAULT 'admin',
                added_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            """
        )

        if connection.execute("SELECT COUNT(*) FROM cities").fetchone()[0] == 0:
            connection.executemany(
                "INSERT INTO cities (name, slug) VALUES (?, ?)",
                [("Белореченск", "belorechensk"), ("Хутор Кубанский", "khutor-kubanskiy")],
            )

        if connection.execute("SELECT COUNT(*) FROM categories").fetchone()[0] == 0:
            connection.executemany(
                "INSERT INTO categories (name, slug, icon) VALUES (?, ?, ?)",
                [
                    ("Электроника", "electronics", "📱"),
                    ("Одежда", "clothing", "👕"),
                    ("Дом", "home", "🏠"),
                    ("Разное", "other", "📦"),
                ],
            )


def get_or_create_user(connection: sqlite3.Connection, client_id: str) -> sqlite3.Row:
    timestamp = now()
    connection.execute(
        """
        INSERT INTO users (client_id, created_at, last_seen_at)
        VALUES (?, ?, ?)
        ON CONFLICT(client_id) DO UPDATE SET last_seen_at = excluded.last_seen_at
        """,
        (client_id, timestamp, timestamp),
    )
    return connection.execute("SELECT * FROM users WHERE client_id = ?", (client_id,)).fetchone()


def require_client(client_id: str | None) -> str:
    if not client_id or not client_id.strip():
        raise HTTPException(status_code=400, detail="Не указан X-SXRON-Client-ID")
    return client_id.strip()


def is_admin(connection: sqlite3.Connection, user_id: int) -> bool:
    return connection.execute("SELECT 1 FROM admins WHERE user_id = ?", (user_id,)).fetchone() is not None


def is_owner(client_id: str) -> bool:
    return bool(OWNER_CLIENT_ID) and client_id == OWNER_CLIENT_ID


class ProductCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=4000)
    price: float = Field(default=0, ge=0)
    category_id: int | None = None
    city_id: int | None = None
    condition: str | None = None
    delivery: str | None = None
    image_url: str | None = None


class AdminRequest(BaseModel):
    user_id: int


@app.on_event("startup")
def startup() -> None:
    init_db()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "app": "SXRON Marketplace", "version": APP_VERSION}


@app.get("/products")
def products(
    search: str | None = Query(default=None),
    category: str | None = Query(default=None),
    city: str | None = Query(default=None),
) -> list[dict[str, Any]]:
    with db() as connection:
        sql = """
            SELECT p.*, c.name AS category_name, c.slug AS category_slug,
                   ci.name AS city_name, ci.slug AS city_slug
            FROM products p
            LEFT JOIN categories c ON c.id = p.category_id
            LEFT JOIN cities ci ON ci.id = p.city_id
            WHERE p.available = 1
        """
        params: list[Any] = []
        if search:
            sql += " AND (p.name LIKE ? OR p.description LIKE ?)"
            like = f"%{search}%"
            params.extend([like, like])
        if category:
            sql += " AND (c.slug = ? OR c.name = ?)"
            params.extend([category, category])
        if city:
            sql += " AND (ci.slug = ? OR ci.name = ?)"
            params.extend([city, city])
        sql += " ORDER BY p.created_at DESC"
        return [dict(row) for row in connection.execute(sql, params).fetchall()]


@app.get("/products/{product_id}")
def product(product_id: int) -> dict[str, Any]:
    with db() as connection:
        row = connection.execute(
            """
            SELECT p.*, c.name AS category_name, c.slug AS category_slug,
                   ci.name AS city_name, ci.slug AS city_slug
            FROM products p
            LEFT JOIN categories c ON c.id = p.category_id
            LEFT JOIN cities ci ON ci.id = p.city_id
            WHERE p.id = ? AND p.available = 1
            """,
            (product_id,),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Товар не найден")
        return dict(row)


@app.post("/products")
def create_product(
    payload: ProductCreate,
    x_sxron_client_id: str | None = Header(default=None),
) -> dict[str, Any]:
    client_id = require_client(x_sxron_client_id)
    with db() as connection:
        user = get_or_create_user(connection, client_id)
        if not (is_owner(client_id) or is_admin(connection, user["id"])):
            raise HTTPException(status_code=403, detail="Недостаточно прав")
        timestamp = now()
        cursor = connection.execute(
            """
            INSERT INTO products
                (name, description, price, category_id, city_id, condition, delivery, image_url, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                payload.name,
                payload.description,
                payload.price,
                payload.category_id,
                payload.city_id,
                payload.condition,
                payload.delivery,
                payload.image_url,
                timestamp,
                timestamp,
            ),
        )
        product_id = cursor.lastrowid
        row = connection.execute("SELECT * FROM products WHERE id = ?", (product_id,)).fetchone()
        return dict(row)


@app.get("/categories")
def categories() -> list[dict[str, Any]]:
    with db() as connection:
        return [dict(row) for row in connection.execute("SELECT * FROM categories ORDER BY name").fetchall()]


@app.get("/cities")
def cities() -> list[dict[str, Any]]:
    with db() as connection:
        return [dict(row) for row in connection.execute("SELECT * FROM cities ORDER BY name").fetchall()]


@app.get("/me")
def me(x_sxron_client_id: str | None = Header(default=None)) -> dict[str, Any]:
    client_id = require_client(x_sxron_client_id)
    with db() as connection:
        user = get_or_create_user(connection, client_id)
        admin = is_admin(connection, user["id"])
        owner = is_owner(client_id)
        return {
            "user": dict(user),
            "is_admin": admin or owner,
            "is_owner": owner,
        }


@app.get("/admins")
def admins(x_sxron_client_id: str | None = Header(default=None)) -> dict[str, Any]:
    client_id = require_client(x_sxron_client_id)
    with db() as connection:
        user = get_or_create_user(connection, client_id)
        if not is_owner(client_id):
            raise HTTPException(status_code=403, detail="Только владелец может управлять администраторами")
        rows = connection.execute(
            """
            SELECT u.id, u.username, u.first_name, u.last_name,
                   a.role, a.added_at
            FROM admins a
            JOIN users u ON u.id = a.user_id
            ORDER BY a.added_at DESC
            """
        ).fetchall()
        return {"admins": [dict(row) for row in rows]}


@app.post("/admins/add")
def add_admin(
    payload: AdminRequest,
    x_sxron_client_id: str | None = Header(default=None),
) -> dict[str, Any]:
    client_id = require_client(x_sxron_client_id)
    with db() as connection:
        if not is_owner(client_id):
            raise HTTPException(status_code=403, detail="Только владелец может добавлять администраторов")
        user = connection.execute("SELECT * FROM users WHERE id = ?", (payload.user_id,)).fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        connection.execute(
            "INSERT OR REPLACE INTO admins (user_id, role, added_at) VALUES (?, 'admin', ?)",
            (payload.user_id, now()),
        )
        return {"ok": True, "message": "Администратор добавлен", "admin": dict(user) | {"role": "admin", "added_at": now()}}


@app.post("/admins/remove")
def remove_admin(
    payload: AdminRequest,
    x_sxron_client_id: str | None = Header(default=None),
) -> dict[str, Any]:
    client_id = require_client(x_sxron_client_id)
    with db() as connection:
        if not is_owner(client_id):
            raise HTTPException(status_code=403, detail="Только владелец может удалять администраторов")
        connection.execute("DELETE FROM admins WHERE user_id = ?", (payload.user_id,))
        return {"ok": True, "message": "Администратор удалён"}
