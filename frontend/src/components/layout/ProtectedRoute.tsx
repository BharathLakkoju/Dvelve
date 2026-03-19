import { Navigate, Outlet } from 'react-router-dom'
import { useStore } from '../../store/useStore'

export function ProtectedRoute() {
  const token = useStore(s => s.token)
  if (!token) return <Navigate to="/signin" replace />
  return <Outlet />
}
