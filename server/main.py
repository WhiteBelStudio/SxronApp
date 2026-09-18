from __future__ import annotations

import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

APP_VERSION = "1.2.17"
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = Path(os.getenv("SXRON_DATA_DIR", BASE_DIR / "data"))
DB_PATH = DATA_DIR / "sxron.db"
OWNER_CLIENT_ID = os.getenv("SXRON_OWNER_CLIENT_ID", "sxron-owner-nikitinka7644").strip()

app = FastAPI(title="SXRON API", version=APP_VERSION)
app.add_middleware(CORSMiddleware, allow_origins=[origin.strip() for origin in os.getenv("SXRON_CORS_ORIGINS", "*").split(",") if origin.strip()], allow_credentials=False, allow_methods=["*"], allow_headers=["*"])

def now() -> str: return datetime.now(timezone.utc).isoformat()
def db() -> sqlite3.Connection:
    DATA_DIR.mkdir(parents=True, exist_ok=True); connection = sqlite3.connect(DB_PATH); connection.row_factory = sqlite3.Row; connection.execute("PRAGMA foreign_keys = ON"); return connection

def ensure_column(connection: sqlite3.Connection, table: str, column: str, definition: str) -> None:
    columns = {row[1] for row in connection.execute(f"PRAGMA table_info({table})").fetchall()}
    if column not in columns: connection.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")

def init_db() -> None:
    with db() as connection:
        connection.executescript("""
        CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, client_id TEXT NOT NULL UNIQUE, username TEXT, first_name TEXT, last_name TEXT, avatar_url TEXT, city_id INTEGER, bio TEXT, created_at TEXT NOT NULL, last_seen_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS cities (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, slug TEXT UNIQUE);
        CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, slug TEXT UNIQUE, icon TEXT);
        CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', price REAL NOT NULL DEFAULT 0, category_id INTEGER, city_id INTEGER, condition TEXT, delivery TEXT, photo_url TEXT, status TEXT NOT NULL DEFAULT 'active', available INTEGER NOT NULL DEFAULT 1, created_by INTEGER, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY(category_id) REFERENCES categories(id), FOREIGN KEY(city_id) REFERENCES cities(id), FOREIGN KEY(created_by) REFERENCES users(id));
        CREATE TABLE IF NOT EXISTS admins (user_id INTEGER PRIMARY KEY, added_at TEXT NOT NULL, FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE);
        """)
        for column, definition in [("display_name","TEXT"),("profile_status","TEXT NOT NULL DEFAULT ''"),("profile_accent","TEXT NOT NULL DEFAULT 'cyan'"),("profile_banner","TEXT NOT NULL DEFAULT 'aurora'"),("avatar_shape","TEXT NOT NULL DEFAULT 'rounded'"),("username_visible","INTEGER NOT NULL DEFAULT 1"),("badges_visible","INTEGER NOT NULL DEFAULT 1"),("activity_visible","INTEGER NOT NULL DEFAULT 1")]: ensure_column(connection, "users", column, definition)
        connection.execute("INSERT OR IGNORE INTO cities(name, slug) VALUES (?, ?)", ("Белореченск", "belorechensk")); connection.execute("INSERT OR IGNORE INTO cities(name, slug) VALUES (?, ?)", ("Хутор Кубанский", "khutor-kubanskiy"))
        for name, slug, icon in [("Электроника","electronics","▣"),("Одежда","clothes","◈"),("Дом","home","⌂"),("Транспорт","transport","◆"),("Разное","other","✦")]: connection.execute("INSERT OR IGNORE INTO categories(name, slug, icon) VALUES (?, ?, ?)", (name, slug, icon))
        if OWNER_CLIENT_ID:
            row = connection.execute("SELECT id FROM users WHERE client_id = ?", (OWNER_CLIENT_ID,)).fetchone()
            if row: connection.execute("INSERT OR IGNORE INTO admins(user_id, added_at) VALUES (?, ?)", (row["id"], now()))

def current_user(client_id: str | None) -> sqlite3.Row:
    if not client_id: raise HTTPException(status_code=401, detail="X-SXRON-Client-ID обязателен")
    client_id = client_id.strip()
    if not client_id or len(client_id) > 200: raise HTTPException(status_code=401, detail="Некорректный идентификатор пользователя")
    with db() as connection:
        row = connection.execute("SELECT * FROM users WHERE client_id = ?", (client_id,)).fetchone()
        if row: connection.execute("UPDATE users SET last_seen_at = ? WHERE id = ?", (now(), row["id"])); return connection.execute("SELECT * FROM users WHERE id = ?", (row["id"],)).fetchone()
        timestamp = now(); cursor = connection.execute("INSERT INTO users(client_id, first_name, created_at, last_seen_at) VALUES (?, 'Пользователь', ?, ?)", (client_id, timestamp, timestamp)); user_id = cursor.lastrowid
        if OWNER_CLIENT_ID and client_id == OWNER_CLIENT_ID: connection.execute("INSERT OR IGNORE INTO admins(user_id, added_at) VALUES (?, ?)", (user_id, now()))
        return connection.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()

