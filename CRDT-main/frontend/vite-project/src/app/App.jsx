import './App.css'
import { Editor } from '@monaco-editor/react'
import { MonacoBinding } from "y-monaco"
import { useRef, useMemo, useState, useEffect } from 'react'
import * as Y from 'yjs'
import { SocketIOProvider } from "y-socket.io"
import HomePage from './HomePage'

const languages = [
  { key: 'java', label: 'Java', monacoLanguage: 'java' },
  { key: 'cpp', label: 'C++', monacoLanguage: 'cpp' },
  { key: 'python', label: 'Python', monacoLanguage: 'python' },
  { key: 'javascript', label: 'JavaScript (Node.js)', monacoLanguage: 'javascript' },
]
const BACKEND_URL = (
  (import.meta.env.DEV
    ? import.meta.env.VITE_BACKEND_URL_DEV || `${window.location.protocol}//${window.location.hostname}:3000`
    : import.meta.env.VITE_BACKEND_URL || 'https://crdt-main.onrender.com')
).replace(/\/+$/, '')

function getParticipantId() {
  const storageKey = 'crdt-participant-id'
  try {
    const existingId = window.localStorage.getItem(storageKey)
    if (existingId) return existingId
  } catch {
    return window.crypto.randomUUID()
  }

  const participantId = window.crypto.randomUUID()
  try {
    window.localStorage.setItem(storageKey, participantId)
  } catch {
    return participantId
  }
  return participantId
}

function createGuestProfile() {
  const participantId = getParticipantId()
  let displayName = `Guest ${participantId.slice(0, 4).toUpperCase()}`
  try {
    const storedName = window.localStorage.getItem('crdt-guest-name')
    if (storedName?.trim() && storedName.trim().length <= 24 && !hasControlCharacters(storedName)) {
      displayName = storedName.trim()
    }
  } catch {
    return { participantId, displayName }
  }
  return { participantId, displayName }
}

function getParticipantColor(participantId) {
  let hash = 2166136261
  for (const character of participantId) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  const value = hash >>> 0
  const hue = value % 360
  const saturation = 67 + ((value >>> 9) % 21)
  const lightness = 60 + ((value >>> 17) % 19)
  return `hsl(${hue} ${saturation}% ${lightness}%)`
}

function getAwarenessColor(color, participantId) {
  return /^hsl\(\d{1,3} (?:6[7-9]|7\d|8[0-7])% (?:6\d|7\d)%\)$/.test(color)
    ? color
    : getParticipantColor(participantId)
}

function hasControlCharacters(value) {
  return Array.from(value).some(character => {
    const code = character.charCodeAt(0)
    return code <= 31 || code === 127
  })
}

function getInitials(name) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length > 1) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return (parts[0] || 'G').slice(0, 2).toUpperCase()
}

const ROOM_PATH_PATTERN = /^\/room\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/?$/i

function getRoomIdFromPath(pathname) {
  return pathname.match(ROOM_PATH_PATTERN)?.[1] || ''
}

function App() {
  const [roomId, setRoomId] = useState(() => getRoomIdFromPath(window.location.pathname))
  const [invalidRoomPath, setInvalidRoomPath] = useState(() => (
    window.location.pathname !== '/' && !getRoomIdFromPath(window.location.pathname)
  ))

  useEffect(() => {
    const updateRoute = () => {
      const nextRoomId = getRoomIdFromPath(window.location.pathname)
      setRoomId(nextRoomId)
      setInvalidRoomPath(window.location.pathname !== '/' && !nextRoomId)
    }
    window.addEventListener('popstate', updateRoute)
    return () => window.removeEventListener('popstate', updateRoute)
  }, [])

  const startRoom = () => {
    const newRoomId = window.crypto.randomUUID()
    window.history.pushState({}, '', `/room/${newRoomId}`)
    setInvalidRoomPath(false)
    setRoomId(newRoomId)
  }

  const goHome = () => {
    window.history.pushState({}, '', '/')
    setRoomId('')
    setInvalidRoomPath(false)
  }

  if (invalidRoomPath) {
    return (
      <main className="invalid-room-page">
        <section>
          <p className="home-eyebrow">ROOM NOT FOUND</p>
          <h1>This room link is invalid.</h1>
          <p>Room links use a valid UUID. Start a new room to invite your team.</p>
          <button className="home-primary-button" type="button" onClick={goHome}>Back to home</button>
        </section>
      </main>
    )
  }

  if (!roomId) return <HomePage onStart={startRoom} />
  return <EditorRoom key={roomId} roomId={roomId} onHome={goHome} />
}

