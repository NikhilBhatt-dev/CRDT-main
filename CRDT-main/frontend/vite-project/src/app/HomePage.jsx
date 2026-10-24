import { useState } from 'react'
import './HomePage.css'

const githubUrl = 'https://github.com/NikhilBhatt-dev/CRDT-main'

const capabilities = [
  {
    number: '01',
    title: 'Real-time collaboration',
    description: 'Edit side by side. Yjs and CRDTs keep shared changes in sync as multiple people work in the same code.',
  },
  {
    number: '02',
    title: 'Shared coding rooms',
    description: 'Open a room in the browser and invite someone with a shareable room link.',
  },
  {
    number: '03',
    title: 'Live presence',
    description: 'See who is there and where collaborators are working. Guests can rename themselves in the room.',
  },
  {
    number: '04',
    title: 'In-browser execution',
    description: 'Run code through the integrated service and inspect its output without leaving the workspace.',
  },
]

const useCases = [
  ['Pair programming', 'Work through an idea together in one shared editor.'],
  ['Remote coding sessions', 'Give distributed teammates a common place to code.'],
  ['Learning and mentoring', 'Explain concepts while editing the same code.'],
  ['Technical interviews', 'Reason through an exercise in a room shared by interviewer and candidate.'],
]

function HomePage({ onStart }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [previewName, setPreviewName] = useState('Guest name')
  const [previewNameInput, setPreviewNameInput] = useState('Guest name')
  const [previewEditing, setPreviewEditing] = useState(false)
  const [previewMessage, setPreviewMessage] = useState('')
  const [codeCopied, setCodeCopied] = useState(false)
  const closeMenu = () => setMenuOpen(false)

  const createAndCopyRoom = async () => {
    const roomId = window.crypto.randomUUID()
    const roomUrl = new URL(`/room/${roomId}`, window.location.origin).toString()
    try {
      await navigator.clipboard.writeText(roomUrl)
      onStart(roomId, 'copied')
    } catch {
      onStart(roomId, 'error')
    }
  }

  const savePreviewName = event => {
    event.preventDefault()
    const name = previewNameInput.trim()
    if (!name || name.length > 24) {
      setPreviewMessage('Enter a name up to 24 characters.')
      return
    }
    setPreviewName(name)
    setPreviewEditing(false)
    setPreviewMessage('Preview name updated locally.')
  }

  const copyPreviewCode = async () => {
    const sample = 'const room = "open-web";\n\nfunction buildTogether(team) {\n  return `${team} builds here`;\n}\n\nconsole.log(buildTogether("You + Me"));'
    try {
      await navigator.clipboard.writeText(sample)
      setCodeCopied(true)
      window.setTimeout(() => setCodeCopied(false), 1800)
    } catch {
      setPreviewMessage('Clipboard access is unavailable in this browser.')
    }
  }

  return (
    <main className="home-page">
      <header className="home-navbar">
        <a className="home-brand" href="/" aria-label="CRDT Collaborative Code Editor home" onClick={closeMenu}>
          <span className="home-brand-mark" aria-hidden="true"><span>&gt;_</span></span>
          <span>CRDT Collaborative Code Editor</span>
        </a>
        <button
          className="home-menu-toggle"
          type="button"
          aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={menuOpen}
          aria-controls="home-navigation"
          onClick={() => setMenuOpen(open => !open)}
        >
          <span /><span /><span />
        </button>
        <nav id="home-navigation" className={`home-nav-links ${menuOpen ? 'is-open' : ''}`} aria-label="Main navigation">
          <a href="#capabilities" onClick={closeMenu}>Capabilities</a>
          <a href="#workflow" onClick={closeMenu}>Workflow</a>
          <a href="#use-cases" onClick={closeMenu}>Use Cases</a>
          <button className="home-nav-cta" type="button" onClick={() => { closeMenu(); onStart() }}>
            Start Coding <span aria-hidden="true">↗</span>
          </button>
        </nav>
      </header>

      <section className="home-hero" aria-labelledby="hero-title">
        <div className="home-hero-copy">
          <p className="home-eyebrow">OPEN SOURCE <i>/</i> A WORKSPACE FOR SHARED IDEAS</p>
          <h1 id="hero-title">The room is wherever you code together.</h1>
          <p className="home-hero-description">
            Open a room in your browser. Share the link, edit code with your team in real time,
            and run the output in your browser through the integrated service.
          </p>
          <div className="home-hero-actions">
            <button className="home-primary-button" type="button" onClick={onStart}>Start Coding <span aria-hidden="true">↗</span></button>
            <a className="home-github-button" href={githubUrl} target="_blank" rel="noreferrer">View on GitHub</a>
          </div>
          <p className="home-hero-note">NO INSTALL TO EXPLORE THE WORKSPACE <span>/</span> JUST A BROWSER</p>
        </div>

        <div className="preview-wrap">
          <div className="preview-label-row">
            <p className="home-eyebrow">THE SHARED ROOM <i>/</i> PREVIEW</p>
            <span className="preview-concept-label">FIG. 01 — LIVE-ROOM CONCEPT</span>
          </div>
          <section className="preview-window" aria-label="Static homepage preview of the collaborative editor">
            <div className="preview-roombar">
              <div className="preview-room-title">
                <span className="preview-window-dots" aria-hidden="true"><i /><i /><i /></span>
                <span>room / open-web</span>
              </div>
              <button className="preview-share-button" type="button" title="Create a live room and copy its invite link" onClick={createAndCopyRoom}>Share Link</button>
            </div>
            <div className="preview-filebar">
              <span><i aria-hidden="true" /> session.js</span>
              <span className="preview-people" aria-label="Illustrative anonymous collaborators">
                <i className="preview-person person-blue">A</i>
                <i className="preview-person person-purple">B</i>
                <i className="preview-person person-green">C</i>
                <small>3 online</small>
              </span>
            </div>
            <div className="preview-workspace">
              <div className="preview-code">
                <div className="preview-code-lines" aria-hidden="true">
                  <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span><span>7</span><span>8</span><span>9</span><span>10</span><span>11</span>
                </div>
                <pre aria-label="Illustrative JavaScript code preview"><code><span className="code-keyword">const</span> room = <span className="code-string">"open-web"</span>;{'\n\n'}<span className="code-keyword">function</span> buildTogether(team) {'{'}{'\n'}  <span className="code-comment">// Ideas move better in the same room.</span>{'\n'}  <span className="code-keyword">return</span> team.<span className="code-method">map</span>(person =&gt; {'{'}{'\n'}    <span className="code-keyword">return</span> <span className="code-string">`${'{'}person{'}'} is here`</span>;{'\n'}  {'}'});{'\n'}{'}'}{'\n\n'}<span className="code-keyword">const</span> team = [<span className="code-string">"Alex"</span>, <span className="code-string">"Sam"</span>, <span className="code-string">"You"</span>];{'\n'}console.<span className="code-method">log</span>(buildTogether(team));</code></pre>
                <span className="preview-cursor cursor-alex">Alex</span>
                <span className="preview-cursor cursor-sam">Sam</span>
                <span className="preview-selection" aria-hidden="true" />
                <span className="preview-cursor cursor-you">You</span>
              </div>
              <aside className="preview-side-panel" aria-label="Illustrative guest presence panel">
                <p className="preview-side-heading">LIVE PRESENCE <i>/</i> YOURSELF</p>
                <p className="preview-side-copy">Alex and Sam are shown as collaborators. In a connected room, collaborators appear here with their chosen names.</p>
                {previewEditing ? (
                  <form className="preview-rename-form" onSubmit={savePreviewName}>
                    <label htmlFor="preview-guest-name">LOCAL GUEST NAME</label>
                    <input
                      id="preview-guest-name"
                      value={previewNameInput}
                      maxLength={24}
                      onChange={event => setPreviewNameInput(event.target.value)}
                    />
                    <div className="preview-rename-actions">
                      <button type="submit">Save</button>
                      <button type="button" onClick={() => { setPreviewEditing(false); setPreviewMessage('') }}>Cancel</button>
                    </div>
                  </form>
                ) : (
                  <div className="preview-guest">
                    <label htmlFor="preview-name-display">LOCAL GUEST NAME</label>
                    <span id="preview-name-display">{previewName}</span>
                    <button type="button" onClick={() => { setPreviewNameInput(previewName); setPreviewEditing(true); setPreviewMessage('') }}>Rename preview guest</button>
                  </div>
                )}
                <p className="preview-side-heading preview-terminal-label">TERMINAL <i>/</i> EXAMPLE OUTPUT</p>
                <pre className="preview-output"><code>[ '{'\n'}  'Alex', 'Sam', 'You are here' {'\n'}]</code></pre>
                <p className="preview-side-copy preview-caveat">Illustrative output. Actual code execution uses the product’s integrated service.</p>
                {previewMessage && <p className="preview-message" role="status">{previewMessage}</p>}
              </aside>
            </div>
            <div className="preview-footer">
              <span>LOCAL PREVIEW / JAVASCRIPT</span>
              <button type="button" onClick={copyPreviewCode}>{codeCopied ? 'Copied' : 'Copy code'}</button>
            </div>
          </section>
          <p className="preview-disclaimer">Homepage concept preview: edits and guest renaming here are local. Live collaboration, room links, and execution require a connected product room.</p>
        </div>
      </section>

      <div className="home-tech-strip" aria-label="Project technologies">
        <span className="tech-open-source">OPEN SOURCE</span>
        <span>REACT + VITE</span>
        <span>YJS + CRDTS</span>
        <span>NODE.JS + SOCKET.IO</span>
      </div>

      <section className="home-section home-capabilities" id="capabilities" aria-labelledby="capabilities-title">
        <div className="section-intro">
          <p className="home-eyebrow">01 <i>/</i> WHAT MAKES THE ROOM WORK</p>
          <h2 id="capabilities-title">One workspace. Many minds in motion.</h2>
        </div>
        <div className="capability-list">
          {capabilities.map(item => (
            <article className="capability-row" key={item.number}>
              <span className={`capability-number capability-number-${item.number}`}>{item.number}<i aria-hidden="true">↗</i></span>
              <div><h3>{item.title}</h3><p>{item.description}</p></div>
            </article>
          ))}
        </div>
      </section>

      <section className="home-workflow" id="workflow" aria-labelledby="workflow-title">
        <div className="workflow-inner">
          <p className="home-eyebrow">02 <i>/</i> A SIMPLE SIGNAL PATH</p>
          <h2 id="workflow-title">From an empty room to a shared breakthrough.</h2>
          <div className="workflow-steps">
            <article><span>01 <i /></span><h3>Open a room</h3><p>Start a browser-based space for the code you want to work on.</p></article>
            <article><span>02 <i /></span><h3>Share the link</h3><p>Send the room link to a teammate, classmate, mentor, or interview partner.</p></article>
            <article><span>03 <i /></span><h3>Build together</h3><p>Edit in real time, follow presence, and reason through code and output together.</p></article>
          </div>
        </div>
      </section>

      <section className="home-section home-use-cases" id="use-cases" aria-labelledby="use-cases-title">
        <div className="section-intro">
          <p className="home-eyebrow">03 <i>/</i> WHERE IDEAS MEET</p>
          <h2 id="use-cases-title">The right room for the next problem.</h2>
        </div>
        <div className="use-case-list">
          {useCases.map(([title, description]) => (
            <article key={title}><h3>{title}</h3><p>{description}</p></article>
          ))}
        </div>
      </section>

      <section className="home-final-cta" aria-labelledby="final-cta-title">
        <p className="home-eyebrow">04 <i>/</i> OPEN BY DESIGN</p>
        <h2 id="final-cta-title">Good code is a conversation. Leave the room open.</h2>
        <div className="final-cta-bottom">
          <p>An open-source approach to building together in the browser. Explore the project repository or open a live room to start working with your team.</p>
          <button className="home-primary-button" type="button" onClick={onStart}>Explore the workspace <span aria-hidden="true">↗</span></button>
        </div>
      </section>

      <footer className="home-footer">
        <span>CRDT Collaborative Code Editor</span>
        <span>Open-source collaborative coding for the browser.</span>
        <a href={githubUrl} target="_blank" rel="noreferrer">GitHub ↗</a>
      </footer>
    </main>
  )
}

export default HomePage
