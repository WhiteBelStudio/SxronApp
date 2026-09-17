import { useEffect, useMemo, useState } from "react";

const APP_VERSION = "1.1.11";
const APP_BUILD = "1.1.11-build-1";
const MANIFEST_URL = `https://raw.githubusercontent.com/WhiteBelStudio/SxronApp/main/update-manifest.json?ts=${Date.now()}`;

type UpdateManifest = { version: string; build: string; title?: string; message?: string; changes?: string[] };
type UpdateKind = "version" | "repair";

function compareVersions(a: string, b: string) {
  const left = a.split(".").map(Number), right = b.split(".").map(Number);
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    const l = left[i] ?? 0, r = right[i] ?? 0;
    if (l !== r) return l > r ? 1 : -1;
  }
  return 0;
}
function startInstaller(kind: UpdateKind) { window.open(kind === "version" ? "sxron://check-updates" : "sxron://repair-current", "_self"); }

export default function ForcedUpdater() {
  const [manifest, setManifest] = useState<UpdateManifest | null>(null);
  const [kind, setKind] = useState<UpdateKind | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const response = await fetch(MANIFEST_URL, { cache: "no-store", headers: { Accept: "application/json" } });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = (await response.json()) as UpdateManifest;
        if (cancelled) return;
        setManifest(data);
        const versionChanged = compareVersions(data.version, APP_VERSION) > 0;
        const currentBuildChanged = compareVersions(data.version, APP_VERSION) === 0 && data.build !== APP_BUILD;
        setKind(versionChanged ? "version" : currentBuildChanged ? "repair" : null);
      } catch (checkError) {
        if (!cancelled) setError(checkError instanceof Error ? checkError.message : "Не удалось проверить обновления.");
      } finally { if (!cancelled) setLoading(false); }
    }
    void check();
    return () => { cancelled = true; };
  }, []);

  const title = useMemo(() => kind === "version" ? `Доступна новая версия ${manifest?.version ?? ""}` : kind === "repair" ? `Доступно обновление файлов ${APP_VERSION}` : "SXRON Marketplace", [kind, manifest?.version]);
  if (loading || !kind) return null;
  const isVersionUpdate = kind === "version";

  return (
    <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, zIndex: 999999, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "radial-gradient(circle at 15% 20%, rgba(32,211,194,.18), transparent 35%), radial-gradient(circle at 85% 80%, rgba(128,103,245,.22), transparent 35%), rgba(5,8,15,.97)", backdropFilter: "blur(28px)", WebkitBackdropFilter: "blur(28px)", color: "#f8fafc", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <div style={{ width: "min(720px, 100%)", border: "1px solid rgba(255,255,255,.13)", borderRadius: 30, padding: "clamp(28px, 5vw, 52px)", background: "linear-gradient(145deg, rgba(18,24,35,.96), rgba(10,14,23,.96))", boxShadow: "0 40px 140px rgba(0,0,0,.55)" }}>
        <div style={{ width: 68, height: 68, display: "grid", placeItems: "center", borderRadius: 20, marginBottom: 24, fontSize: 30, background: "linear-gradient(135deg,#20d3c2,#8067f5)", boxShadow: "0 14px 45px rgba(73,153,226,.25)" }}>{isVersionUpdate ? "🚀" : "🛠️"}</div>
        <div style={{ color: "#20d3c2", fontSize: 12, fontWeight: 900, letterSpacing: ".12em", textTransform: "uppercase" }}>SXRON UPDATE CENTER</div>
        <h1 style={{ margin: "10px 0 12px", fontSize: "clamp(28px, 5vw, 46px)", lineHeight: 1.05 }}>{title}</h1>
        <p style={{ margin: 0, color: "#a8b3c5", fontSize: 16, lineHeight: 1.65 }}>{manifest?.message ?? "Выпущена новая версия SXRON. Нажмите «Обновить», чтобы загрузить и установить актуальные файлы."}</p>
        <div style={{ marginTop: 24, display: "grid", gap: 10, padding: 18, borderRadius: 18, background: "rgba(255,255,255,.045)", border: "1px solid rgba(255,255,255,.08)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, color: "#dce5f2", fontSize: 14 }}><span>Текущая версия</span><strong>{APP_VERSION}</strong></div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, color: "#dce5f2", fontSize: 14 }}><span>{isVersionUpdate ? "Новая версия" : "Актуальные файлы"}</span><strong>{isVersionUpdate ? manifest?.version : manifest?.build}</strong></div>
        </div>
        {manifest?.changes?.length ? <ul style={{ margin: "20px 0 0", paddingLeft: 22, color: "#a8b3c5", lineHeight: 1.65 }}>{manifest.changes.map((change) => <li key={change}>{change}</li>)}</ul> : null}
        {error ? <div style={{ marginTop: 18, color: "#ff9b9b", fontSize: 13 }}>Не удалось проверить обновление: {error}</div> : null}
        <button type="button" disabled={starting} onClick={() => { setStarting(true); startInstaller(kind); }} style={{ width: "100%", minHeight: 58, marginTop: 28, border: 0, borderRadius: 16, cursor: starting ? "wait" : "pointer", color: "white", fontSize: 15, fontWeight: 900, background: "linear-gradient(135deg,#20d3c2,#8067f5)", boxShadow: "0 16px 40px rgba(71,137,220,.28)", opacity: starting ? 0.72 : 1 }}>{starting ? "Запускаем обновление…" : "Обновить сейчас"}</button>
        <div style={{ marginTop: 14, color: "#728097", fontSize: 12, lineHeight: 1.5, textAlign: "center" }}>Обновление заменит файлы приложения. Пользовательские данные сохраняются.</div>
      </div>
    </div>
  );
}
