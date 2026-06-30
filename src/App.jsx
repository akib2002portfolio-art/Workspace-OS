import { useEffect, useMemo, useState } from 'react'
import './App.css'

const initialTasks = [
  { id: 1, title: 'Ship onboarding flow', done: true, priority: 'High', due: '2026-07-02' },
  { id: 2, title: 'Review design system tokens', done: false, priority: 'Medium', due: '2026-07-04' },
  { id: 3, title: 'Plan sprint retro notes', done: false, priority: 'Low', due: '2026-07-06' },
]

const initialNotes = [
  'Capture the week’s wins before the standup.',
  'Move the launch checklist into the shared board.',
]

const goals = [
  { label: 'Deep work blocks', value: '4/5' },
  { label: 'Wellness reset', value: '12 min' },
  { label: 'Focus score', value: '92%' },
]

const calendarDays = [
  { day: 'Mon', date: '14', active: true },
  { day: 'Tue', date: '15' },
  { day: 'Wed', date: '16' },
  { day: 'Thu', date: '17' },
  { day: 'Fri', date: '18' },
  { day: 'Sat', date: '19' },
  { day: 'Sun', date: '20' },
]

const weatherCodeMap = {
  0: 'Clear skies',
  1: 'Mostly clear',
  2: 'Partly cloudy',
  3: 'Cloudy',
  45: 'Foggy',
  48: 'Rime fog',
  51: 'Light drizzle',
  53: 'Drizzle',
  61: 'Rain',
  71: 'Snow',
  95: 'Thunderstorm',
}

function formatTime(seconds) {
  const mins = String(Math.floor(seconds / 60)).padStart(2, '0')
  const secs = String(seconds % 60).padStart(2, '0')
  return `${mins}:${secs}`
}

