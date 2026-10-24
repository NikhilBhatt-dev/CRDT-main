import './App.css'
import { Editor } from '@monaco-editor/react'
import { MonacoBinding } from "y-monaco"
import { useRef, useMemo, useState, useEffect } from 'react'
import * as Y from 'yjs'
import { SocketIOProvider } from "y-socket.io"

const languages = [
  { key: 'java', label: 'Java', monacoLanguage: 'java' },
  { key: 'cpp', label: 'C++', monacoLanguage: 'cpp' },
  { key: 'python', label: 'Python', monacoLanguage: 'python' },
  { key: 'javascript', label: 'JavaScript (Node.js)', monacoLanguage: 'javascript' },
]
const BACKEND_URL = (
  import.meta.env.VITE_BACKEND_URL ||
  (import.meta.env.DEV
    ? `${window.location.protocol}//${window.location.hostname}:3000`
    : 'https://crdt-main.onrender.com')
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

function App() {

  const editorRef = useRef(null)
  const providerRef = useRef(null)
  const bindingRef = useRef(null)
  const executionLockRef = useRef(false)
  const hasConnectedRef = useRef(false)
  const participantId = useMemo(getParticipantId, [])
  const [editorReady, setEditorReady] = useState(false)
  const [username, setUsername] = useState('')

  const [users, setUsers] = useState([])
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

  const handleJoin = (e) => {
    e.preventDefault()
    const name = e.target.username.value.trim()
    if (!name) return

    setUsername(name)
    const url = new URL(window.location.href)
    url.searchParams.delete('username')
    url.searchParams.delete('email')
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
  }

  useEffect(() => {
    if (!username || !editorReady || !editorRef.current) return

    let reconnectFailed = false
    const provider = new SocketIOProvider(
      BACKEND_URL,
      'monaco',
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
    bindingRef.current = new MonacoBinding(
      yText,
      editor.getModel(),
      new Set([editor]),
      provider.awareness
    )

    const updateUsers = () => {
      const states = Array.from(provider.awareness.getStates().values())

      setUsers(
        Array.from(
          new Map(
            states
              .map(state => state.user)
              .filter(user => user?.participantId && user?.username)
              .map(user => [user.participantId, user])
          ).values()
        )
      )
    }

    const syncAwareness = () => {
      provider.awareness.setLocalStateField('user', { participantId, username })
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

  }, [editorReady, participantId, username, ydoc, yText])

  useEffect(() => {
    return () => {
      ydoc.destroy()
    }
  }, [ydoc])

  if (!username) {
    return (
      <main className="h-screen w-full bg-gray-900 flex items-center justify-center p-4">
        <form onSubmit={handleJoin} className='flex flex-col items-center gap-4 w-full max-w-sm'>
          <input
            type="text"
            placeholder='enter your name'
            className='w-full p-2 rounded-lg bg-gray-800 text-white'
            name='username'
          />
          <button className='w-full p-2 rounded-lg bg-amber-50 text-gray-950 font-bold'>
            join
          </button>
        </form>
      </main>
    )
  }

  return (
    <main className="workspace-layout h-screen w-full bg-gray-900 flex gap-4 p-4">
      <aside className='users-sidebar h-full w-1/4 bg-amber-50 rounded-lg p-2'>
      <h2 className="text-2xl font-bold mb-4">Users</h2>
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

      <ul className='p-4'>
        {users.map((u, i) => (
          <li key={i} className="bg-gray-800 text-white  p-2 rounded mb-2">
            {u.username}
          </li>
        ))}
        </ul>
      </aside>

      <section className='compiler-section w-3/4 bg-neutral-800 rounded-lg overflow-hidden'>
        <div className="compiler-toolbar">
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
    </main>
  )
}

export default App
