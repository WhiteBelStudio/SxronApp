from __future__ import annotations

from typing import Any

from fastapi import HTTPException

import server.main as base

# Keep the API version aligned with the desktop/web package version while
# retaining server/main.py as the source of the existing application routes.
base.APP_VERSION = "1.1.5"
base.app.version = base.APP_VERSION
init_db = base.init_db


@base.app.get("/public/sellers/{user_id}")
def get_public_seller(user_id: int) -> dict[str, Any]:
    """Return the public seller card, statistics, reviews and active listings."""
    with base.db() as connection:
        user = connection.execute(
            "SELECT * FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="Продавец не найден")

        seller = base.user_dict(user, connection)
        listings_rows = connection.execute(
            "SELECT * FROM products "
            "WHERE created_by = ? AND available = 1 "
            "ORDER BY id DESC",
            (user_id,),
        ).fetchall()

        reviews_count = int(seller.get("reviews_count") or 0)
        rating = seller.get("rating")

    # Respect public visibility settings.
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

    # The current data model does not have a review table yet. Keep a stable
    # public response shape so the UI is ready for real reviews later.
    reviews: list[dict[str, Any]] = []

    return {
        "seller": seller,
        "listings": listings,
        "rating": rating,
        "reviews_count": reviews_count,
        "reviews": reviews,
    }
