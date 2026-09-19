import { useState } from "react";
import { createOrder } from "../api/api";
import type { Product } from "../types";

export default function OrderCheckoutModal({ product, onClose, onDone, onNotify }: {
  product: Product;
  onClose: () => void;
  onDone: () => void;
  onNotify?: (message: string) => void;
}) {
  const [delivery, setDelivery] = useState("Самовывоз");
  const [address, setAddress] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!product.seller_id) { onNotify?.("У товара не указан продавец"); return; }
    setBusy(true);
    try {
      await createOrder({
        product_id: product.id,
        quantity,
        delivery_method: delivery,
        delivery_address: address.trim(),
        note: note.trim(),
      });
      onNotify?.("Заказ оформлен. Продавец получил уведомление.");
      onDone();
    } catch (e) {
      onNotify?.(e instanceof Error ? e.message : "Не удалось оформить заказ");
    } finally {
      setBusy(false);
    }
  }

  return <div className="marketplace-core-modal-backdrop" onClick={onClose}>
    <div className="marketplace-core-checkout" onClick={e => e.stopPropagation()}>
      <button className="marketplace-core-modal-close" onClick={onClose}>×</button>
      <span className="section-label">SXRON CHECKOUT</span>
      <h2>Оформление покупки</h2>
      <div className="marketplace-core-checkout-product">
        <div className="marketplace-core-checkout-photo">{product.cover_photo_url || product.photo_url ? <img src={(product.cover_photo_url || product.photo_url) as string} alt="" /> : <span>S</span>}</div>
        <div><strong>{product.name}</strong><span>{product.price.toLocaleString("ru-RU")} ₽ / шт.</span></div>
      </div>
      <label>Способ получения<select value={delivery} onChange={e => setDelivery(e.target.value)}><option>Самовывоз</option><option>Доставка</option><option>Встреча с продавцом</option></select></label>
      <label>Количество<input type="number" min={1} max={20} value={quantity} onChange={e => setQuantity(Math.max(1, Math.min(20, Number(e.target.value) || 1)))} /></label>
      <label>Адрес / место встречи<input value={address} onChange={e => setAddress(e.target.value)} placeholder="Можно оставить пустым для самовывоза" /></label>
      <label>Комментарий продавцу<textarea rows={3} value={note} onChange={e => setNote(e.target.value)} placeholder="Например: удобное время для встречи" /></label>
      <div className="marketplace-core-checkout-total"><span>Итого</span><strong>{(product.price * quantity).toLocaleString("ru-RU")} ₽</strong></div>
      <div className="marketplace-core-checkout-actions"><button className="sxron-secondary" onClick={onClose} disabled={busy}>Отмена</button><button className="sxron-primary" onClick={() => void submit()} disabled={busy}>{busy ? "Оформляем…" : "Оформить заказ"}</button></div>
    </div>
  </div>;
}
