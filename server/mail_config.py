from __future__ import annotations

import json
import os
import smtplib
from email.message import EmailMessage
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field


PROVIDERS: dict[str, dict[str, Any]] = {
    "gmail": {
        "name": "Gmail / Google Workspace",
        "domains": ("gmail.com", "googlemail.com"),
        "host": "smtp.gmail.com",
        "port": 587,
        "security": "starttls",
    },
    "yandex": {
        "name": "Яндекс Почта",
        "domains": ("yandex.ru", "ya.ru", "yandex.com"),
        "host": "smtp.yandex.ru",
        "port": 587,
        "security": "starttls",
    },
    "mailru": {
        "name": "Mail.ru / VK Почта",
        "domains": ("mail.ru", "inbox.ru", "list.ru", "bk.ru"),
        "host": "smtp.mail.ru",
        "port": 465,
        "security": "ssl",
    },
    "outlook": {
        "name": "Outlook / Hotmail / Microsoft 365",
        "domains": ("outlook.com", "hotmail.com", "live.com", "msn.com"),
        "host": "smtp.office365.com",
        "port": 587,
        "security": "starttls",
    },
    "yahoo": {
        "name": "Yahoo Mail",
        "domains": ("yahoo.com", "yahoo.co.uk", "ymail.com"),
        "host": "smtp.mail.yahoo.com",
        "port": 587,
        "security": "starttls",
    },
    "proton": {
        "name": "Proton Mail (SMTP Bridge)",
        "domains": ("proton.me", "protonmail.com", "pm.me"),
        "host": "127.0.0.1",
        "port": 1025,
        "security": "starttls",
    },
    "custom": {
        "name": "Свой SMTP / корпоративная почта",
        "domains": (),
        "host": "",
        "port": 587,
        "security": "starttls",
    },
}


class MailConfig(BaseModel):
    provider: str = Field(default="custom", min_length=1, max_length=32)
    host: str = Field(default="", max_length=255)
    port: int = Field(default=587, ge=1, le=65535)
    username: str = Field(default="", max_length=320)
    password: str = Field(default="", max_length=1000)
    sender: str = Field(default="", max_length=320)
    security: str = Field(default="starttls", pattern="^(none|starttls|ssl)$")


DATA_DIR = Path(os.getenv("SXRON_DATA_DIR", Path(__file__).resolve().parent / "data"))
CONFIG_PATH = DATA_DIR / "smtp.json"


def _provider_for_email(email: str) -> str:
    domain = email.rsplit("@", 1)[-1].lower().strip() if "@" in email else ""
    for key, preset in PROVIDERS.items():
        if domain in preset.get("domains", ()):
            return key
    return "custom"


def _preset(provider: str) -> dict[str, Any]:
    return dict(PROVIDERS.get(provider, PROVIDERS["custom"]))


def _load_file() -> dict[str, Any]:
    try:
        if CONFIG_PATH.exists():
            value = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
            return value if isinstance(value, dict) else {}
    except Exception:
        pass
    return {}


def _save_file(config: MailConfig) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    temp = CONFIG_PATH.with_suffix(".tmp")
    payload = config.model_dump()
    temp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    temp.replace(CONFIG_PATH)


def load_mail_config() -> MailConfig | None:
    file_config = _load_file()
    env_host = os.getenv("SXRON_SMTP_HOST", os.getenv("SMTP_HOST", "")).strip()
    env_user = os.getenv("SXRON_SMTP_USERNAME", os.getenv("SMTP_USERNAME", "")).strip()
    env_password = os.getenv("SXRON_SMTP_PASSWORD", os.getenv("SMTP_PASSWORD", ""))
    env_sender = os.getenv("SXRON_SMTP_FROM", os.getenv("SMTP_FROM", env_user)).strip()
    env_port = os.getenv("SXRON_SMTP_PORT", os.getenv("SMTP_PORT", "587"))
    env_security = os.getenv("SXRON_SMTP_SECURITY", "").strip().lower()

    provider = str(file_config.get("provider") or os.getenv("SXRON_SMTP_PROVIDER", "")).strip().lower()
    if not provider and env_sender:
        provider = _provider_for_email(env_sender)
    if not provider:
        provider = "custom"

    preset = _preset(provider)
    host = str(file_config.get("host") or env_host or preset.get("host", "")).strip()
    port_value = file_config.get("port") or env_port or preset.get("port", 587)
    try:
        port = int(port_value)
    except (TypeError, ValueError):
        port = int(preset.get("port", 587))
    username = str(file_config.get("username") or env_user).strip()
    password = str(file_config.get("password") or env_password)
    sender = str(file_config.get("sender") or env_sender or username).strip()
    security = str(file_config.get("security") or env_security or preset.get("security", "starttls")).lower()

    if not host or not sender:
        return None

    return MailConfig(
        provider=provider,
        host=host,
        port=port,
        username=username,
        password=password,
        sender=sender,
        security=security if security in {"none", "starttls", "ssl"} else "starttls",
    )


