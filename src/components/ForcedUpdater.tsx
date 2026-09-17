import { useEffect, useState } from "react";

const APP_VERSION = "1.1.12";

type UpdaterEvent = {
  event: string;
  currentVersion?: string;
  currentBuild?: string;
  targetVersion?: string;
  targetBuild?: string;
  releaseName?: string;
  releaseNotes?: string;
  message?: string;
  percent?: number;
};

function openProtocol(protocol: "check-updates" | "start-update") {
  window.open(`sxron://${protocol}`, "_self");
}

export default function ForcedUpdater() {
  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<UpdaterEvent | null>(null);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<UpdaterEvent>).detail;
      if (!detail) return;

      if (detail.event === "checking") {
        setChecking(true);
        setMessage("Проверяем GitHub на наличие новой сборки…");
      }
      if (detail.event === "up-to-date") {
        setChecking(false);
        setAvailable(null);
        setMessage("У вас установлена последняя доступная сборка.");
        setOpen(true);
      }
      if (detail.event === "update-required") {
        setChecking(false);
        setAvailable(detail);
        setMessage("");
        setOpen(true);
      }
      if (detail.event === "download-start") {
        setChecking(false);
        setOpen(true);
        setProgress(0);
        setMessage("Скачиваем новую сборку из GitHub…");
      }
      if (detail.event === "download-progress") {
        setProgress(Math.max(0, Math.min(100, Number(detail.percent) || 0)));
      }
      if (detail.event === "update-ready") {
        setProgress(100);
        setMessage("Установщик проверен. Перезапускаем приложение для обновления…");
      }
      if (detail.event === "update-error") {
        setChecking(false);
        setMessage(detail.message || "Не удалось проверить или установить обновление.");
        setOpen(true);
      }
    };

    window.addEventListener("sxron-updater", handler);
    return () => window.removeEventListener("sxron-updater", handler);
  }, []);

  const check = () => {
    setOpen(true);
    setChecking(true);
    setAvailable(null);
    setMessage("Проверяем GitHub на наличие новой сборки…");
    openProtocol("check-updates");
  };

  return (
    <>
      <button
        type="button"
        onClick={check}
        style={{
          position: "fixed",
          right: 20,
          bottom: 20,
          zIndex: 999990,
          border: "1px solid rgba(255,255,255,.14)",
          borderRadius: 14,
          padding: "11px 16px",
          color: "#fff",
          background: "linear-gradient(135deg,#20d3c2,#8067f5)",
          boxShadow: "0 12px 34px rgba(0,0,0,.3)",
          cursor: "pointer",
          fontWeight: 800,
        }}
      >
        🔄 Обновления
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 999999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            background: "rgba(5,8,15,.86)",
            backdropFilter: "blur(20px)",
            color: "#f8fafc",
            fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          }}
        >
          <div style={{ width: "min(620px,100%)", border: "1px solid rgba(255,255,255,.13)", borderRadius: 28, padding: 34, background: "linear-gradient(145deg,rgba(18,24,35,.98),rgba(10,14,23,.98))", boxShadow: "0 35px 120px rgba(0,0,0,.55)" }}>
            <div style={{ color: "#20d3c2", fontSize: 12, fontWeight: 900, letterSpacing: ".12em" }}>SXRON UPDATE CENTER</div>
            <h2 style={{ margin: "10px 0 12px", fontSize: 32 }}>Центр обновлений</h2>
            <p style={{ color: "#a8b3c5", lineHeight: 1.6, margin: 0 }}>
              Установлена версия <strong style={{ color: "#fff" }}>{APP_VERSION}</strong>. Проверка выполняется непосредственно по опубликованным GitHub-сборкам.
            </p>

            {available ? (
              <div style={{ marginTop: 22, padding: 18, borderRadius: 18, background: "rgba(32,211,194,.07)", border: "1px solid rgba(32,211,194,.22)" }}>
                <div style={{ fontSize: 20, fontWeight: 900 }}>Доступно обновление</div>
                <div style={{ marginTop: 8, color: "#a8b3c5" }}>{available.releaseName || `SXRON Marketplace ${APP_VERSION}`}</div>
                <div style={{ marginTop: 6, fontSize: 13, color: "#728097" }}>Новая сборка: {available.targetBuild || "новая"}</div>
                {available.releaseNotes ? <div style={{ marginTop: 14, whiteSpace: "pre-wrap", color: "#a8b3c5", fontSize: 13, lineHeight: 1.55 }}>{available.releaseNotes}</div> : null}
              </div>
            ) : null}

            {message ? <div style={{ marginTop: 18, color: "#a8b3c5", lineHeight: 1.55 }}>{message}</div> : null}
            {progress > 0 && progress < 100 ? <div style={{ marginTop: 18, height: 8, borderRadius: 99, overflow: "hidden", background: "rgba(255,255,255,.08)" }}><div style={{ width: `${progress}%`, height: "100%", background: "linear-gradient(90deg,#20d3c2,#8067f5)", transition: "width .2s" }} /></div> : null}

            <div style={{ display: "flex", gap: 10, marginTop: 26 }}>
              {available ? (
                <button type="button" disabled={checking} onClick={() => { setMessage("Запускаем загрузку и установку…"); openProtocol("start-update"); }} style={{ flex: 1, minHeight: 52, border: 0, borderRadius: 14, color: "#fff", fontWeight: 900, background: "linear-gradient(135deg,#20d3c2,#8067f5)", cursor: "pointer" }}>
                  Да, обновить
                </button>
              ) : (
                <button type="button" disabled={checking} onClick={check} style={{ flex: 1, minHeight: 52, border: 0, borderRadius: 14, color: "#fff", fontWeight: 900, background: "linear-gradient(135deg,#20d3c2,#8067f5)", cursor: checking ? "wait" : "pointer" }}>
                  {checking ? "Проверяем…" : "Проверить обновления"}
                </button>
              )}
              <button type="button" onClick={() => setOpen(false)} style={{ minHeight: 52, padding: "0 20px", border: "1px solid rgba(255,255,255,.12)", borderRadius: 14, color: "#c7d0df", background: "rgba(255,255,255,.05)", cursor: "pointer" }}>
                Позже
              </button>
            </div>

            <div style={{ marginTop: 14, color: "#728097", fontSize: 12, textAlign: "center", lineHeight: 1.5 }}>
              Обновление устанавливается из GitHub. Пользовательские данные хранятся отдельно и не удаляются.
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
