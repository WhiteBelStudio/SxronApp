import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { getAuthToken } from "../api/api";

type Dashboard = {
  version: string;
  is_owner: boolean;
  user: {
    id: number;
    display_name: string;
    username?: string | null;
    email?: string | null;
    email_verified?: boolean;
  };
  stats: {
    users: number;
    products: number;
    active_products: number;
    sold_products: number;
    admins: number;
    categories: number;
    cities: number;
  };
};

type AdminUser = {
  id: number;
  username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  role: "owner" | "admin";
  added_at: string;
};

type UserRow = {
  id: number;
  display_name: string;
  username?: string | null;
  email?: string | null;
  email_verified: boolean;
  phone_verified: boolean;
  created_at: string;
  last_seen_at: string;
  listings_count: number;
  is_admin: boolean;
  is_owner: boolean;
};

const API_URL = (import.meta.env.VITE_API_URL || (typeof window !== "undefined" && window.location.protocol === "file:" ? "http://127.0.0.1:8000" : "/api")).replace(/\/$/, "");

async function adminRequest<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
  });
  if (!response.ok) {
    let message = `Ошибка API: ${response.status}`;
    try {
      const body = await response.json();
      if (typeof body?.detail === "string") message = body.detail;
    } catch {
      // ignore malformed error bodies
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

const cardStyle: CSSProperties = {
  borderRadius: 22,
  border: "1px solid rgba(255,255,255,.10)",
  background: "linear-gradient(145deg, rgba(18,24,35,.96), rgba(10,14,23,.94))",
  boxShadow: "0 30px 100px rgba(0,0,0,.45)",
  color: "#f8fafc",
};

export default function AdminPanel() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState("");
  const [adminId, setAdminId] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [nextDashboard, nextAdmins, nextUsers] = await Promise.all([
        adminRequest<Dashboard>("/admin/dashboard"),
        adminRequest<{ admins: AdminUser[] }>("/admin/admins"),
        adminRequest<{ users: UserRow[] }>("/admin/users"),
      ]);
      setDashboard(nextDashboard);
      setAdmins(nextAdmins.admins);
      setUsers(nextUsers.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось открыть админ-панель.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const openPanel = () => {
      if (!active) return;
      setOpen(true);
      void refresh();
    };
    window.addEventListener("sxron-open-admin-panel", openPanel);
    void refresh();
    return () => {
      active = false;
      window.removeEventListener("sxron-open-admin-panel", openPanel);
    };
  }, [refresh]);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return users;
    return users.filter((user) => `${user.id} ${user.display_name} ${user.username || ""} ${user.email || ""}`.toLowerCase().includes(query));
  }, [search, users]);

  async function addAdmin() {
    const id = Number(adminId);
    if (!Number.isInteger(id) || id <= 0) {
      setError("Введите корректный ID пользователя.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await adminRequest(`/admin/admins/${id}`, { method: "POST" });
      setAdminId("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось добавить администратора.");
    } finally {
      setBusy(false);
    }
  }

  async function removeAdmin(id: number) {
    setBusy(true);
    setError("");
    try {
      await adminRequest(`/admin/admins/${id}`, { method: "DELETE" });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось удалить администратора.");
    } finally {
      setBusy(false);
    }
  }

  const statItems = dashboard ? [
    ["👥", "Пользователи", dashboard.stats.users],
    ["📦", "Товары", dashboard.stats.products],
    ["🟢", "Активные", dashboard.stats.active_products],
    ["✅", "Проданы", dashboard.stats.sold_products],
    ["🛡️", "Админы", dashboard.stats.admins],
    ["◈", "Категории", dashboard.stats.categories],
  ] as const : [];

  if (!open) {
    return dashboard?.is_owner || admins.some((admin) => admin.role === "owner") ? (
      <button
        type="button"
        aria-label="Открыть админ-панель"
        onClick={() => { setOpen(true); void refresh(); }}
        style={{ position: "fixed", right: 22, bottom: 88, zIndex: 5000, minHeight: 44, padding: "0 15px", border: "1px solid rgba(32,211,194,.35)", borderRadius: 14, color: "#fff", background: "linear-gradient(135deg,#19d8d0,#7a4dff)", boxShadow: "0 14px 45px rgba(48,80,170,.35)", cursor: "pointer", fontWeight: 900 }}
      >
        ⚙️ Админ-панель
      </button>
    ) : null;
  }

  return (
    <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, zIndex: 50000, padding: 18, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(3,6,12,.88)", backdropFilter: "blur(18px)" }} onMouseDown={(event) => { if (event.currentTarget === event.target) setOpen(false); }}>
      <section style={{ ...cardStyle, width: "min(1080px, 100%)", maxHeight: "calc(100vh - 36px)", overflow: "auto" }}>
        <div style={{ padding: "26px 26px 18px", borderBottom: "1px solid rgba(255,255,255,.08)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, position: "sticky", top: 0, background: "rgba(12,17,27,.96)", backdropFilter: "blur(16px)", zIndex: 2 }}>
          <div><div style={{ color: "#20d3c2", fontSize: 11, fontWeight: 900, letterSpacing: ".14em" }}>SXRON CONTROL CENTER</div><h2 style={{ margin: "7px 0 4px", fontSize: 30 }}>Админ-панель</h2><div style={{ color: "#8f9cb0", fontSize: 13 }}>{dashboard?.user?.email || "Авторизованный администратор"} · v{dashboard?.version || "1.1.7"}</div></div>
          <button type="button" onClick={() => setOpen(false)} style={{ width: 42, height: 42, borderRadius: 12, border: "1px solid rgba(255,255,255,.10)", background: "rgba(255,255,255,.05)", color: "#fff", cursor: "pointer", fontSize: 22 }}>×</button>
        </div>

        <div style={{ padding: 26 }}>
          {error && <div style={{ marginBottom: 18, padding: 13, borderRadius: 13, background: "rgba(255,80,105,.10)", border: "1px solid rgba(255,80,105,.16)", color: "#ffadb7" }}>{error}</div>}
          {loading && !dashboard ? <div style={{ padding: 45, textAlign: "center", color: "#8f9cb0" }}>Загружаем центр управления…</div> : null}

          {dashboard && <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12 }}>
              {statItems.map(([icon, label, value]) => <div key={label} style={{ padding: 17, borderRadius: 17, border: "1px solid rgba(255,255,255,.08)", background: "rgba(255,255,255,.035)" }}><div style={{ fontSize: 18 }}>{icon}</div><div style={{ marginTop: 10, color: "#8896ab", fontSize: 12 }}>{label}</div><strong style={{ display: "block", marginTop: 3, fontSize: 26 }}>{value}</strong></div>)}
            </div>

            <div style={{ marginTop: 22, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 18 }}>
              <div style={{ padding: 20, borderRadius: 18, border: "1px solid rgba(255,255,255,.08)", background: "rgba(255,255,255,.03)" }}><div style={{ color: "#20d3c2", fontSize: 11, fontWeight: 900, letterSpacing: ".12em" }}>OWNER</div><h3 style={{ margin: "7px 0 4px", fontSize: 19 }}>{dashboard.user.display_name}</h3><p style={{ margin: 0, color: "#8f9cb0", lineHeight: 1.55 }}>{dashboard.user.email || "Email скрыт"}</p><div style={{ marginTop: 14, display: "inline-flex", padding: "6px 9px", borderRadius: 9, background: "rgba(32,211,194,.10)", color: "#70eee5", fontSize: 11, fontWeight: 800 }}>{dashboard.is_owner ? "ВЛАДЕЛЕЦ" : "АДМИНИСТРАТОР"}</div></div>
              <div style={{ padding: 20, borderRadius: 18, border: "1px solid rgba(255,255,255,.08)", background: "rgba(255,255,255,.03)" }}><div style={{ color: "#9b8cff", fontSize: 11, fontWeight: 900, letterSpacing: ".12em" }}>QUICK INFO</div><h3 style={{ margin: "7px 0 4px", fontSize: 19 }}>Marketplace</h3><p style={{ margin: 0, color: "#8f9cb0", lineHeight: 1.55 }}>Белореченск · Хутор Кубанский<br />Категорий: {dashboard.stats.categories} · Городов: {dashboard.stats.cities}</p></div>
            </div>

            <div style={{ marginTop: 24, padding: 20, borderRadius: 18, border: "1px solid rgba(255,255,255,.08)", background: "rgba(255,255,255,.03)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}><div><div style={{ color: "#20d3c2", fontSize: 11, fontWeight: 900, letterSpacing: ".12em" }}>ADMIN TEAM</div><h3 style={{ margin: "7px 0 0", fontSize: 19 }}>Администраторы</h3></div><button type="button" onClick={() => void refresh()} style={{ border: "1px solid rgba(255,255,255,.10)", borderRadius: 10, padding: "8px 11px", background: "rgba(255,255,255,.05)", color: "#fff", cursor: "pointer" }}>↻ Обновить</button></div>
              {dashboard.is_owner && <div style={{ display: "flex", gap: 9, marginTop: 15 }}><input value={adminId} onChange={(event) => setAdminId(event.target.value)} placeholder="ID пользователя" inputMode="numeric" style={{ flex: 1, minWidth: 0, borderRadius: 11, border: "1px solid rgba(255,255,255,.10)", background: "rgba(255,255,255,.05)", color: "#fff", padding: "11px 12px", outline: "none" }} /><button type="button" disabled={busy} onClick={addAdmin} style={{ border: 0, borderRadius: 11, padding: "0 15px", background: "linear-gradient(135deg,#19d8d0,#7a4dff)", color: "#fff", fontWeight: 800, cursor: "pointer", opacity: busy ? .6 : 1 }}>Добавить</button></div>}
              <div style={{ marginTop: 14, display: "grid", gap: 9 }}>{admins.map((admin) => <div key={admin.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: 12, borderRadius: 12, background: "rgba(255,255,255,.035)" }}><div><strong>{admin.first_name || "Пользователь"}{admin.last_name ? ` ${admin.last_name}` : ""}</strong><div style={{ marginTop: 3, color: "#7f8da3", fontSize: 12 }}>ID {admin.id}{admin.email ? ` · ${admin.email}` : ""}</div></div><div style={{ display: "flex", alignItems: "center", gap: 10 }}><span style={{ fontSize: 10, fontWeight: 900, color: admin.role === "owner" ? "#70eee5" : "#a99cff" }}>{admin.role === "owner" ? "OWNER" : "ADMIN"}</span>{dashboard.is_owner && admin.role !== "owner" && <button type="button" disabled={busy} onClick={() => void removeAdmin(admin.id)} style={{ border: 0, background: "rgba(255,80,105,.10)", color: "#ff9eaa", borderRadius: 9, padding: "7px 9px", cursor: "pointer" }}>Удалить</button>}</div></div>)}</div>
            </div>

            <div style={{ marginTop: 24, padding: 20, borderRadius: 18, border: "1px solid rgba(255,255,255,.08)", background: "rgba(255,255,255,.03)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}><div><div style={{ color: "#9b8cff", fontSize: 11, fontWeight: 900, letterSpacing: ".12em" }}>USERS</div><h3 style={{ margin: "7px 0 0", fontSize: 19 }}>Пользователи</h3></div><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Поиск по ID, email, имени..." style={{ width: "min(330px,45%)", borderRadius: 11, border: "1px solid rgba(255,255,255,.10)", background: "rgba(255,255,255,.05)", color: "#fff", padding: "10px 12px", outline: "none" }} /></div>
              <div style={{ marginTop: 14, display: "grid", gap: 8 }}>{filteredUsers.slice(0, 60).map((user) => <div key={user.id} style={{ display: "grid", gridTemplateColumns: "56px minmax(180px,1fr) minmax(180px,1fr) 80px", alignItems: "center", gap: 12, padding: "11px 12px", borderRadius: 11, background: "rgba(255,255,255,.03)" }}><strong>#{user.id}</strong><div><b>{user.display_name}</b><span style={{ display: "block", marginTop: 2, color: "#77859b", fontSize: 11 }}>{user.username ? `@${user.username}` : "Username нет"}</span></div><div style={{ color: "#8f9cb0", fontSize: 12, wordBreak: "break-word" }}>{user.email || "Email нет"}{user.email_verified && " · ✓"}</div><div style={{ textAlign: "right", color: user.is_owner ? "#70eee5" : user.is_admin ? "#a99cff" : "#76849a", fontSize: 10, fontWeight: 900 }}>{user.is_owner ? "OWNER" : user.is_admin ? "ADMIN" : `${user.listings_count} объявл.`}</div></div>)}</div>
            </div>
          </>}
        </div>
      </section>
    </div>
  );
}