def apply_mail_config() -> MailConfig | None:
    config = load_mail_config()
    if not config:
        return None
    os.environ["SMTP_HOST"] = config.host
    os.environ["SMTP_PORT"] = str(config.port)
    os.environ["SMTP_USERNAME"] = config.username
    os.environ["SMTP_PASSWORD"] = config.password
    os.environ["SMTP_FROM"] = config.sender
    os.environ["SMTP_USE_TLS"] = "true" if config.security == "starttls" else "false"
    os.environ["SXRON_EMAIL_MODE"] = "smtp"
    return config


def public_config(config: MailConfig | None) -> dict[str, Any]:
    if not config:
        return {"configured": False, "providers": providers()}
    return {
        "configured": True,
        "provider": config.provider,
        "provider_name": PROVIDERS.get(config.provider, PROVIDERS["custom"]).get("name", config.provider),
        "host": config.host,
        "port": config.port,
        "username": config.username,
        "sender": config.sender,
        "security": config.security,
        "password_configured": bool(config.password),
        "providers": providers(),
    }


def providers() -> list[dict[str, Any]]:
    return [
        {
            "id": key,
            "name": value["name"],
            "host": value["host"],
            "port": value["port"],
            "security": value["security"],
        }
        for key, value in PROVIDERS.items()
    ]


def send_test(config: MailConfig, destination: str) -> None:
    message = EmailMessage()
    message["Subject"] = "Тестовое письмо SXRON Marketplace"
    message["From"] = config.sender
    message["To"] = destination
    message.set_content("SMTP-подключение SXRON Marketplace работает корректно.")
    try:
        if config.security == "ssl":
            with smtplib.SMTP_SSL(config.host, config.port, timeout=20) as smtp:
                if config.username:
                    smtp.login(config.username, config.password)
                smtp.send_message(message)
            return
        with smtplib.SMTP(config.host, config.port, timeout=20) as smtp:
            if config.security == "starttls":
                smtp.starttls()
            if config.username:
                smtp.login(config.username, config.password)
            smtp.send_message(message)
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Не удалось подключиться к SMTP-серверу или отправить тестовое письмо") from exc


class MailTestRequest(BaseModel):
    destination: str = Field(min_length=3, max_length=320)


class MailSaveRequest(MailConfig):
    pass


def register_mail_config(app: FastAPI) -> None:
    apply_mail_config()

    @app.get("/admin/mail/providers")
    def mail_providers() -> dict[str, Any]:
        return {"providers": providers()}

    @app.get("/admin/mail/config")
    def mail_config() -> dict[str, Any]:
        return public_config(load_mail_config())

    @app.post("/admin/mail/config")
    def save_mail_config(data: MailSaveRequest) -> dict[str, Any]:
        provider = data.provider.lower().strip()
        if provider not in PROVIDERS:
            raise HTTPException(status_code=400, detail="Неизвестный почтовый провайдер")
        if not data.host.strip() or not data.sender.strip():
            raise HTTPException(status_code=400, detail="SMTP-сервер и адрес отправителя обязательны")
        config = MailConfig(**data.model_dump(provider=provider))
        _save_file(config)
        apply_mail_config()
        return public_config(config)

    @app.post("/admin/mail/test")
    def test_mail(data: MailTestRequest) -> dict[str, Any]:
        config = load_mail_config()
        if not config or not config.host or not config.sender:
            raise HTTPException(status_code=503, detail="Почтовый сервер не настроен")
        send_test(config, data.destination.strip())
        return {"ok": True, "message": "Тестовое письмо отправлено"}
