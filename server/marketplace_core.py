from __future__ import annotations

import hashlib
import mimetypes
import re
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import File, Header, HTTPException, Query, Request, UploadFile
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

import server.main as base


MAX_IMAGE_BYTES = 10 * 1024 * 1024
MAX_FILE_BYTES = 25 * 1024 * 1024
MAX_PRODUCT_IMAGES = 8
ALLOWED_IMAGES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}
ALLOWED_FILES = {
    **ALLOWED_IMAGES,
    "application/pdf": ".pdf",
    "text/plain": ".txt",
}


def _media_root() -> Path:
    root = base.DATA_DIR / "media"
    root.mkdir(parents=True, exist_ok=True)
    return root


def _now() -> str:
    return base.now()


def _public_url(request: Request, relative_path: str) -> str:
    return str(request.base_url).rstrip("/") + "/media/" + relative_path.replace("\\", "/")


def _safe_original_name(name: str | None) -> str:
    value = Path(name or "file").name.strip()
    value = re.sub(r"[^0-9A-Za-zА-Яа-яЁё._()\- ]+", "_", value)
    return value[:180] or "file"


def _extension(content_type: str, name: str) -> str:
    if content_type in ALLOWED_FILES:
        return ALLOWED_FILES[content_type]
    ext = Path(name).suffix.lower()
    return ext if re.fullmatch(r"\.[a-z0-9]{1,8}", ext) else ".bin"


def _looks_like_image(content: bytes, content_type: str) -> bool:
    if content_type == "image/jpeg":
        return content[:3] == b"\xff\xd8\xff"
    if content_type == "image/png":
        return content[:8] == b"\x89PNG\r\n\x1a\n"
    if content_type == "image/webp":
        return len(content) >= 12 and content[:4] == b"RIFF" and content[8:12] == b"WEBP"
    if content_type == "image/gif":
        return content[:6] in (b"GIF87a", b"GIF89a")
    return False


