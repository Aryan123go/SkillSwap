import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { apiRequest } from './api.js'
import { useAuth } from './useAuth.js'
import { ArrowIcon, FormField, Header, SkillChoices, SkillList } from './components.jsx'
import { getSkillId } from './skillUtils.js'

function AuthLayout({ title, description, children, footer }) {
  return <main className="auth-page">
    <Header compact />
    <section className="auth-card">
      <span className="section-kicker">YOUR SKILL-SHARING COMMUNITY</span>
      <h1>{title}</h1><p className="auth-description">{description}</p>
      {children}
      <p className="auth-footer">{footer}</p>
    </section>
  </main>
}

export function LandingPage() {
  const { user } = useAuth()
  return <main>
    <Header />
    <section className="hero" id="home">
      <div className="hero-copy">
        <div className="eyebrow"><span className="sparkle">✳</span> YOUR NEXT SKILL IS CLOSER THAN YOU THINK</div>
        <h1>Learn something.<br /><span>Teach something.</span></h1>
        <p className="hero-description">Trade what you know for what you want to learn.<br className="desktop-break" /> Good skills—and good people—are meant to be shared.</p>
        <div className="hero-actions">
          <Link className="join-button" to={user ? '/dashboard' : '/register'}>{user ? 'Go to your dashboard' : 'Create your profile'} <ArrowIcon /></Link>
          {user && <Link className="secondary-link" to="/profile">View your profile</Link>}
        </div>
        <div className="hero-footnote"><span className="mini-avatars">S <i>K</i> Y</span><span>Share what you know. Grow together.</span></div>
      </div>
      <div className="hero-art" aria-label="Illustration of a community sharing skills">
        <div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" />
        <span className="art-star star-one">✳</span><span className="art-star star-two">✦</span>
        <div className="art-note note-design"><span>✎</span> design</div><div className="art-note note-code"><span>&lt;/&gt;</span> code</div><div className="art-note note-photo"><span>◉</span> ideas</div>
        <div className="art-person person-one"><span>✳</span></div><div className="art-person person-two"><span>↗</span></div><div className="art-person person-three"><span>✦</span></div>
        <div className="art-center"><span>✳</span><small>better<br />together</small></div>
      </div>
      <div className="hero-bottom"><span>NO MONEY. JUST KNOW-HOW.</span><span className="bottom-line" /><span>GIVE A LITTLE. GROW A LOT.</span></div>
    </section>
    <section className="intro-section">
      <div><span className="section-kicker">START WITH WHAT YOU KNOW</span><h2>A little knowledge goes a long way<span className="heading-dot">.</span></h2><p>Build a profile around your skills, then keep it fresh as you learn and grow.</p></div>
      <div className="intro-steps"><article><span>01</span><h3>Make your profile</h3><p>Tell your community what you can teach and what you'd love to learn.</p></article><article><span>02</span><h3>Share your skills</h3><p>Choose from a growing catalogue and set your comfort level.</p></article><article><span>03</span><h3>Keep growing</h3><p>Your profile is yours to update whenever your skills change.</p></article></div>
    </section>
    <footer className="site-footer"><Header compact /><p>SkillSwap · Learn something. Teach something.</p></footer>
  </main>
}

export function ServiceUnavailablePage({ message, onRetry }) {
  return <main className="status-page">
    <Header compact />
    <section className="status-card">
      <span className="completion-icon">!</span>
      <span className="section-kicker">CONNECTION ISSUE</span>
      <h1>SkillSwap is taking a moment.</h1>
      <p>{message}</p>
      <button className="primary-button" onClick={onRetry}>Try again <ArrowIcon /></button>
    </section>
  </main>
}

export function RegisterPage() {
  const { user, register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  if (user) return <Navigate to="/dashboard" replace />

  async function submit(event) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      await register(form)
      navigate('/dashboard')
    } catch (submissionError) {
      setError(submissionError.message)
    } finally {
      setBusy(false)
    }
  }

  return <AuthLayout title="Create your account" description="Start building your SkillSwap profile." footer={<>Already have an account? <Link to="/login">Log in</Link></>}>
    <form className="form-stack" onSubmit={submit}>
      <FormField label="Full name" name="name" autoComplete="name" minLength={2} maxLength={80} required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
      <FormField label="Email address" name="email" type="email" autoComplete="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
      <FormField label="Password" name="password" type="password" autoComplete="new-password" minLength={8} maxLength={72} required value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
      <p className="form-hint">Use at least 8 characters.</p>
      {error && <p className="form-alert" role="alert">{error}</p>}
      <button className="primary-button full-width" disabled={busy}>{busy ? 'Creating account…' : 'Create account'} <ArrowIcon /></button>
    </form>
  </AuthLayout>
}

