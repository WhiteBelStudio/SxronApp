import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { getAuthToken } from "../api/api";

type Dashboard = {
  version: string;
  is_owner: boolean;
  user: { id: number; display_name: string; username?: string | null; email?: string | null };
  stats: { users: number; products: number; active_products: number; sold_products: number; admins: number; categories: number; cities: number };
};

type AdminUser = { id: number; username?: string | null; first_name?: string | null; last_name?: string | null; email?: string | null; role: "owner" | "admin"; added_at: string };
type City = { id: number; name: string; slug?: string | null };
type UserRow = { id: number; display_name: string; username?: string | null; email?: string | null; created_at: string; last_seen_at: string; listings_count: number; is_admin: boolean; is_owner: boolean; role: string };
type Profile = UserRow & {
  client_id: string;
  first_name?: string | null;
  last_name?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  city_id?: number | null;
  city?: City | null;
  profile_status: string;
  profile_accent: "cyan" | "violet" | "blue" | "sunset";
  profile_banner: "aurora" | "violet" | "ocean" | "sunset";
  avatar_shape: "rounded" | "circle" | "square";
  username_visible: boolean;
  badges_visible: boolean;
  activity_visible: boolean;
  email_verified: boolean;
  phone_verified: boolean;
  listings_count: number;
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

const card: CSSProperties = {
  borderRadius: 22,
  border: "1px solid rgba(255,255,255,.10)",
  background: "linear-gradient(145deg, rgba(18,24,35,.98), rgba(10,14,23,.96))",
  boxShadow: "0 30px 100px rgba(0,0,0,.45)",
  color: "#f8fafc",
};
const input: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  borderRadius: 11,
  border: "1px solid rgba(255,255,255,.10)",
  background: "rgba(255,255,255,.045)",
  color: "#fff",
  padding: "11px 12px",
  outline: "none",
};
const label: CSSProperties = { display: "grid", gap: 7, color: "#98a5b9", fontSize: 12, fontWeight: 700 };
const primary: CSSProperties = { border: 0, borderRadius: 11, padding: "10px 14px", background: "linear-gradient(135deg,#19d8d0,#7a4dff)", color: "#fff", fontWeight: 900, cursor: "pointer" };
const ghost: CSSProperties = { border: "1px solid rgba(255,255,255,.10)", borderRadius: 11, padding: "10px 13px", background: "rgba(255,255,255,.045)", color: "#fff", fontWeight: 800, cursor: "pointer" };

function roleColor(role: string) {
  if (role === "Владелец") return "#70eee5";
  if (role === "Администратор") return "#a99cff";
  return "#8290a6";
}

