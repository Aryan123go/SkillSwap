import { useMemo, useState } from 'react'
import './App.css'

const skills = [
  {
    name: 'Maya Chen',
    initials: 'MC',
    color: 'peach',
    location: 'Brooklyn, NY',
    rating: '4.9',
    sessions: 18,
    teaches: 'UI/UX Design',
    learns: 'Photography',
    category: 'Design',
    note: 'I’ll help you turn your ideas into clean, thoughtful interfaces.',
  },
  {
    name: 'Jordan Lee',
    initials: 'JL',
    color: 'blue',
    location: 'Austin, TX',
    rating: '5.0',
    sessions: 24,
    teaches: 'Photography',
    learns: 'Spanish',
    category: 'Creative',
    note: 'Let’s find the light, then make something worth keeping.',
  },
  {
    name: 'Amara Okafor',
    initials: 'AO',
    color: 'lavender',
    location: 'London, UK',
    rating: '4.8',
    sessions: 12,
    teaches: 'Spanish',
    learns: 'Web Development',
    category: 'Languages',
    note: 'Easy-going conversation practice for every level.',
  },
  {
    name: 'Theo Martin',
    initials: 'TM',
    color: 'green',
    location: 'Portland, OR',
    rating: '5.0',
    sessions: 31,
    teaches: 'Web Development',
    learns: 'Guitar',
    category: 'Technology',
    note: 'From first HTML tag to your first shipped project.',
  },
]

const categories = ['All skills', 'Design', 'Creative', 'Languages', 'Technology']

function ArrowIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
      <path d="M4 10h12m-5-5 5 5-5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function App() {
  const [activeCategory, setActiveCategory] = useState('All skills')
  const [search, setSearch] = useState('')
  const [selectedPerson, setSelectedPerson] = useState(null)

  const visibleSkills = useMemo(() => {
    const query = search.trim().toLowerCase()

    return skills.filter((person) => {
      const matchesCategory = activeCategory === 'All skills' || person.category === activeCategory
      const matchesSearch =
        !query ||
        `${person.name} ${person.teaches} ${person.learns} ${person.location}`
          .toLowerCase()
          .includes(query)

      return matchesCategory && matchesSearch
    })
  }, [activeCategory, search])

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#home" aria-label="SkillSwap home">
          <span className="brand-mark">s</span>
          <span>skill<span className="brand-light">swap</span></span>
        </a>
        <nav className="main-nav" aria-label="Main navigation">
          <a className="nav-active" href="#discover">Discover</a>
          <a href="#how-it-works">How it works</a>
          <a href="#community">Community</a>
        </nav>
        <div className="account-actions">
          <button className="login-button" onClick={() => setSelectedPerson({ name: 'Welcome back!' })}>Log in</button>
          <button className="join-button" onClick={() => setSelectedPerson({ name: 'Join the community' })}>Join for free <ArrowIcon /></button>
        </div>
      </header>

      <section className="hero" id="home">
        <div className="hero-copy">
          <div className="eyebrow"><span className="sparkle">✳</span> YOUR NEXT SKILL IS CLOSER THAN YOU THINK</div>
          <h1>Learn something.<br /><span>Teach something.</span></h1>
          <p className="hero-description">Trade what you know for what you want to learn.<br className="desktop-break" /> Good skills—and good people—are meant to be shared.</p>
          <div className="hero-search">
            <span className="search-icon" aria-hidden="true">⌕</span>
            <input
              aria-label="Search skills or people"
              placeholder="What do you want to learn?"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <button onClick={() => document.querySelector('#discover')?.scrollIntoView({ behavior: 'smooth' })}>Find your match <ArrowIcon /></button>
          </div>
          <div className="hero-footnote"><span className="mini-avatars">A <i>M</i> J</span> <span>Join <strong>2,400+</strong> curious people swapping skills</span></div>
        </div>
        <div className="hero-art" aria-label="Illustration of a community sharing skills">
          <div className="art-orbit orbit-one"></div>
          <div className="art-orbit orbit-two"></div>
          <span className="art-star star-one">✳</span>
          <span className="art-star star-two">✦</span>
          <div className="art-note note-design"><span>✎</span> design</div>
          <div className="art-note note-code"><span>&lt;/&gt;</span> code</div>
          <div className="art-note note-photo"><span>◉</span> photo</div>
          <div className="art-person person-one"><span>👩🏽‍🎨</span></div>
          <div className="art-person person-two"><span>👨🏻‍💻</span></div>
          <div className="art-person person-three"><span>👩🏻‍🎤</span></div>
          <div className="art-center"><span>✳</span><small>better<br />together</small></div>
        </div>
        <div className="hero-bottom">
          <span>NO MONEY. JUST KNOW-HOW.</span>
          <span className="bottom-line"></span>
          <span>GIVE A LITTLE. GROW A LOT.</span>
        </div>
      </section>

      <section className="discover-section" id="discover">
        <div className="section-heading">
          <div>
            <span className="section-kicker">GOOD THINGS HAPPEN WHEN WE SHARE</span>
            <h2>Find your kind of people<span className="heading-dot">.</span></h2>
            <p>Real people, real skills, and a little bit of give-and-take.</p>
          </div>
          <a href="#how-it-works" className="browse-link">How SkillSwap works <ArrowIcon /></a>
        </div>

        <div className="category-row" aria-label="Filter by skill category">
          {categories.map((category) => (
            <button
              key={category}
              className={`category-chip${activeCategory === category ? ' selected' : ''}`}
              onClick={() => setActiveCategory(category)}
              aria-pressed={activeCategory === category}
            >
              {category}
            </button>
          ))}
          <span className="results-count">{visibleSkills.length} people to meet</span>
        </div>

        <div className="people-grid">
          {visibleSkills.map((person) => (
            <article className="person-card" key={person.name}>
              <div className={`card-avatar ${person.color}`}><span>{person.initials}</span><i className="online-dot"></i></div>
              <div className="card-person-heading">
                <div><h3>{person.name}</h3><p className="location">{person.location}</p></div>
                <span className="rating">★ {person.rating}</span>
              </div>
              <p className="person-note">“{person.note}”</p>
              <div className="swap-pair">
                <div className="skill-pill teach"><span>TEACHES</span><strong>{person.teaches}</strong></div>
                <span className="swap-arrow">↔</span>
                <div className="skill-pill learn"><span>WANTS TO LEARN</span><strong>{person.learns}</strong></div>
              </div>
              <div className="card-footer">
                <span>{person.sessions} swaps completed</span>
                <button aria-label={`Propose a swap with ${person.name}`} onClick={() => setSelectedPerson(person)}><ArrowIcon /></button>
              </div>
            </article>
          ))}
          {visibleSkills.length === 0 && (
            <div className="empty-state">
              <span>✳</span>
              <h3>No matches just yet</h3>
              <p>Try another search or explore all skills.</p>
              <button onClick={() => { setSearch(''); setActiveCategory('All skills') }}>Show everyone</button>
            </div>
          )}
        </div>
        <div className="community-callout" id="community">
          <div className="callout-icon">✳</div>
          <p><strong>Your skill is someone else’s next big thing.</strong><br />Make an account and find your first swap.</p>
          <button onClick={() => setSelectedPerson({ name: 'Join the community' })}>Meet your people <ArrowIcon /></button>
        </div>
      </section>

      <footer className="site-footer" id="how-it-works">
        <a className="brand footer-brand" href="#home"><span className="brand-mark">s</span><span>skill<span className="brand-light">swap</span></span></a>
        <p>We all know a little. We all need a little.</p>
        <span>© 2026 SkillSwap · Made for curious people</span>
      </footer>

      {selectedPerson && (
        <div className="modal-backdrop" role="presentation" onClick={() => setSelectedPerson(null)}>
          <section className="swap-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" aria-label="Close" onClick={() => setSelectedPerson(null)}>×</button>
            <span className="modal-sparkle">✳</span>
            <h2 id="modal-title">{selectedPerson.name === 'Join the community' || selectedPerson.name === 'Welcome back!' ? selectedPerson.name : `Swap with ${selectedPerson.name.split(' ')[0]}?`}</h2>
            <p>SkillSwap is getting ready to bring curious people together. Sign-up and messaging are coming soon.</p>
            <button className="modal-done" onClick={() => setSelectedPerson(null)}>Sounds good</button>
          </section>
        </div>
      )}
    </main>
  )
}

export default App
