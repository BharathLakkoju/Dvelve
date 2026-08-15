import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Mail, Lock, User, Eye, EyeOff, Shield, Zap, Star } from 'lucide-react'
import { api } from '../lib/api'
import { useStore } from '../store/useStore'

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  }),
}

const highlights = [
  { icon: Shield, text: 'Offline mode keeps every request on your machine — no data leaves it.' },
  { icon: Zap, text: 'Watch the report stream live as each agent completes its stage.' },
  { icon: Star, text: 'A Critic agent scores every report for quality and citation coverage.' },
]

export default function SignUp() {
  const navigate = useNavigate()
  const { setUser, setToken } = useStore()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    setLoading(true)
    try {
      const data = await api.signup(username, email, password)
      setToken(data.access_token)
      setUser(data.user)
      navigate('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-white">
      {/* Branding panel */}
      <div className="hidden lg:flex lg:w-[46%] relative bg-gradient-to-br from-primary-700 via-primary-600 to-accent-700 text-white flex-col justify-between p-12 overflow-hidden">
        <div className="absolute inset-0 bg-noise opacity-20 pointer-events-none" />
        <div className="absolute -top-24 -right-24 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -left-16 w-96 h-96 bg-black/10 rounded-full blur-3xl" />

        <Link to="/" className="relative flex items-center gap-2.5 z-10">
          <img src="/logo.ico" alt="Dvelve" className="w-9 h-9 rounded-xl object-contain" />
          <span className="font-extrabold text-lg tracking-tight">Dvelve</span>
        </Link>

        <div className="relative z-10">
          <h2 className="text-3xl font-extrabold leading-tight mb-6 max-w-sm">
            Create a free account and start researching in minutes.
          </h2>
          <div className="space-y-4 max-w-sm">
            {highlights.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="w-4 h-4" />
                </div>
                <p className="text-sm text-white/80 leading-relaxed pt-1">{text}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-xs text-white/50">© 2026 Dvelve. Local-first, privacy-first.</p>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12 bg-surface-50">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={0}
          className="mb-8 flex flex-col items-center gap-3 lg:hidden"
        >
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/logo.ico" alt="Dvelve" className="w-10 h-10 rounded-xl object-contain" />
            <span className="font-extrabold text-xl text-gray-900">Dvelve</span>
          </Link>
        </motion.div>

        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={1}
          className="w-full max-w-sm bg-white rounded-3xl shadow-elevated border border-gray-100 p-8"
        >
          <h1 className="text-2xl font-extrabold text-gray-900 mb-1 tracking-tight">Create account</h1>
          <p className="text-sm text-gray-500 mb-7">Start researching with AI in minutes</p>

          {error && (
            <div className="mb-5 px-4 py-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Username</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  required
                  autoComplete="username"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="Your name"
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-300 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-300 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  className="w-full pl-9 pr-10 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-300 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center py-2.5 mt-2"
            >
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Already have an account?{' '}
            <Link to="/signin" className="text-primary-600 font-semibold hover:underline">
              Sign in
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  )
}