def is_admin(user_id: int) -> bool:
    with db() as connection: return connection.execute("SELECT 1 FROM admins WHERE user_id = ?", (user_id,)).fetchone() is not None

def is_owner(user: sqlite3.Row) -> bool: return bool(OWNER_CLIENT_ID and user["client_id"] == OWNER_CLIENT_ID)
def require_admin(user: sqlite3.Row) -> None:
    if not is_admin(user["id"]): raise HTTPException(status_code=403, detail="Доступ только для администратора")

class ProductCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200); description: str = Field(default="", max_length=4000); price: float = Field(ge=0); category: str | None = None; category_id: int | None = None; city: str | None = None; city_id: int | None = None; condition: str | None = None; delivery: str | None = None; photo_url: str | None = None
class AdminMutation(BaseModel): user_id: int
class ProfileUpdate(BaseModel):
    display_name: str | None = Field(default=None, max_length=60); bio: str | None = Field(default=None, max_length=500); profile_status: str | None = Field(default=None, max_length=80); avatar_url: str | None = Field(default=None, max_length=2_000_000); profile_accent: str | None = Field(default=None, pattern="^(cyan|violet|blue|sunset)$"); profile_banner: str | None = Field(default=None, pattern="^(aurora|violet|ocean|sunset)$"); avatar_shape: str | None = Field(default=None, pattern="^(rounded|circle|square)$"); username_visible: bool | None = None; badges_visible: bool | None = None; activity_visible: bool | None = None; city_id: int | None = None

@app.on_event("startup")
def startup() -> None: init_db()
@app.get("/health")
def health() -> dict[str, str]: return {"status":"ok","app":"SXRON API","version":APP_VERSION}

def user_dict(user: sqlite3.Row, connection: sqlite3.Connection) -> dict[str, Any]:
    listings = connection.execute("SELECT COUNT(*) FROM products WHERE created_by = ?", (user["id"],)).fetchone()[0]; active = connection.execute("SELECT COUNT(*) FROM products WHERE created_by = ? AND available = 1", (user["id"],)).fetchone()[0]; sold = connection.execute("SELECT COUNT(*) FROM products WHERE created_by = ? AND status = 'sold'", (user["id"],)).fetchone()[0]
    city = None
    if user["city_id"]:
        city_row = connection.execute("SELECT * FROM cities WHERE id = ?", (user["city_id"],)).fetchone()
        if city_row: city = {"id":city_row["id"],"name":city_row["name"],"slug":city_row["slug"]}
    try: is_online = (datetime.now(timezone.utc) - datetime.fromisoformat(user["last_seen_at"])).total_seconds() < 300
    except (TypeError,ValueError): is_online = False
    return {"id":user["id"],"username":user["username"],"first_name":user["first_name"],"last_name":user["last_name"],"avatar_url":user["avatar_url"],"city":city,"created_at":user["created_at"],"bio":user["bio"],"display_name":user["display_name"] or user["first_name"] or "Пользователь","profile_status":user["profile_status"] or "","profile_accent":user["profile_accent"] or "cyan","profile_banner":user["profile_banner"] or "aurora","avatar_shape":user["avatar_shape"] or "rounded","username_visible":bool(user["username_visible"]),"badges_visible":bool(user["badges_visible"]),"activity_visible":bool(user["activity_visible"]),"listings_count":listings,"active_listings_count":active,"sold_count":sold,"views_count":0,"rating":None,"reviews_count":0,"last_seen_at":user["last_seen_at"],"is_online":is_online,"verified":is_owner(user)}

def product_dict(row: sqlite3.Row) -> dict[str, Any]:
    city = category = None
    with db() as connection:
        if row["city_id"]:
            city_row = connection.execute("SELECT * FROM cities WHERE id = ?", (row["city_id"],)).fetchone()
            if city_row: city={"id":city_row["id"],"name":city_row["name"],"slug":city_row["slug"]}
        if row["category_id"]:
            category_row=connection.execute("SELECT * FROM categories WHERE id = ?", (row["category_id"],)).fetchone()
            if category_row: category=category_row["name"]
    return {"id":row["id"],"name":row["name"],"description":row["description"],"price":row["price"],"category_id":row["category_id"],"category":category,"city_id":row["city_id"],"city":city,"condition":row["condition"],"delivery":row["delivery"],"photo_url":row["photo_url"],"status":row["status"],"available":bool(row["available"]),"is_available":bool(row["available"]),"created_by":row["created_by"],"seller_id":row["created_by"],"created_at":row["created_at"],"updated_at":row["updated_at"]}

