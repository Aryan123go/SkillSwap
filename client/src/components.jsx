import React from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from './useAuth.js'
import { capitalize, getSkillId, PROFICIENCIES } from './skillUtils.js'

export function Brand() {
  return <Link className="brand" to="/" aria-label="SkillSwap home">
    <span className="brand-mark">s</span><span>skill<span className="brand-light">swap</span></span>
  </Link>
}

export function Header({ compact = false }) {
  const { user, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [menuError, setMenuError] = React.useState('')

  async function handleSignOut() {
    setMenuError('')
    try {
      await signOut()
      navigate('/')
    } catch (error) {
      setMenuError(error.message)
    }
  }

  return <>
    <header className="topbar">
      <Brand />
      {!compact && user && <nav className="main-nav" aria-label="Main navigation">
        <NavLink to="/dashboard">Dashboard</NavLink>
        <NavLink to="/profile">My profile</NavLink>
      </nav>}
      <div className="account-actions">
        {user ? <>
          <span className="header-user">{user.name.split(' ')[0]}</span>
          <button className="login-button" onClick={handleSignOut}>Log out</button>
        </> : location.pathname === '/login' ? <>
          <Link className="join-button" to="/register">Sign up <ArrowIcon /></Link>
        </> : location.pathname === '/register' ? <>
          <Link className="login-button" to="/login">Log in</Link>
        </> : <>
          <Link className="login-button" to="/login">Log in</Link>
          <Link className="join-button" to="/register">Join for free <ArrowIcon /></Link>
        </>}
      </div>
    </header>
    {menuError && <div className="inline-banner error-banner" role="alert">{menuError}</div>}
  </>
}

export function ArrowIcon() {
  return <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
    <path d="M4 10h12m-5-5 5 5-5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
}

export function LoadingScreen() {
  return <main className="loading-screen" role="status"><span className="spinner" />Loading SkillSwap…</main>
}

export function FormField({ label, error, ...props }) {
  return <label className="form-field">
    <span>{label}</span>
    <input {...props} aria-invalid={Boolean(error)} />
    {error && <small className="field-error">{error}</small>}
  </label>
}

export function SkillChoices({ title, skills, entries, onChange, description }) {
  const [query, setQuery] = React.useState('')
  const visibleSkills = skills.filter((skill) => (
    `${skill.name} ${skill.category}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
  ))

  function toggleSkill(skill) {
    const exists = entries.some((entry) => getSkillId(entry.skill) === skill._id)
    onChange(exists
      ? entries.filter((entry) => getSkillId(entry.skill) !== skill._id)
      : [...entries, { skill: skill._id, proficiency: 'BEGINNER' }])
  }

  function setProficiency(skillId, proficiency) {
    onChange(entries.map((entry) => (
      getSkillId(entry.skill) === skillId ? { ...entry, proficiency } : entry
    )))
  }

  return <section className="skill-editor">
    <div className="skill-editor-heading">
      <div><h3>{title}</h3><p>{description}</p></div>
      <span className="selection-count">{entries.length} selected</span>
    </div>
    <input className="skill-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search the skill catalogue" aria-label={`Search ${title.toLowerCase()}`} />
    {visibleSkills.length ? <div className="skill-options">
      {visibleSkills.map((skill) => {
        const entry = entries.find((item) => getSkillId(item.skill) === skill._id)
        return <div className={`skill-option${entry ? ' is-selected' : ''}`} key={skill._id}>
          <label><input type="checkbox" checked={Boolean(entry)} onChange={() => toggleSkill(skill)} /><span>{skill.name}</span><small>{skill.category}</small></label>
          {entry && <select value={entry.proficiency} onChange={(event) => setProficiency(skill._id, event.target.value)} aria-label={`${skill.name} proficiency`}>
            {PROFICIENCIES.map((level) => <option key={level} value={level}>{capitalize(level)}</option>)}
          </select>}
        </div>
      })}
    </div> : <p className="subtle-text">No catalogue skills match that search.</p>}
  </section>
}

export function SkillList({ entries, emptyText }) {
  if (!entries?.length) return <p className="subtle-text">{emptyText}</p>
  return <div className="skill-list">{entries.map((entry) => (
    <span className="skill-tag" key={getSkillId(entry.skill)}>
      {typeof entry.skill === 'object' ? entry.skill.name : 'Skill'}
      <small>{capitalize(entry.proficiency)}</small>
    </span>
  ))}</div>
}
