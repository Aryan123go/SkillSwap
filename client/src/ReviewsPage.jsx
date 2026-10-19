import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiRequest } from './api.js'
import { Header } from './components.jsx'

function AppLayout({ children }) {
  return <main className="app-shell"><Header /><div className="app-content review-page-content">{children}</div><footer className="app-footer">SkillSwap · Learn something. Teach something.</footer></main>
}

function formatDate(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleDateString([], { dateStyle: 'medium' })
}

export function ReviewsPage() {
  const [sessions, setSessions] = useState([])
  const [ratings, setRatings] = useState({})
  const [comments, setComments] = useState({})
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let active = true
    apiRequest('/reviews/eligible')
      .then((data) => {
        if (active) {
          setSessions(Array.isArray(data.sessions) ? data.sessions : [])
          setError('')
        }
      })
      .catch((requestError) => { if (active) setError(requestError.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [refreshKey])

  function refresh() {
    setLoading(true)
    setError('')
    setRefreshKey((current) => current + 1)
  }

  async function submitReview(event, session) {
    event.preventDefault()
    setError('')
    setSuccess('')
    setBusyId(session._id)
    try {
      await apiRequest('/reviews', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: session._id,
          rating: Number(ratings[session._id] ?? 5),
          comment: comments[session._id] ?? '',
        }),
      })
      setSessions((current) => current.filter((item) => item._id !== session._id))
      setSuccess(`Your review for ${session.partner?.name ?? 'your exchange partner'} has been submitted.`)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusyId('')
    }
  }

  return <AppLayout>
    <div className="page-heading"><div><span className="section-kicker">CELEBRATE GOOD COLLABORATION</span><h1>Reviews & reputation</h1><p>After a completed exchange, share helpful feedback and build trust in the community.</p></div></div>
    {error && <section className="empty-panel error-panel review-alert" role="alert"><p>{error}</p><button className="secondary-button" onClick={refresh}>Try again</button></section>}
    {success && <p className="inline-banner review-success" role="status">{success} You can see it on their profile.</p>}
    {loading ? <div className="empty-panel">Finding completed sessions you can review…</div> : error ? null : sessions.length === 0 ? <section className="empty-panel review-empty"><span className="completion-icon">✳</span><h2>You're all caught up</h2><p>When you complete a SkillSwap session, you'll be able to leave your partner a review here.</p><Link className="primary-button" to="/sessions">View sessions</Link></section> : <div className="review-session-list">{sessions.map((session) => <article className="content-card review-session-card" key={session._id}>
      <div className="review-session-heading"><div><span className="section-kicker">COMPLETED SESSION · {formatDate(session.endAt)}</span><h2>{session.title}</h2><p>Review your exchange with <strong>{session.partner?.name ?? 'your partner'}</strong></p></div>{session.partner?._id && <Link className="secondary-button" to={`/profile/${session.partner._id}`}>View profile</Link>}</div>
      <form className="review-form" onSubmit={(event) => submitReview(event, session)}>
        <fieldset className="rating-field"><legend>Your rating</legend><div className="rating-options">{[1, 2, 3, 4, 5].map((rating) => <button key={rating} type="button" className={`rating-choice${Number(ratings[session._id] ?? 5) === rating ? ' selected' : ''}`} onClick={() => setRatings((current) => ({ ...current, [session._id]: rating }))} aria-pressed={Number(ratings[session._id] ?? 5) === rating}>{rating} <span aria-hidden="true">★</span></button>)}</div><small>1 = Needs improvement · 5 = Excellent</small></fieldset>
        <label className="review-comment-field"><span>Written feedback <small>(optional)</small></span><textarea value={comments[session._id] ?? ''} onChange={(event) => setComments((current) => ({ ...current, [session._id]: event.target.value }))} maxLength={500} rows={3} placeholder="What went well? Share constructive, respectful feedback." /></label>
        <div className="review-form-footer"><small>{(comments[session._id] ?? '').length}/500 characters</small><button className="primary-button" disabled={busyId === session._id}>{busyId === session._id ? 'Submitting…' : 'Submit review'}</button></div>
      </form>
    </article>)}</div>}
  </AppLayout>
}