def _store_upload(
    request: Request,
    upload: UploadFile,
    owner_id: int,
    kind: str,
    max_bytes: int,
    images_only: bool = False,
) -> dict[str, Any]:
    content_type = (upload.content_type or "").lower().split(";")[0].strip()
    if images_only and content_type not in ALLOWED_IMAGES:
        raise HTTPException(status_code=415, detail="Разрешены только JPG, PNG, WEBP и GIF.")
    if not images_only and content_type not in ALLOWED_FILES:
        guessed = mimetypes.guess_type(upload.filename or "")[0]
        content_type = guessed if guessed in ALLOWED_FILES else content_type
    if content_type not in ALLOWED_FILES:
        raise HTTPException(status_code=415, detail="Тип файла не поддерживается.")

    data = bytearray()
    digest = hashlib.sha256()
    while True:
        chunk = upload.file.read(1024 * 1024)
        if not chunk:
            break
        data.extend(chunk)
        digest.update(chunk)
        if len(data) > max_bytes:
            raise HTTPException(status_code=413, detail=f"Файл слишком большой. Лимит: {max_bytes // (1024 * 1024)} МБ.")

    raw = bytes(data)
    if content_type.startswith("image/") and not _looks_like_image(raw, content_type):
        raise HTTPException(status_code=400, detail="Файл не похож на корректное изображение.")
    if content_type == "application/pdf" and not raw.startswith(b"%PDF"):
        raise HTTPException(status_code=400, detail="Файл не похож на корректный PDF.")

    sha256 = digest.hexdigest()
    safe_name = _safe_original_name(upload.filename)
    ext = _extension(content_type, safe_name)
    relative = str(Path(kind) / datetime.utcnow().strftime("%Y") / datetime.utcnow().strftime("%m") / f"{uuid.uuid4().hex}{ext}")
    destination = _media_root() / relative
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(raw)

    with base.db() as connection:
        cursor = connection.execute(
            """INSERT INTO media_files(
                owner_id, original_name, relative_path, content_type,
                size_bytes, sha256, kind, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (owner_id, safe_name, relative, content_type, len(raw), sha256, kind, _now()),
        )
        media_id = int(cursor.lastrowid)

    return {
        "id": media_id,
        "name": safe_name,
        "content_type": content_type,
        "size_bytes": len(raw),
        "url": _public_url(request, relative),
    }


def _user(client_id: str | None):
    return base.current_user(client_id)


def _participant_or_admin(user: Any, conversation_id: int) -> dict[str, Any]:
    with base.db() as connection:
        row = connection.execute(
            "SELECT * FROM conversations WHERE id = ?", (conversation_id,)
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Диалог не найден")
    if user["id"] not in (row["user_a_id"], row["user_b_id"]) and not base.is_admin(user["id"]):
        raise HTTPException(status_code=403, detail="Нет доступа к этому диалогу")
    return dict(row)


class OrderCreate(BaseModel):
    product_id: int
    quantity: int = Field(default=1, ge=1, le=20)
    delivery_method: str = Field(default="Самовывоз", max_length=60)
    delivery_address: str = Field(default="", max_length=500)
    note: str = Field(default="", max_length=1000)


class OrderStatusUpdate(BaseModel):
    status: str = Field(max_length=30)
    note: str = Field(default="", max_length=500)


class MessageCreate(BaseModel):
    text: str = Field(default="", max_length=4000)
    media_id: int | None = None


class ConversationCreate(BaseModel):
    seller_id: int
    product_id: int | None = None
    text: str = Field(default="", max_length=4000)


class NotificationRead(BaseModel):
    read: bool = True


def init_marketplace_tables() -> None:
    with base.db() as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS media_files (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                owner_id INTEGER,
                original_name TEXT NOT NULL,
                relative_path TEXT NOT NULL UNIQUE,
                content_type TEXT NOT NULL,
                size_bytes INTEGER NOT NULL,
                sha256 TEXT NOT NULL,
                kind TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY(owner_id) REFERENCES users(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS product_media (
                product_id INTEGER NOT NULL,
                media_id INTEGER NOT NULL,
                sort_order INTEGER NOT NULL DEFAULT 0,
                is_cover INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY(product_id, media_id),
                FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE,
                FOREIGN KEY(media_id) REFERENCES media_files(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS favorites (
                user_id INTEGER NOT NULL,
                product_id INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                PRIMARY KEY(user_id, product_id),
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                buyer_id INTEGER NOT NULL,
                seller_id INTEGER NOT NULL,
                product_id INTEGER NOT NULL,
                quantity INTEGER NOT NULL DEFAULT 1,
                unit_price REAL NOT NULL,
                total_price REAL NOT NULL,
                delivery_method TEXT NOT NULL DEFAULT 'Самовывоз',
                delivery_address TEXT NOT NULL DEFAULT '',
                note TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL DEFAULT 'pending',
                cancel_reason TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                completed_at TEXT,
                FOREIGN KEY(buyer_id) REFERENCES users(id) ON DELETE RESTRICT,
                FOREIGN KEY(seller_id) REFERENCES users(id) ON DELETE RESTRICT,
                FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE RESTRICT
            );

            CREATE TABLE IF NOT EXISTS order_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id INTEGER NOT NULL,
                actor_id INTEGER,
                from_status TEXT,
                to_status TEXT NOT NULL,
                note TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL,
                FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE,
                FOREIGN KEY(actor_id) REFERENCES users(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                type TEXT NOT NULL,
                title TEXT NOT NULL,
                message TEXT NOT NULL DEFAULT '',
                entity_type TEXT,
                entity_id INTEGER,
                read_at TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS conversations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_a_id INTEGER NOT NULL,
                user_b_id INTEGER NOT NULL,
                product_id INTEGER,
                created_at TEXT NOT NULL,
                last_message_at TEXT NOT NULL,
                FOREIGN KEY(user_a_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY(user_b_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                conversation_id INTEGER NOT NULL,
                sender_id INTEGER NOT NULL,
                text TEXT NOT NULL DEFAULT '',
                media_id INTEGER,
                created_at TEXT NOT NULL,
                read_at TEXT,
                FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
                FOREIGN KEY(sender_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY(media_id) REFERENCES media_files(id) ON DELETE SET NULL
            );

            CREATE INDEX IF NOT EXISTS idx_product_media_product ON product_media(product_id, sort_order);
            CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id, created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_orders_buyer ON orders(buyer_id, created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_orders_seller ON orders(seller_id, created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, id);
            CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);
            """
        )


