import { BrowserRouter, NavLink, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { useCalls } from './lib/data'
import type { DataContext } from './lib/context'
import { Icon, ThemeToggle } from './components/ui'
import Overview from './pages/Overview'
import CallsPage from './pages/Calls'
import CallDetail from './pages/CallDetail'

function Layout() {
  const { data, error } = useCalls()
  const { search, pathname } = useLocation()
  // Keep filters when switching between Overview and Calls; drop the page number.
  const keep = new URLSearchParams(search)
  keep.delete('page')
  const qs = keep.toString() ? `?${keep}` : ''

  const ctx: DataContext | null = data
    ? {
        ...data,
        topics: [...new Set(data.calls.map((c) => c.topic))].sort((a, b) =>
          a === 'Other' ? 1 : b === 'Other' ? -1 : a.localeCompare(b),
        ),
      }
    : null

  return (
    <div className="shell">
      <nav className="sidebar" aria-label="Main">
        <NavLink to={`/${qs}`} className="brand">
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" />
          <div>
            <strong>Call Insights</strong>
            <span>{data?.meta.company ?? '—'} · AI voice agent</span>
          </div>
        </NavLink>
        <div className="nav">
          <NavLink to={`/${qs}`} end>
            <Icon name="grid" />
            <span>Overview</span>
          </NavLink>
          <NavLink to={`/calls${qs}`} className={() => (pathname.startsWith('/calls') ? 'active' : '')}>
            <Icon name="phone" />
            <span>Calls</span>
          </NavLink>
        </div>
        <div className="sidebar-foot">
          <ThemeToggle />
          <span className="src">Demo data: Talkmap telecom corpus (synthetic)</span>
        </div>
      </nav>
      <main className="main">
        {error ? (
          <div className="empty">Couldn’t load call data: {error}</div>
        ) : ctx ? (
          <Outlet context={ctx} />
        ) : (
          <div className="loading">Loading calls…</div>
        )}
      </main>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Overview />} />
          <Route path="calls" element={<CallsPage />} />
          <Route path="calls/:id" element={<CallDetail />} />
          <Route path="*" element={<div className="empty">Page not found.</div>} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
