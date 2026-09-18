import { useEffect, useState } from "react";

const APP_VERSION = "1.3.4";

type UpdaterEvent = {
  event: string;
  currentVersion?: string;
  targetVersion?: string;
  releaseName?: string;
  releaseNotes?: string;
  message?: string;
  percent?: number;
  available?: boolean;
};

function openProtocol(protocol: "check-updates" | "start-update") {
  window.open(`sxron://${protocol}`, "_self");
}

export default function ForcedUpdater() {
  const [visible, setVisible] = useState(false);
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<UpdaterEvent | null>(null);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [installedVersion, setInstalledVersion] = useState(APP_VERSION);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<UpdaterEvent>).detail;
      if (!detail) return;

      if (detail.event === "app-version" && detail.version) {
        setInstalledVersion(detail.version);
      }

      if (detail.event === "checking") {
        setChecking(true);
        setError("");
        setMessage("Проверяем наличие новой версии…");
      }

      if (detail.event === "up-to-date") {
        setChecking(false);
        setAvailable(null);
        setProgress(0);
        setMessage("");
        setError("");
        setVisible(false);
      }

      if (detail.event === "update-required") {
        setChecking(false);
        setAvailable(detail);
        setProgress(0);
        setMessage("");
        setError("");
        setVisible(true);
      }

      if (detail.event === "download-start") {
        setChecking(false);
        setVisible(true);
        setProgress(0);
        setMessage(`Скачиваем версию ${detail.targetVersion || ""}…`);
        setError("");
      }

      if (detail.event === "download-progress") {
        setProgress(Math.max(0, Math.min(100, Number(detail.percent) || 0)));
      }

      if (detail.event === "update-ready") {
        setProgress(100);
        setMessage(`Версия ${detail.targetVersion || "новая версия"} загружена и проверена. Перезапускаем SXRON…`);
      }

      if (detail.event === "update-error") {
        setChecking(false);
        setError(detail.message || "Не удалось выполнить обновление.");
        setMessage("");
        setVisible(true);
      }
    };

    window.addEventListener("sxron-updater", handler);
    return () => window.removeEventListener("sxron-updater", handler);
  }, []);

  if (!visible) return null;

  const isDownloading = progress > 0 || message.includes("Скачиваем") || message.includes("загружена");

  return (
    <section
      aria-label="Обновление SXRON Marketplace"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 999999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 36,
        background: "#07090f",
        color: "#f8fafc",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <div style={{ width: "min(760px,100%)", padding: 42, borderRadius: 30, border: "1px solid rgba(255,255,255,.09)", background: "linear-gradient(145deg,#111827,#0b1019)", boxShadow: "0 30px 100px rgba(0,0,0,.48)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: 15, display: "grid", placeItems: "center", fontWeight: 950, fontSize: 22, color: "#fff", background: "linear-gradient(135deg,#22b8ff,#a855f7)" }}>S</div>
          <div>
            <div style={{ color: "#22b8ff", fontSize: 11, fontWeight: 900, letterSpacing: ".14em" }}>SXRON MARKETPLACE</div>
            <div style={{ marginTop: 3, color: "#748198", fontSize: 12 }}>Новое обновление приложения</div>
          </div>
        </div>

        {error ? (
          <>
            <h1 style={{ margin: "28px 0 10px", fontSize: 32 }}>Не удалось обновить</h1>
            <p style={{ margin: 0, color: "#a8b3c5", lineHeight: 1.65 }}>{error}</p>
            <button type="button" onClick={() => { setChecking(true); setError(""); setMessage("Проверяем наличие новой версии…"); openProtocol("check-updates"); }} style={{ marginTop: 26, minHeight: 52, padding: "0 22px", border: 0, borderRadius: 14, color: "#fff", fontWeight: 900, background: "linear-gradient(135deg,#22b8ff,#a855f7)", cursor: checking ? "wait" : "pointer" }}>
              {checking ? "Проверяем…" : "Повторить проверку"}
            </button>
          </>
        ) : (
          <>
            <div style={{ marginTop: 30, color: "#7d8aa2", fontSize: 12, fontWeight: 800, letterSpacing: ".08em" }}>УСТАНОВЛЕНА · {installedVersion}</div>
            <h1 style={{ margin: "10px 0 14px", fontSize: 34 }}>Доступна новая версия</h1>
            <p style={{ margin: 0, color: "#a8b3c5", lineHeight: 1.65 }}>Каждое обновление SXRON выпускается отдельной версией. Текущая версия останется закрытой, пока новая версия не установится.</p>

            {available ? (
              <div style={{ marginTop: 24, padding: 20, borderRadius: 18, background: "rgba(34, 184, 255,.06)", border: "1px solid rgba(34, 184, 255,.16)" }}>
                <div style={{ fontSize: 19, fontWeight: 900 }}>{available.releaseName || `SXRON Marketplace v${available.targetVersion || "новая"}`}</div>
                <div style={{ marginTop: 7, color: "#738097", fontSize: 13 }}>Новая версия: {available.targetVersion || "новая"}</div>
                {available.releaseNotes ? <div style={{ marginTop: 14, color: "#a8b3c5", lineHeight: 1.55, fontSize: 13, whiteSpace: "pre-wrap" }}>{available.releaseNotes}</div> : null}
              </div>
            ) : null}

            {message ? <div style={{ marginTop: 18, color: "#a8b3c5", lineHeight: 1.55 }}>{message}</div> : null}

            {progress > 0 && progress < 100 ? (
              <div style={{ marginTop: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, color: "#7d8aa2", fontSize: 12 }}><span>Загрузка</span><span>{Math.round(progress)}%</span></div>
                <div style={{ height: 8, borderRadius: 99, overflow: "hidden", background: "rgba(255,255,255,.07)" }}><div style={{ width: `${progress}%`, height: "100%", background: "linear-gradient(90deg,#22b8ff,#a855f7)", transition: "width .2s" }} /></div>
              </div>
            ) : null}

            {!isDownloading && available ? (
              <div style={{ display: "flex", gap: 10, marginTop: 28 }}>
                <button type="button" disabled={checking} onClick={() => { setMessage(`Запускаем загрузку версии ${available.targetVersion || "новой"}…`); openProtocol("start-update"); }} style={{ flex: 1, minHeight: 54, border: 0, borderRadius: 14, color: "#fff", fontWeight: 900, background: "linear-gradient(135deg,#22b8ff,#a855f7)", cursor: "pointer" }}>
                  Обновить до {available.targetVersion || "новой версии"}
                </button>
              </div>
            ) : null}
          </>
        )}

        <div style={{ marginTop: 20, color: "#66738a", fontSize: 12, lineHeight: 1.55 }}>Пользовательские данные находятся отдельно от файлов приложения и сохраняются при обновлении.</div>
      </div>
    </section>
  );
}
