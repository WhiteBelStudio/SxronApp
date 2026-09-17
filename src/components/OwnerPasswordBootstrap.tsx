import { useEffect, useState } from "react";

import { getAuthMe, getAuthToken, setAuthToken } from "../api/api";

type BootstrapResult = {
  initialized?: boolean;
  email?: string;
  password?: string;
  session_token?: string;
  message?: string;
};

function apiBase(): string {
  return typeof window !== "undefined" && window.location.protocol === "file:"
    ? "http://127.0.0.1:8000"
    : "/api";
}

export default function OwnerPasswordBootstrap() {
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      const token = getAuthToken();
      if (!token) return;

      try {
        const me = await getAuthMe();
        if (!me.is_owner) return;

        const response = await fetch(`${apiBase()}/auth/owner/bootstrap`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        });
        if (!response.ok) return;

        const result = (await response.json()) as BootstrapResult;
        if (!result.initialized || !result.password || !active) return;

        if (result.session_token) setAuthToken(result.session_token);
        setEmail(result.email || me.user.email || "neoneonhorizon@gmail.com");
        setPassword(result.password);
      } catch {
        // Bootstrap must never block marketplace startup.
      }
    }

    void bootstrap();
    return () => {
      active = false;
    };
  }, []);

  if (!password) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "rgba(2,5,12,.78)",
        backdropFilter: "blur(12px)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 500,
          borderRadius: 24,
          padding: 28,
          background: "#131725",
          border: "1px solid rgba(255,255,255,.1)",
          boxShadow: "0 30px 100px rgba(0,0,0,.5)",
          color: "#fff",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        <div style={{ fontSize: 13, opacity: 0.62, marginBottom: 8 }}>SXRON Marketplace 1.2.0</div>
        <h2 style={{ margin: "0 0 10px", fontSize: 28 }}>Новый пароль владельца</h2>
        <p style={{ margin: "0 0 18px", color: "rgba(255,255,255,.65)", lineHeight: 1.5 }}>
          Пароль для аккаунта <strong>{email}</strong> установлен один раз. Сохраните его сейчас: SXRON больше не покажет его после закрытия этого окна.
        </p>
        <div
          style={{
            padding: "16px 18px",
            borderRadius: 14,
            background: "rgba(25,216,208,.1)",
            border: "1px solid rgba(25,216,208,.24)",
            fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace",
            fontSize: 18,
            letterSpacing: 0.6,
            wordBreak: "break-all",
          }}
        >
          {password}
        </div>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(password);
            } catch {
              // Clipboard access can be unavailable in some Electron environments.
            }
            setPassword("");
          }}
          style={{
            width: "100%",
            marginTop: 16,
            border: 0,
            borderRadius: 14,
            padding: "14px 16px",
            fontWeight: 800,
            fontSize: 15,
            color: "#fff",
            background: "linear-gradient(135deg,#19d8d0,#7a4dff)",
            cursor: "pointer",
          }}
        >
          Скопировать и закрыть
        </button>
      </div>
    </div>
  );
}
