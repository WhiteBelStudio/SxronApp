import { useRef, useState } from "react";

import type { ProfileCustomization } from "../types";

interface ProfileCustomizerProps {
  value: ProfileCustomization;
  telegramName: string;
  onChange: (value: ProfileCustomization) => void;
  onClose: () => void;
}

const AVATARS = ["✦", "S", "⚡", "◈", "✧", "●", "◆", "∞"];
const ACCENTS: Array<{ id: ProfileCustomization["accent"]; label: string }> = [
  { id: "cyan", label: "Бирюза" },
  { id: "violet", label: "Фиолетовый" },
  { id: "blue", label: "Синий" },
  { id: "sunset", label: "Закат" },
];

function isImageAvatar(value: string) {
  return value.startsWith("data:image/");
}

function resizeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Не удалось прочитать изображение"));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("Не удалось обработать изображение"));
      image.onload = () => {
        const size = 512;
        const scale = Math.min(size / image.width, size / image.height, 1);
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("Canvas недоступен"));
          return;
        }
        context.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.84));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export default function ProfileCustomizer({
  value,
  telegramName,
  onChange,
  onClose,
}: ProfileCustomizerProps) {
  const [draft, setDraft] = useState(value);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const update = (patch: Partial<ProfileCustomization>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setError("");
  };

  const handleAvatarUpload = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Выбери изображение в формате JPG, PNG или WebP.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("Файл слишком большой. Максимальный размер — 8 МБ.");
      return;
    }

    setUploading(true);
    setError("");
    try {
      const avatar = await resizeImage(file);
      update({ avatar });
    } catch {
      setError("Не удалось установить это изображение. Попробуй другое фото.");
    } finally {
      setUploading(false);
    }
  };

  const save = () => {
    onChange(draft);
    onClose();
  };

  return (
    <div className="profile-customizer-backdrop" onClick={onClose}>
      <section
        className="profile-customizer"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Настройка профиля"
      >
        <div className="profile-customizer__header">
          <div>
            <span className="profile-customizer__eyebrow">SXRON PROFILE</span>
            <h2>Настрой свой профиль</h2>
            <p>Изменения сохраняются на этом устройстве.</p>
          </div>
          <button type="button" className="profile-customizer__close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>

        <div className="profile-customizer__preview">
          <div className="profile-customizer__preview-avatar" data-accent={draft.accent}>
            {isImageAvatar(draft.avatar) ? <img src={draft.avatar} alt="Аватар профиля" /> : draft.avatar}
          </div>
          <div>
            <strong>{draft.displayName || telegramName}</strong>
            <span>{draft.usernameVisible ? "Telegram-профиль" : "Имя пользователя скрыто"}</span>
            {draft.bio && <p>{draft.bio}</p>}
          </div>
        </div>

        <label className="profile-customizer__field">
          <span>Отображаемое имя</span>
          <input
            value={draft.displayName}
            onChange={(event) => update({ displayName: event.target.value.slice(0, 32) })}
            placeholder={telegramName}
            maxLength={32}
          />
        </label>

        <label className="profile-customizer__field">
          <span>О себе</span>
          <textarea
            value={draft.bio}
            onChange={(event) => update({ bio: event.target.value.slice(0, 160) })}
            placeholder="Расскажи немного о себе..."
            rows={3}
            maxLength={160}
          />
          <small>{draft.bio.length}/160</small>
        </label>

        <div className="profile-customizer__group">
          <span className="profile-customizer__label">Аватар профиля</span>
          <div className="profile-customizer__avatar-upload">
            <button
              type="button"
              className="profile-customizer__upload-button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <span className="profile-customizer__upload-icon">{uploading ? "…" : "↑"}</span>
              <span>
                <strong>{uploading ? "Обрабатываем фото…" : "Загрузить фото"}</strong>
                <small>JPG, PNG или WebP · до 8 МБ</small>
              </span>
            </button>
            <input
              ref={fileInputRef}
              className="profile-customizer__file-input"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => {
                void handleAvatarUpload(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
            {isImageAvatar(draft.avatar) && (
              <button type="button" className="profile-customizer__remove-avatar" onClick={() => update({ avatar: "✦" })}>
                Удалить фото
              </button>
            )}
          </div>
          <div className="profile-customizer__avatars">
            {AVATARS.map((avatar) => (
              <button
                key={avatar}
                type="button"
                className={draft.avatar === avatar ? "is-active" : ""}
                onClick={() => update({ avatar })}
              >
                {avatar}
              </button>
            ))}
          </div>
          {error && <p className="profile-customizer__error">{error}</p>}
        </div>

        <div className="profile-customizer__group">
          <span className="profile-customizer__label">Акцент профиля</span>
          <div className="profile-customizer__accents">
            {ACCENTS.map((accent) => (
              <button
                key={accent.id}
                type="button"
                data-accent={accent.id}
                className={draft.accent === accent.id ? "is-active" : ""}
                onClick={() => update({ accent: accent.id })}
              >
                <i />
                {accent.label}
              </button>
            ))}
          </div>
        </div>

        <label className="profile-customizer__switch">
          <span>
            <strong>Показывать username</strong>
            <small>Другие пользователи увидят @username</small>
          </span>
          <input type="checkbox" checked={draft.usernameVisible} onChange={(event) => update({ usernameVisible: event.target.checked })} />
          <i />
        </label>

        <label className="profile-customizer__switch">
          <span>
            <strong>Показывать бейджи</strong>
            <small>Статусы и достижения в профиле</small>
          </span>
          <input type="checkbox" checked={draft.badgesVisible} onChange={(event) => update({ badgesVisible: event.target.checked })} />
          <i />
        </label>

        <div className="profile-customizer__actions">
          <button type="button" className="profile-customizer__cancel" onClick={onClose}>Отмена</button>
          <button type="button" className="profile-customizer__save" onClick={save}>Сохранить изменения</button>
        </div>
      </section>
    </div>
  );
}