function App() {
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window === 'undefined') {
      return false
    }

    const stored = window.localStorage.getItem('workspace-dark')
    if (stored !== null) {
      return stored === 'true'
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })
  const [tasks, setTasks] = useState(() => {
    if (typeof window === 'undefined') {
      return initialTasks
    }

    const stored = window.localStorage.getItem('workspace-tasks')
    return stored ? JSON.parse(stored) : initialTasks
  })
  const [taskTitle, setTaskTitle] = useState('')
  const [taskPriority, setTaskPriority] = useState('Medium')
  const [taskDue, setTaskDue] = useState('')
  const [taskFilter, setTaskFilter] = useState('all')
  const [taskSearch, setTaskSearch] = useState('')
  const [notes, setNotes] = useState(initialNotes)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [weather, setWeather] = useState({ temp: 20, description: 'Clear skies', loading: true })
  const [pomodoro, setPomodoro] = useState({ isRunning: false, seconds: 25 * 60 })
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light'
    window.localStorage.setItem('workspace-dark', String(darkMode))
  }, [darkMode])

  useEffect(() => {
    window.localStorage.setItem('workspace-tasks', JSON.stringify(tasks))
  }, [tasks])

  useEffect(() => {
    const interval = window.setInterval(() => {
      setPomodoro((current) => {
        if (!current.isRunning) {
          return current
        }

        if (current.seconds <= 1) {
          return { ...current, isRunning: false, seconds: 25 * 60 }
        }

        return { ...current, seconds: current.seconds - 1 }
      })
    }, 1000)

    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    const fetchWeather = async () => {
      try {
        const response = await fetch(
          'https://api.open-meteo.com/v1/forecast?latitude=40.71&longitude=-74.01&current=temperature_2m,weathercode&timezone=auto',
          { signal: controller.signal },
        )
        const data = await response.json()

        setWeather({
          temp: Math.round(data.current.temperature_2m),
          description: weatherCodeMap[data.current.weathercode] ?? 'Clear skies',
          loading: false,
        })
      } catch {
        setWeather((current) => ({ ...current, loading: false, description: 'Cloudy' }))
      }
    }

    fetchWeather()

    return () => controller.abort()
  }, [])

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPaletteOpen(true)
      }

      if (event.key === 'Escape') {
        setPaletteOpen(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const commandItems = useMemo(() => {
    const items = [
      { label: 'Open Calendar', hint: 'Jump to schedule' },
      { label: 'Focus Session', hint: 'Start a deep work sprint' },
      { label: 'Review Goals', hint: 'See weekly targets' },
      { label: 'Toggle Theme', hint: 'Switch between light and dark' },
    ]

    return items.filter((item) =>
      item.label.toLowerCase().includes(query.toLowerCase()),
    )
  }, [query])

  const toggleTask = (id) => {
    setTasks((current) =>
      current.map((task) => (task.id === id ? { ...task, done: !task.done } : task)),
    )
  }

  const addTask = (event) => {
    event.preventDefault()
    if (!taskTitle.trim()) {
      return
    }

    const newTask = {
      id: Date.now(),
      title: taskTitle.trim(),
      done: false,
      priority: taskPriority,
      due: taskDue || null,
    }

    setTasks((current) => [newTask, ...current])
    setTaskTitle('')
    setTaskPriority('Medium')
    setTaskDue('')
  }

  const deleteTask = (id) => {
    setTasks((current) => current.filter((task) => task.id !== id))
  }

  const completeCount = tasks.filter((task) => task.done).length
  const overdueCount = tasks.filter((task) => task.due && !task.done && new Date(task.due) < new Date()).length

  const filteredTasks = useMemo(() => {
    const filtered = tasks.filter((task) => {
      if (taskFilter === 'active') return !task.done
      if (taskFilter === 'completed') return task.done
      return true
    })

    return filtered
      .filter((task) => task.title.toLowerCase().includes(taskSearch.toLowerCase()))
      .sort((a, b) => {
        const priorityRank = { High: 1, Medium: 2, Low: 3 }
        if (a.done !== b.done) return a.done ? 1 : -1
        if (a.priority !== b.priority) return priorityRank[a.priority] - priorityRank[b.priority]
        if (a.due && b.due) return new Date(a.due) - new Date(b.due)
        if (a.due) return -1
        if (b.due) return 1
        return 0
      })
  }, [tasks, taskFilter, taskSearch])

  if (!isLoggedIn) {
    return (
      <div className="app-shell login-screen">
        <div className="login-card">
          <p className="eyebrow">Workspace OS</p>
          <h1>Welcome back</h1>
          <p className="login-text">Sign in to open your focused workspace dashboard.</p>

          <form
            className="login-form"
            onSubmit={(event) => {
              event.preventDefault()
              setIsLoggedIn(true)
            }}
          >
            <label>
              Email
              <input type="email" placeholder="you@example.com" defaultValue="maya@studio.com" />
            </label>
            <label>
              Password
              <input type="password" placeholder="••••••••" defaultValue="demo123" />
            </label>
            <button type="submit" className="primary-btn login-btn">
              Enter workspace
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <div className="brand-badge" aria-label="Workspace OS logo">
            <svg viewBox="0 0 128 128" aria-hidden="true">
              <defs>
                <linearGradient id="logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#7c5cff" />
                  <stop offset="100%" stopColor="#4cc9f0" />
                </linearGradient>
              </defs>
              <rect x="0" y="0" width="128" height="128" rx="32" fill="url(#logo-grad)" />
              <circle cx="64" cy="64" r="34" fill="rgba(255,255,255,0.16)" />
              <path d="M52 42h24l-28 44h24" fill="none" stroke="#fff" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M44 86h40" fill="none" stroke="#fff" strokeWidth="12" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <p className="eyebrow">Workspace OS</p>
            <h2>Workspace OS</h2>
          </div>
        </div>
        <div className="topbar-actions">
          <button type="button" className="ghost-btn" onClick={() => setPaletteOpen(true)}>
            ⌘K
          </button>
          <button type="button" className="ghost-btn" onClick={() => setDarkMode((value) => !value)}>
            {darkMode ? '☀️' : '🌙'}
          </button>
        </div>
      </header>

      <main className="dashboard">
        <section className="hero-panel">
          <div className="hero-copy">
            <p className="eyebrow">Monday • 6:30 PM</p>
            <h1>Welcome back, Maya.</h1>
            <p className="hero-text">
              You have a calm, balanced day ahead with 3 focus blocks left and a healthy pace.
            </p>
            <div className="hero-actions">
              <button type="button" className="primary-btn">
                New note
              </button>
              <button type="button" className="secondary-btn">
                Review goals
              </button>
            </div>
          </div>

          <div className="hero-side">
            <article className="card weather-card">
              <div>
                <p className="eyebrow">Weather</p>
                <h3>{weather.loading ? 'Loading...' : `${weather.temp}°C`}</h3>
                <p>{weather.description}</p>
              </div>
              <span className="weather-icon">☁️</span>
            </article>

            <article className="card timer-card">
              <div className="timer-head">
                <p className="eyebrow">Pomodoro</p>
                <span className="pill">{pomodoro.isRunning ? 'Running' : 'Ready'}</span>
              </div>
              <h3>{formatTime(pomodoro.seconds)}</h3>
              <div className="timer-actions">
                <button type="button" className="primary-btn" onClick={() => setPomodoro((current) => ({ ...current, isRunning: !current.isRunning }))}>
                  {pomodoro.isRunning ? 'Pause' : 'Start'}
                </button>
                <button type="button" className="secondary-btn" onClick={() => setPomodoro({ isRunning: false, seconds: 25 * 60 })}>
                  Reset
                </button>
              </div>
            </article>
          </div>
        </section>

        <section className="grid">
          <article className="card calendar-card">
            <div className="card-title-row">
              <h3>Calendar</h3>
              <span className="mini-pill">4 events</span>
            </div>
            <div className="days-row">
              {calendarDays.map((entry) => (
                <div key={entry.day} className={`day-pill ${entry.active ? 'active' : ''}`}>
                  <span>{entry.day}</span>
                  <strong>{entry.date}</strong>
                </div>
              ))}
            </div>
          </article>

          <article className="card tasks-card">
            <div className="card-title-row">
              <div>
                <h3>Today’s tasks</h3>
                <p className="task-summary">{completeCount}/{tasks.length} done • {overdueCount} overdue</p>
              </div>
              <span className="mini-pill">Task list</span>
            </div>

            <form className="task-form" onSubmit={addTask}>
              <input
                type="text"
                placeholder="Add a new task"
                value={taskTitle}
                onChange={(event) => setTaskTitle(event.target.value)}
              />
              <div className="task-form-row">
                <select value={taskPriority} onChange={(event) => setTaskPriority(event.target.value)}>
                  <option>High</option>
                  <option>Medium</option>
                  <option>Low</option>
                </select>
                <input
                  type="date"
                  value={taskDue}
                  onChange={(event) => setTaskDue(event.target.value)}
                />
                <button type="submit" className="primary-btn">
                  Add
                </button>
              </div>
            </form>

            <div className="task-controls">
              <input
                type="search"
                placeholder="Search tasks"
                value={taskSearch}
                onChange={(event) => setTaskSearch(event.target.value)}
              />
              <div className="task-filters">
                {['all', 'active', 'completed'].map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    className={taskFilter === filter ? 'filter-btn active' : 'filter-btn'}
                    onClick={() => setTaskFilter(filter)}
                  >
                    {filter.charAt(0).toUpperCase() + filter.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <ul className="task-list">
              {filteredTasks.map((task) => (
                <li key={task.id} className={task.done ? 'task-item done' : 'task-item'}>
                  <label>
                    <input type="checkbox" checked={task.done} onChange={() => toggleTask(task.id)} />
                    <div>
                      <span className="task-title">{task.title}</span>
                      <span className="task-meta">
                        {task.priority} priority
                        {task.due ? ` • due ${task.due}` : ''}
                      </span>
                    </div>
                  </label>
                  <button type="button" className="delete-btn" onClick={() => deleteTask(task.id)}>
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          </article>

          <article className="card notes-card">
            <div className="card-title-row">
              <h3>Quick notes</h3>
              <span className="mini-pill">Fresh</span>
            </div>
            <ul className="note-list">
              {notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </article>

          <article className="card goals-card">
            <div className="card-title-row">
              <h3>Goals</h3>
              <span className="mini-pill">Weekly</span>
            </div>
            <div className="goals-list">
              {goals.map((goal) => (
                <div key={goal.label} className="goal-item">
                  <span>{goal.label}</span>
                  <strong>{goal.value}</strong>
                </div>
              ))}
            </div>
          </article>

          <article className="card chart-card">
            <div className="card-title-row">
              <h3>Productivity</h3>
              <span className="mini-pill">+18%</span>
            </div>
            <div className="chart-bars" aria-label="Productivity chart">
              {[64, 82, 76, 90, 88, 94].map((height, index) => (
                <div key={height} className="bar-column">
                  <div className="bar" style={{ height: `${height}%` }} />
                  <span>{['M', 'T', 'W', 'T', 'F', 'S'][index]}</span>
                </div>
              ))}
            </div>
          </article>
        </section>
      </main>

      {paletteOpen && (
        <div className="command-overlay" role="dialog" aria-modal="true">
          <div className="command-panel">
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Type a command"
            />
            <div className="command-list">
              {commandItems.map((item) => (
                <button key={item.label} type="button" className="command-item" onClick={() => setPaletteOpen(false)}>
                  <span>{item.label}</span>
                  <small>{item.hint}</small>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