function EditorRoom({ roomId, onHome }) {

  const editorRef = useRef(null)
  const providerRef = useRef(null)
  const bindingRef = useRef(null)
  const executionLockRef = useRef(false)
  const hasConnectedRef = useRef(false)
  const profile = useMemo(createGuestProfile, [])
  const participantId = profile.participantId
  const participantColor = useMemo(() => getParticipantColor(participantId), [participantId])
  const displayNameRef = useRef(profile.displayName)
  const cursorStylesRef = useRef(null)
  const toastTimerRef = useRef(null)
  const [editorReady, setEditorReady] = useState(false)
  const [displayName, setDisplayName] = useState(profile.displayName)

  const [users, setUsers] = useState([])
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameValue, setRenameValue] = useState(profile.displayName)
  const [renameError, setRenameError] = useState('')
  const [renameToast, setRenameToast] = useState('')
  const [roomLinkCopied, setRoomLinkCopied] = useState(false)
  const [roomLinkCopyError, setRoomLinkCopyError] = useState('')
  const [connectionStatus, setConnectionStatus] = useState('connecting')
  const [connectionError, setConnectionError] = useState('')
  const [languageKey, setLanguageKey] = useState('javascript')
  const [stdin, setStdin] = useState('')
  const [execution, setExecution] = useState(null)
  const [executionError, setExecutionError] = useState('')
  const [isRunning, setIsRunning] = useState(false)
  const selectedLanguage = languages.find(language => language.key === languageKey)

  const ydoc = useMemo(() => new Y.Doc(), [])
  const yText = useMemo(() => ydoc.getText("monaco"), [ydoc])
  const onlineUsers = connectionStatus === 'connected' ? users : []
  const currentUser = { participantId, username: displayName, color: participantColor }

  useEffect(() => {
    displayNameRef.current = displayName
    if (connectionStatus === 'connected') {
      providerRef.current?.awareness.setLocalStateField('user', {
        participantId,
        username: displayName,
        color: participantColor,
      })
    }
  }, [connectionStatus, displayName, participantColor, participantId])

  useEffect(() => {
    const syncStoredName = event => {
      if (event.key !== 'crdt-guest-name' || !event.newValue) return
      const nextName = event.newValue.trim()
      if (!nextName || nextName.length > 24 || hasControlCharacters(nextName)) return
      setDisplayName(nextName)
    }
    window.addEventListener('storage', syncStoredName)
    return () => window.removeEventListener('storage', syncStoredName)
  }, [])

  useEffect(() => {
    const url = new URL(window.location.href)
    if (url.searchParams.has('username') || url.searchParams.has('email')) {
      url.searchParams.delete('username')
      url.searchParams.delete('email')
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
    }
  }, [])

  const handleMount = (editor) => {
    editorRef.current = editor
    setEditorReady(true)
  }

  const handleRun = async () => {
    if (executionLockRef.current || !editorRef.current || !selectedLanguage) return

    executionLockRef.current = true
    setIsRunning(true)
    setExecution(null)
    setExecutionError('')
    try {
      const response = await fetch(`${BACKEND_URL}/api/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceCode: editorRef.current.getValue(),
          language: selectedLanguage.key,
          stdin,
        }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Code execution failed.')
      setExecution(body)
    } catch (error) {
      setExecutionError(error.message || 'Code execution failed.')
    } finally {
      executionLockRef.current = false
      setIsRunning(false)
    }
  }

  const handleRetryConnection = () => {
    const provider = providerRef.current
    if (!provider || provider.socket.connected) return

    setConnectionStatus(hasConnectedRef.current ? 'reconnecting' : 'connecting')
    setConnectionError('')
    provider.connect()
  }

  const openRename = () => {
    setRenameValue(displayName)
    setRenameError('')
    setProfileMenuOpen(false)
    setRenameOpen(true)
  }

  const saveDisplayName = (event) => {
    event?.preventDefault()
    const nextName = renameValue.trim()
    if (!nextName) {
      setRenameError('Enter a display name.')
      return
    }
    if (nextName.length > 24) {
      setRenameError('Display names must be 24 characters or fewer.')
      return
    }
    if (hasControlCharacters(nextName)) {
      setRenameError('Display names cannot contain control characters.')
      return
    }

    let savedToStorage = true
    try {
      window.localStorage.setItem('crdt-guest-name', nextName)
    } catch {
      savedToStorage = false
    }
    setDisplayName(nextName)
    setRenameOpen(false)
    setRenameError('')
    setRenameToast(savedToStorage ? `You are now ${nextName}` : `You are now ${nextName}. Name saved for this session only.`)
    window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => setRenameToast(''), 2600)
  }

  const cancelRename = () => {
    setRenameOpen(false)
    setRenameError('')
    setRenameValue(displayName)
  }

  useEffect(() => {
    if (!renameOpen) return undefined
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setRenameOpen(false)
        setRenameError('')
        setRenameValue(displayName)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [renameOpen, displayName])

  useEffect(() => () => window.clearTimeout(toastTimerRef.current), [])

  const handleCopyRoomLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setRoomLinkCopyError('')
      setRoomLinkCopied(true)
      window.setTimeout(() => setRoomLinkCopied(false), 2_000)
    } catch {
      setRoomLinkCopyError('Clipboard unavailable. Copy the URL from your address bar.')
    }
  }

  useEffect(() => {
    if (!editorReady || !editorRef.current) return

    let reconnectFailed = false
    const provider = new SocketIOProvider(
      BACKEND_URL,
      roomId,
      ydoc,
      { autoConnect: false },
      {
        transports: ['websocket'],
        reconnectionAttempts: 5,
        reconnectionDelay: 1_000,
        reconnectionDelayMax: 5_000,
      }
    )
    const editor = editorRef.current

    providerRef.current = provider
    const cursorStyles = document.createElement('style')
    cursorStyles.dataset.roomCursorStyles = roomId
    document.head.appendChild(cursorStyles)
    cursorStylesRef.current = cursorStyles
    bindingRef.current = new MonacoBinding(
      yText,
      editor.getModel(),
      new Set([editor]),
      provider.awareness
    )

    const updateUsers = () => {
      const states = Array.from(provider.awareness.getStates().values())
      const collaborators = Array.from(
        new Map(
          states
            .map(state => state.user)
            .filter(user => (
              typeof user?.participantId === 'string' &&
              user.participantId &&
              typeof user.username === 'string' &&
              user.username
            ))
            .map(user => [user.participantId, {
              participantId: user.participantId,
              username: user.username,
              color: getAwarenessColor(user.color, user.participantId),
            }])
        ).values()
      )
      setUsers(collaborators)

      cursorStyles.textContent = Array.from(provider.awareness.getStates().entries())
        .filter(([, state]) => (
          typeof state.user?.participantId === 'string' &&
          state.user.participantId &&
          typeof state.user.username === 'string' &&
          state.user.username
        ))
        .map(([clientId, state]) => {
          const user = state.user
          const color = getAwarenessColor(user.color, user.participantId)
          const safeName = JSON.stringify(String(user.username).slice(0, 24))
          return `
            .monaco-editor .yRemoteSelection-${clientId} { background-color: color-mix(in srgb, ${color} 24%, transparent); }
            .monaco-editor .yRemoteSelectionHead-${clientId} {
              position: relative;
              border-left: 2px solid ${color};
              border-right: 2px solid ${color};
              box-sizing: border-box;
            }
            .monaco-editor .yRemoteSelectionHead-${clientId}::after {
              position: absolute;
              z-index: 20;
              top: -1.4rem;
              left: -2px;
              max-width: 12rem;
              overflow: hidden;
              border-radius: 0.25rem;
              background: ${color};
              padding: 0.12rem 0.35rem;
              color: #07111f;
              content: ${safeName};
              font: 600 0.68rem/1.2 system-ui, sans-serif;
              text-overflow: ellipsis;
              white-space: nowrap;
              pointer-events: none;
            }`
        })
        .join('\n')
    }

    const syncAwareness = () => {
      provider.awareness.setLocalStateField('user', {
        participantId,
        username: displayNameRef.current,
        color: participantColor,
      })
      updateUsers()
    }
    const handleStatus = ({ status }) => {
      if (status === 'connected') {
        hasConnectedRef.current = true
        reconnectFailed = false
        setConnectionStatus('connected')
        setConnectionError('')
      } else if (status === 'connecting') {
        setConnectionStatus(hasConnectedRef.current ? 'reconnecting' : 'connecting')
      } else {
        setConnectionStatus(hasConnectedRef.current ? 'reconnecting' : 'connecting')
      }
    }
    const handleConnectionError = (error) => {
      setConnectionError(error?.message || 'The collaboration server could not be reached.')
    }
    const handleReconnectAttempt = () => {
      if (!reconnectFailed) {
        setConnectionStatus(hasConnectedRef.current ? 'reconnecting' : 'connecting')
      }
    }
    const handleReconnect = () => {
      reconnectFailed = false
      setConnectionError('')
    }
    const handleReconnectError = (error) => {
      setConnectionError(error?.message || 'The collaboration server could not be reached.')
    }
    const handleReconnectFailed = () => {
      reconnectFailed = true
      setConnectionStatus('disconnected')
      setConnectionError('The collaboration server could not be reached after several attempts.')
    }
    const handleSocketConnect = () => {
      hasConnectedRef.current = true
      reconnectFailed = false
      setConnectionStatus('connected')
      setConnectionError('')
      syncAwareness()
    }
    const handleSocketDisconnect = (reason) => {
      if (reason === 'io server disconnect') {
        setConnectionStatus('disconnected')
        setConnectionError('The server closed the connection. Retry to reconnect.')
      } else {
        setConnectionStatus('reconnecting')
        setConnectionError('')
      }
    }

    provider.awareness.on("change", updateUsers)
    provider.on("sync", syncAwareness)
    provider.on("status", handleStatus)
    provider.on("connection-error", handleConnectionError)
    provider.on("connection-close", handleSocketDisconnect)
    provider.socket.on('connect', handleSocketConnect)
    provider.socket.on('disconnect', handleSocketDisconnect)
    provider.socket.io.on('reconnect_attempt', handleReconnectAttempt)
    provider.socket.io.on('reconnect', handleReconnect)
    provider.socket.io.on('reconnect_error', handleReconnectError)
    provider.socket.io.on('reconnect_failed', handleReconnectFailed)
    syncAwareness()
    provider.connect()

    const handleBeforeUnload = () => {
      provider.awareness.setLocalStateField('user', null)
    }

    window.addEventListener("beforeunload", handleBeforeUnload)

    return () => {
      provider.awareness.off("change", updateUsers)
      provider.off("sync", syncAwareness)
      provider.off("status", handleStatus)
      provider.off("connection-error", handleConnectionError)
      provider.off("connection-close", handleSocketDisconnect)
      provider.socket.off('connect', handleSocketConnect)
      provider.socket.off('disconnect', handleSocketDisconnect)
      provider.socket.io.off('reconnect_attempt', handleReconnectAttempt)
      provider.socket.io.off('reconnect', handleReconnect)
      provider.socket.io.off('reconnect_error', handleReconnectError)
      provider.socket.io.off('reconnect_failed', handleReconnectFailed)
      provider.awareness.setLocalStateField('user', null)
      cursorStyles.remove()
      cursorStylesRef.current = null
      bindingRef.current?.destroy()
      bindingRef.current = null
      provider.disconnect()
      provider.destroy()
      providerRef.current = null
      hasConnectedRef.current = false
      setConnectionStatus('disconnected')
      setConnectionError('')
      setUsers([])
      window.removeEventListener("beforeunload", handleBeforeUnload)
    }

  }, [editorReady, participantColor, participantId, roomId, ydoc, yText])

  useEffect(() => {
    return () => {
      ydoc.destroy()
    }
  }, [ydoc])

  return (
    <main className="workspace-layout h-screen w-full bg-gray-900 flex gap-4 p-4">
      <aside className='users-sidebar h-full w-1/4 bg-amber-50 rounded-lg p-2'>
      <div className="editor-sidebar-heading">
        <button className="editor-home-link" type="button" onClick={onHome} aria-label="Return to homepage">CRDT</button>
        <h2 className="text-2xl font-bold mb-4">Users</h2>
      </div>
      <div className="room-share-card">
        <span>Room link</span>
        <button type="button" onClick={handleCopyRoomLink}>
          {roomLinkCopied ? 'Link copied' : 'Copy invite link'}
        </button>
        {roomLinkCopyError && <small role="status">{roomLinkCopyError}</small>}
      </div>
      <section
        className={`collaboration-status-card status-${connectionStatus}`}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <div className="collaboration-status-heading">
          <span className={`collaboration-status-icon ${connectionStatus === 'connecting' || connectionStatus === 'reconnecting' ? 'is-spinning' : ''}`} aria-hidden="true">
            {connectionStatus === 'connected' ? (
              <span className="connected-dot" />
            ) : connectionStatus === 'disconnected' ? (
              <svg viewBox="0 0 20 20" fill="none">
                <path d="M10 2.5 18 17H2L10 2.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                <path d="M10 7v4.5m0 2.5h.01" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
            ) : (
              <span className="connection-spinner" />
            )}
          </span>
          <span className="collaboration-status-label">
            {connectionStatus === 'connected'
              ? 'Team connected'
              : connectionStatus === 'reconnecting'
                ? 'Reconnecting to your team...'
                : connectionStatus === 'disconnected'
                  ? 'Unable to connect'
                  : 'Connecting to your team...'}
          </span>
          {connectionStatus === 'disconnected' && (
            <button
              className="connection-retry-button"
              type="button"
              onClick={handleRetryConnection}
              disabled={!providerRef.current}
            >
              Retry
            </button>
          )}
        </div>
        {connectionStatus !== 'connected' && connectionStatus !== 'disconnected' && (
          <p className="collaboration-status-detail">Your shared workspace will appear when the connection is ready.</p>
        )}
        {connectionStatus === 'disconnected' && (
          <p className="collaboration-status-detail">
            {connectionError || 'Check your internet connection, then try again.'}
          </p>
        )}
      </section>

      <section className="sidebar-collaborators" aria-label="Online collaborators">
        <div className="sidebar-collaborators-heading">
          <h3>In this room</h3>
          <span>{onlineUsers.length} online</span>
        </div>
        {onlineUsers.length ? (
          <ul className="collaborator-list">
            {onlineUsers.map(user => (
              <li className="collaborator-list-item" key={user.participantId}>
                <span className="collaborator-avatar" style={{ '--collaborator-color': user.color }} aria-hidden="true">
                  {getInitials(user.username)}
                </span>
                <span className="collaborator-name">{user.username}</span>
                {user.participantId === participantId && <span className="you-label">you</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="collaborator-empty">Collaborators appear when connected.</p>
        )}
      </section>
      </aside>

      <section className='compiler-section w-3/4 bg-neutral-800 rounded-lg overflow-hidden'>
        <div className="compiler-toolbar">
          <div className="toolbar-presence" aria-label="Room presence">
            <div className="toolbar-online" aria-label={`${onlineUsers.length} collaborators online`}>
              <div className="toolbar-avatars">
                {onlineUsers.slice(0, 4).map(user => (
                  <span
                    className="toolbar-avatar"
                    key={user.participantId}
                    style={{ '--collaborator-color': user.color }}
                    title={user.username}
                    aria-label={user.username}
                  >
                    {getInitials(user.username)}
                  </span>
                ))}
                {onlineUsers.length > 4 && <span className="toolbar-avatar toolbar-avatar-overflow">+{onlineUsers.length - 4}</span>}
              </div>
              <span className="toolbar-online-count">
                <span className={`toolbar-online-dot ${connectionStatus === 'connected' ? 'is-online' : ''}`} aria-hidden="true" />
                {onlineUsers.length} online
              </span>
            </div>
            <div className="profile-menu-wrap" onKeyDown={event => {
              if (event.key === 'Escape') setProfileMenuOpen(false)
            }}>
              <button
                className="profile-menu-trigger"
                type="button"
                aria-haspopup="menu"
                aria-expanded={profileMenuOpen}
                onClick={() => setProfileMenuOpen(open => !open)}
              >
                <span className="toolbar-avatar current-user-avatar" style={{ '--collaborator-color': currentUser.color }} aria-hidden="true">
                  {getInitials(currentUser.username)}
                </span>
                <span className="current-user-name">{currentUser.username}</span>
                <span className="profile-menu-chevron" aria-hidden="true">▾</span>
              </button>
              {profileMenuOpen && (
                <div className="profile-menu" role="menu" aria-label="Guest profile">
                  <button type="button" role="menuitem" onClick={openRename}>Rename</button>
                </div>
              )}
            </div>
          </div>
          <label className="language-control">
            Language
            <select
              value={languageKey}
              onChange={event => setLanguageKey(event.target.value)}
              disabled={isRunning}
            >
              {languages.map(language => (
                <option key={language.key} value={language.key}>{language.label}</option>
              ))}
            </select>
          </label>
          <button
            className="run-button"
            type="button"
            onClick={handleRun}
            disabled={!selectedLanguage || isRunning || !editorReady}
          >
            {isRunning ? 'Running...' : 'Run'}
          </button>
        </div>
        <div className="editor-pane">
          <Editor
            height="100%"
            language={selectedLanguage?.monacoLanguage || 'javascript'}
            defaultValue='//some content'
            theme='vs-dark'
            onMount={handleMount}
          />
        </div>
        <div className="execution-panel">
          <label className="stdin-control">
            Custom input (stdin)
            <textarea
              value={stdin}
              onChange={event => setStdin(event.target.value)}
              placeholder="Enter input passed to your program"
              rows={3}
              maxLength={100_000}
              disabled={isRunning}
            />
          </label>
          <section className="output-terminal" aria-live="polite" aria-busy={isRunning}>
            <div className="terminal-heading">
              <h2>Output</h2>
              {isRunning && <span>Executing code...</span>}
              {execution && (
                <div className={`execution-metrics ${execution.status === 'success' ? '' : 'execution-failed'}`}>
                  <span>{execution.status === 'success' ? 'Completed' : `Exited (${execution.exitCode ?? 'unknown'})`}</span>
                  {execution.time !== null && <span>{execution.time}s</span>}
                  {execution.total !== null && <span>Total {execution.total}s</span>}
                  {execution.memory !== null && <span>{execution.memory} KB</span>}
                </div>
              )}
            </div>
            {executionError && <p className="compiler-error" role="alert">{executionError}</p>}
            {execution && (
              <div className="terminal-content">
                <div>
                  <h3>Standard output</h3>
                  <pre>{execution.output || '(no output)'}</pre>
                </div>
                {execution.error && (
                  <div className="terminal-error">
                    <h3>Compilation / runtime errors</h3>
                    <pre>{execution.error}</pre>
                  </div>
                )}
                {execution.exitCode !== null && execution.exitCode !== 0 && (
                  <p className="terminal-error">Exit code: {execution.exitCode}{execution.signal !== null ? ` (signal ${execution.signal})` : ''}</p>
                )}
                {execution.truncated && <p className="terminal-error">Output was truncated by OnlineCompiler.</p>}
              </div>
            )}
          </section>
        </div>
      </section>
      {renameOpen && (
        <div className="rename-modal-backdrop">
          <section className="rename-modal" role="dialog" aria-modal="true" aria-labelledby="rename-title">
            <p className="rename-modal-eyebrow">GUEST PROFILE</p>
            <h2 id="rename-title">Choose a display name</h2>
            <p className="rename-modal-description">This name is visible to people in this room. Your guest ID stays private.</p>
            <form onSubmit={saveDisplayName}>
              <label htmlFor="guest-display-name">Display name</label>
              <input
                id="guest-display-name"
                autoFocus
                autoComplete="off"
                maxLength={24}
                value={renameValue}
                onChange={event => {
                  setRenameValue(event.target.value)
                  setRenameError('')
                }}
                aria-invalid={Boolean(renameError)}
                aria-describedby={renameError ? 'rename-error' : 'rename-hint'}
              />
              {renameError ? (
                <p className="rename-error" id="rename-error" role="alert">{renameError}</p>
              ) : (
                <p className="rename-hint" id="rename-hint">{renameValue.trim().length}/24 characters · Enter to save · Escape to cancel</p>
              )}
              <div className="rename-modal-actions">
                <button className="rename-cancel-button" type="button" onClick={cancelRename}>Cancel</button>
                <button className="rename-save-button" type="submit">Save</button>
              </div>
            </form>
          </section>
        </div>
      )}
      {renameToast && <div className="rename-toast" role="status" aria-live="polite">{renameToast}</div>}
    </main>
  )
}

export default App