export function LoginPage() {
  const { user, signIn } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  if (user) return <Navigate to="/dashboard" replace />

  async function submit(event) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      await signIn(form)
      navigate('/dashboard')
    } catch (submissionError) {
      setError(submissionError.message)
    } finally {
      setBusy(false)
    }
  }

  return <AuthLayout title="Welcome back" description="Sign in to continue to your profile." footer={<>New to SkillSwap? <Link to="/register">Create an account</Link></>}>
    <form className="form-stack" onSubmit={submit}>
      <FormField label="Email address" name="email" type="email" autoComplete="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
      <FormField label="Password" name="password" type="password" autoComplete="current-password" required value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
      {error && <p className="form-alert" role="alert">{error}</p>}
      <button className="primary-button full-width" disabled={busy}>{busy ? 'Signing in…' : 'Log in'} <ArrowIcon /></button>
    </form>
  </AuthLayout>
}

export function DashboardPage() {
  const { user } = useAuth()
  const completion = getCompletion(user)
  return <AppLayout>
    <div className="page-heading"><div><span className="section-kicker">YOUR SKILLS, YOUR NEXT CHAPTER</span><h1>Welcome, {user.name.split(' ')[0]}.</h1><p>Your SkillSwap profile is ready to grow with you.</p></div><Link className="primary-button" to="/profile/edit">Edit profile <ArrowIcon /></Link></div>
    <section className="completion-card">
      <div className="completion-copy"><span className="completion-icon">✳</span><div><h2>{completion === 100 ? 'Your profile is complete' : 'Make your profile your own'}</h2><p>{completion === 100 ? 'You can update your skills any time.' : 'Add a bio, college, and skills to help your profile feel complete.'}</p></div></div>
      <div className="progress-group"><span>{completion}% complete</span><div className="progress-track"><i style={{ width: `${completion}%` }} /></div></div>
    </section>
    <div className="dashboard-grid">
      <section className="content-card"><div className="card-heading"><div><span className="section-kicker">WHAT YOU CAN SHARE</span><h2>Teaching skills</h2></div><Link to="/profile/edit">Edit</Link></div><SkillList entries={user.skillsToTeach} emptyText="Add skills you'd be happy to teach." /></section>
      <section className="content-card"><div className="card-heading"><div><span className="section-kicker">WHAT YOU WANT TO LEARN</span><h2>Learning goals</h2></div><Link to="/profile/edit">Edit</Link></div><SkillList entries={user.skillsToLearn} emptyText="Add skills you'd like to learn." /></section>
    </div>
  </AppLayout>
}

