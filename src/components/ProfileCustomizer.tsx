import { useState } from "react";

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

export default function ProfileCustomizer({
  value,
  telegramName,
  onChange,
  onClose,
}: ProfileCustomizerProps) {
  const [draft, setDraft] = useState(value);

  const update = (patch: Partial<ProfileCustomization>) => {
    setDraft((current) => ({ ...current, ...patch }));
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
          <button type="button" className="profile-customizer__close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="profile-customizer__preview">
          <div className="profile-customizer__preview-avatar" data-accent={draft.accent}>
            {draft.avatar}
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
          <p className="profile-customizer__hint">
            Фото Telegram остаётся главным, если оно доступно. Этот вариант используется как запасной аватар.
          </p>
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
          <input
            type="checkbox"
            checked={draft.usernameVisible}
            onChange={(event) => update({ usernameVisible: event.target.checked })}
          />
          <i />
        </label>

        <label className="profile-customizer__switch">
          <span>
            <strong>Показывать бейджи</strong>
            <small>Статусы и достижения в профиле</small>
          </span>
          <input
            type="checkbox"
            checked={draft.badgesVisible}
            onChange={(event) => update({ badgesVisible: event.target.checked })}
          />
          <i />
        </label>

        <div className="profile-customizer__actions">
          <button type="button" className="profile-customizer__cancel" onClick={onClose}>
            Отмена
          </button>
          <button type="button" className="profile-customizer__save" onClick={save}>
            Сохранить изменения
          </button>
        </div>
      </section>
    </div>
  );
}