def _product_media(product_id: int, request: Request | None = None) -> list[dict[str, Any]]:
    with base.db() as connection:
        rows = connection.execute(
            """SELECT m.*, pm.sort_order, pm.is_cover
               FROM product_media pm
               JOIN media_files m ON m.id = pm.media_id
               WHERE pm.product_id = ?
               ORDER BY pm.is_cover DESC, pm.sort_order ASC, pm.media_id ASC""",
            (product_id,),
        ).fetchall()
    return [
        {
            "id": row["id"],
            "name": row["original_name"],
            "content_type": row["content_type"],
            "size_bytes": row["size_bytes"],
            "url": (
                _public_url(request, row["relative_path"])
                if request is not None
                else "/media/" + row["relative_path"].replace("\\", "/")
            ),
            "is_cover": bool(row["is_cover"]),
            "sort_order": int(row["sort_order"]),
        }
        for row in rows
    ]


def _order_dict(row: Any) -> dict[str, Any]:
    with base.db() as connection:
        product = connection.execute(
            "SELECT p.*, u.display_name, u.username FROM products p LEFT JOIN users u ON u.id=p.created_by WHERE p.id=?",
            (row["product_id"],),
        ).fetchone()
    return {
        "id": row["id"],
        "buyer_id": row["buyer_id"],
        "seller_id": row["seller_id"],
        "product_id": row["product_id"],
        "product": {
            "id": product["id"],
            "name": product["name"],
            "price": product["price"],
            "photo_url": product["photo_url"],
            "seller_name": product["display_name"] or product["username"] or "Продавец",
        } if product else None,
        "quantity": row["quantity"],
        "unit_price": row["unit_price"],
        "total_price": row["total_price"],
        "delivery_method": row["delivery_method"],
        "delivery_address": row["delivery_address"],
        "note": row["note"],
        "status": row["status"],
        "cancel_reason": row["cancel_reason"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
        "completed_at": row["completed_at"],
    }


def register_marketplace_core() -> None:
    init_marketplace_tables()
    media_root = _media_root()

    try:
        base.app.mount("/media", StaticFiles(directory=str(media_root)), name="sxron-media")
    except RuntimeError:
        pass

    original_product_dict = base.product_dict

    if not getattr(base.product_dict, "_sxron_media_enriched", False):
        def enriched_product_dict(row: Any) -> dict[str, Any]:
            data = original_product_dict(row)
            photos = _product_media(int(row["id"]))
            data["photos"] = photos
            data["cover_photo_url"] = photos[0]["url"] if photos else data.get("photo_url")
            data["favorite"] = False
            return data
        enriched_product_dict._sxron_media_enriched = True
        base.product_dict = enriched_product_dict

    @base.app.post("/media/upload")
    def upload_media(
        request: Request,
        file: UploadFile = File(...),
        x_sxron_client_id: str | None = Header(default=None),
        kind: str = Query(default="general"),
    ):
        user = _user(x_sxron_client_id)
        if kind not in {"avatar", "chat", "general"}:
            raise HTTPException(status_code=400, detail="Недопустимый тип медиа")
        return _store_upload(request, file, int(user["id"]), kind, MAX_FILE_BYTES, images_only=(kind == "avatar"))

    @base.app.post("/products/{product_id}/images")
    def upload_product_images(
        product_id: int,
        request: Request,
        files: list[UploadFile] = File(...),
        x_sxron_client_id: str | None = Header(default=None),
    ):
        user = _user(x_sxron_client_id)
        with base.db() as connection:
            product = connection.execute("SELECT * FROM products WHERE id=?", (product_id,)).fetchone()
            if not product:
                raise HTTPException(status_code=404, detail="Объявление не найдено")
            if not base.is_admin(user["id"]) and product["created_by"] != user["id"]:
                raise HTTPException(status_code=403, detail="Можно изменять только своё объявление")
            count = connection.execute("SELECT COUNT(*) FROM product_media WHERE product_id=?", (product_id,)).fetchone()[0]
        if count + len(files) > MAX_PRODUCT_IMAGES:
            raise HTTPException(status_code=400, detail=f"У товара может быть не более {MAX_PRODUCT_IMAGES} фото.")

        result = []
        for upload in files:
            stored = _store_upload(request, upload, int(user["id"]), "products", MAX_IMAGE_BYTES, images_only=True)
            with base.db() as connection:
                position = connection.execute("SELECT COALESCE(MAX(sort_order), -1)+1 FROM product_media WHERE product_id=?", (product_id,)).fetchone()[0]
                cover = 1 if int(position) == 0 else 0
                connection.execute(
                    "INSERT INTO product_media(product_id,media_id,sort_order,is_cover) VALUES (?,?,?,?)",
                    (product_id, stored["id"], position, cover),
                )
            result.append(stored)
        return {"photos": _product_media(product_id, request)}

    @base.app.delete("/products/{product_id}/images/{media_id}")
    def delete_product_image(product_id: int, media_id: int, x_sxron_client_id: str | None = Header(default=None)):
        user = _user(x_sxron_client_id)
        with base.db() as connection:
            product = connection.execute("SELECT * FROM products WHERE id=?", (product_id,)).fetchone()
            if not product:
                raise HTTPException(status_code=404, detail="Объявление не найдено")
            if not base.is_admin(user["id"]) and product["created_by"] != user["id"]:
                raise HTTPException(status_code=403, detail="Нет доступа")
            row = connection.execute(
                """SELECT m.relative_path FROM product_media pm
                   JOIN media_files m ON m.id=pm.media_id
                   WHERE pm.product_id=? AND pm.media_id=?""",
                (product_id, media_id),
            ).fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Фото не найдено")
            connection.execute("DELETE FROM product_media WHERE product_id=? AND media_id=?", (product_id, media_id))
            connection.execute("DELETE FROM media_files WHERE id=?", (media_id,))
            remaining = connection.execute(
                "SELECT media_id FROM product_media WHERE product_id=? ORDER BY sort_order, media_id", (product_id,)
            ).fetchall()
            if remaining:
                connection.execute("UPDATE product_media SET is_cover=0 WHERE product_id=?", (product_id,))
                connection.execute("UPDATE product_media SET is_cover=1 WHERE product_id=? AND media_id=?", (product_id, remaining[0][0]))
        try:
            ( _media_root() / row["relative_path"]).unlink(missing_ok=True)
        except OSError:
            pass
        return {"ok": True, "photos": _product_media(product_id)}

    @base.app.get("/favorites")
    def list_favorites(x_sxron_client_id: str | None = Header(default=None)):
        user = _user(x_sxron_client_id)
        with base.db() as connection:
            rows = connection.execute(
                """SELECT p.* FROM favorites f JOIN products p ON p.id=f.product_id
                   WHERE f.user_id=? ORDER BY f.created_at DESC""",
                (user["id"],),
            ).fetchall()
        return [base.product_dict(row) for row in rows]

    @base.app.post("/favorites/{product_id}")
    def add_favorite(product_id: int, x_sxron_client_id: str | None = Header(default=None)):
        user = _user(x_sxron_client_id)
        with base.db() as connection:
            if not connection.execute("SELECT 1 FROM products WHERE id=?", (product_id,)).fetchone():
                raise HTTPException(status_code=404, detail="Объявление не найдено")
            connection.execute(
                "INSERT OR IGNORE INTO favorites(user_id,product_id,created_at) VALUES(?,?,?)",
                (user["id"], product_id, _now()),
            )
        return {"ok": True, "favorite": True}

    @base.app.delete("/favorites/{product_id}")
    def remove_favorite(product_id: int, x_sxron_client_id: str | None = Header(default=None)):
        user = _user(x_sxron_client_id)
        with base.db() as connection:
            connection.execute("DELETE FROM favorites WHERE user_id=? AND product_id=?", (user["id"], product_id))
        return {"ok": True, "favorite": False}

    @base.app.post("/orders")
    def create_order(data: OrderCreate, x_sxron_client_id: str | None = Header(default=None)):
        buyer = _user(x_sxron_client_id)
        timestamp = _now()
        with base.db() as connection:
            connection.execute("BEGIN IMMEDIATE")
            product = connection.execute(
                "SELECT * FROM products WHERE id=? AND available=1 AND status='active'", (data.product_id,)
            ).fetchone()
            if not product:
                raise HTTPException(status_code=409, detail="Товар уже недоступен или снят с продажи")
            seller_id = int(product["created_by"])
            if seller_id == buyer["id"]:
                raise HTTPException(status_code=400, detail="Нельзя оформить заказ на собственное объявление")
            total = float(product["price"]) * int(data.quantity)
            cursor = connection.execute(
                """INSERT INTO orders(
                    buyer_id,seller_id,product_id,quantity,unit_price,total_price,
                    delivery_method,delivery_address,note,status,created_at,updated_at
                ) VALUES (?,?,?,?,?,?,?,?,?,'pending',?,?)""",
                (
                    buyer["id"], seller_id, data.product_id, data.quantity, product["price"], total,
                    data.delivery_method.strip(), data.delivery_address.strip(), data.note.strip(),
                    timestamp, timestamp,
                ),
            )
            order_id = int(cursor.lastrowid)
            connection.execute("UPDATE products SET available=0,status='reserved',updated_at=? WHERE id=?", (timestamp, data.product_id))
            connection.execute(
                "INSERT INTO order_events(order_id,actor_id,from_status,to_status,note,created_at) VALUES(?,?,?,?,?,?)",
                (order_id, buyer["id"], "active", "pending", "", timestamp),
            )
            connection.execute(
                "INSERT INTO notifications(user_id,type,title,message,entity_type,entity_id,created_at) VALUES(?,?,?,?,?,?,?)",
                (seller_id, "order", "Новый заказ", f"Покупатель оформил заказ на «{product['name']}».", "order", order_id, timestamp),
            )
            row = connection.execute("SELECT * FROM orders WHERE id=?", (order_id,)).fetchone()
        return _order_dict(row)

    @base.app.get("/orders")
    def list_orders(
        side: str = Query(default="all"),
        x_sxron_client_id: str | None = Header(default=None),
    ):
        user = _user(x_sxron_client_id)
        if side not in {"all", "buying", "selling"}:
            raise HTTPException(status_code=400, detail="Недопустимый тип списка заказов")
        with base.db() as connection:
            if side == "buying":
                rows = connection.execute("SELECT * FROM orders WHERE buyer_id=? ORDER BY created_at DESC", (user["id"],)).fetchall()
            elif side == "selling":
                rows = connection.execute("SELECT * FROM orders WHERE seller_id=? ORDER BY created_at DESC", (user["id"],)).fetchall()
            else:
                rows = connection.execute("SELECT * FROM orders WHERE buyer_id=? OR seller_id=? ORDER BY created_at DESC", (user["id"], user["id"])).fetchall()
        return {"orders": [_order_dict(row) for row in rows]}

    @base.app.get("/orders/{order_id}")
    def get_order(order_id: int, x_sxron_client_id: str | None = Header(default=None)):
        user = _user(x_sxron_client_id)
        with base.db() as connection:
            row = connection.execute("SELECT * FROM orders WHERE id=?", (order_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Заказ не найден")
        if user["id"] not in (row["buyer_id"], row["seller_id"]) and not base.is_admin(user["id"]):
            raise HTTPException(status_code=403, detail="Нет доступа")
        return _order_dict(row)

    @base.app.patch("/orders/{order_id}")
    def update_order(order_id: int, data: OrderStatusUpdate, x_sxron_client_id: str | None = Header(default=None)):
        user = _user(x_sxron_client_id)
        allowed = {
            "pending": {"accepted", "cancelled"},
            "accepted": {"shipping", "cancelled"},
            "shipping": {"completed", "cancelled"},
        }
        with base.db() as connection:
            row = connection.execute("SELECT * FROM orders WHERE id=?", (order_id,)).fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Заказ не найден")
            seller = int(row["seller_id"])
            buyer = int(row["buyer_id"])
            actor_is_admin = base.is_admin(user["id"])
            if user["id"] not in (seller, buyer) and not actor_is_admin:
                raise HTTPException(status_code=403, detail="Нет доступа")
            target = data.status.strip().lower()
            if target not in {"cancelled", "completed", "accepted", "shipping"}:
                raise HTTPException(status_code=400, detail="Недопустимый статус заказа")
            if not actor_is_admin:
                if target == "accepted" and user["id"] != seller:
                    raise HTTPException(status_code=403, detail="Принять заказ может продавец")
                if target == "shipping" and user["id"] != seller:
                    raise HTTPException(status_code=403, detail="Передать заказ в доставку может продавец")
                if target == "completed" and user["id"] != buyer:
                    raise HTTPException(status_code=403, detail="Подтвердить получение может покупатель")
                if target == "cancelled" and user["id"] not in (seller, buyer):
                    raise HTTPException(status_code=403, detail="Отменить заказ может участник сделки")
            if target not in allowed.get(row["status"], set()) and not (target == "cancelled" and row["status"] == "pending"):
                raise HTTPException(status_code=409, detail=f"Нельзя перевести заказ из {row['status']} в {target}")
            timestamp = _now()
            connection.execute(
                "UPDATE orders SET status=?,cancel_reason=?,completed_at=?,updated_at=? WHERE id=?",
                (target, data.note.strip() if target == "cancelled" else "", timestamp if target == "completed" else None, timestamp, order_id),
            )
            if target == "completed":
                connection.execute("UPDATE products SET status='sold',available=0,updated_at=? WHERE id=?", (timestamp, row["product_id"]))
            elif target == "cancelled":
                connection.execute("UPDATE products SET status='active',available=1,updated_at=? WHERE id=?", (timestamp, row["product_id"]))
            connection.execute(
                "INSERT INTO order_events(order_id,actor_id,from_status,to_status,note,created_at) VALUES(?,?,?,?,?,?)",
                (order_id, user["id"], row["status"], target, data.note.strip(), timestamp),
            )
            recipient = seller if user["id"] == buyer else buyer
            connection.execute(
                "INSERT INTO notifications(user_id,type,title,message,entity_type,entity_id,created_at) VALUES(?,?,?,?,?,?,?)",
                (recipient, "order", "Статус заказа изменён", f"Заказ #{order_id}: {target}.", "order", order_id, timestamp),
            )
            fresh = connection.execute("SELECT * FROM orders WHERE id=?", (order_id,)).fetchone()
        return _order_dict(fresh)

    @base.app.post("/conversations")
    def create_conversation(data: ConversationCreate, x_sxron_client_id: str | None = Header(default=None)):
        user = _user(x_sxron_client_id)
        if data.seller_id == user["id"]:
            raise HTTPException(status_code=400, detail="Нельзя начать диалог с самим собой")
        low, high = sorted((int(user["id"]), int(data.seller_id)))
        timestamp = _now()
        with base.db() as connection:
            seller = connection.execute("SELECT id FROM users WHERE id=?", (data.seller_id,)).fetchone()
            if not seller:
                raise HTTPException(status_code=404, detail="Пользователь не найден")
            row = connection.execute(
                "SELECT * FROM conversations WHERE user_a_id=? AND user_b_id=? AND product_id IS ? LIMIT 1",
                (low, high, data.product_id),
            ).fetchone()
            if row:
                conversation_id = int(row["id"])
            else:
                cursor = connection.execute(
                    "INSERT INTO conversations(user_a_id,user_b_id,product_id,created_at,last_message_at) VALUES(?,?,?,?,?)",
                    (low, high, data.product_id, timestamp, timestamp),
                )
                conversation_id = int(cursor.lastrowid)
            if data.text.strip():
                connection.execute(
                    "INSERT INTO messages(conversation_id,sender_id,text,created_at) VALUES(?,?,?,?)",
                    (conversation_id, user["id"], data.text.strip(), timestamp),
                )
                connection.execute("UPDATE conversations SET last_message_at=? WHERE id=?", (timestamp, conversation_id))
            connection.execute(
                "INSERT INTO notifications(user_id,type,title,message,entity_type,entity_id,created_at) VALUES(?,?,?,?,?,?,?)",
                (data.seller_id, "message", "Новое сообщение", "Вам написали в SXRON.", "conversation", conversation_id, timestamp),
            )
        return {"conversation_id": conversation_id}

    @base.app.get("/conversations")
    def list_conversations(x_sxron_client_id: str | None = Header(default=None)):
        user = _user(x_sxron_client_id)
        with base.db() as connection:
            rows = connection.execute(
                """SELECT c.*,
                   ua.display_name AS a_name, ub.display_name AS b_name,
                   (SELECT text FROM messages m WHERE m.conversation_id=c.id ORDER BY m.id DESC LIMIT 1) AS last_text
                   FROM conversations c
                   JOIN users ua ON ua.id=c.user_a_id
                   JOIN users ub ON ub.id=c.user_b_id
                   WHERE c.user_a_id=? OR c.user_b_id=?
                   ORDER BY c.last_message_at DESC""",
                (user["id"], user["id"]),
            ).fetchall()
        return {
            "conversations": [
                {
                    "id": row["id"],
                    "product_id": row["product_id"],
                    "other_user_id": row["user_b_id"] if row["user_a_id"] == user["id"] else row["user_a_id"],
                    "other_user_name": row["b_name"] if row["user_a_id"] == user["id"] else row["a_name"],
                    "last_text": row["last_text"] or "",
                    "last_message_at": row["last_message_at"],
                }
                for row in rows
            ]
        }

    @base.app.get("/conversations/{conversation_id}/messages")
    def list_messages(conversation_id: int, x_sxron_client_id: str | None = Header(default=None)):
        user = _user(x_sxron_client_id)
        _participant_or_admin(user, conversation_id)
        with base.db() as connection:
            rows = connection.execute(
                "SELECT * FROM messages WHERE conversation_id=? ORDER BY id ASC LIMIT 500",
                (conversation_id,),
            ).fetchall()
        return {
            "messages": [
                {
                    "id": row["id"],
                    "sender_id": row["sender_id"],
                    "text": row["text"],
                    "media_id": row["media_id"],
                    "created_at": row["created_at"],
                    "read_at": row["read_at"],
                }
                for row in rows
            ]
        }

    @base.app.post("/conversations/{conversation_id}/messages")
    def send_message(
        conversation_id: int,
        data: MessageCreate,
        x_sxron_client_id: str | None = Header(default=None),
    ):
        user = _user(x_sxron_client_id)
        conversation = _participant_or_admin(user, conversation_id)
        text = data.text.strip()
        if not text and data.media_id is None:
            raise HTTPException(status_code=400, detail="Сообщение не может быть пустым")
        timestamp = _now()
        with base.db() as connection:
            if data.media_id is not None:
                media = connection.execute("SELECT owner_id FROM media_files WHERE id=?", (data.media_id,)).fetchone()
                if not media or media["owner_id"] != user["id"]:
                    raise HTTPException(status_code=403, detail="Медиафайл недоступен")
            connection.execute(
                "INSERT INTO messages(conversation_id,sender_id,text,media_id,created_at) VALUES(?,?,?,?,?)",
                (conversation_id, user["id"], text, data.media_id, timestamp),
            )
            connection.execute("UPDATE conversations SET last_message_at=? WHERE id=?", (timestamp, conversation_id))
            recipient = conversation["user_b_id"] if conversation["user_a_id"] == user["id"] else conversation["user_a_id"]
            connection.execute(
                "INSERT INTO notifications(user_id,type,title,message,entity_type,entity_id,created_at) VALUES(?,?,?,?,?,?,?)",
                (recipient, "message", "Новое сообщение", text[:180] or "Вам отправили файл.", "conversation", conversation_id, timestamp),
            )
        return {"ok": True}

    @base.app.get("/notifications")
    def list_notifications(x_sxron_client_id: str | None = Header(default=None)):
        user = _user(x_sxron_client_id)
        with base.db() as connection:
            rows = connection.execute(
                "SELECT * FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 200",
                (user["id"],),
            ).fetchall()
        return {"notifications": [dict(row) for row in rows]}

    @base.app.patch("/notifications/{notification_id}")
    def update_notification(
        notification_id: int,
        data: NotificationRead,
        x_sxron_client_id: str | None = Header(default=None),
    ):
        user = _user(x_sxron_client_id)
        with base.db() as connection:
            row = connection.execute(
                "SELECT id FROM notifications WHERE id=? AND user_id=?", (notification_id, user["id"])
            ).fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Уведомление не найдено")
            connection.execute(
                "UPDATE notifications SET read_at=? WHERE id=?",
                (_now() if data.read else None, notification_id),
            )
        return {"ok": True}