@app.get("/products")
def products(search: str | None=None, category: str | None=None, city: str | None=None):
    sql="SELECT p.* FROM products p LEFT JOIN categories c ON c.id=p.category_id LEFT JOIN cities ci ON ci.id=p.city_id WHERE p.available=1"; values=[]
    if search: sql += " AND (LOWER(p.name) LIKE ? OR LOWER(p.description) LIKE ?)"; pattern=f"%{search.lower()}%"; values.extend([pattern,pattern])
    if category and category != "Все": sql += " AND LOWER(c.name)=LOWER(?)"; values.append(category)
    if city: sql += " AND LOWER(ci.name)=LOWER(?)"; values.append(city)
    sql += " ORDER BY p.id DESC"
    with db() as connection: rows=connection.execute(sql,values).fetchall()
    return [product_dict(row) for row in rows]
@app.get("/products/{product_id}")
def get_product(product_id:int):
    with db() as connection: row=connection.execute("SELECT * FROM products WHERE id=?",(product_id,)).fetchone()
    if not row: raise HTTPException(status_code=404,detail="Товар не найден")
    return product_dict(row)
@app.post("/products")
def create_product(data:ProductCreate,x_sxron_client_id:str|None=Header(default=None)):
    user=current_user(x_sxron_client_id); require_admin(user)
    with db() as connection:
        category_id=data.category_id
        if not category_id and data.category:
            row=connection.execute("SELECT id FROM categories WHERE LOWER(name)=LOWER(?)",(data.category,)).fetchone(); category_id=row["id"] if row else None
        city_id=data.city_id
        if not city_id and data.city:
            row=connection.execute("SELECT id FROM cities WHERE LOWER(name)=LOWER(?)",(data.city,)).fetchone(); city_id=row["id"] if row else None
        timestamp=now(); cursor=connection.execute("INSERT INTO products(name,description,price,category_id,city_id,condition,delivery,photo_url,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",(data.name.strip(),data.description.strip(),data.price,category_id,city_id,data.condition,data.delivery,data.photo_url,user["id"],timestamp,timestamp)); row=connection.execute("SELECT * FROM products WHERE id=?",(cursor.lastrowid,)).fetchone()
    return product_dict(row)
@app.put("/products/{product_id}")
def update_product(product_id:int, data:ProductCreate, x_sxron_client_id:str|None=Header(default=None)):
    user=current_user(x_sxron_client_id)
    require_admin(user)
    with db() as connection:
        existing=connection.execute("SELECT * FROM products WHERE id=?",(product_id,)).fetchone()
        if not existing: raise HTTPException(status_code=404,detail="Товар не найден")
        if not is_owner(user) and existing["created_by"] != user["id"]:
            raise HTTPException(status_code=403,detail="Можно изменять только свои объявления")
        category_id=data.category_id
        if not category_id and data.category:
            row=connection.execute("SELECT id FROM categories WHERE LOWER(name)=LOWER(?)",(data.category,)).fetchone()
            category_id=row["id"] if row else None
        city_id=data.city_id
        if not city_id and data.city:
            row=connection.execute("SELECT id FROM cities WHERE LOWER(name)=LOWER(?)",(data.city,)).fetchone()
            city_id=row["id"] if row else None
        timestamp=now()
        connection.execute(
            """UPDATE products
               SET name=?, description=?, price=?, category_id=?, city_id=?, condition=?, delivery=?, photo_url=?, available=1, status='active', updated_at=?
               WHERE id=?""",
            (data.name.strip(),data.description.strip(),data.price,category_id,city_id,data.condition,data.delivery,data.photo_url,timestamp,product_id)
        )
        row=connection.execute("SELECT * FROM products WHERE id=?",(product_id,)).fetchone()
    return product_dict(row)

@app.delete("/products/{product_id}")
def delete_product(product_id:int, x_sxron_client_id:str|None=Header(default=None)):
    user=current_user(x_sxron_client_id)
    require_admin(user)
    with db() as connection:
        existing=connection.execute("SELECT * FROM products WHERE id=?",(product_id,)).fetchone()
        if not existing: raise HTTPException(status_code=404,detail="Товар не найден")
        if not is_owner(user) and existing["created_by"] != user["id"]:
            raise HTTPException(status_code=403,detail="Можно удалять только свои объявления")
        connection.execute("DELETE FROM products WHERE id=?",(product_id,))
    return {"ok":True}

