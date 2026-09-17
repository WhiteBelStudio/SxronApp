import { useEffect, useState } from "react";
import type { CSSProperties, FormEvent, ReactNode } from "react";
import {
  clearAuthToken,
  getAuthMe,
  getAuthToken,
  loginWithPassword,
  resetOwnerPassword,
  resendAuthCode,
  setAuthToken,
  startOwnerLogin,
  startOwnerRecovery,
  startRegistration,
  verifyOwnerRecovery,
  verifyRegistration,
} from "../api/api";

type Mode = "register" | "login" | "recovery";
type RegisterMethod = "email" | "phone";
type Step =
  | "identifier"
  | "code"
  | "phone"
  | "phone_code"
  | "recovery_email"
  | "recovery_code"
  | "recovery_password";

const panelStyle: CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
  background:
    "radial-gradient(circle at top left, rgba(104,75,255,.28), transparent 42%), radial-gradient(circle at bottom right, rgba(0,220,210,.22), transparent 40%), #080a12",
  color: "#fff",
  fontFamily: "Inter, system-ui, sans-serif",
};

const cardStyle: CSSProperties = {
  width: "100%",
  maxWidth: 460,
  borderRadius: 28,
  padding: 30,
  background: "rgba(20,23,36,.92)",
  border: "1px solid rgba(255,255,255,.1)",
  boxShadow: "0 24px 80px rgba(0,0,0,.45)",
  backdropFilter: "blur(18px)",
};

const inputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,.12)",
  background: "rgba(255,255,255,.06)",
  color: "#fff",
  padding: "14px 16px",
  fontSize: 16,
  outline: "none",
};

const primaryStyle: CSSProperties = {
  width: "100%",
  border: 0,
  borderRadius: 14,
  padding: "14px 16px",
  fontSize: 16,
  fontWeight: 700,
  color: "#fff",
  cursor: "pointer",
  background: "linear-gradient(135deg,#19d8d0,#7a4dff)",
};

const secondaryLinkStyle: CSSProperties = {
  width: "100%",
  marginTop: 12,
  border: 0,
  background: "transparent",
  color: "rgba(255,255,255,.64)",
  cursor: "pointer",
  padding: 10,
  fontSize: 14,
};

