import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { getAuthToken } from "../api/api";

type Tab = "dashboard" | "users" | "products" | "reports" | "reviews" | "admins" | "audit" | "directories" | "broadcasts" | "settings" | "security";
type AnyRow = Record<string, any>;

const API_URL = (import.meta.env.VITE_API_URL || (typeof window !== "undefined" && window.location.protocol === "file:" ? "http://127.0.0.1:8000" : "/api")).replace(/\/$/, "");
const card: CSSProperties = { border: "1px solid rgba(255,255,255,.09)", background: "linear-gradient(145deg,rgba(18,24,35,.98),rgba(9,13,22,.97))", borderRadius: 18 };
const field: CSSProperties = { width: "100%", boxSizing: "border-box", padding: "11px 12px", borderRadius: 11, border: "1px solid rgba(255,255,255,.10)", background: "rgba(255,255,255,.045)", color: "#fff", outline: "none" };
const primary: CSSProperties = { border: 0, borderRadius: 11, padding: "10px 14px", background: "linear-gradient(135deg,#19d8d0,#7a4dff)", color: "#fff", fontWeight: 900, cursor: "pointer" };
const muted: CSSProperties = { border: "1px solid rgba(255,255,255,.10)", borderRadius: 11, padding: "10px 13px", background: "rgba(255,255,255,.04)", color: "#fff", fontWeight: 800, cursor: "pointer" };
const danger: CSSProperties = { border: "1px solid rgba(255,80,105,.22)", borderRadius: 11, padding: "10px 13px", background: "rgba(255,80,105,.09)", color: "#ff9eaa", fontWeight: 800, cursor: "pointer" };

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const response = await fetch(`${API_URL}${endpoint}`, { ...options, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options?.headers || {}) } });
  if (!response.ok) {
    let message = `Ошибка API: ${response.status}`;
    try { const body = await response.json(); if (typeof body?.detail === "string") message = body.detail; } catch { /* ignore */ }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

function fmtDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("ru-RU");
}

function roleLabel(role: string | null | undefined) {
  return role === "owner" ? "Владелец" : role === "moderator" ? "Модератор" : "Администратор";
}

