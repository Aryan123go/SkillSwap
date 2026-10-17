import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { apiRequest } from './api.js'
import { useAuth } from './useAuth.js'
import { ArrowIcon, Header } from './components.jsx'

const pageSize = 50
const minimumDuration = 15 * 60_000
const maximumDuration = 4 * 60 * 60_000
const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'your local timezone'

function AppLayout({ children }) {
  return <main className="app-shell"><Header /><div className="app-content">{children}</div><footer className="app-footer">SkillSwap · Learn something. Teach something.</footer></main>
}

function formatLocalTime(value) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZoneName: 'short',
  }).format(new Date(value))
}

function toLocalInput(value) {
  const date = new Date(value)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

function newSchedule() {
  const start = new Date(Date.now() + 60 * 60_000)
  const end = new Date(start.getTime() + 60 * 60_000)
  return { startAt: toLocalInput(start), endAt: toLocalInput(end) }
}

function participantId(participant) {
  return participant?._id ?? participant
}

function SessionCard({ session, userId }) {
  const organizerId = participantId(session.organizer)?.toString()
  const otherParticipant = session.participants.find((participant) => participantId(participant)?.toString() !== userId)
  return <article className="session-card">
    <div className="session-card-heading">
      <div><span className="section-kicker">{organizerId === userId ? 'YOU PROPOSED' : 'SESSION WITH'}</span><h2><Link to={`/sessions/${session._id}`}>{session.title}</Link></h2></div>
      <span className={`request-status status-${session.status.toLowerCase()}`}>{session.status.toLowerCase()}</span>
    </div>
    <p className="session-partner">{otherParticipant
      ? <Link to={`/profile/${participantId(otherParticipant)}`}>{otherParticipant.name}</Link>
      : 'Exchange participant'}</p>
    <p className="session-time"><strong>{formatLocalTime(session.startAt)}</strong> – {formatLocalTime(session.endAt)}</p>
    {session.description && <p className="session-description">{session.description}</p>}
    <Link className="secondary-button" to={`/sessions/${session._id}`}>View session</Link>
  </article>
}

function AcceptedRequestOption({ request, userId }) {
  const senderId = participantId(request.sender)?.toString()
  const other = senderId === userId ? request.recipient : request.sender
  return <option value={request._id}>
    {other?.name ?? 'Student'} · {request.requestedSkill?.name ?? 'Skill exchange'}
  </option>
}

export function SessionsPage() {
  const { user } = useAuth()
  const [minimumStart] = useState(() => toLocalInput(Date.now()))
  const [upcoming, setUpcoming] = useState([])
  const [past, setPast] = useState([])
  const [acceptedRequests, setAcceptedRequests] = useState([])
  const [acceptedPagination, setAcceptedPagination] = useState({ page: 1, pages: 0 })
  const [loadingMoreRequests, setLoadingMoreRequests] = useState(false)
  const [schedule, setSchedule] = useState(() => newSchedule())
  const [selectedRequest, setSelectedRequest] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let active = true
    Promise.all([
      apiRequest(`/sessions?period=upcoming&page=1&limit=${pageSize}`),
      apiRequest(`/sessions?period=past&page=1&limit=${pageSize}`),
      apiRequest(`/exchange-requests/accepted?page=1&limit=${pageSize}`),
    ])
      .then(([upcomingData, pastData, requestData]) => {
        if (!active) return
        setUpcoming(upcomingData.sessions)
        setPast(pastData.sessions)
        setAcceptedRequests(requestData.requests)
        setAcceptedPagination(requestData.pagination)
      })
      .catch((requestError) => { if (active) setError(requestError.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [refreshKey])

  const refresh = useCallback(() => {
    setLoading(true)
    setError('')
    setSelectedRequest('')
    setRefreshKey((value) => value + 1)
  }, [])

  async function loadMoreAcceptedRequests() {
    setLoadingMoreRequests(true)
    setError('')
    try {
      const data = await apiRequest(`/exchange-requests/accepted?page=${acceptedPagination.page + 1}&limit=${pageSize}`)
      setAcceptedRequests((current) => [...current, ...data.requests])
      setAcceptedPagination(data.pagination)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoadingMoreRequests(false)
    }
  }

  async function proposeSession(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    const exchangeRequest = selectedRequest || acceptedRequests[0]?._id
    const startAt = new Date(schedule.startAt)
    const endAt = new Date(schedule.endAt)
    if (!exchangeRequest) {
      setError('Choose an accepted exchange request first.')
      setBusy(false)
      return
    }
    if (!Number.isFinite(startAt.getTime()) || !Number.isFinite(endAt.getTime()) || startAt <= new Date()) {
      setError('Choose a valid session start time in the future.')
      setBusy(false)
      return
    }
    if (endAt - startAt < minimumDuration || endAt - startAt > maximumDuration) {
      setError('Sessions must last between 15 minutes and 4 hours.')
      setBusy(false)
      return
    }
    try {
      await apiRequest('/sessions', {
        method: 'POST',
        body: JSON.stringify({
          exchangeRequest,
          title,
          description,
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
        }),
      })
      setNotice('Session proposed. The other participant can confirm or decline it.')
      setTitle('')
      setDescription('')
      setSchedule(newSchedule())
      refresh()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  const hasAcceptedRequests = acceptedRequests.length > 0
  return <AppLayout>
    <div className="page-heading session-page-heading">
      <div><span className="section-kicker">PLAN YOUR SKILL EXCHANGE</span><h1>Your sessions</h1><p>Accepted requests do not create a session automatically. Session times are shown in {timeZone}.</p></div>
      <button className="secondary-button" onClick={refresh} disabled={loading}>Refresh</button>
    </div>
    {notice && <output className="success-message" role="status">{notice}</output>}
    {error && <section className="empty-panel error-panel" role="alert"><p>{error}</p><button className="secondary-button" onClick={refresh}>Try again</button></section>}
    {loading && <output className="empty-panel"><span className="spinner" /> Loading your sessions…</output>}
    {!loading && !error && <div className="session-page-grid">
      <section className="content-card session-proposal">
        <div className="card-heading"><div><span className="section-kicker">START SCHEDULING</span><h2>Propose a session</h2></div></div>
        {!hasAcceptedRequests
          ? <p className="subtle-text">You need an accepted exchange request before you can propose a session.</p>
          : <form className="form-stack" onSubmit={proposeSession}>
            <label className="form-field"><span>Accepted exchange request</span>
              <select value={selectedRequest || acceptedRequests[0]._id} onChange={(event) => setSelectedRequest(event.target.value)}>
                {acceptedRequests.map((request) => <AcceptedRequestOption key={request._id} request={request} userId={user.id} />)}
              </select>
            </label>
            {acceptedPagination.page < acceptedPagination.pages && <button type="button" className="secondary-button" disabled={loadingMoreRequests} onClick={loadMoreAcceptedRequests}>{loadingMoreRequests ? 'Loading…' : 'Load more accepted exchanges'}</button>}
            <label className="form-field"><span>Session title or skill</span><input required minLength="2" maxLength="120" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="For example, React fundamentals" /></label>
            <label className="form-field"><span>Notes (optional)</span><textarea rows="3" maxLength="500" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What would you like to cover?" /></label>
            <label className="form-field"><span>Starts ({timeZone})</span><input type="datetime-local" required min={minimumStart} value={schedule.startAt} onChange={(event) => setSchedule((current) => ({ ...current, startAt: event.target.value }))} /></label>
            <label className="form-field"><span>Ends ({timeZone})</span><input type="datetime-local" required value={schedule.endAt} onChange={(event) => setSchedule((current) => ({ ...current, endAt: event.target.value }))} /></label>
            <p className="form-hint">Choose a duration between 15 minutes and 4 hours. Availability is not verified.</p>
            <button className="primary-button" disabled={busy}>{busy ? 'Proposing…' : 'Propose session'} <ArrowIcon /></button>
          </form>}
      </section>
      <div className="session-groups">
        <section className="session-group"><div className="card-heading"><div><span className="section-kicker">SCHEDULED OR AWAITING RESPONSE</span><h2>Upcoming sessions</h2></div></div>
          {upcoming.length
            ? <div className="session-list">{upcoming.map((session) => <SessionCard key={session._id} session={session} userId={user.id} />)}</div>
            : <p className="empty-panel">No upcoming or proposed sessions yet.</p>}
        </section>
        <section className="session-group"><div className="card-heading"><div><span className="section-kicker">SESSION HISTORY</span><h2>Past sessions</h2></div></div>
          {past.length
            ? <div className="session-list">{past.map((session) => <SessionCard key={session._id} session={session} userId={user.id} />)}</div>
            : <p className="empty-panel">Past and cancelled sessions will appear here.</p>}
        </section>
      </div>
    </div>}
  </AppLayout>
}

function SessionActions({ session, userId, onUpdated }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [rescheduling, setRescheduling] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [schedule, setSchedule] = useState(() => ({
    startAt: toLocalInput(session.startAt),
    endAt: toLocalInput(session.endAt),
  }))
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(timer)
  }, [])
  const organizerId = participantId(session.organizer)?.toString()
  const isOrganizer = organizerId === userId
  const canConfirm = session.status === 'PROPOSED' && !isOrganizer && new Date(session.startAt).getTime() > now
  const canDecline = session.status === 'PROPOSED' && !isOrganizer
  const canSchedule = ['PROPOSED', 'CONFIRMED'].includes(session.status)
  const canComplete = session.status === 'CONFIRMED' && new Date(session.endAt).getTime() <= now

  async function act(action, body) {
    if (action === 'cancel' && !window.confirm('Cancel this session for both participants?')) return
    setBusy(true)
    setError('')
    try {
      await apiRequest(`/sessions/${session._id}/${action}`, {
        method: 'PATCH',
        ...(body ? { body: JSON.stringify(body) } : {}),
      })
      setRescheduling(false)
      onUpdated()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  async function submitReschedule(event) {
    event.preventDefault()
    const startAt = new Date(schedule.startAt)
    const endAt = new Date(schedule.endAt)
    if (!Number.isFinite(startAt.getTime()) || !Number.isFinite(endAt.getTime()) || startAt <= new Date()) {
      setError('Choose a valid session start time in the future.')
      return
    }
    if (endAt - startAt < minimumDuration || endAt - startAt > maximumDuration) {
      setError('Sessions must last between 15 minutes and 4 hours.')
      return
    }
    await act('reschedule', { startAt: startAt.toISOString(), endAt: endAt.toISOString() })
  }

  return <section className="content-card session-action-card">
    <div className="card-heading"><div><span className="section-kicker">SESSION WORKFLOW</span><h2>Available actions</h2></div></div>
    {error && <p className="form-alert" role="alert">{error}</p>}
    <div className="session-actions">
      {canConfirm && <button className="primary-button" disabled={busy} onClick={() => act('confirm')}>{busy ? 'Saving…' : 'Confirm session'}</button>}
      {canDecline && <button className="secondary-button" disabled={busy} onClick={() => act('decline')}>Decline</button>}
      {canSchedule && <>
        <button className="secondary-button" disabled={busy} onClick={() => setRescheduling((value) => !value)}>{rescheduling ? 'Close reschedule' : 'Reschedule'}</button>
        <button className="secondary-button" disabled={busy} onClick={() => act('cancel')}>Cancel session</button>
      </>}
      {canComplete && <button className="primary-button" disabled={busy} onClick={() => act('complete')}>Mark completed</button>}
      {!canDecline && !canSchedule && !canComplete && <p className="subtle-text">No further actions are available for this session.</p>}
    </div>
    {rescheduling && canSchedule && <form className="session-reschedule form-stack" onSubmit={submitReschedule}>
      <p className="form-hint">A reschedule returns the session to proposed status and requires the other participant to confirm again. Times use {timeZone}.</p>
      <label className="form-field"><span>New start time</span><input type="datetime-local" required min={toLocalInput(now)} value={schedule.startAt} onChange={(event) => setSchedule((current) => ({ ...current, startAt: event.target.value }))} /></label>
      <label className="form-field"><span>New end time</span><input type="datetime-local" required value={schedule.endAt} onChange={(event) => setSchedule((current) => ({ ...current, endAt: event.target.value }))} /></label>
      <button className="primary-button" disabled={busy}>{busy ? 'Saving…' : 'Propose new time'}</button>
    </form>}
  </section>
}

export function SessionDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [loadedSessionId, setLoadedSessionId] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let active = true
    apiRequest(`/sessions/${id}`)
      .then((data) => {
        if (!active) return
        setSession(data.session)
        setError('')
        setLoadedSessionId(id)
      })
      .catch((requestError) => {
        if (!active) return
        setError(requestError.message)
        setLoadedSessionId(id)
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [id, refreshKey])

  const participants = useMemo(() => session?.participants ?? [], [session])
  const request = session?.exchangeRequest
  const requestOwner = participantId(request?.sender)?.toString() === user.id ? 'sent' : 'received'
  const isLoading = loading || loadedSessionId !== id
  return <AppLayout>
    <div className="page-heading"><div><span className="section-kicker">SESSION DETAILS</span><h1>{session?.title ?? 'Session'}</h1><p>Times are displayed in {timeZone}.</p></div><Link className="secondary-button" to="/sessions">All sessions</Link></div>
    {isLoading && <output className="empty-panel"><span className="spinner" /> Loading session…</output>}
    {!isLoading && error && <section className="empty-panel error-panel" role="alert"><p>{error}</p><Link className="secondary-button" to="/sessions">Back to sessions</Link></section>}
    {!isLoading && !error && session && <>
      <section className="content-card session-detail-card">
        <div className="session-card-heading"><div><span className="section-kicker">CURRENT STATUS</span><h2>{session.title}</h2></div><span className={`request-status status-${session.status.toLowerCase()}`}>{session.status.toLowerCase()}</span></div>
        <p className="session-time"><strong>{formatLocalTime(session.startAt)}</strong> – {formatLocalTime(session.endAt)}</p>
        <p className="form-hint">Start and end times are converted to the viewer's local timezone ({timeZone}).</p>
        {session.description && <p className="session-description">{session.description}</p>}
        <div className="session-participants"><span className="section-kicker">PARTICIPANTS</span><div>{participants.map((participant) => <Link key={participantId(participant)} to={`/profile/${participantId(participant)}`}>{participant.name}</Link>)}</div></div>
        {request && <div className="session-related-request"><span className="section-kicker">RELATED EXCHANGE REQUEST</span><p>{request.requestedSkill?.name ? `Learning ${request.requestedSkill.name}` : 'Accepted skill exchange'}{request.offeredSkill?.name ? ` · offering ${request.offeredSkill.name}` : ''}</p><Link className="secondary-button" to={`/requests/${requestOwner}`}>View exchange requests</Link></div>}
      </section>
      <SessionActions session={session} userId={user.id} onUpdated={() => {
        setLoading(true)
        setRefreshKey((value) => value + 1)
      }} />
    </>}
  </AppLayout>
}
