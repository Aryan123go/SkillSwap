import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { io } from 'socket.io-client'
import { apiRequest } from './api.js'
import { useAuth } from './useAuth.js'
import { ArrowIcon, Header } from './components.jsx'

const apiOrigin = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')
const socketOrigin = apiOrigin || window.location.origin

function AppLayout({ children }) {
  return <main className="app-shell"><Header /><div className="app-content chat-page-content">{children}</div><footer className="app-footer">SkillSwap · Learn something. Teach something.</footer></main>
}

function partnerFor(conversation, currentUserId) {
  return (conversation.participants ?? []).find((participant) => String(participant._id) !== String(currentUserId))
}

function initials(name = '?') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
}

function formatTime(value) {
  if (!value) return 'No messages yet'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
}

function MessageBubble({ message, own }) {
  return <article className={`chat-message${own ? ' chat-message-own' : ''}`}>
    {!own && <span className="chat-message-avatar">{initials(message.sender?.name)}</span>}
    <div className="chat-message-content">
      {!own && <small>{message.sender?.name ?? 'Student'}</small>}
      <p>{message.content}</p>
      <time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
    </div>
  </article>
}

export function MessagesPage() {
  const { user } = useAuth()
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshToken, setRefreshToken] = useState(0)

  useEffect(() => {
    let active = true
    apiRequest('/conversations')
      .then(({ conversations: items }) => { if (active) { setConversations(items); setError('') } })
      .catch((requestError) => { if (active) setError(requestError.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [refreshToken])

  useEffect(() => {
    const socket = io(socketOrigin, { withCredentials: true })
    socket.on('user:message', () => {
      setLoading(true)
      setRefreshToken((value) => value + 1)
    })
    return () => socket.disconnect()
  }, [])

  return <AppLayout>
    <div className="page-heading"><div><span className="section-kicker">LEARN TOGETHER</span><h1>Your messages</h1><p>Private conversations for accepted skill exchanges.</p></div><button className="secondary-button" onClick={() => { setError(''); setLoading(true); setRefreshToken((value) => value + 1) }}>Refresh</button></div>
    {error && <div className="form-alert" role="alert">{error}</div>}
    {loading ? <div className="empty-panel">Loading conversations…</div> : conversations.length ? <section className="conversation-list">
      {conversations.map((conversation) => {
        const partner = partnerFor(conversation, user.id)
        return <Link className="conversation-row" to={`/messages/${conversation._id}`} key={conversation._id}>
          <span className="conversation-avatar">{initials(partner?.name)}</span>
          <span className="conversation-summary"><strong>{partner?.name ?? 'SkillSwap student'}</strong><span>{conversation.lastMessageSender && String(conversation.lastMessageSender._id ?? conversation.lastMessageSender) === String(user.id) ? 'You: ' : ''}{conversation.lastMessageText || 'Start the conversation'}</span><small>{conversation.exchangeRequest?.requestedSkill?.name ? `Exchange: ${conversation.exchangeRequest.requestedSkill.name}` : 'Accepted exchange'}</small></span>
          <time>{formatTime(conversation.lastMessageAt)}</time>{Number(conversation.unreadCount) > 0 && <span className="conversation-unread-badge" aria-label={`${conversation.unreadCount} unread messages`}>{conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}</span>}<ArrowIcon />
        </Link>
      })}
    </section> : <div className="empty-panel">No chats yet. Chat becomes available when a student accepts your exchange request. <p><Link to="/requests/received">View exchange requests</Link></p></div>}
  </AppLayout>
}

export function ConversationPage() {
  const { conversationId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [conversation, setConversation] = useState(null)
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadedConversationId, setLoadedConversationId] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [connection, setConnection] = useState('connecting')
  const socketRef = useRef(null)
  const bottomRef = useRef(null)

  const addMessage = useCallback((message) => {
    if (!message?._id) return
    setMessages((current) => current.some((item) => String(item._id) === String(message._id))
      ? current
      : [...current, message].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)))
  }, [])

  useEffect(() => {
    let active = true
    Promise.all([
      apiRequest(`/conversations/${conversationId}`),
      apiRequest(`/conversations/${conversationId}/messages?limit=50&page=1`),
    ]).then(([conversationData, messageData]) => {
      if (!active) return
      setConversation(conversationData.conversation)
      setMessages(messageData.messages)
      setError('')
      setLoadedConversationId(conversationId)
      apiRequest(`/conversations/${conversationId}/read`, { method: 'PATCH' }).catch(() => {})
    }).catch((requestError) => {
      if (active) { setError(requestError.message); setConversation(null); setMessages([]); setLoadedConversationId(conversationId) }
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [conversationId])

  useEffect(() => {
    if (loading || loadedConversationId !== conversationId || !conversation) return undefined
    const socket = io(socketOrigin, { withCredentials: true })
    socketRef.current = socket
    socket.on('connect', () => {
      setConnection('connected')
      socket.emit('conversation:join', { conversationId }, (result) => {
        if (!result?.success) setError(result?.error?.message || 'Could not join this conversation.')
        else {
          // Fetch after joining to close the history/live-event race; IDs are deduplicated.
          apiRequest(`/conversations/${conversationId}/messages?limit=50&page=1`)
            .then(({ messages: latest }) => { latest.forEach(addMessage); return apiRequest(`/conversations/${conversationId}/read`, { method: 'PATCH' }) })
            .catch((requestError) => setError(requestError.message))
        }
      })
    })
    socket.on('disconnect', () => setConnection('reconnecting'))
    socket.on('connect_error', (connectError) => {
      setConnection('offline')
      setError(connectError.message || 'Chat connection failed. Refresh to try again.')
    })
    socket.on('message:new', ({ message }) => {
      addMessage(message)
      if (String(message.sender?._id) !== String(user.id)) {
        apiRequest(`/conversations/${conversationId}/read`, { method: 'PATCH' }).catch(() => {})
      }
    })
    return () => {
      socket.emit('conversation:leave', { conversationId })
      socket.disconnect()
      socketRef.current = null
    }
  }, [conversationId, conversation, loading, loadedConversationId, addMessage, user.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length])

  async function submit(event) {
    event.preventDefault()
    const content = draft.trim()
    if (!content || sending) return
    setError('')
    setSending(true)
    const clientMessageId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
    try {
      const socket = socketRef.current
      if (socket?.connected) {
        const result = await new Promise((resolve) => {
          socket.timeout(10000).emit('message:send', { conversationId, content, clientMessageId }, (timeoutError, response) => {
            if (timeoutError) resolve({ success: false, error: { message: 'Message send timed out. Check the conversation before retrying.' } })
            else resolve(response)
          })
        })
        if (!result?.success) throw new Error(result?.error?.message || 'Message could not be sent.')
        addMessage(result.message)
      } else {
        const { message } = await apiRequest(`/conversations/${conversationId}/messages`, {
          method: 'POST',
          body: JSON.stringify({ content, clientMessageId }),
        })
        addMessage(message)
      }
      setDraft('')
    } catch (sendError) {
      setError(sendError.message)
    } finally {
      setSending(false)
    }
  }

  const partner = conversation ? partnerFor(conversation, user.id) : null

  const isLoading = loading || loadedConversationId !== conversationId
  if (isLoading) return <AppLayout><div className="empty-panel">Loading conversation…</div></AppLayout>
  if (error && !conversation) return <AppLayout><div className="empty-panel error-panel" role="alert">{error}<button className="secondary-button" onClick={() => navigate('/messages')}>Back to messages</button></div></AppLayout>

  return <AppLayout>
    <div className="chat-room">
      <header className="chat-room-header">
        <Link className="secondary-button" to="/messages">← All messages</Link>
        <span className="conversation-avatar">{initials(partner?.name)}</span>
        <div><h1>{partner?.name ?? 'SkillSwap student'}</h1><p>{conversation?.exchangeRequest?.requestedSkill?.name ? `Skill exchange · ${conversation.exchangeRequest.requestedSkill.name}` : 'Accepted skill exchange'}</p></div>
        <span className={`chat-connection chat-connection-${connection}`}>{connection === 'connected' ? 'Live' : connection === 'reconnecting' ? 'Reconnecting…' : connection === 'connecting' ? 'Connecting…' : 'Offline'}</span>
      </header>
      <section className="chat-history" aria-label="Messages" aria-live="polite">
        {messages.length ? messages.map((message) => <MessageBubble key={message._id} message={message} own={String(message.sender?._id) === String(user.id)} />) : <div className="chat-empty"><span>✳</span><h2>Start with a hello.</h2><p>Share what you want to learn and find a time to connect.</p></div>}
        <div ref={bottomRef} />
      </section>
      {error && <p className="form-alert chat-alert" role="alert">{error}</p>}
      <form className="chat-composer" onSubmit={submit}>
        <label className="sr-only" htmlFor="chat-message">Write a message</label>
        <textarea id="chat-message" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={2000} rows={2} placeholder="Write a message…" />
        <div className="chat-composer-footer"><small>{draft.length}/2000 characters · Keep it kind and useful.</small><button className="primary-button" disabled={sending || !draft.trim()}>{sending ? 'Sending…' : 'Send message'} <ArrowIcon /></button></div>
      </form>
    </div>
  </AppLayout>
}