@app.get("/categories")
def categories():
    with db() as connection: rows=connection.execute("SELECT c.*,COUNT(p.id) AS products_count FROM categories c LEFT JOIN products p ON p.category_id=c.id AND p.available=1 GROUP BY c.id ORDER BY c.id").fetchall()
    return [dict(row) for row in rows]
@app.get("/cities")
def cities():
    with db() as connection: rows=connection.execute("SELECT * FROM cities ORDER BY id").fetchall()
    return [dict(row) for row in rows]
@app.get("/me")
def me(x_sxron_client_id:str|None=Header(default=None)):
    user=current_user(x_sxron_client_id)
    with db() as connection: data=user_dict(user,connection)
    return {"user":data,"is_admin":is_admin(user["id"]),"is_owner":is_owner(user)}
@app.get("/me/profile")
def get_profile(x_sxron_client_id:str|None=Header(default=None)):
    user=current_user(x_sxron_client_id)
    with db() as connection: data=user_dict(user,connection)
    return {"user":data,"is_admin":is_admin(user["id"]),"is_owner":is_owner(user)}
@app.get("/users/{user_id}/profile")
def public_profile(user_id:int):
    with db() as connection:
        user=connection.execute("SELECT * FROM users WHERE id=?",(user_id,)).fetchone()
        if not user: raise HTTPException(status_code=404,detail="Профиль не найден")
        data=user_dict(user,connection)
        if not data["username_visible"]: data["username"]=None
        if not data["badges_visible"]: data["verified"]=False
        if not data["activity_visible"]: data["is_online"]=False; data["last_seen_at"]=None
        return {"user":data}
@app.put("/me/profile")
def update_profile(data:ProfileUpdate,x_sxron_client_id:str|None=Header(default=None)):
    user=current_user(x_sxron_client_id); updates={}
    for field in ("display_name","bio","profile_status","avatar_url","profile_accent","profile_banner","avatar_shape","username_visible","badges_visible","activity_visible"): 
        value=getattr(data,field)
        if value is not None: updates[field]=int(value) if field in ("username_visible","badges_visible","activity_visible") else (value.strip() if isinstance(value,str) else value)
    if data.city_id is not None:
        with db() as connection:
            if not connection.execute("SELECT 1 FROM cities WHERE id=?",(data.city_id,)).fetchone(): raise HTTPException(status_code=400,detail="Город не найден")
        updates["city_id"]=data.city_id
    if updates:
        with db() as connection: connection.execute(f"UPDATE users SET {', '.join(f'{k}=?' for k in updates)}, last_seen_at=? WHERE id=?",[*updates.values(),now(),user["id"]])
    with db() as connection: fresh=connection.execute("SELECT * FROM users WHERE id=?",(user["id"],)).fetchone(); result=user_dict(fresh,connection)
    return {"user":result,"is_admin":is_admin(user["id"]),"is_owner":is_owner(user)}
@app.get("/admins")
def admins(x_sxron_client_id:str|None=Header(default=None)):
    user=current_user(x_sxron_client_id); require_admin(user)
    with db() as connection: rows=connection.execute("SELECT u.id,u.username,u.first_name,u.last_name,a.added_at FROM admins a JOIN users u ON u.id=a.user_id ORDER BY a.user_id").fetchall()
    return {"admins":[{**dict(row),"role":"owner" if is_owner(user) and row["id"]==user["id"] else "admin"} for row in rows]}
@app.post("/admins/add")
def add_admin(data:AdminMutation,x_sxron_client_id:str|None=Header(default=None)):
    user=current_user(x_sxron_client_id)
    if not is_owner(user): raise HTTPException(status_code=403,detail="Добавлять администраторов может только владелец")
    with db() as connection:
        target=connection.execute("SELECT * FROM users WHERE id=?",(data.user_id,)).fetchone()
        if not target: raise HTTPException(status_code=404,detail="Пользователь не найден")
        connection.execute("INSERT OR IGNORE INTO admins(user_id,added_at) VALUES (?,?)",(data.user_id,now()))
    return {"ok":True,"message":"Администратор добавлен"}
@app.post("/admins/remove")
def remove_admin(data:AdminMutation,x_sxron_client_id:str|None=Header(default=None)):
    user=current_user(x_sxron_client_id)
    if not is_owner(user): raise HTTPException(status_code=403,detail="Удалять администраторов может только владелец")
    with db() as connection:
        target=connection.execute("SELECT * FROM users WHERE id=?",(data.user_id,)).fetchone()
        if not target: raise HTTPException(status_code=404,detail="Пользователь не найден")
        if is_owner(target): raise HTTPException(status_code=400,detail="Нельзя удалить владельца")
        connection.execute("DELETE FROM admins WHERE user_id=?",(data.user_id,))
    return {"ok":True,"message":"Администратор удалён"}

from server.auth import register_auth
register_auth(app)