export default function AuthGate({ children }: { children: ReactNode }) {
  const [checking, setChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [mode, setMode] = useState<Mode>("register");
  const [method, setMethod] = useState<RegisterMethod>("email");
  const [step, setStep] = useState<Step>("identifier");
  const [identifier, setIdentifier] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [code, setCode] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [destination, setDestination] = useState("");
  const [recoveryToken, setRecoveryToken] = useState("");
  const [debugCode, setDebugCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;

    async function check() {
      try {
        const token = getAuthToken();
        if (token) {
          try {
            await getAuthMe();
            if (active) {
              setAuthenticated(true);
              setChecking(false);
            }
            return;
          } catch {
            clearAuthToken();
          }
        }

        try {
          const owner = await startOwnerLogin();
          if (owner.authenticated && owner.session_token) {
            setAuthToken(owner.session_token);
            if (active) setAuthenticated(true);
            return;
          }
        } catch {
          // Обычный вход.
        }
      } finally {
        if (active) setChecking(false);
      }
    }

    void check();
    return () => {
      active = false;
    };
  }, []);

  function resetAuth(nextMode: Mode) {
    setMode(nextMode);
    setMethod("email");
    setStep(nextMode === "recovery" ? "recovery_email" : "identifier");
    setIdentifier("");
    setPhone("");
    setPassword("");
    setConfirmPassword("");
    setCode("");
    setChallengeId("");
    setDestination("");
    setRecoveryToken("");
    setDebugCode("");
    setError("");
  }

  function backToLogin() {
    resetAuth("login");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);

    try {
      if (step === "identifier") {
        if (mode === "login") {
          const result = await loginWithPassword(identifier, password, remember);
          if (!result.session_token) throw new Error("Сервер не вернул сессию");
          setAuthToken(result.session_token);
          setAuthenticated(true);
          return;
        }

        if (password !== confirmPassword) {
          throw new Error("Пароли не совпадают");
        }

        const result = await startRegistration(method, identifier, password);
        setChallengeId(result.challenge_id);
        setDestination(result.destination);
        setDebugCode(result.debug_code || "");
        setStep("code");
        return;
      }

      if (step === "code") {
        const result = await verifyRegistration(challengeId, code);
        if (result.authenticated && result.session_token) {
          setAuthToken(result.session_token);
          setAuthenticated(true);
          return;
        }
        if (result.next === "phone") {
          setStep("phone");
          return;
        }
        if (result.challenge_id && result.next === "verify_phone") {
          setChallengeId(result.challenge_id);
          setDestination(result.destination || phone);
          setDebugCode(result.debug_code || "");
          setStep("phone_code");
          return;
        }
        throw new Error("Не удалось продолжить регистрацию");
      }

      if (step === "phone") {
        const result = await startRegistration("phone", phone);
        setChallengeId(result.challenge_id);
        setDestination(result.destination);
        setDebugCode(result.debug_code || "");
        setStep("phone_code");
        return;
      }

      if (step === "phone_code") {
        const result = await verifyRegistration(challengeId, code);
        if (!result.authenticated || !result.session_token) {
          throw new Error("Телефон ещё не подтверждён");
        }
        setAuthToken(result.session_token);
        setAuthenticated(true);
        return;
      }

      if (step === "recovery_email") {
        const result = await startOwnerRecovery(identifier);
        if (!result.challenge_id) {
          throw new Error(result.message);
        }
        setChallengeId(result.challenge_id);
        setDestination(result.destination || identifier.trim());
        setDebugCode(result.debug_code || "");
        setStep("recovery_code");
        return;
      }

      if (step === "recovery_code") {
        const result = await verifyOwnerRecovery(challengeId, code);
        setRecoveryToken(result.reset_token);
        setPassword("");
        setConfirmPassword("");
        setStep("recovery_password");
        return;
      }

      if (step === "recovery_password") {
        if (password !== confirmPassword) {
          throw new Error("Пароли не совпадают");
        }
        const result = await resetOwnerPassword(recoveryToken, password);
        if (!result.session_token) throw new Error("Сервер не вернул новую сессию");
        setAuthToken(result.session_token);
        setAuthenticated(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось выполнить операцию");
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (!challengeId || busy) return;
    setError("");
    setBusy(true);
    try {
      const result = await resendAuthCode(challengeId);
      setChallengeId(result.challenge_id);
      setDestination(result.destination);
      setDebugCode(result.debug_code || "");
      setCode("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отправить код");
    } finally {
      setBusy(false);
    }
  }

  if (checking) {
    return <div style={panelStyle}><div>Проверяем владельца и сессию…</div></div>;
  }

  if (authenticated) return <>{children}</>;

  const isRecovery = mode === "recovery";
  const title =
    step === "recovery_password"
      ? "Новый пароль владельца"
      : step === "recovery_code"
        ? "Код восстановления"
        : step === "recovery_email"
          ? "Восстановление владельца"
          : step === "code" || step === "phone_code"
            ? "Введите код"
            : step === "phone"
              ? "Подтвердим телефон"
              : mode === "login"
                ? "С возвращением"
                : "Создать аккаунт";

  const description =
    step === "recovery_email"
      ? "Укажите подтверждённый email владельца. Код восстановления отправляется только на этот адрес."
      : step === "recovery_code"
        ? `Код отправлен: ${destination}`
        : step === "recovery_password"
          ? "После смены пароля все старые сессии владельца будут завершены."
          : step === "identifier" && mode === "register"
            ? "Создайте аккаунт по email или телефону. Пароль хранится только в виде защищённого хэша."
            : step === "identifier" && mode === "login"
              ? "Введите подтверждённый email или номер телефона и пароль."
              : step === "code"
                ? `Код отправлен: ${destination}`
                : step === "phone"
                  ? "После подтверждения email номер телефона нужно подтвердить по SMS."
                  : `SMS-код отправлен на ${destination}`;

  return (
    <div style={panelStyle}>
      <div style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 22 }}>
          <div style={{ width: 48, height: 48, borderRadius: 15, display: "grid", placeItems: "center", fontWeight: 900, fontSize: 20, background: "linear-gradient(135deg,#19d8d0,#7a4dff)" }}>
            S
          </div>
          <div>
            <div style={{ fontSize: 21, fontWeight: 800 }}>SXRON Marketplace</div>
            <div style={{ opacity: .6, fontSize: 13 }}>Версия 1.1.20 · безопасный вход</div>
          </div>
        </div>

        {!isRecovery && (
          <div style={{ display: "flex", gap: 8, marginBottom: 22 }}>
            <button type="button" onClick={() => resetAuth("register")} style={{ ...primaryStyle, opacity: mode === "register" ? 1 : .45 }}>
              Регистрация
            </button>
            <button type="button" onClick={() => resetAuth("login")} style={{ ...primaryStyle, opacity: mode === "login" ? 1 : .45 }}>
              Вход
            </button>
          </div>
        )}

        <h1 style={{ margin: "0 0 8px", fontSize: 28 }}>{title}</h1>
        <p style={{ margin: "0 0 22px", color: "rgba(255,255,255,.62)", lineHeight: 1.5 }}>{description}</p>

        {step === "identifier" && mode === "register" && (
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <button type="button" onClick={() => setMethod("email")} style={{ ...primaryStyle, opacity: method === "email" ? 1 : .45 }}>
              📧 Email
            </button>
            <button type="button" onClick={() => setMethod("phone")} style={{ ...primaryStyle, opacity: method === "phone" ? 1 : .45 }}>
              📱 Телефон
            </button>
          </div>
        )}

        <form onSubmit={submit}>
          {step === "identifier" && (
            <>
              <input
                style={inputStyle}
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                placeholder={mode === "login" ? "Email или +79991234567" : method === "email" ? "you@example.com" : "+79991234567"}
                type={method === "email" && mode === "register" ? "email" : "text"}
                autoComplete={mode === "login" ? "username" : method === "email" ? "email" : "tel"}
                required
              />
              <input
                style={{ ...inputStyle, marginTop: 10 }}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Пароль · минимум 8 символов"
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                minLength={8}
                maxLength={128}
                required
              />
              {mode === "register" && (
                <input
                  style={{ ...inputStyle, marginTop: 10 }}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Повторите пароль"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={128}
                  required
                />
              )}
              {mode === "login" && (
                <>
                  <label style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 14, color: "rgba(255,255,255,.75)", fontSize: 14, cursor: "pointer" }}>
                    <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
                    Запомнить меня
                  </label>
                  <button type="button" onClick={() => resetAuth("recovery")} style={secondaryLinkStyle}>
                    Забыли пароль?
                  </button>
                </>
              )}
            </>
          )}

          {step === "recovery_email" && (
            <input
              style={inputStyle}
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder="neoneonhorizon@gmail.com"
              type="email"
              autoComplete="email"
              required
            />
          )}

          {step === "phone" && (
            <input
              style={inputStyle}
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="+79991234567"
              type="tel"
              autoComplete="tel"
              required
            />
          )}

          {(step === "code" || step === "phone_code" || step === "recovery_code") && (
            <input
              style={{ ...inputStyle, textAlign: "center", letterSpacing: 8, fontSize: 24 }}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
            />
          )}

          {step === "recovery_password" && (
            <>
              <input
                style={inputStyle}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Новый пароль · минимум 8 символов"
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                required
              />
              <input
                style={{ ...inputStyle, marginTop: 10 }}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Повторите новый пароль"
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                required
              />
            </>
          )}

          {error && (
            <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: "rgba(255,75,100,.12)", color: "#ff9aaa", fontSize: 14 }}>
              {error}
            </div>
          )}

          {debugCode && (
            <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: "rgba(25,216,208,.1)", color: "#79fff7", fontSize: 13 }}>
              DEV-код: <strong>{debugCode}</strong>
            </div>
          )}

          <button disabled={busy} type="submit" style={{ ...primaryStyle, marginTop: 16, opacity: busy ? .6 : 1 }}>
            {busy
              ? "Подождите…"
              : step === "identifier"
                ? mode === "login"
                  ? "Войти"
                  : "Получить код"
                : step === "recovery_email"
                  ? "Отправить код"
                  : step === "phone"
                    ? "Отправить SMS"
                    : step === "recovery_password"
                      ? "Сменить пароль"
                      : "Подтвердить"}
          </button>
        </form>

        {(step === "code" || step === "phone_code") && (
          <button type="button" onClick={resend} disabled={busy} style={secondaryLinkStyle}>
            Отправить код ещё раз
          </button>
        )}

        {isRecovery && step !== "recovery_password" && (
          <button type="button" onClick={backToLogin} style={secondaryLinkStyle}>
            Вернуться ко входу
          </button>
        )}

        {step === "recovery_password" && (
          <button type="button" onClick={backToLogin} style={secondaryLinkStyle}>
            Вернуться ко входу
          </button>
        )}
      </div>
    </div>
  );
}
