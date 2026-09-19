import { useEffect, useRef, useState } from "react";
import { createConversation, getConversations, getMessages, getMe, sendMessage, uploadMedia } from "../api/api";
import type { ChatMessage, Conversation } from "../types";

export default function MessagesPage({ onNotify }: { onNotify?: (message: string) => void }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [active, setActive] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [myId, setMyId] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  async function loadConversations() {
    setLoading(true);
    try {
      const data = await getConversations();
      setConversations(data.conversations);
      setActive(current => current && data.conversations.some(item => item.id === current) ? current : (data.conversations[0]?.id ?? null));
    } catch (e) { onNotify?.(e instanceof Error ? e.message : "Не удалось загрузить сообщения"); }
    finally { setLoading(false); }
  }
  async function loadMessages(id: number) {
    try { setMessages((await getMessages(id)).messages); } catch (e) { onNotify?.(e instanceof Error ? e.message : "Не удалось открыть диалог"); }
  }
  useEffect(() => { void loadConversations(); getMe().then(result => setMyId(result.user.id)).catch(() => undefined); }, []);
  useEffect(() => { if (active) void loadMessages(active); else setMessages([]); }, [active]);
  useEffect(() => { if (!active) return; const timer = window.setInterval(() => { void loadMessages(active); }, 3500); return () => window.clearInterval(timer); }, [active]);
  async function submit() {
    if (!active || !draft.trim() || sending) return;
    setSending(true);
    try { await sendMessage(active, draft.trim()); setDraft(""); await loadMessages(active); await loadConversations(); }
    catch (e) { onNotify?.(e instanceof Error ? e.message : "Сообщение не отправлено"); }
    finally { setSending(false); }
  }
  async function attach(file: File) {
    if (!active) return;
    setSending(true);
    try { const media = await uploadMedia(file, "chat"); await sendMessage(active, "", media.id); await loadMessages(active); await loadConversations(); }
    catch (e) { onNotify?.(e instanceof Error ? e.message : "Файл не отправлен"); }
    finally { setSending(false); }
  }
  return <section className="sxron-page marketplace-core-page marketplace-core-chat-page">
    <div className="sxron-page-head"><div><span>СООБЩЕНИЯ</span><h1>Диалоги</h1><p>Связь с продавцами и покупателями</p></div><button className="sxron-secondary" onClick={() => void loadConversations()}>↻ Обновить</button></div>
    <div className="marketplace-core-chat">
      <aside className="marketplace-core-chat__list">
        {loading && <div className="marketplace-core-muted">Загрузка…</div>}
        {!loading && !conversations.length && <div className="marketplace-core-muted">Диалогов пока нет.</div>}
        {conversations.map(item => <button key={item.id} className={active === item.id ? "is-active" : ""} onClick={() => setActive(item.id)}><strong>{item.other_user_name || "Пользователь"}</strong><span>{item.last_text || "Файл или новое сообщение"}</span><small>{new Date(item.last_message_at).toLocaleString("ru-RU")}</small></button>)}
      </aside>
      <div className="marketplace-core-chat__room">
        {!active ? <div className="marketplace-core-chat__placeholder"><strong>✉</strong><span>Выберите диалог</span></div> : <>
          <div className="marketplace-core-chat__messages">{messages.map(message => <div key={message.id} className={message.sender_id === myId ? "outgoing" : "incoming"}>
            <div>
              {message.text && <p className="marketplace-core-chat__text">{message.text}</p>}
              {message.media && (
                message.media.content_type.startsWith("image/")
                  ? <a href={message.media.url} target="_blank" rel="noreferrer" className="marketplace-core-chat__attachment">
                      <img src={message.media.url} alt={message.media.name} />
                      <span>{message.media.name}</span>
                    </a>
                  : <a href={message.media.url} target="_blank" rel="noreferrer" className="marketplace-core-chat__file">📎 {message.media.name} · {(message.media.size_bytes / 1024 / 1024).toFixed(1)} МБ</a>
              )}
            </div>
            <small>{new Date(message.created_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</small>
          </div>)}</div>
          <div className="marketplace-core-chat__composer"><input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void submit(); } }} placeholder="Написать сообщение…" /><input ref={fileRef} type="file" hidden onChange={e => { const file = e.target.files?.[0]; if (file) void attach(file); e.currentTarget.value = ""; }} /><button className="sxron-secondary" onClick={() => fileRef.current?.click()}>📎</button><button className="sxron-primary" disabled={sending || !draft.trim()} onClick={() => void submit()}>Отправить</button></div>
        </>}
      </div>
    </div>
  </section>;
}

export async function openSellerChat(sellerId: number, productId?: number, text = "") {
  return createConversation({ seller_id: sellerId, ...(productId ? { product_id: productId } : {}), text });
}