import { useEffect, useMemo, useState } from 'react'
import './App.css'

const initialTasks = [
  { id: 1, title: 'Ship onboarding flow', done: true, priority: 'High', due: '2026-07-02', recurrence: 'None' },
  { id: 2, title: 'Review design system tokens', done: false, priority: 'Medium', due: '2026-07-04', recurrence: 'Weekly' },
  { id: 3, title: 'Plan sprint retro notes', done: false, priority: 'Low', due: '2026-07-06', recurrence: 'Monthly' },
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

function getInitialProductivityData() {
  if (typeof window === 'undefined') {
    return [
      { label: 'Mon', score: 64 },
      { label: 'Tue', score: 72 },
      { label: 'Wed', score: 76 },
      { label: 'Thu', score: 82 },
      { label: 'Fri', score: 88 },
      { label: 'Sat', score: 90 },
    ]
  }

  const stored = window.localStorage.getItem('workspace-productivity')
  if (stored) {
    try {
      const parsed = JSON.parse(stored)
      if (Array.isArray(parsed)) {
        return parsed
      }
    } catch {
      // Ignore invalid stored data and fall back to defaults.
    }
  }

  return [
    { label: 'Mon', score: 64 },
    { label: 'Tue', score: 72 },
    { label: 'Wed', score: 76 },
    { label: 'Thu', score: 82 },
    { label: 'Fri', score: 88 },
    { label: 'Sat', score: 90 },
  ]
}

function calculateProductivityScore(tasks, overdueCount, isRunning) {
  const completed = tasks.filter((task) => task.done).length
  const total = Math.max(tasks.length, 1)
  const baseScore = Math.round((completed / total) * 70 + 20)
  const overduePenalty = Math.min(12, overdueCount * 3)
  const focusBoost = isRunning ? 8 : 0
  return Math.max(18, Math.min(100, baseScore + focusBoost - overduePenalty))
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
  const [taskRecurrence, setTaskRecurrence] = useState('None')
  const [taskFilter, setTaskFilter] = useState('all')
  const [taskSearch, setTaskSearch] = useState('')
  const [noteInput, setNoteInput] = useState('')
  const [notes, setNotes] = useState(initialNotes)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [weather, setWeather] = useState({ temp: 20, description: 'Clear skies', loading: true })
  const [pomodoro, setPomodoro] = useState({ isRunning: false, seconds: 25 * 60 })
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [activeNav, setActiveNav] = useState('overview')
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [productivityData, setProductivityData] = useState(getInitialProductivityData)
  const completeCount = tasks.filter((task) => task.done).length
  const overdueCount = tasks.filter((task) => task.due && !task.done && new Date(task.due) < new Date()).length

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
    const timer = window.setInterval(() => {
      setCurrentDate(new Date())
    }, 1000)

    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const nextScore = calculateProductivityScore(tasks, overdueCount, pomodoro.isRunning)
    const currentLabel = currentDate.toLocaleDateString('en', { weekday: 'short' })

    setProductivityData((current) => {
      const next = [...current]
      const latest = next[next.length - 1]
      const updated = {
        label: currentLabel,
        score: nextScore,
      }

      if (latest && latest.label === currentLabel) {
        next[next.length - 1] = updated
      } else {
        next.push(updated)
      }

      const trimmed = next.slice(-6)
      window.localStorage.setItem('workspace-productivity', JSON.stringify(trimmed))
      return trimmed
    })
  }, [tasks, overdueCount, pomodoro.isRunning, currentDate])

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

  const calendarDays = useMemo(() => {
    const start = new Date(currentDate)
    const day = start.getDay()
    const diff = day === 0 ? -6 : 1 - day
    start.setHours(0, 0, 0, 0)
    start.setDate(start.getDate() + diff)

    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(start)
      date.setDate(start.getDate() + index)
      const isToday = date.toDateString() === currentDate.toDateString()
      return {
        day: date.toLocaleDateString('en', { weekday: 'short' }),
        date: date.getDate().toString(),
        active: isToday,
      }
    })
  }, [currentDate])

  const taskStats = useMemo(() => {
    const total = tasks.length
    const completed = tasks.filter((task) => task.done).length
    const active = total - completed
    const overdue = tasks.filter(
      (task) => task.due && !task.done && new Date(task.due) < new Date(),
    ).length
    const highPriority = tasks.filter((task) => task.priority === 'High' && !task.done).length
    const recurring = tasks.filter((task) => task.recurrence && task.recurrence !== 'None').length
    const dueThisWeek = tasks.filter((task) => {
      if (!task.due) return false
      const dueDate = new Date(task.due)
      const today = new Date()
      const diff = (dueDate - today) / (1000 * 60 * 60 * 24)
      return diff >= 0 && diff <= 7
    }).length

    return { total, completed, active, overdue, highPriority, recurring, dueThisWeek }
  }, [tasks])

  const aiSuggestions = useMemo(() => {
    const suggestions = []
    if (taskStats.overdue > 0) {
      suggestions.push(`You have ${taskStats.overdue} overdue task${taskStats.overdue > 1 ? 's' : ''}. Focus on them first.`)
    }
    if (taskStats.highPriority > 0) {
      suggestions.push(`There are ${taskStats.highPriority} high-priority task${taskStats.highPriority > 1 ? 's' : ''}. Use a focused sprint.`)
    }
    if (taskStats.completed / Math.max(taskStats.total, 1) >= 0.75) {
      suggestions.push('Great momentum! Keep the streak going with a short break between tasks.')
    }
    if (taskStats.dueThisWeek > 0) {
      suggestions.push(`You have ${taskStats.dueThisWeek} task${taskStats.dueThisWeek > 1 ? 's' : ''} due this week.`)
    }
    if (weather.description.toLowerCase().includes('rain')) {
      suggestions.push('Rainy weather ahead — a cozy focus session will help you stay productive.')
    }
    if (!suggestions.length) {
      suggestions.push('No urgent tasks right now. Schedule your next energy block for creative work.')
    }
    return suggestions
  }, [taskStats, weather])

  const calculateNextDue = (due, recurrence) => {
    if (!due || recurrence === 'None') {
      return null
    }

    const next = new Date(due)
    switch (recurrence) {
      case 'Daily':
        next.setDate(next.getDate() + 1)
        break
      case 'Weekly':
        next.setDate(next.getDate() + 7)
        break
      case 'Monthly':
        next.setMonth(next.getMonth() + 1)
        break
      default:
        return null
    }

    return next.toISOString().split('T')[0]
  }

  const commandItems = useMemo(() => {
    const items = [
      { label: 'Open Calendar', hint: 'Jump to schedule', action: 'calendar' },
      { label: 'Focus Session', hint: 'Start a deep work sprint', action: 'focus' },
      { label: 'Review Goals', hint: 'See weekly targets', action: 'goals' },
      { label: 'Toggle Theme', hint: 'Switch between light and dark', action: 'theme' },
    ]

    return items.filter((item) => item.label.toLowerCase().includes(query.toLowerCase()))
  }, [query])

  const scrollToSection = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleNavClick = (section, id) => {
    setActiveNav(section)
    if (id) {
      scrollToSection(id)
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handleCommand = (action) => {
    switch (action) {
      case 'calendar':
        scrollToSection('calendar-card')
        break
      case 'focus':
        setPomodoro({ isRunning: true, seconds: 25 * 60 })
        break
      case 'goals':
        scrollToSection('goals-card')
        break
      case 'theme':
        setDarkMode((value) => !value)
        break
      default:
        break
    }

    setPaletteOpen(false)
    setQuery('')
  }

  const addNote = (event) => {
    event.preventDefault()
    const trimmed = noteInput.trim()
    if (!trimmed) {
      return
    }

    setNotes((current) => [trimmed, ...current])
    setNoteInput('')
  }

  const toggleTask = (id) => {
    setTasks((current) =>
      current.flatMap((task) => {
        if (task.id !== id) return task

        const updated = { ...task, done: !task.done }
        if (!task.done && task.recurrence && task.recurrence !== 'None' && task.due) {
          const nextDue = calculateNextDue(task.due, task.recurrence)
          if (nextDue) {
            const nextTask = {
              id: Date.now() + Math.floor(Math.random() * 10000),
              title: task.title,
              done: false,
              priority: task.priority,
              due: nextDue,
              recurrence: task.recurrence,
            }
            return [updated, nextTask]
          }
        }

        return updated
      }),
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
      recurrence: taskRecurrence,
    }

    setTasks((current) => [newTask, ...current])
    setTaskTitle('')
    setTaskPriority('Medium')
    setTaskDue('')
    setTaskRecurrence('None')
  }

  const deleteTask = (id) => {
    setTasks((current) => current.filter((task) => task.id !== id))
  }

  const chartData = useMemo(() => productivityData.slice(-6), [productivityData])
  const liveProductivityScore = useMemo(() => {
    const latestScore = chartData[chartData.length - 1]?.score
    if (typeof latestScore === 'number') {
      return latestScore
    }

    return calculateProductivityScore(tasks, overdueCount, pomodoro.isRunning)
  }, [chartData, tasks, overdueCount, pomodoro.isRunning])

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
      <div className="app-frame">
        <aside className="sidebar">
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
              <h2>Northstar</h2>
            </div>
          </div>

          <nav className="sidebar-nav">
            <button type="button" className={activeNav === 'overview' ? 'nav-item active' : 'nav-item'} onClick={() => handleNavClick('overview')}>
              Overview
            </button>
            <button type="button" className={activeNav === 'calendar' ? 'nav-item active' : 'nav-item'} onClick={() => handleNavClick('calendar', 'calendar-card')}>
              Calendar
            </button>
            <button type="button" className={activeNav === 'focus' ? 'nav-item active' : 'nav-item'} onClick={() => handleNavClick('focus', 'task-board')}>
              Focus
            </button>
            <button type="button" className={activeNav === 'notes' ? 'nav-item active' : 'nav-item'} onClick={() => handleNavClick('notes', 'notes-card')}>
              Notes
            </button>
          </nav>

          <div className="sidebar-card">
            <p className="eyebrow">Today</p>
            <h3>Flow state</h3>
            <p>Three deep work blocks and a calm evening ahead.</p>
            <button type="button" className="primary-btn" onClick={() => {
              setActiveNav('focus')
              setPomodoro({ isRunning: true, seconds: 25 * 60 })
              scrollToSection('task-board')
            }}>
              Start focus
            </button>
          </div>
        </aside>

        <div className="main-panel">
          <header className="topbar">
            <div>
              <p className="eyebrow">{currentDate.toLocaleDateString('en', { weekday: 'long', month: 'short', day: 'numeric' })} • {currentDate.toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' })}</p>
              <h2>Daily command center</h2>
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
                <div className="hero-badge">AI-paced day</div>
                <h1>Welcome back, Maya.</h1>
                <p className="hero-text">
                  Your workspace feels light, balanced, and ready for momentum with 3 focus blocks left today.
                </p>
                <div className="hero-actions">
                  <button type="button" className="primary-btn" onClick={() => {
                    setActiveNav('notes')
                    document.getElementById('note-input')?.focus()
                    scrollToSection('notes-card')
                  }}>
                    New note
                  </button>
                  <button type="button" className="secondary-btn" onClick={() => {
                    setActiveNav('overview')
                    scrollToSection('goals-card')
                  }}>
                    Review goals
                  </button>
                </div>
              </div>

              <div className="hero-side">
                <article className="glass-card weather-card">
                  <div>
                    <p className="eyebrow">Weather</p>
                    <h3>{weather.loading ? 'Loading...' : `${weather.temp}°C`}</h3>
                    <p>{weather.description}</p>
                  </div>
                  <span className="weather-icon">☁️</span>
                </article>

                <article className="glass-card timer-card">
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

            <section className="stats-row">
              <article className="stat-card">
                <span>Completed</span>
                <strong>{completeCount}</strong>
              </article>
              <article className="stat-card">
                <span>Overdue</span>
                <strong>{overdueCount}</strong>
              </article>
              <article className="stat-card">
                <span>Recurring</span>
                <strong>{taskStats.recurring}</strong>
              </article>
              <article className="stat-card">
                <span>Focus score</span>
                <strong>{liveProductivityScore}%</strong>
              </article>
            </section>

            <section className="content-grid">
              <article className="card tasks-card" id="task-board">
                <div className="card-title-row">
                  <div>
                    <h3>Today’s tasks</h3>
                    <p className="task-summary">{completeCount}/{tasks.length} done • {overdueCount} overdue</p>
                  </div>
                  <span className="mini-pill">Task flow</span>
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
                    <select value={taskRecurrence} onChange={(event) => setTaskRecurrence(event.target.value)}>
                      <option>None</option>
                      <option>Daily</option>
                      <option>Weekly</option>
                      <option>Monthly</option>
                    </select>
                    <input type="date" value={taskDue} onChange={(event) => setTaskDue(event.target.value)} />
                    <button type="submit" className="primary-btn">Add</button>
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

                <div className="analytics-panel">
                  <div className="analytics-grid">
                    <div className="analytics-card">
                      <strong>{taskStats.active}</strong>
                      <span>Active</span>
                    </div>
                    <div className="analytics-card">
                      <strong>{taskStats.overdue}</strong>
                      <span>Overdue</span>
                    </div>
                    <div className="analytics-card">
                      <strong>{taskStats.recurring}</strong>
                      <span>Recurring</span>
                    </div>
                    <div className="analytics-card">
                      <strong>{taskStats.dueThisWeek}</strong>
                      <span>Due soon</span>
                    </div>
                  </div>
                  <div className="ai-suggestions">
                    <h4>AI suggestions</h4>
                    <ul>
                      {aiSuggestions.map((suggestion) => (
                        <li key={suggestion}>{suggestion}</li>
                      ))}
                    </ul>
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

              <article className="card calendar-card" id="calendar-card">
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
                <div className="calendar-list">
                  <div className="calendar-item">
                    <span>09:30</span>
                    <strong>Design review</strong>
                  </div>
                  <div className="calendar-item">
                    <span>13:00</span>
                    <strong>Product sync</strong>
                  </div>
                </div>
              </article>

              <article className="card notes-card" id="notes-card">
                <div className="card-title-row">
                  <h3>Quick notes</h3>
                  <span className="mini-pill">Fresh</span>
                </div>
                <form className="note-form" onSubmit={addNote}>
                  <input
                    id="note-input"
                    type="text"
                    value={noteInput}
                    placeholder="Capture a quick note"
                    onChange={(event) => setNoteInput(event.target.value)}
                  />
                  <button type="submit" className="primary-btn">Add note</button>
                </form>
                <ul className="note-list">
                  {notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </article>

              <article className="card goals-card" id="goals-card">
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
                  <span className="mini-pill">{liveProductivityScore}%</span>
                </div>
                <div className="chart-bars" aria-label="Productivity chart">
                  {chartData.map((entry) => (
                    <div key={`${entry.label}-${entry.score}`} className="bar-column">
                      <div className="bar" style={{ height: `${entry.score}%` }} />
                      <span>{entry.label}</span>
                    </div>
                  ))}
                </div>
              </article>
            </section>
          </main>
        </div>
      </div>

      {paletteOpen && (
        <div
          className="command-overlay"
          role="dialog"
          aria-modal="true"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setPaletteOpen(false)
            }
          }}
        >
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
                <button
                  key={item.label}
                  type="button"
                  className="command-item"
                  onClick={() => handleCommand(item.action)}
                >
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
