import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiRequest } from './api.js'
import { useAuth } from './useAuth.js'
import { Header, SkillList } from './components.jsx'
import { capitalize, getEligibleOfferSkills, getSkillId } from './skillUtils.js'

const pageSize = 12

function getId(skill) {
  return typeof skill === 'string' ? skill : skill?._id
}

function AppLayout({ children }) {
  return <main className="app-shell"><Header /><div className="app-content">{children}</div><footer className="app-footer">SkillSwap · Learn something. Teach something.</footer></main>
}

function StudentCard({ student, user, onRequested }) {
  const choices = useMemo(() => student.skillsTheyCanTeachMe ?? [], [student.skillsTheyCanTeachMe])
  const eligibleOffers = useMemo(() => getEligibleOfferSkills(
    user.skillsToTeach ?? [],
    student.skillsToLearn ?? [],
    student.openToAnySkill === true,
  ), [user.skillsToTeach, student.skillsToLearn, student.openToAnySkill])
  const [requestedSkill, setRequestedSkill] = useState(() => getId(choices[0]?.skill) ?? '')
  const [offeredSkill, setOfferedSkill] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const selectedRequestedSkill = choices.some(({ skill }) => getId(skill) === requestedSkill)
    ? requestedSkill
    : getId(choices[0]?.skill) ?? ''
  const selectedOfferedSkill = eligibleOffers.some((entry) => getSkillId(entry.skill) === offeredSkill)
    ? offeredSkill
    : getSkillId(eligibleOffers[0]?.skill) ?? ''

  async function sendRequest(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setSuccess(false)
    try {
      await apiRequest('/exchange-requests', {
        method: 'POST',
        body: JSON.stringify({
          recipient: student.id,
          requestedSkill: selectedRequestedSkill,
          offeredSkill: selectedOfferedSkill,
          message,
        }),
      })
      setSuccess(true)
      onRequested()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  return <article className="student-card">
    <div className="student-card-head">
      {student.profileImage
        ? <img className="student-avatar" src={student.profileImage} alt="" />
        : <div className="student-avatar student-avatar-fallback" aria-hidden="true">{student.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</div>}
      <div><h2><Link className="student-name-link" to={`/profile/${student.id}`}>{student.name}</Link></h2><p>{student.college || 'College not provided'}</p></div>
      <span className="match-score">{student.matchScore}<small>match score</small></span>
    </div>
    <div className="student-reputation" aria-label="Student rating">
      <span className="student-rating-stars" aria-hidden="true">★</span>
      <strong>{student.reputation?.averageRating != null && Number(student.reputation.averageRating) > 0 ? Number(student.reputation.averageRating).toFixed(1) : 'New'}</strong>
      <span>{Number(student.reputation?.reviewCount) || 0} {(Number(student.reputation?.reviewCount) || 0) === 1 ? 'review' : 'reviews'}</span>
    </div>
    {student.openToAnySkill && <p className="open-any-badge">Open to any skill</p>}
    {student.bio && <p className="student-bio">{student.bio}</p>}
    {student.matchReasons.length > 0
      ? <ul className="match-reasons">{student.matchReasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
      : <p className="subtle-text">No complementary skill match yet. You can still view this profile.</p>}
    {student.scoreComponents && <p className="match-score-breakdown">
      Score points: skills {student.scoreComponents.skillMatchPoints.theyCanTeachMe + student.scoreComponents.skillMatchPoints.iCanTeachThem}/60
      {' · '}proficiency {student.scoreComponents.proficiencyBonus.theyCanTeachMe + student.scoreComponents.proficiencyBonus.iCanTeachThem}/20
      {' · '}mutual {student.scoreComponents.mutualExchangeBonus}/20
    </p>}
    <div className="student-skill-grid">
      <div><h3>Can teach</h3><SkillList entries={student.skillsToTeach} emptyText="No teaching skills listed." /></div>
      <div><h3>Wants to learn</h3>{student.openToAnySkill ? <p className="subtle-text">Open to any skill</p> : <SkillList entries={student.skillsToLearn} emptyText="No learning skills listed." />}</div>
    </div>
    <div className="student-card-actions"><Link className="secondary-button" to={`/profile/${student.id}`}>View profile</Link></div>
    {choices.length > 0 && <form className="request-compose" onSubmit={sendRequest}>
      <h3>Send an exchange request</h3>
      <div className="request-skill-summaries">
        <div><h4>Your teaching skills</h4><SkillList entries={user.skillsToTeach} emptyText="Add teaching skills to your profile before sending a request." /></div>
        <div><h4>Their learning requirements</h4>{student.openToAnySkill
          ? <p className="open-any-description">Open to any skill — choose from the skills you can teach.</p>
          : <SkillList entries={student.skillsToLearn} emptyText="This student has not listed specific learning requirements." />}</div>
      </div>
      <label className="form-field"><span>Skill you want to learn</span>
        <select value={selectedRequestedSkill} onChange={(event) => setRequestedSkill(event.target.value)} required>
          {choices.map(({ skill }) => <option value={getId(skill)} key={getId(skill)}>{skill.name}</option>)}
        </select>
      </label>
      <label className="form-field"><span>Skills you can offer</span>
        <select value={selectedOfferedSkill} onChange={(event) => setOfferedSkill(event.target.value)} required disabled={!eligibleOffers.length}>
          {eligibleOffers.map(({ skill, proficiency, requiredProficiency }) => <option value={getSkillId(skill)} key={getSkillId(skill)}>
            {skill.name} — You: {capitalize(proficiency)}{requiredProficiency ? ` | They want: ${capitalize(requiredProficiency)}` : ''}
          </option>)}
        </select>
      </label>
      {!eligibleOffers.length && <p className="offer-skill-empty" role="status">You don't currently have a skill that meets this student's learning requirements.</p>}
      <label className="form-field"><span>Introductory message (optional)</span>
        <textarea rows="2" maxLength="500" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Introduce yourself and what you hope to learn." />
      </label>
      {error && <p className="form-alert" role="alert">{error}</p>}
      {success && <output className="success-message">Request sent. You can track it in Sent requests.</output>}
      <button type="submit" className="primary-button" disabled={busy || !selectedRequestedSkill || !selectedOfferedSkill || !eligibleOffers.length}>{busy ? 'Sending…' : 'Send request'}</button>
    </form>}
  </article>
}

export function DiscoveryPage() {
  const { user } = useAuth()
  const [skills, setSkills] = useState([])
  const [catalogueError, setCatalogueError] = useState('')
  const [filters, setFilters] = useState({ q: '', teachingSkill: '', learningSkill: '', proficiency: '', college: '', minRating: '' })
  const [searchText, setSearchText] = useState('')
  const [page, setPage] = useState(1)
  const [result, setResult] = useState({ students: [], pagination: { page: 1, pages: 0, total: 0 } })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const timeout = setTimeout(() => {
      setFilters((current) => current.q === searchText.trim() ? current : { ...current, q: searchText.trim() })
      setPage(1)
    }, 300)
    return () => clearTimeout(timeout)
  }, [searchText])

  useEffect(() => {
    let active = true
    apiRequest('/skills')
      .then(({ skills: catalogue }) => { if (active) setSkills(catalogue) })
      .catch((requestError) => { if (active) setCatalogueError(requestError.message) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    const params = new URLSearchParams({ page: String(page), limit: String(pageSize) })
    Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value) })
    apiRequest(`/users/discover?${params}`)
      .then((data) => { if (active) setResult(data) })
      .catch((requestError) => { if (active) setError(requestError.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [filters, page, refreshKey])

  function changeFilter(name, value) {
    setLoading(true)
    setError('')
    setFilters((current) => ({ ...current, [name]: value }))
    setPage(1)
  }

  function clearFilters() {
    setLoading(true)
    setError('')
    setSearchText('')
    setFilters({ q: '', teachingSkill: '', learningSkill: '', proficiency: '', college: '', minRating: '' })
    setPage(1)
  }

  const skillOptions = skills.map((skill) => <option key={skill._id} value={skill._id}>{skill.name}</option>)

  return <AppLayout>
    <div className="page-heading"><div><span className="section-kicker">FIND YOUR NEXT SKILL PARTNER</span><h1>Discover students</h1><p>Find students whose skills complement what you want to learn and share.</p></div></div>
    <section className="content-card discovery-filters" aria-label="Student search and filters">
      <label className="form-field"><span>Search names or skills</span><input type="search" value={searchText} onChange={(event) => { setLoading(true); setError(''); setSearchText(event.target.value) }} placeholder="Try a student name or skill" /></label>
      <label className="form-field"><span>Teaches</span><select value={filters.teachingSkill} onChange={(event) => changeFilter('teachingSkill', event.target.value)}><option value="">Any skill</option>{skillOptions}</select></label>
      <label className="form-field"><span>Wants to learn</span><select value={filters.learningSkill} onChange={(event) => changeFilter('learningSkill', event.target.value)}><option value="">Any skill</option>{skillOptions}</select></label>
      <label className="form-field"><span>Proficiency</span><select value={filters.proficiency} onChange={(event) => changeFilter('proficiency', event.target.value)}><option value="">Any level</option>{['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'].map((value) => <option key={value} value={value}>{value[0]}{value.slice(1).toLowerCase()}</option>)}</select></label>
      <label className="form-field"><span>College</span><input value={filters.college} onChange={(event) => changeFilter('college', event.target.value)} placeholder="Filter by college" maxLength="120" /></label>
      <label className="form-field"><span>Minimum rating</span><select value={filters.minRating} onChange={(event) => changeFilter('minRating', event.target.value)}><option value="">Any rating</option><option value="4">4+ stars</option><option value="3">3+ stars</option><option value="2">2+ stars</option><option value="1">1+ stars</option></select></label>
      <button className="secondary-button clear-filters" type="button" onClick={clearFilters}>Clear filters</button>
    </section>
    {catalogueError && <section className="empty-panel error-panel" role="alert"><p>Skill filters could not be loaded: {catalogueError}</p><button className="secondary-button" onClick={() => { setCatalogueError(''); setSkills([]); apiRequest('/skills').then(({ skills: catalogue }) => setSkills(catalogue)).catch((requestError) => setCatalogueError(requestError.message)) }}>Try again</button></section>}
    {error && <section className="empty-panel error-panel" role="alert"><p>{error}</p><button className="secondary-button" onClick={() => { setLoading(true); setError(''); setRefreshKey((value) => value + 1) }}>Try again</button></section>}
    {loading && <output className="empty-panel"><span className="spinner" /> Searching students…</output>}
    {!loading && !error && result.students.length === 0 && <section className="empty-panel"><h2>No students found</h2><p>Try adjusting your search or clearing some filters.</p><button className="secondary-button" onClick={clearFilters}>Clear filters</button></section>}
    {!loading && !error && result.students.length > 0 && <>
      <p className="results-count">{result.students.length} shown on this page · {result.pagination.total} total matches · ordered by matching score{filters.minRating ? ` · minimum ${filters.minRating}+ stars` : ''}</p>
      <div className="student-grid">{result.students.map((student) => <StudentCard key={student.id} student={student} user={user} onRequested={() => { setLoading(true); setRefreshKey((value) => value + 1) }} />)}</div>
      {result.pagination.pages > 1 && <nav className="pagination" aria-label="Discovery pages"><button className="secondary-button" disabled={page <= 1} onClick={() => { setLoading(true); setPage((value) => value - 1) }}>Previous</button><span>Page {result.pagination.page} of {result.pagination.pages}</span><button className="secondary-button" disabled={page >= result.pagination.pages} onClick={() => { setLoading(true); setPage((value) => value + 1) }}>Next</button></nav>}
    </>}
  </AppLayout>
}