export function ProfilePage() {
  const { user } = useAuth()
  const { id } = useParams()
  const [publicProfile, setPublicProfile] = useState(null)
  const [error, setError] = useState('')
  const isOwnProfile = !id || id === user.id
  const profile = isOwnProfile ? user : publicProfile

  useEffect(() => {
    if (!id || id === user.id) return undefined
    let active = true
    apiRequest(`/users/${id}`)
      .then(({ user: result }) => { if (active) setPublicProfile(result) })
      .catch((requestError) => { if (active) setError(requestError.message) })
    return () => { active = false }
  }, [id, user])

  if (error) return <AppLayout><div className="empty-panel" role="alert">{error}</div></AppLayout>
  if (!profile) return <AppLayout><div className="empty-panel">Loading profile…</div></AppLayout>

  return <AppLayout>
    <div className="page-heading"><div><span className="section-kicker">STUDENT PROFILE</span><h1>{profile.name}</h1><p>{profile.college || 'Add your college to tell the community where you study.'}</p></div>{isOwnProfile && <Link className="primary-button" to="/profile/edit">Edit profile <ArrowIcon /></Link>}</div>
    <section className="profile-card">
      <div className="profile-avatar">{profile.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</div>
      <div className="profile-bio"><span className="section-kicker">A LITTLE ABOUT ME</span><p>{profile.bio || 'This profile is just getting started.'}</p></div>
    </section>
    <div className="dashboard-grid profile-skills">
      <section className="content-card"><div className="card-heading"><div><span className="section-kicker">SKILLS I CAN SHARE</span><h2>Teaching skills</h2></div></div><SkillList entries={profile.skillsToTeach} emptyText="No teaching skills added yet." /></section>
      <section className="content-card"><div className="card-heading"><div><span className="section-kicker">SKILLS I WANT TO GAIN</span><h2>Learning goals</h2></div></div><SkillList entries={profile.skillsToLearn} emptyText="No learning skills added yet." /></section>
    </div>
  </AppLayout>
}

export function EditProfilePage() {
  const { user, setUser } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState(() => profileToForm(user))
  const [skills, setSkills] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([apiRequest('/users/me'), apiRequest('/skills')])
      .then(([profileData, skillData]) => {
        if (!active) return
        setForm(profileToForm(profileData.user))
        setUser(profileData.user)
        setSkills(skillData.skills)
      })
      .catch((requestError) => { if (active) setError(requestError.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [setUser])

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
    setError('')
    setSuccess('')
  }

  async function submit(event) {
    event.preventDefault()
    setError('')
    setSuccess('')
    setBusy(true)
    try {
      const data = await apiRequest('/users/me', {
        method: 'PUT',
        body: JSON.stringify(form),
      })
      setUser(data.user)
      setSuccess('Your profile has been saved.')
      setTimeout(() => navigate('/profile'), 700)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <AppLayout><div className="empty-panel">Loading your profile and the skill catalogue…</div></AppLayout>
  return <AppLayout>
    <div className="page-heading"><div><span className="section-kicker">MAKE IT YOURS</span><h1>Edit your profile</h1><p>Your changes are saved to your SkillSwap account.</p></div></div>
    <form className="edit-form" onSubmit={submit}>
      <section className="content-card form-section"><h2>About you</h2><FormField label="Full name" name="name" minLength={2} maxLength={80} required value={form.name} onChange={updateField} /><FormField label="College" name="college" maxLength={120} value={form.college} onChange={updateField} /><label className="form-field"><span>Bio</span><textarea name="bio" rows="4" maxLength="500" value={form.bio} onChange={updateField} placeholder="A little about you and what you're interested in…" /><small className="character-count">{form.bio.length}/500</small></label></section>
      {skills.length > 0 && <>
        <section className="content-card"><SkillChoices title="Skills I can teach" description="Select the skills you can share and set your proficiency." skills={skills} entries={form.skillsToTeach} onChange={(skillsToTeach) => setForm((current) => ({ ...current, skillsToTeach }))} /></section>
        <section className="content-card"><SkillChoices title="Skills I want to learn" description="Choose the skills you'd like to develop." skills={skills} entries={form.skillsToLearn} onChange={(skillsToLearn) => setForm((current) => ({ ...current, skillsToLearn }))} /></section>
      </>}
      {error && <p className="form-alert" role="alert">{error}</p>}
      {success && <p className="success-message" role="status">{success}</p>}
      <div className="form-actions"><Link className="secondary-button" to="/profile">Cancel</Link><button className="primary-button" disabled={busy || skills.length === 0}>{busy ? 'Saving…' : 'Save changes'} <ArrowIcon /></button></div>
    </form>
  </AppLayout>
}

function AppLayout({ children }) {
  return <main className="app-shell"><Header /><div className="app-content">{children}</div><footer className="app-footer">SkillSwap · Learn something. Teach something.</footer></main>
}

function getCompletion(user) {
  const checks = [
    Boolean(user.name),
    Boolean(user.bio),
    Boolean(user.college),
    user.skillsToTeach.length > 0,
    user.skillsToLearn.length > 0,
  ]
  return Math.round(checks.filter(Boolean).length / checks.length * 100)
}

function profileToForm(user) {
  return {
    name: user.name,
    bio: user.bio ?? '',
    college: user.college ?? '',
    skillsToTeach: (user.skillsToTeach ?? []).map((entry) => ({
      skill: getSkillId(entry.skill),
      proficiency: entry.proficiency,
    })),
    skillsToLearn: (user.skillsToLearn ?? []).map((entry) => ({
      skill: getSkillId(entry.skill),
      proficiency: entry.proficiency,
    })),
  }
}
