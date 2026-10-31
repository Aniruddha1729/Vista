import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useLocation } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { authenticatedFetch } from '../auth/authenticatedFetch'
import './VeeAssistant.css'

type Message = { from: 'vee' | 'you'; text: string; eventId?: string }

export default function VeeAssistant() {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const { accessToken } = useAuth()
  const location = useLocation()
  const [messages, setMessages] = useState<Message[]>([
    { from: 'vee', text: 'Hi, I’m Vee. Ask me how to find, create, or join a Vista event.' },
  ])
  const assistantRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function closeOnOutsidePointer(event: PointerEvent) {
      if (event.target instanceof Node && !assistantRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer)
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer)
  }, [open])

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const text = draft.trim()
    if (!text) return
    setMessages((current) => [...current, { from: 'you', text }])
    setDraft('')
    setBusy(true)
    try {
      const history = messages.slice(-10).map((message) => ({ role: message.from === 'vee' ? 'assistant' : 'user', content: message.text.slice(0, 1200) }))
      const response = await authenticatedFetch('/api/auth/vee', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) }, body: JSON.stringify({ message: text, page: location.pathname, history }) })
      const result = await response.json() as { reply?: string; message?: string; eventDraft?: { id: string; title: string } | null }
      setMessages((current) => [...current, { from: 'vee', text: response.ok ? result.reply || 'I could not prepare an answer. Try again.' : result.message || 'Please sign in to chat with Vee.', eventId: result.eventDraft?.id }])
    } catch {
      setMessages((current) => [...current, { from: 'vee', text: 'I could not connect just now. Please try again.' }])
    } finally { setBusy(false) }
  }

  return (
    <div className="vee-assistant" ref={assistantRef}>
      {open && <section className="vee-chat" aria-label="Vee chat">
        <header className="vee-chat-header"><span className="vee-avatar">V</span><div><strong>Vee AI</strong><small>Vista event helper</small></div><button type="button" aria-label="Close Vee chat" onClick={() => setOpen(false)}>×</button></header>
        <div className="vee-messages" aria-live="polite">{messages.map((message, index) => <div className={`vee-message ${message.from}`} key={`${index}-${message.from}`}><p>{message.text}</p>{message.eventId && <Link className="vee-review-draft" to={`/host-event?id=${encodeURIComponent(message.eventId)}`} onClick={() => setOpen(false)}>Review draft ↗</Link>}</div>)}</div>
        <form className="vee-chat-form" onSubmit={(event) => void sendMessage(event)}><input aria-label="Message Vee" maxLength={2000} placeholder="Ask Vee something…" value={draft} onChange={(event) => setDraft(event.target.value)} /><button disabled={busy} type="submit" aria-label="Send message">{busy ? '…' : '↑'}</button></form>
        <p className="vee-chat-note">Vee can make mistakes. Don’t share payment or sign-in secrets.</p>
      </section>}
      <button className="vee-launcher" type="button" aria-expanded={open} aria-label={open ? 'Close Vee AI chat' : 'Open Vee AI chat'} onClick={() => setOpen((value) => !value)}><span className="vee-launcher-mark">V</span><span>Ask Vee</span></button>
    </div>
  )
}
