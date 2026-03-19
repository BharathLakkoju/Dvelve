import { Link, useLocation, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Library, Settings, Cpu, Wifi, WifiOff, LogOut } from 'lucide-react'
import { useStore } from '../../store/useStore'
import clsx from 'clsx'

export function Navbar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { selectedModel, offlineMode, ollamaConnected, user, logout } = useStore()

  function handleLogout() {
    logout()
    navigate('/')
  }

  const navLinks = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/library', label: 'Library', icon: Library },
    { to: '/settings', label: 'Settings', icon: Settings },
  ]

  const initials = user
    ? user.username.slice(0, 2).toUpperCase()
    : '?'

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
        {/* Logo */}
        <Link to="/dashboard" className="flex items-center gap-2.5 group">
          <img src="/logo.ico" alt="Dvelve" className="w-8 h-8 rounded-lg object-contain" />
          <span className="font-bold text-gray-900 text-sm tracking-tight">Dvelve</span>
        </Link>

        {/* Nav links */}
        <div className="hidden sm:flex items-center gap-1">
          {navLinks.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className={clsx(
                'nav-item',
                location.pathname.startsWith(to) ? 'nav-item-active' : ''
              )}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Right: model info + status + user */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-100">
            <Cpu className="w-3.5 h-3.5 text-primary-500" />
            <span className="text-xs font-medium text-gray-600">{selectedModel}</span>
          </div>
          <div className={clsx(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium',
            offlineMode
              ? 'bg-amber-50 border-amber-100 text-amber-700'
              : ollamaConnected
                ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                : 'bg-red-50 border-red-100 text-red-600'
          )}>
            {offlineMode ? (
              <><WifiOff className="w-3.5 h-3.5" /><span>Offline</span></>
            ) : ollamaConnected ? (
              <><Wifi className="w-3.5 h-3.5" /><span>Connected</span></>
            ) : (
              <><WifiOff className="w-3.5 h-3.5" /><span>Disconnected</span></>
            )}
          </div>

          {/* User avatar */}
          {user && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center" title={user.email}>
                <span className="text-xs font-semibold text-primary-700">{initials}</span>
              </div>
              <button
                onClick={handleLogout}
                title="Sign out"
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-500 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