export default function AdminCenter() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("dashboard");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dashboard, setDashboard] = useState<AnyRow | null>(null);
  const [users, setUsers] = useState<AnyRow[]>([]);
  const [selectedUser, setSelectedUser] = useState<AnyRow | null>(null);
  const [products, setProducts] = useState<AnyRow[]>([]);
  const [reports, setReports] = useState<AnyRow[]>([]);
  const [reviews, setReviews] = useState<AnyRow[]>([]);
  const [admins, setAdmins] = useState<AnyRow[]>([]);
  const [audit, setAudit] = useState<AnyRow[]>([]);
  const [categories, setCategories] = useState<AnyRow[]>([]);
  const [cities, setCities] = useState<AnyRow[]>([]);
  const [broadcasts, setBroadcasts] = useState<AnyRow[]>([]);
  const [settings, setSettings] = useState<AnyRow[]>([]);
  const [sessions, setSessions] = useState<AnyRow[]>([]);
  const [search, setSearch] = useState("");
  const [userState, setUserState] = useState("all");
  const [productStatus, setProductStatus] = useState("all");
  const [reportStatus, setReportStatus] = useState("all");
  const [reviewStatus, setReviewStatus] = useState("all");
  const [directoryKind, setDirectoryKind] = useState<"categories" | "cities">("categories");
  const [newDirectory, setNewDirectory] = useState({ name: "", slug: "", icon: "◈" });
  const [broadcastDraft, setBroadcastDraft] = useState({ title: "", message: "", audience: "all" });
  const [newSettingKey, setNewSettingKey] = useState("");
  const [newSettingValue, setNewSettingValue] = useState("");

  async function loadTab(nextTab: Tab = tab) {
    setLoading(true); setError("");
    try {
      if (nextTab === "dashboard") setDashboard(await request("/admin/center/dashboard"));
      if (nextTab === "users") setUsers((await request<{ users: AnyRow[] }>(`/admin/center/users?search=${encodeURIComponent(search)}&state=${encodeURIComponent(userState)}`)).users);
      if (nextTab === "products") setProducts((await request<{ products: AnyRow[] }>(`/admin/center/products?search=${encodeURIComponent(search)}&status=${encodeURIComponent(productStatus)}`)).products);
      if (nextTab === "reports") setReports((await request<{ reports: AnyRow[] }>(`/admin/center/reports?status=${encodeURIComponent(reportStatus)}`)).reports);
      if (nextTab === "reviews") setReviews((await request<{ reviews: AnyRow[] }>(`/admin/center/reviews?status=${encodeURIComponent(reviewStatus)}`)).reviews);
      if (nextTab === "admins") setAdmins((await request<{ admins: AnyRow[] }>("/admin/center/admins")).admins);
      if (nextTab === "audit") setAudit((await request<{ logs: AnyRow[] }>("/admin/center/audit?limit=300")).logs);
      if (nextTab === "directories") {
        const [cats, cityRows] = await Promise.all([request<{ categories: AnyRow[] }>("/admin/center/directory?kind=categories"), request<{ cities: AnyRow[] }>("/admin/center/directory?kind=cities")]);
        setCategories(cats.categories); setCities(cityRows.cities);
      }
      if (nextTab === "broadcasts") setBroadcasts((await request<{ broadcasts: AnyRow[] }>("/admin/center/broadcasts")).broadcasts);
      if (nextTab === "settings") setSettings((await request<{ settings: AnyRow[] }>("/admin/center/settings")).settings);
      if (nextTab === "security") setSessions((await request<{ sessions: AnyRow[] }>("/admin/center/security/sessions")).sessions);
    } catch (err) { setError(err instanceof Error ? err.message : "Не удалось загрузить раздел."); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    const openPanel = () => { setOpen(true); setTab("dashboard"); void loadTab("dashboard"); };
    window.addEventListener("sxron-open-admin-panel", openPanel);
    return () => window.removeEventListener("sxron-open-admin-panel", openPanel);
  }, []);

  useEffect(() => { if (open) void loadTab(tab); }, [open, tab]);

  async function mutate(endpoint: string, options: RequestInit = {}, reload = tab) {
    setLoading(true); setError("");
    try { await request(endpoint, options); await loadTab(reload); if (tab === "dashboard") setDashboard(await request("/admin/center/dashboard")); }
    catch (err) { setError(err instanceof Error ? err.message : "Операция не выполнена."); }
    finally { setLoading(false); }
  }

  async function openUser(id: number) {
    try { setSelectedUser((await request<{ user: AnyRow }>(`/admin/center/users/${id}`)).user); } catch (err) { setError(err instanceof Error ? err.message : "Профиль не найден."); }
  }

  const statCards = useMemo(() => {
    if (!dashboard?.stats) return [] as [string,string,number][];
    const s = dashboard.stats;
    return [["👥","Пользователи",s.users],["🟢","Активные",s.active_users],["🔒","Заблокированы",s.blocked_users],["📦","Объявления",s.products],["⏳","На модерации",s.pending_products],["✅","Проданы",s.sold_products],["🚨","Жалобы",s.reports],["⭐","Отзывы",s.reviews],["👑","Админы",s.admins]] as [string,string,number][];
  }, [dashboard]);

  if (!open) {
    return <button type="button" aria-label="Открыть админ-панель" onClick={() => { setOpen(true); setTab("dashboard"); }} style={{ position: "fixed", right: 22, bottom: 88, zIndex: 5000, minHeight: 44, padding: "0 15px", border: "1px solid rgba(34, 184, 255,.35)", borderRadius: 14, color: "#fff", background: "linear-gradient(135deg,#19d8d0,#7a4dff)", boxShadow: "0 14px 45px rgba(48,80,170,.35)", cursor: "pointer", fontWeight: 900 }}>⚙️ Админ-панель</button>;
  }

  const nav: [Tab,string][] = [["dashboard","📊 Дашборд"],["users","👥 Пользователи"],["products","📦 Объявления"],["reports","🚨 Жалобы"],["reviews","⭐ Отзывы"],["admins","👑 Администраторы"],["audit","📋 Журнал"],["directories","🗂 Справочники"],["broadcasts","📢 Рассылки"],["settings","⚙️ Настройки"],["security","🔐 Безопасность"]];

  return <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, zIndex: 50000, padding: 16, background: "rgba(2,5,10,.92)", backdropFilter: "blur(18px)", color: "#fff" }}>
    <section style={{ ...card, width: "min(1480px,100%)", height: "calc(100vh - 32px)", margin: "0 auto", overflow: "hidden", display: "grid", gridTemplateColumns: "240px minmax(0,1fr)" }}>
      <aside style={{ borderRight: "1px solid rgba(255,255,255,.08)", padding: 15, background: "rgba(7,11,18,.82)", overflow: "auto" }}>
        <div style={{ padding: "9px 10px 18px" }}><div style={{ color: "#22b8ff", fontSize: 10, fontWeight: 900, letterSpacing: ".16em" }}>SXRON CONTROL</div><h2 style={{ margin: "7px 0 4px", fontSize: 22 }}>Админ-центр</h2><small style={{ color: "#748298" }}>v1.2.11</small></div>
        <div style={{ display: "grid", gap: 5 }}>{nav.map(([id,label]) => <button key={id} type="button" onClick={() => setTab(id)} style={{ textAlign: "left", padding: "10px 11px", borderRadius: 10, border: id === tab ? "1px solid rgba(34, 184, 255,.28)" : "1px solid transparent", background: id === tab ? "rgba(34, 184, 255,.08)" : "transparent", color: id === tab ? "#70eee5" : "#b2bdce", fontWeight: 800, cursor: "pointer" }}>{label}</button>)}</div>
        <button type="button" onClick={() => setOpen(false)} style={{ ...danger, width: "100%", marginTop: 18 }}>Закрыть</button>
      </aside>

      <main style={{ overflow: "auto" }}>
        <header style={{ position: "sticky", top: 0, zIndex: 20, padding: "15px 20px", borderBottom: "1px solid rgba(255,255,255,.08)", background: "rgba(12,17,27,.95)", backdropFilter: "blur(18px)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div><div style={{ color: "#22b8ff", fontSize: 10, fontWeight: 900, letterSpacing: ".13em" }}>{nav.find(([id]) => id === tab)?.[1]}</div><h1 style={{ margin: "5px 0 0", fontSize: 25 }}>SXRON Marketplace</h1></div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}><span style={{ color: "#7f8ca0", fontSize: 12 }}>{dashboard?.role ? roleLabel(dashboard.role) : ""}</span><button type="button" onClick={() => void loadTab(tab)} style={muted}>{loading ? "…" : "↻ Обновить"}</button></div>
        </header>

        <div style={{ padding: 20 }}>
          {error && <div style={{ marginBottom: 15, padding: 12, borderRadius: 12, background: "rgba(255,80,105,.10)", color: "#ffadb7", border: "1px solid rgba(255,80,105,.16)" }}>{error}</div>}

          {tab === "dashboard" && dashboard && <div style={{ display: "grid", gap: 18 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>{statCards.map(([icon,name,value]) => <div key={name} style={{ ...card, padding: 14 }}><div>{icon}</div><small style={{ color: "#7f8ca1" }}>{name}</small><strong style={{ display: "block", marginTop: 5, fontSize: 23 }}>{value}</strong></div>)}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(310px,1fr))", gap: 15 }}>
              <section style={{ ...card, padding: 18 }}><h3 style={{ marginTop: 0 }}>Быстрые действия</h3><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>{[["users","Пользователи"],["products","Объявления"],["reports","Жалобы"],["reviews","Отзывы"],["admins","Администраторы"],["audit","Журнал"]].map(([id,label]) => <button key={id} type="button" onClick={() => setTab(id as Tab)} style={muted}>{label}</button>)}</div></section>
              <section style={{ ...card, padding: 18 }}><h3 style={{ marginTop: 0 }}>Последние действия</h3>{dashboard.recent?.length ? dashboard.recent.map((row: AnyRow) => <div key={row.id} style={{ padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,.05)" }}><b style={{ fontSize: 12 }}>{row.action}</b><div style={{ color: "#758298", fontSize: 10, marginTop: 3 }}>#{row.target_id || "—"} · {row.display_name || "Админ"} · {fmtDate(row.created_at)}</div></div>) : <p style={{ color: "#78869a" }}>Журнал пока пуст.</p>}</section>
            </div>
          </div>}

          {tab === "users" && <div style={{ display: "grid", gridTemplateColumns: selectedUser ? "minmax(330px,.85fr) minmax(420px,1.15fr)" : "1fr", gap: 15 }}>
            <section style={{ ...card, padding: 17 }}><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void loadTab("users"); }} placeholder="ID, имя, username, email" style={{ ...field, flex: 1, minWidth: 220 }} /><select value={userState} onChange={(e) => { setUserState(e.target.value); }} style={{ ...field, width: 170 }}><option value="all">Все</option><option value="active">Активные</option><option value="blocked">Заблокированные</option><option value="admins">Админы</option><option value="new">Новые</option></select><button onClick={() => void loadTab("users")} style={primary}>Поиск</button></div><div style={{ marginTop: 12, display: "grid", gap: 8 }}>{users.map((user: AnyRow) => <button key={user.id} onClick={() => void openUser(user.id)} style={{ textAlign: "left", padding: 12, borderRadius: 12, border: "1px solid rgba(255,255,255,.06)", background: "rgba(255,255,255,.025)", color: "#fff", cursor: "pointer" }}><div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><b>{user.display_name}</b><span style={{ color: user.is_blocked ? "#ff9eaa" : user.is_owner ? "#70eee5" : "#a99cff", fontSize: 10, fontWeight: 900 }}>{user.is_blocked ? "ЗАБЛОКИРОВАН" : roleLabel(user.admin_role)}</span></div><small style={{ display: "block", color: "#78869a", marginTop: 4 }}>ID {user.id} · {user.username ? `@${user.username}` : "без username"} · объявлений {user.listings_count} · сессий {user.active_sessions}</small></button>)}</div></section>
            {selectedUser && <section style={{ ...card, padding: 18 }}><div style={{ display: "flex", justifyContent: "space-between" }}><div><h3 style={{ margin: 0 }}>{selectedUser.display_name}</h3><small style={{ color: "#78869a" }}>ID {selectedUser.id} · {selectedUser.email || "email нет"}</small></div><button onClick={() => setSelectedUser(null)} style={muted}>×</button></div><div style={{ marginTop: 16, display: "grid", gap: 8 }}>{[["Роль",roleLabel(selectedUser.admin_role)], ["Регистрация",fmtDate(selectedUser.created_at)], ["Последняя активность",fmtDate(selectedUser.last_seen_at)], ["Объявления",selectedUser.listings_count], ["Активные сессии",selectedUser.active_sessions], ["Причина блокировки",selectedUser.blocked_reason || "—"]].map(([name,value]) => <div key={String(name)} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: 9, borderRadius: 9, background: "rgba(255,255,255,.035)" }}><span style={{ color: "#7e8b9f" }}>{name}</span><b>{String(value)}</b></div>)}</div><div style={{ marginTop: 15, display: "flex", gap: 8, flexWrap: "wrap" }}>{selectedUser.is_owner ? <span style={{ color: "#70eee5", fontWeight: 900 }}>Владельца нельзя блокировать</span> : selectedUser.is_blocked ? <button onClick={() => void mutate(`/admin/center/users/${selectedUser.id}/unblock`, { method: "POST" }, "users")} style={primary}>Разблокировать</button> : <button onClick={() => void mutate(`/admin/center/users/${selectedUser.id}/block?reason=${encodeURIComponent("Нарушение правил")}`, { method: "POST" }, "users")} style={danger}>Заблокировать</button>}<button onClick={() => void mutate(`/admin/center/users/${selectedUser.id}/terminate-sessions`, { method: "POST" }, "users")} style={muted}>Завершить сессии</button></div></section>}
          </div>}

          {tab === "products" && <section style={{ ...card, padding: 17 }}><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Название, ID, продавец" style={{ ...field, flex: 1, minWidth: 220 }} /><select value={productStatus} onChange={(e) => setProductStatus(e.target.value)} style={{ ...field, width: 170 }}><option value="all">Все</option><option value="pending">На модерации</option><option value="active">Активные</option><option value="hidden">Скрытые</option><option value="rejected">Отклонённые</option><option value="sold">Проданные</option></select><button onClick={() => void loadTab("products")} style={primary}>Загрузить</button></div><div style={{ marginTop: 12, display: "grid", gap: 9 }}>{products.map((p: AnyRow) => <div key={p.id} style={{ padding: 12, borderRadius: 12, border: "1px solid rgba(255,255,255,.07)", background: "rgba(255,255,255,.025)" }}><div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><div><b>#{p.id} · {p.name}</b><div style={{ color: "#78869a", fontSize: 11, marginTop: 4 }}>Продавец: {p.seller_name || "—"} · {p.category_name || "Без категории"} · {p.city_name || "—"}</div><div style={{ color: "#aeb8c7", fontSize: 12, marginTop: 5 }}>{Number(p.price).toLocaleString("ru-RU")} ₽ · {p.status} · {p.available ? "видимо" : "скрыто"}</div></div><div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}><button onClick={() => void mutate(`/admin/center/products/${p.id}`, { method: "PATCH", body: JSON.stringify({ status: "active", available: true }) })} style={primary}>Одобрить</button><button onClick={() => void mutate(`/admin/center/products/${p.id}`, { method: "PATCH", body: JSON.stringify({ status: "rejected", available: false }) })} style={danger}>Отклонить</button><button onClick={() => void mutate(`/admin/center/products/${p.id}`, { method: "PATCH", body: JSON.stringify({ status: "hidden", available: false }) })} style={muted}>Скрыть</button><button onClick={() => void mutate(`/admin/center/products/${p.id}`, { method: "DELETE" })} style={danger}>Удалить</button></div></div></div>)}</div></section>}

          {tab === "reports" && <section style={{ ...card, padding: 17 }}><div style={{ display: "flex", gap: 8 }}><select value={reportStatus} onChange={(e) => setReportStatus(e.target.value)} style={{ ...field, width: 190 }}><option value="all">Все жалобы</option><option value="open">Открытые</option><option value="confirmed">Подтверждённые</option><option value="rejected">Отклонённые</option></select><button onClick={() => void loadTab("reports")} style={primary}>Обновить</button></div><div style={{ marginTop: 12, display: "grid", gap: 9 }}>{reports.length ? reports.map((r: AnyRow) => <div key={r.id} style={{ padding: 13, borderRadius: 12, border: "1px solid rgba(255,255,255,.07)" }}><div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><b>Жалоба #{r.id} · {r.reason}</b><span style={{ color: r.status === "open" ? "#ffcc72" : "#7f8da0", fontSize: 10, fontWeight: 900 }}>{r.status}</span></div><p style={{ color: "#9aa7b9", fontSize: 12 }}>{r.comment || "Комментарий отсутствует."}</p><small style={{ color: "#738197" }}>Репортёр: {r.reporter_name || "—"} · Цель: {r.target_name || "—"} · Объявление: {r.product_name || "—"}</small><div style={{ display: "flex", gap: 7, marginTop: 10 }}><button onClick={() => void mutate(`/admin/center/reports/${r.id}/resolve`, { method: "POST", body: JSON.stringify({ status: "confirmed" }) }, "reports")} style={primary}>Подтвердить</button><button onClick={() => void mutate(`/admin/center/reports/${r.id}/resolve`, { method: "POST", body: JSON.stringify({ status: "rejected" }) }, "reports")} style={muted}>Отклонить</button></div></div>) : <p style={{ color: "#78869a" }}>Жалоб пока нет.</p>}</div></section>}

          {tab === "reviews" && <section style={{ ...card, padding: 17 }}><div style={{ display: "flex", gap: 8 }}><select value={reviewStatus} onChange={(e) => setReviewStatus(e.target.value)} style={{ ...field, width: 190 }}><option value="all">Все отзывы</option><option value="pending">На модерации</option><option value="approved">Одобрены</option><option value="rejected">Отклонены</option></select><button onClick={() => void loadTab("reviews")} style={primary}>Обновить</button></div><div style={{ marginTop: 12, display: "grid", gap: 9 }}>{reviews.length ? reviews.map((r: AnyRow) => <div key={r.id} style={{ padding: 13, borderRadius: 12, border: "1px solid rgba(255,255,255,.07)" }}><b>#{r.id} · {"★".repeat(Number(r.rating))}{"☆".repeat(5-Number(r.rating))}</b><p style={{ color: "#9aa7b9" }}>{r.text || "Без текста"}</p><small style={{ color: "#738197" }}>{r.reviewer_name || "Пользователь"} → {r.seller_name || "Продавец"} · {r.product_name || "объявление"}</small><div style={{ display: "flex", gap: 7, marginTop: 10 }}><button onClick={() => void mutate(`/admin/center/reviews/${r.id}/moderate`, { method: "POST", body: JSON.stringify({ status: "approved" }) }, "reviews")} style={primary}>Одобрить</button><button onClick={() => void mutate(`/admin/center/reviews/${r.id}/moderate`, { method: "POST", body: JSON.stringify({ status: "rejected" }) }, "reviews")} style={danger}>Отклонить</button></div></div>) : <p style={{ color: "#78869a" }}>Отзывов пока нет.</p>}</div></section>}

          {tab === "admins" && <section style={{ ...card, padding: 17 }}><h3 style={{ marginTop: 0 }}>Команда и роли</h3><p style={{ color: "#7e8ba0" }}>Владелец имеет полный доступ. Администраторы управляют системой, модераторы — модерацией.</p><div style={{ display: "grid", gap: 9 }}>{admins.map((admin: AnyRow) => <div key={admin.user_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: 12, borderRadius: 12, background: "rgba(255,255,255,.025)" }}><div><b>{admin.display_name || "Пользователь"}</b><small style={{ display: "block", color: "#748197", marginTop: 3 }}>ID {admin.user_id} · {admin.username ? `@${admin.username}` : "без username"}</small></div>{admin.role === "owner" ? <span style={{ color: "#70eee5", fontWeight: 900 }}>ВЛАДЕЛЕЦ</span> : <select value={admin.role} onChange={(e) => void mutate(`/admin/center/admins/${admin.user_id}`, { method: "PATCH", body: JSON.stringify({ role: e.target.value }) }, "admins")} style={{ ...field, width: 170 }}><option value="admin">Администратор</option><option value="moderator">Модератор</option></select>}</div>)}</div></section>}

          {tab === "audit" && <section style={{ ...card, padding: 17 }}><div style={{ display: "grid", gap: 8 }}>{audit.map((row: AnyRow) => <div key={row.id} style={{ padding: 11, borderRadius: 11, background: "rgba(255,255,255,.025)" }}><b>{row.action}</b><div style={{ color: "#78869a", fontSize: 11, marginTop: 4 }}>Админ: {row.display_name || "—"} · цель: {row.target_type || "—"} #{row.target_id || "—"} · {fmtDate(row.created_at)}</div>{row.details && <small style={{ display: "block", color: "#8e9aad", marginTop: 5 }}>{row.details}</small>}</div>)}</div></section>}

          {tab === "directories" && <section style={{ ...card, padding: 17 }}><div style={{ display: "flex", gap: 8 }}><button onClick={() => setDirectoryKind("categories")} style={directoryKind === "categories" ? primary : muted}>🗂 Категории</button><button onClick={() => setDirectoryKind("cities")} style={directoryKind === "cities" ? primary : muted}>🏙 Города</button></div><div style={{ display: "grid", gridTemplateColumns: "minmax(260px,.8fr) 1.2fr", gap: 15, marginTop: 15 }}><div><input value={newDirectory.name} onChange={(e) => setNewDirectory((x) => ({ ...x, name: e.target.value }))} placeholder="Название" style={{ ...field, marginBottom: 8 }} /><input value={newDirectory.slug} onChange={(e) => setNewDirectory((x) => ({ ...x, slug: e.target.value }))} placeholder="slug" style={{ ...field, marginBottom: 8 }} />{directoryKind === "categories" && <input value={newDirectory.icon} onChange={(e) => setNewDirectory((x) => ({ ...x, icon: e.target.value }))} placeholder="Иконка" style={{ ...field, marginBottom: 8 }} />}<button onClick={async () => { await mutate(`/admin/center/directory/${directoryKind}`, { method: "POST", body: JSON.stringify(newDirectory) }, "directories"); setNewDirectory({ name: "", slug: "", icon: "◈" }); }} style={primary}>Добавить</button></div><div style={{ display: "grid", gap: 8 }}>{(directoryKind === "categories" ? categories : cities).map((item: AnyRow) => <div key={item.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: 11, borderRadius: 10, background: "rgba(255,255,255,.025)" }}><span>{directoryKind === "categories" ? `${item.icon || "◈"} ` : "📍 "}{item.name}<small style={{ display: "block", color: "#748197", fontSize: 10 }}>{item.slug}</small></span><button onClick={() => { const nextName = window.prompt("Новое название", item.name); if (nextName) void mutate(`/admin/center/directory/${directoryKind}/${item.id}`, { method: "PATCH", body: JSON.stringify({ name: nextName, slug: item.slug, icon: item.icon }) }, "directories"); }} style={muted}>Изменить</button><button onClick={() => void mutate(`/admin/center/directory/${directoryKind}/${item.id}`, { method: "DELETE" }, "directories")} style={danger}>Удалить</button></div>)}</div></div></section>}

          {tab === "broadcasts" && <section style={{ ...card, padding: 17 }}><div style={{ display: "grid", gridTemplateColumns: "minmax(280px,.8fr) 1.2fr", gap: 15 }}><div><input value={broadcastDraft.title} onChange={(e) => setBroadcastDraft((x) => ({ ...x, title: e.target.value }))} placeholder="Название рассылки" style={{ ...field, marginBottom: 8 }} /><select value={broadcastDraft.audience} onChange={(e) => setBroadcastDraft((x) => ({ ...x, audience: e.target.value }))} style={{ ...field, marginBottom: 8 }}><option value="all">Все пользователи</option><option value="active">Активные</option><option value="sellers">Продавцы</option><option value="buyers">Покупатели</option><option value="city">Город</option></select><textarea value={broadcastDraft.message} onChange={(e) => setBroadcastDraft((x) => ({ ...x, message: e.target.value }))} placeholder="Текст сообщения" rows={8} style={{ ...field, resize: "vertical" }} /><button onClick={async () => { await mutate("/admin/center/broadcasts", { method: "POST", body: JSON.stringify(broadcastDraft) }, "broadcasts"); setBroadcastDraft({ title: "", message: "", audience: "all" }); }} style={{ ...primary, marginTop: 9 }}>Создать рассылку</button></div><div style={{ display: "grid", gap: 8 }}>{broadcasts.map((b: AnyRow) => <div key={b.id} style={{ padding: 12, borderRadius: 11, background: "rgba(255,255,255,.025)" }}><div style={{ display: "flex", justifyContent: "space-between" }}><b>{b.title}</b><span style={{ color: "#8b98ab", fontSize: 10 }}>{b.status}</span></div><p style={{ color: "#919fb2", whiteSpace: "pre-wrap" }}>{b.message}</p><small style={{ color: "#738197" }}>Аудитория: {b.audience} · {fmtDate(b.created_at)}</small>{b.status === "draft" && <button onClick={() => void mutate(`/admin/center/broadcasts/${b.id}/queue`, { method: "POST" }, "broadcasts")} style={{ ...primary, marginTop: 9 }}>В очередь</button>}</div>)}</div></div><p style={{ color: "#6f7d91", fontSize: 11, marginBottom: 0 }}>Рассылки сохраняются как очередь сообщений. Фактическая доставка зависит от подключённого канала отправки.</p></section>}

          {tab === "settings" && <section style={{ ...card, padding: 17 }}><div style={{ display: "grid", gridTemplateColumns: "minmax(260px,.8fr) 1.2fr", gap: 15 }}><div><input value={newSettingKey} onChange={(e) => setNewSettingKey(e.target.value)} placeholder="Ключ настройки" style={{ ...field, marginBottom: 8 }} /><textarea value={newSettingValue} onChange={(e) => setNewSettingValue(e.target.value)} placeholder="Значение" rows={5} style={{ ...field, marginBottom: 8 }} /><button onClick={async () => { if (!newSettingKey.trim()) return; await mutate(`/admin/center/settings/${encodeURIComponent(newSettingKey.trim())}`, { method: "PATCH", body: JSON.stringify({ value: newSettingValue }) }, "settings"); setNewSettingKey(""); setNewSettingValue(""); }} style={primary}>Сохранить</button></div><div style={{ display: "grid", gap: 8 }}>{settings.map((s: AnyRow) => <div key={s.key} style={{ padding: 11, borderRadius: 10, background: "rgba(255,255,255,.025)" }}><div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><b>{s.key}</b><button onClick={() => { const value = window.prompt(`Значение ${s.key}`, s.value); if (value !== null) void mutate(`/admin/center/settings/${encodeURIComponent(s.key)}`, { method: "PATCH", body: JSON.stringify({ value }) }, "settings"); }} style={muted}>Изменить</button></div><p style={{ color: "#8997aa", marginBottom: 0, whiteSpace: "pre-wrap" }}>{s.value || "—"}</p></div>)}</div></div></section>}

          {tab === "security" && <section style={{ ...card, padding: 17 }}><h3 style={{ marginTop: 0 }}>Активные сессии пользователей</h3><div style={{ display: "grid", gap: 8 }}>{sessions.map((s: AnyRow) => <div key={s.id} style={{ padding: 11, borderRadius: 10, background: "rgba(255,255,255,.025)" }}><div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><b>#{s.id} · {s.display_name || "Пользователь"}</b><span style={{ color: s.revoked_at ? "#ff9eaa" : "#70eee5", fontSize: 10, fontWeight: 900 }}>{s.revoked_at ? "ЗАВЕРШЕНА" : "АКТИВНА"}</span></div><small style={{ color: "#748197", display: "block", marginTop: 4 }}>@{s.username || "—"} · {s.device || "Устройство"} · {s.platform || "—"} · IP {s.ip_address || "скрыт"}</small><small style={{ color: "#6f7d91", display: "block", marginTop: 3 }}>Создана: {fmtDate(s.created_at)} · истекает: {fmtDate(s.expires_at)}</small></div>)}</div></section>}
        </div>
      </main>
    </section>
  </div>;
}