export default function AdminPanel() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [search, setSearch] = useState("");
  const [adminId, setAdminId] = useState("");
  const [selected, setSelected] = useState<Profile | null>(null);
  const [edit, setEdit] = useState<Partial<Profile>>({});

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [d, a, u, c] = await Promise.all([
        adminRequest<Dashboard>("/admin/dashboard"),
        adminRequest<{ admins: AdminUser[] }>("/admin/admins"),
        adminRequest<{ users: UserRow[] }>("/admin/users"),
        adminRequest<City[]>("/cities"),
      ]);
      setDashboard(d);
      setAdmins(a.admins);
      setUsers(u.users);
      setCities(c);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить админ-панель.");
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
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((user) => `${user.id} ${user.display_name} ${user.username || ""} ${user.email || ""}`.toLowerCase().includes(q));
  }, [search, users]);

  async function openUser(id: number) {
    setBusy(true);
    setError("");
    try {
      const result = await adminRequest<{ user: Profile }>(`/admin/users/${id}`);
      setSelected(result.user);
      setEdit({ ...result.user });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось открыть профиль пользователя.");
    } finally {
      setBusy(false);
    }
  }

  async function saveUser() {
    if (!selected || !dashboard?.is_owner) return;
    setBusy(true);
    setError("");
    try {
      const payload = {
        display_name: String(edit.display_name ?? ""),
        first_name: String(edit.first_name ?? ""),
        last_name: String(edit.last_name ?? ""),
        username: String(edit.username ?? ""),
        bio: String(edit.bio ?? ""),
        avatar_url: String(edit.avatar_url ?? ""),
        city_id: edit.city_id ?? null,
        profile_accent: edit.profile_accent ?? "cyan",
        profile_banner: edit.profile_banner ?? "aurora",
        avatar_shape: edit.avatar_shape ?? "rounded",
        username_visible: Boolean(edit.username_visible),
        badges_visible: Boolean(edit.badges_visible),
        activity_visible: Boolean(edit.activity_visible),
      };
      const result = await adminRequest<{ user: Profile }>(`/admin/users/${selected.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      setSelected(result.user);
      setEdit({ ...result.user });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить профиль.");
    } finally {
      setBusy(false);
    }
  }

  async function resetProfile() {
    if (!selected || !dashboard?.is_owner) return;
    setBusy(true);
    setError("");
    try {
      const result = await adminRequest<{ user: Profile }>(`/admin/users/${selected.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          display_name: "",
          first_name: "",
          last_name: "",
          username: "",
          bio: "",
          avatar_url: "",
          city_id: null,
          profile_accent: "cyan",
          profile_banner: "aurora",
          avatar_shape: "rounded",
          username_visible: true,
          badges_visible: true,
          activity_visible: true,
        }),
      });
      setSelected(result.user);
      setEdit({ ...result.user });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сбросить профиль.");
    } finally {
      setBusy(false);
    }
  }

  async function addAdminById(id: number) {
    if (!dashboard?.is_owner) return;
    setBusy(true);
    setError("");
    try {
      await adminRequest(`/admin/admins/${id}`, { method: "POST" });
      await refresh();
      await openUser(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось назначить администратора.");
    } finally {
      setBusy(false);
    }
  }

  async function removeAdmin(id: number) {
    if (!dashboard?.is_owner) return;
    setBusy(true);
    setError("");
    try {
      await adminRequest(`/admin/admins/${id}`, { method: "DELETE" });
      await refresh();
      await openUser(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось снять администратора.");
    } finally {
      setBusy(false);
    }
  }

  async function addAdmin() {
    const id = Number(adminId);
    if (!Number.isInteger(id) || id <= 0) {
      setError("Введите корректный ID пользователя.");
      return;
    }
    setAdminId("");
    await addAdminById(id);
  }

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

  const statItems = dashboard ? [
    ["👥", "Пользователи", dashboard.stats.users],
    ["📦", "Товары", dashboard.stats.products],
    ["🟢", "Активные", dashboard.stats.active_products],
    ["✅", "Проданы", dashboard.stats.sold_products],
    ["🛡️", "Админы", dashboard.stats.admins],
    ["◈", "Категории", dashboard.stats.categories],
  ] as const : [];

  return (
    <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, zIndex: 50000, padding: 18, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(3,6,12,.90)", backdropFilter: "blur(18px)" }} onMouseDown={(event) => { if (event.currentTarget === event.target) setOpen(false); }}>
      <section style={{ ...card, width: "min(1240px,100%)", maxHeight: "calc(100vh - 36px)", overflow: "auto" }}>
        <header style={{ padding: "22px 24px", borderBottom: "1px solid rgba(255,255,255,.08)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, position: "sticky", top: 0, zIndex: 10, background: "rgba(12,17,27,.96)", backdropFilter: "blur(16px)" }}>
          <div>
            <div style={{ color: "#20d3c2", fontSize: 11, fontWeight: 900, letterSpacing: ".14em" }}>SXRON CONTROL CENTER</div>
            <h2 style={{ margin: "6px 0 3px", fontSize: 29 }}>Расширенная админ-панель</h2>
            <div style={{ color: "#8f9cb0", fontSize: 13 }}>{dashboard?.user?.email || "Авторизованный администратор"} · v{dashboard?.version || "1.1.17"}</div>
          </div>
          <button type="button" onClick={() => setOpen(false)} style={{ width: 42, height: 42, borderRadius: 12, border: "1px solid rgba(255,255,255,.10)", background: "rgba(255,255,255,.05)", color: "#fff", cursor: "pointer", fontSize: 22 }}>×</button>
        </header>

        <div style={{ padding: 24 }}>
          {error && <div style={{ marginBottom: 18, padding: 13, borderRadius: 13, background: "rgba(255,80,105,.10)", border: "1px solid rgba(255,80,105,.16)", color: "#ffadb7" }}>{error}</div>}
          {loading && !dashboard && <div style={{ padding: 45, textAlign: "center", color: "#8f9cb0" }}>Загружаем центр управления…</div>}

          {dashboard && <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))", gap: 11 }}>
              {statItems.map(([icon, name, value]) => <div key={name} style={{ padding: 15, borderRadius: 16, border: "1px solid rgba(255,255,255,.08)", background: "rgba(255,255,255,.035)" }}><div>{icon}</div><div style={{ marginTop: 8, color: "#8896ab", fontSize: 12 }}>{name}</div><strong style={{ display: "block", marginTop: 3, fontSize: 23 }}>{value}</strong></div>)}
            </div>

            <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 18 }}>
              <div style={{ padding: 18, borderRadius: 18, border: "1px solid rgba(255,255,255,.08)", background: "rgba(255,255,255,.025)" }}>
                <div style={{ color: "#20d3c2", fontSize: 11, fontWeight: 900, letterSpacing: ".12em" }}>ADMIN TEAM</div>
                <h3 style={{ margin: "7px 0 0", fontSize: 19 }}>Администраторы</h3>
                {dashboard.is_owner && <div style={{ display: "flex", gap: 9, marginTop: 13 }}><input value={adminId} onChange={(event) => setAdminId(event.target.value)} placeholder="ID пользователя" inputMode="numeric" style={{ ...input, flex: 1 }} /><button type="button" disabled={busy} onClick={() => void addAdmin()} style={{ ...primary, opacity: busy ? .6 : 1 }}>Назначить</button></div>}
                <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
                  {admins.map((admin) => <div key={admin.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: 11, borderRadius: 12, background: "rgba(255,255,255,.03)" }}><div><strong>{admin.first_name || "Пользователь"}{admin.last_name ? ` ${admin.last_name}` : ""}</strong><div style={{ marginTop: 3, color: "#7f8da3", fontSize: 11 }}>ID {admin.id}{admin.email ? ` · ${admin.email}` : ""}</div></div><div style={{ display: "flex", alignItems: "center", gap: 9 }}><span style={{ color: admin.role === "owner" ? "#70eee5" : "#a99cff", fontSize: 10, fontWeight: 900 }}>{admin.role === "owner" ? "ВЛАДЕЛЕЦ" : "АДМИН"}</span>{dashboard.is_owner && admin.role !== "owner" && <button type="button" disabled={busy} onClick={() => void removeAdmin(admin.id)} style={{ border: 0, borderRadius: 8, padding: "6px 8px", background: "rgba(255,80,105,.10)", color: "#ff9eaa", cursor: "pointer" }}>Снять</button>}</div></div>)}
                </div>
              </div>
              <div style={{ padding: 18, borderRadius: 18, border: "1px solid rgba(255,255,255,.08)", background: "rgba(255,255,255,.025)" }}>
                <div style={{ color: "#9b8cff", fontSize: 11, fontWeight: 900, letterSpacing: ".12em" }}>ROLE SYSTEM</div>
                <h3 style={{ margin: "7px 0 4px", fontSize: 19 }}>Системные статусы</h3>
                <p style={{ margin: 0, color: "#8f9cb0", lineHeight: 1.55 }}>Пользователь не задаёт статус вручную. Роль определяется сервером и показывается в профиле автоматически.</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 13 }}><span style={{ padding: "7px 10px", borderRadius: 9, background: "rgba(255,255,255,.05)", color: "#8290a6", fontSize: 11, fontWeight: 900 }}>Пользователь</span><span style={{ padding: "7px 10px", borderRadius: 9, background: "rgba(155,140,255,.10)", color: "#a99cff", fontSize: 11, fontWeight: 900 }}>Администратор</span><span style={{ padding: "7px 10px", borderRadius: 9, background: "rgba(32,211,194,.10)", color: "#70eee5", fontSize: 11, fontWeight: 900 }}>Владелец</span></div>
              </div>
            </div>

            <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "minmax(300px,.85fr) minmax(420px,1.15fr)", gap: 18 }}>
              <div style={{ padding: 18, borderRadius: 18, border: "1px solid rgba(255,255,255,.08)", background: "rgba(255,255,255,.025)" }}>
                <div style={{ color: "#20d3c2", fontSize: 11, fontWeight: 900, letterSpacing: ".12em" }}>USERS</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}><h3 style={{ margin: "7px 0 0", fontSize: 19 }}>Пользователи</h3><button type="button" onClick={() => void refresh()} style={ghost}>↻</button></div>
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ID, имя, username или email" style={{ ...input, marginTop: 13 }} />
                <div style={{ marginTop: 11, display: "grid", gap: 8, maxHeight: 500, overflow: "auto" }}>
                  {filteredUsers.map((user) => <button key={user.id} type="button" onClick={() => void openUser(user.id)} style={{ width: "100%", textAlign: "left", padding: 12, borderRadius: 13, border: selected?.id === user.id ? "1px solid rgba(32,211,194,.38)" : "1px solid rgba(255,255,255,.06)", background: selected?.id === user.id ? "rgba(32,211,194,.07)" : "rgba(255,255,255,.025)", color: "#fff", cursor: "pointer" }}><div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}><div><strong>{user.display_name}</strong><div style={{ marginTop: 3, color: "#7d8ba0", fontSize: 11 }}>ID {user.id}{user.username ? ` · @${user.username}` : ""}</div></div><span style={{ color: roleColor(user.role), fontSize: 10, fontWeight: 900 }}>{user.role.toUpperCase()}</span></div><div style={{ marginTop: 7, color: "#7d8ba0", fontSize: 11 }}>Объявлений: {user.listings_count} · {user.last_seen_at || "Нет активности"}</div></button>)}
                  {!filteredUsers.length && <div style={{ padding: 25, textAlign: "center", color: "#7f8da3" }}>Пользователи не найдены.</div>}
                </div>
              </div>

              <div style={{ padding: 18, borderRadius: 18, border: "1px solid rgba(255,255,255,.08)", background: "rgba(255,255,255,.025)" }}>
                {!selected ? <div style={{ minHeight: 500, display: "grid", placeItems: "center", textAlign: "center", color: "#7f8da3" }}><div><div style={{ fontSize: 40 }}>👤</div><h3 style={{ margin: "11px 0 6px", color: "#fff" }}>Выберите пользователя</h3><p style={{ margin: 0, maxWidth: 360, lineHeight: 1.55 }}>Нажмите на пользователя слева, чтобы открыть его профиль и доступные владельцу действия.</p></div></div> : <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14 }}>
                    <div><div style={{ color: "#9b8cff", fontSize: 11, fontWeight: 900, letterSpacing: ".12em" }}>USER PROFILE</div><h3 style={{ margin: "7px 0 3px", fontSize: 21 }}>{selected.display_name}</h3><div style={{ color: roleColor(selected.role), fontSize: 11, fontWeight: 900 }}>{selected.profile_status}</div></div>
                    {dashboard.is_owner && !selected.is_owner && <button type="button" disabled={busy} onClick={() => void (selected.is_admin ? removeAdmin(selected.id) : addAdminById(selected.id))} style={ghost}>{selected.is_admin ? "Снять админа" : "Назначить админом"}</button>}
                  </div>

                  <div style={{ marginTop: 17, display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 11 }}>
                    <label style={label}>Отображаемое имя<input value={String(edit.display_name ?? "")} onChange={(e) => setEdit((v) => ({ ...v, display_name: e.target.value }))} style={input} maxLength={60} disabled={!dashboard.is_owner} /></label>
                    <label style={label}>Username<input value={String(edit.username ?? "")} onChange={(e) => setEdit((v) => ({ ...v, username: e.target.value }))} style={input} maxLength={120} disabled={!dashboard.is_owner} placeholder="username" /></label>
                    <label style={label}>Имя<input value={String(edit.first_name ?? "")} onChange={(e) => setEdit((v) => ({ ...v, first_name: e.target.value }))} style={input} maxLength={120} disabled={!dashboard.is_owner} /></label>
                    <label style={label}>Фамилия<input value={String(edit.last_name ?? "")} onChange={(e) => setEdit((v) => ({ ...v, last_name: e.target.value }))} style={input} maxLength={120} disabled={!dashboard.is_owner} /></label>
                  </div>

                  <label style={{ ...label, marginTop: 11 }}>Описание профиля<textarea value={String(edit.bio ?? "")} onChange={(e) => setEdit((v) => ({ ...v, bio: e.target.value }))} style={{ ...input, minHeight: 90, resize: "vertical" }} maxLength={500} disabled={!dashboard.is_owner} /></label>
                  <label style={{ ...label, marginTop: 11 }}>URL аватарки<input value={String(edit.avatar_url ?? "")} onChange={(e) => setEdit((v) => ({ ...v, avatar_url: e.target.value }))} style={input} disabled={!dashboard.is_owner} placeholder="https://..." /></label>

                  <div style={{ marginTop: 11, display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 11 }}>
                    <label style={label}>Город<select value={edit.city_id ?? ""} onChange={(e) => setEdit((v) => ({ ...v, city_id: e.target.value ? Number(e.target.value) : null }))} style={input} disabled={!dashboard.is_owner}><option value="">Не указан</option>{cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}</select></label>
                    <label style={label}>Акцент<select value={edit.profile_accent ?? "cyan"} onChange={(e) => setEdit((v) => ({ ...v, profile_accent: e.target.value as Profile["profile_accent"] }))} style={input} disabled={!dashboard.is_owner}><option value="cyan">Бирюзовый</option><option value="violet">Фиолетовый</option><option value="blue">Синий</option><option value="sunset">Sunset</option></select></label>
                    <label style={label}>Баннер<select value={edit.profile_banner ?? "aurora"} onChange={(e) => setEdit((v) => ({ ...v, profile_banner: e.target.value as Profile["profile_banner"] }))} style={input} disabled={!dashboard.is_owner}><option value="aurora">Aurora</option><option value="violet">Violet</option><option value="ocean">Ocean</option><option value="sunset">Sunset</option></select></label>
                  </div>

                  <div style={{ marginTop: 11, display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 11 }}>
                    <label style={label}>Форма аватара<select value={edit.avatar_shape ?? "rounded"} onChange={(e) => setEdit((v) => ({ ...v, avatar_shape: e.target.value as Profile["avatar_shape"] }))} style={input} disabled={!dashboard.is_owner}><option value="rounded">Скруглённая</option><option value="circle">Круг</option><option value="square">Квадрат</option></select></label>
                    <label style={{ ...label, alignContent: "end", gridAutoFlow: "column", gridTemplateColumns: "auto 1fr", alignItems: "center" }}><input type="checkbox" checked={Boolean(edit.username_visible)} onChange={(e) => setEdit((v) => ({ ...v, username_visible: e.target.checked }))} disabled={!dashboard.is_owner} /> Показывать username</label>
                    <label style={{ ...label, alignContent: "end", gridAutoFlow: "column", gridTemplateColumns: "auto 1fr", alignItems: "center" }}><input type="checkbox" checked={Boolean(edit.badges_visible)} onChange={(e) => setEdit((v) => ({ ...v, badges_visible: e.target.checked }))} disabled={!dashboard.is_owner} /> Показывать бейджи</label>
                  </div>
                  <label style={{ ...label, marginTop: 11, gridAutoFlow: "column", gridTemplateColumns: "auto 1fr", alignItems: "center" }}><input type="checkbox" checked={Boolean(edit.activity_visible)} onChange={(e) => setEdit((v) => ({ ...v, activity_visible: e.target.checked }))} disabled={!dashboard.is_owner} /> Показывать активность</label>

                  <div style={{ marginTop: 17, paddingTop: 15, borderTop: "1px solid rgba(255,255,255,.08)" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 9 }}><div style={{ padding: 10, borderRadius: 10, background: "rgba(255,255,255,.03)" }}><div style={{ color: "#78869a", fontSize: 10 }}>ID</div><strong style={{ display: "block", marginTop: 3 }}>{selected.id}</strong></div><div style={{ padding: 10, borderRadius: 10, background: "rgba(255,255,255,.03)" }}><div style={{ color: "#78869a", fontSize: 10 }}>Email</div><strong style={{ display: "block", marginTop: 3, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis" }}>{selected.email || "—"}</strong></div><div style={{ padding: 10, borderRadius: 10, background: "rgba(255,255,255,.03)" }}><div style={{ color: "#78869a", fontSize: 10 }}>Объявления</div><strong style={{ display: "block", marginTop: 3 }}>{selected.listings_count}</strong></div></div>
                  </div>

                  {dashboard.is_owner && <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 17 }}><button type="button" disabled={busy} onClick={() => void resetProfile()} style={{ ...ghost, color: "#ffb0b9" }}>Сбросить профиль</button><button type="button" disabled={busy} onClick={() => void saveUser()} style={{ ...primary, opacity: busy ? .6 : 1 }}>Сохранить изменения</button></div>}
                </>}
              </div>
            </div>
          </>}
        </div>
      </section>
    </div>
  );
}
