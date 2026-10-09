import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiRequest } from './api.js'
import { Header } from './components.jsx'

function AppLayout({ children }) {
  return <main className="app-shell"><Header /><div className="app-content">{children}</div><footer className="app-footer">SkillSwap · Learn something. Teach something.</footer></main>
}

function studentName(student) {
  return student?.name ?? 'Student'
}

function RequestCard({ request, direction, onAction }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const otherStudent = direction === 'received' ? request.sender : request.recipient
  const actionVerb = direction === 'received' ? 'accept' : 'cancel'

  async function update(action) {
    if (action === 'cancel' && !window.confirm('Cancel this pending exchange request?')) return
    setBusy(true)
    setError('')
    try {
      await apiRequest(`/exchange-requests/${request._id}/${action}`, { method: 'PATCH' })
      onAction()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  return <article className="request-card">
    <div className="request-card-head">
      <div><span className="section-kicker">{direction === 'received' ? 'FROM' : 'TO'}</span><h2><Link to={`/profile/${otherStudent?._id}`}>{studentName(otherStudent)}</Link></h2><p>{otherStudent?.college || 'College not provided'}</p></div>
      <span className={`request-status status-${request.status.toLowerCase()}`}>{request.status.toLowerCase()}</span>
    </div>
    <p className="request-skill-line"><strong>{studentName(request.sender)}</strong> wants to learn <strong>{request.requestedSkill?.name}</strong>{request.offeredSkill ? <> and offers <strong>{request.offeredSkill.name}</strong></> : ''}.</p>
    {request.message && <blockquote className="request-message">{request.message}</blockquote>}
    <p className="request-date">Sent {new Date(request.createdAt).toLocaleString()}</p>
    {error && <p className="form-alert" role="alert">{error}</p>}
    {request.status === 'PENDING' && <div className="request-actions">
      {direction === 'received' && <><button className="primary-button" disabled={busy} onClick={() => update('accept')}>{busy && actionVerb === 'accept' ? 'Saving…' : 'Accept'}</button><button className="secondary-button" disabled={busy} onClick={() => update('reject')}>Reject</button></>}
      {direction === 'sent' && <button className="secondary-button" disabled={busy} onClick={() => update('cancel')}>{busy ? 'Cancelling…' : 'Cancel request'}</button>}
    </div>}
  </article>
}

export function RequestsPage({ direction }) {
  const [requests, setRequests] = useState([])
  const [pagination, setPagination] = useState({ page: 1, pages: 0, total: 0 })
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [notice, setNotice] = useState('')
  const title = direction === 'received' ? 'Received requests' : 'Sent requests'
  useEffect(() => {
    const controller = new AbortController()
    let active = true
    apiRequest(`/exchange-requests/${direction}?page=${page}&limit=10`, { signal: controller.signal })
      .then((data) => {
        if (!active) return
        setRequests(data.requests)
        setPagination(data.pagination)
      })
      .catch((requestError) => { if (active) setError(requestError.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => {
      active = false
      controller.abort()
    }
  }, [direction, page, refreshKey])

  function refreshAfterAction() {
    setNotice('Request status updated.')
    setLoading(true)
    setError('')
    setRefreshKey((value) => value + 1)
  }

  return <AppLayout>
    <div className="page-heading"><div><span className="section-kicker">YOUR EXCHANGE ACTIVITY</span><h1>{title}</h1><p>Review request details and current statuses. Accepted requests do not schedule a session.</p></div><button className="secondary-button" onClick={() => { setLoading(true); setError(''); setRefreshKey((value) => value + 1) }}>Refresh</button></div>
    {notice && <output className="success-message">{notice}</output>}
    {error && <section className="empty-panel error-panel" role="alert"><p>{error}</p><button className="secondary-button" onClick={() => { setLoading(true); setError(''); setRefreshKey((value) => value + 1) }}>Try again</button></section>}
    {loading && <output className="empty-panel"><span className="spinner" /> Loading requests…</output>}
    {!loading && !error && requests.length === 0 && <section className="empty-panel"><h2>No {direction} requests yet</h2><p>{direction === 'sent' ? 'Explore student profiles and send an exchange request.' : 'Requests from other students will appear here.'}</p>{direction === 'sent' && <Link className="primary-button" to="/discover">Discover students</Link>}</section>}
    {!loading && !error && requests.length > 0 && <>
      <div className="request-list">{requests.map((request) => <RequestCard key={request._id} request={request} direction={direction} onAction={refreshAfterAction} />)}</div>
      {pagination.pages > 1 && <nav className="pagination" aria-label="Request pages"><button className="secondary-button" disabled={page <= 1} onClick={() => { setLoading(true); setPage((value) => value - 1) }}>Previous</button><span>Page {pagination.page} of {pagination.pages}</span><button className="secondary-button" disabled={page >= pagination.pages} onClick={() => { setLoading(true); setPage((value) => value + 1) }}>Next</button></nav>}
    </>}
  </AppLayout>
}
