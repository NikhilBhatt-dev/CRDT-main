import { useState } from 'react'
import './HomePage.css'

const githubUrl = 'https://github.com/NikhilBhatt-dev/CRDT-main'

const features = [
  {
    icon: '↗',
    title: 'Real-Time Collaboration',
    description: 'Code together in the same shared editor, with changes synced as you type.',
    href: '#how-it-works',
    action: 'See how it works',
  },
  {
    icon: '</>',
    title: 'Multiple Languages',
    description: 'Write and run Java, C++, Python, and JavaScript in one workspace.',
    href: '#languages',
    action: 'Explore languages',
  },
  {
    icon: '▶',
    title: 'Run & Test Instantly',
    description: 'Send code and custom stdin to the existing isolated OnlineCompiler runner.',
    href: '#how-it-works',
    action: 'How execution works',
  },
  {
    icon: '⌁',
    title: 'Shareable Rooms',
    description: 'Invite collaborators with a unique room link. Anyone with the link can join.',
    href: '#use-cases',
    action: 'Explore use cases',
  },
]

function HomePage({ onStart }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const closeMenu = () => setMenuOpen(false)

  return (
    <main className="home-page">
      <div className="home-ambient home-ambient-blue" aria-hidden="true" />
      <div className="home-ambient home-ambient-violet" aria-hidden="true" />

      <header className="home-navbar">
        <a className="home-brand" href="/" onClick={closeMenu} aria-label="CRDT home">
          <span className="home-brand-mark" aria-hidden="true">C</span>
          <span>CRDT</span>
        </a>
        <button
          className="home-menu-toggle"
          type="button"
          aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(open => !open)}
        >
          <span />
          <span />
          <span />
        </button>
        <nav className={`home-nav-links ${menuOpen ? 'is-open' : ''}`} aria-label="Main navigation">
          <a href="#features" onClick={closeMenu}>Features</a>
          <a href="#how-it-works" onClick={closeMenu}>How it works</a>
          <a href="#use-cases" onClick={closeMenu}>Use cases</a>
          <a className="home-nav-cta" href="#get-started" onClick={(event) => { event.preventDefault(); closeMenu(); onStart() }}>
            Get Started <span aria-hidden="true">→</span>
          </a>
        </nav>
      </header>

      <section className="home-hero" aria-labelledby="hero-title">
        <div className="home-hero-copy">
          <p className="home-eyebrow"><span /> Real-Time <i>·</i> Collaboration <i>·</i> Secure</p>
          <h1 id="hero-title">Code Together,<br /><span>Build Faster</span></h1>
          <p className="home-hero-description">
            A real-time collaborative code editor for developers. Write, run, and share code
            together with your team — right in the browser.
          </p>
          <div className="home-hero-actions" id="get-started">
            <button className="home-primary-button" type="button" onClick={onStart}>
              Start Coding Now <span aria-hidden="true">→</span>
            </button>
            <a className="home-github-button" href={githubUrl} target="_blank" rel="noreferrer">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path fill="currentColor" d="M12 .9a11.1 11.1 0 0 0-3.51 21.63c.55.1.76-.24.76-.54v-2.08c-3.1.67-3.76-1.31-3.76-1.31-.5-1.29-1.24-1.64-1.24-1.64-1.02-.7.08-.69.08-.69 1.13.08 1.72 1.16 1.72 1.16 1 .1.72 2.62 3.13 1.86.1-.73.4-1.23.7-1.51-2.48-.28-5.1-1.24-5.1-5.52 0-1.22.44-2.22 1.16-3-.12-.28-.5-1.42.11-2.96 0 0 .95-.3 3.05 1.15a10.6 10.6 0 0 1 5.55 0c2.11-1.45 3.05-1.15 3.05-1.15.61 1.54.23 2.68.12 2.96.72.78 1.15 1.78 1.15 3 0 4.3-2.62 5.24-5.12 5.52.4.35.76 1.02.76 2.06v3.05c0 .3.2.65.77.54A11.1 11.1 0 0 0 12 .9Z" />
              </svg>
              View on GitHub
            </a>
          </div>
          <ul className="home-benefit-list" aria-label="Editor benefits">
            <li><span>✓</span> No installation</li>
            <li><span>✓</span> Real-time sync</li>
            <li><span>✓</span> Multi-language</li>
            <li><span>✓</span> Shareable rooms</li>
          </ul>
        </div>

        <div className="editor-preview" aria-label="Preview of the collaborative code editor">
          <div className="preview-glow" aria-hidden="true" />
          <div className="preview-window">
            <div className="preview-topbar">
              <div className="preview-dots" aria-hidden="true"><i /><i /><i /></div>
              <span className="preview-logo">CRDT</span>
              <span className="preview-room">room · shared</span>
              <span className="preview-language">JavaScript · Node.js</span>
              <span className="preview-run">Editor preview</span>
              <span className="preview-avatars" aria-label="Three anonymous collaborators"><i>A</i><i>B</i><i>C</i></span>
            </div>
            <div className="preview-content">
              <aside className="preview-users">
                <b>Collaborators</b>
                <span><i className="preview-online" /> Guest 7F2A</span>
                <span><i className="preview-online" /> Guest 91BC</span>
                <span><i className="preview-online" /> Guest D034</span>
              </aside>
              <div className="preview-editor">
                <div className="preview-file">● &nbsp;main.js</div>
                <pre aria-hidden="true"><code><span className="preview-comment">// Write code together</span>{'\n'}<span className="preview-keyword">const</span> greet = (name) =&gt; {'{'}{'\n'}  console.log(<span className="preview-string">`Hello, ${'{'}name{'}'}!`</span>);{'\n'}{'}'};{'\n\n'}greet(<span className="preview-string">"world"</span>);</code></pre>
              </div>
            </div>
            <div className="preview-terminal">
              <span>SAMPLE OUTPUT</span>
              <code>Hello, world!</code>
              <span className="preview-terminal-status">Preview · not executed</span>
            </div>
          </div>
        </div>
      </section>

      <section className="home-features home-section" id="features" aria-labelledby="features-title">
        <div className="home-section-heading">
          <p className="home-eyebrow">BUILT FOR YOUR WORKFLOW</p>
          <h2 id="features-title">Everything you need to <span>build together</span></h2>
          <p>From the first shared keystroke to a working program, all in one place.</p>
        </div>
        <div className="feature-grid">
          {features.map(feature => (
            <a className="feature-card" href={feature.href} key={feature.title}>
              <span className="feature-icon" aria-hidden="true">{feature.icon}</span>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
              <span className="feature-action">{feature.action} <b aria-hidden="true">→</b></span>
            </a>
          ))}
        </div>
      </section>

      <section className="home-how home-section" id="how-it-works" aria-labelledby="how-title">
        <div className="home-section-heading">
          <p className="home-eyebrow">SIMPLE BY DESIGN</p>
          <h2 id="how-title">From idea to <span>working code</span></h2>
          <p>No setup ceremony. Open a room, invite your team, and get to work.</p>
        </div>
        <div className="steps-grid">
          <article className="step-card"><span>01</span><h3>Create a room</h3><p>Start a fresh UUID room in one click. Your editor opens at its shareable room URL.</p></article>
          <article className="step-card"><span>02</span><h3>Code together</h3><p>Share the room link. Teammates join the same Yjs-powered editor and see changes in real time.</p></article>
          <article className="step-card"><span>03</span><h3>Run your code</h3><p>Choose Java, C++, Python, or JavaScript. Provide stdin and run in OnlineCompiler’s isolated environment.</p></article>
        </div>
      </section>

      <section className="home-languages home-section" id="languages" aria-labelledby="languages-title">
        <div className="language-copy">
          <p className="home-eyebrow">ONE WORKSPACE, FOUR LANGUAGES</p>
          <h2 id="languages-title">Your ideas speak<br /><span>every language.</span></h2>
          <p>Write in the language that fits the problem. Select a runtime in the editor, add standard input, and see the actual execution result.</p>
          <button className="home-text-link" type="button" onClick={onStart}>Try the editor <span aria-hidden="true">→</span></button>
        </div>
        <div className="language-list" aria-label="Supported programming languages">
          <span><i className="language-java">J</i> Java <small>OpenJDK</small></span>
          <span><i className="language-cpp">C+</i> C++ <small>GCC</small></span>
          <span><i className="language-python">Py</i> Python <small>Python 3</small></span>
          <span><i className="language-js">JS</i> JavaScript <small>Node.js</small></span>
        </div>
      </section>

      <section className="home-use-cases home-section" id="use-cases" aria-labelledby="use-cases-title">
        <div className="home-section-heading">
          <p className="home-eyebrow">MADE FOR SHARED THINKING</p>
          <h2 id="use-cases-title">A better place to <span>work through code</span></h2>
        </div>
        <div className="use-case-grid">
          <article><span aria-hidden="true">⌘</span><h3>Pair programming</h3><p>Explore an idea side by side in one shared editor.</p></article>
          <article><span aria-hidden="true">◈</span><h3>Learning together</h3><p>Share a room to explain, experiment, and practice code together.</p></article>
          <article><span aria-hidden="true">⚡</span><h3>Quick code reviews</h3><p>Open a room and reproduce a small example before discussing a fix.</p></article>
        </div>
      </section>

      <section className="home-final-cta">
        <p className="home-eyebrow">YOUR NEXT GREAT IDEA STARTS HERE</p>
        <h2>Ready to build <span>together?</span></h2>
        <p>Create a room, share the link, and let the collaboration begin.</p>
        <button className="home-primary-button" type="button" onClick={onStart}>Start Coding Now <span aria-hidden="true">→</span></button>
      </section>

      <footer className="home-footer">
        <a className="home-brand" href="/" aria-label="CRDT home"><span className="home-brand-mark" aria-hidden="true">C</span><span>CRDT</span></a>
        <p>Built for developers who build together.</p>
        <a href={githubUrl} target="_blank" rel="noreferrer">GitHub <span aria-hidden="true">↗</span></a>
      </footer>
    </main>
  )
}

export default HomePage
