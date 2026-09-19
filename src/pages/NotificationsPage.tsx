import { useEffect, useState } from "react";
import { getNotifications, markNotificationRead } from "../api/api";
import type { SxronNotification } from "../types";

export default function NotificationsPage({ onNotify }: { onNotify?: (message: string) => void }) {
  const [items, setItems] = useState<SxronNotification[]>([]);
  useEffect(() => { getNotifications().then(data => setItems(data.notifications)).catch(e => onNotify?.(e instanceof Error ? e.message : "Не удалось загрузить уведомления")); }, []);
  async function read(id: number) { try { await markNotificationRead(id); setItems(current => current.map(item => item.id === id ? { ...item, read_at: new Date().toISOString() } : item)); } catch {} }
  return <section className="sxron-page marketplace-core-page"><div className="sxron-page-head"><div><span>УВЕДОМЛЕНИЯ</span><h1>Центр уведомлений</h1><p>События по заказам, сообщениям и аккаунту</p></div></div><div className="marketplace-core-notifications">{items.length ? items.map(item => <button key={item.id} className={item.read_at ? "is-read" : ""} onClick={() => void read(item.id)}><span>{item.type === "order" ? "🛒" : item.type === "message" ? "✉" : "🔔"}</span><div><strong>{item.title}</strong><p>{item.message}</p><small>{new Date(item.created_at).toLocaleString("ru-RU")}</small></div></button>) : <div className="marketplace-core-empty"><strong>🔔</strong><h2>Уведомлений нет</h2><p>Здесь появятся события по вашим действиям.</p></div>}</div></section>;
}