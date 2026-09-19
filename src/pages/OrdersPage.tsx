import { useEffect, useState } from "react";
import { getOrders, updateOrder } from "../api/api";
import type { Order } from "../types";

function statusLabel(status: string) {
  return ({ pending: "Новый", accepted: "Принят", shipping: "В доставке", completed: "Завершён", cancelled: "Отменён", reserved: "Зарезервирован" } as Record<string, string>)[status] || status;
}

export default function OrdersPage({ side, onNotify }: { side: "buying" | "selling"; onNotify?: (message: string) => void }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  async function load() {
    setLoading(true); setError("");
    try { setOrders((await getOrders(side)).orders); }
    catch (e) { setError(e instanceof Error ? e.message : "Не удалось загрузить заказы"); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [side]);
  async function change(orderId: number, status: string) {
    try {
      const updated = await updateOrder(orderId, status);
      setOrders(current => current.map(order => order.id === orderId ? updated : order));
      onNotify?.("Статус заказа обновлён");
    } catch (e) { onNotify?.(e instanceof Error ? e.message : "Не удалось изменить заказ"); }
  }
  return <section className="sxron-page marketplace-core-page">
    <div className="sxron-page-head"><div><span>{side === "buying" ? "ПОКУПКИ" : "ПРОДАЖИ"}</span><h1>{side === "buying" ? "Мои покупки" : "Мои продажи"}</h1><p>{orders.length} сделок в истории и работе</p></div><button className="sxron-secondary" onClick={() => void load()} disabled={loading}>{loading ? "Загрузка…" : "↻ Обновить"}</button></div>
    {error && <div className="marketplace-core-error">{error}</div>}
    {!loading && !orders.length && !error && <div className="marketplace-core-empty"><strong>{side === "buying" ? "🛒" : "📦"}</strong><h2>Пока пусто</h2><p>{side === "buying" ? "Оформленные покупки появятся здесь." : "Заказы на ваши объявления появятся здесь."}</p></div>}
    <div className="marketplace-core-orders">{orders.map(order => <article className="marketplace-core-order" key={order.id}>
      <div className="marketplace-core-order__photo">{order.product?.photo_url ? <img src={order.product.photo_url} alt="" /> : <span>S</span>}</div>
      <div className="marketplace-core-order__body">
        <div className="marketplace-core-order__top"><div><small>Заказ #{order.id}</small><h3>{order.product?.name || ("Товар #" + order.product_id)}</h3></div><b className={"marketplace-core-status status-" + order.status}>{statusLabel(order.status)}</b></div>
        <div className="marketplace-core-order__meta"><span>{order.quantity} шт.</span><span>{order.delivery_method}</span><strong>{order.total_price.toLocaleString("ru-RU")} ₽</strong></div>
        {order.delivery_address && <p>{order.delivery_address}</p>}
        <div className="marketplace-core-order__actions">
          {side === "selling" && order.status === "pending" && <button className="sxron-primary sxron-small" onClick={() => void change(order.id, "accepted")}>Принять заказ</button>}
          {side === "selling" && order.status === "accepted" && <button className="sxron-primary sxron-small" onClick={() => void change(order.id, "shipping")}>Передать в доставку</button>}
          {side === "buying" && order.status === "shipping" && <button className="sxron-primary sxron-small" onClick={() => void change(order.id, "completed")}>Получил товар</button>}
          {["pending", "accepted", "shipping"].includes(order.status) && <button className="sxron-secondary sxron-small" onClick={() => void change(order.id, "cancelled")}>Отменить</button>}
        </div>
      </div>
    </article>)}</div>
  </section>;
}