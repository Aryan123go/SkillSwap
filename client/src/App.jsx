import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import './App.css'
import { AuthProvider } from './AuthContext.jsx'
import { useAuth } from './useAuth.js'
import { LoadingScreen } from './components.jsx'
import {
  DashboardPage,
  EditProfilePage,
  LandingPage,
  LoginPage,
  ProfilePage,
  RegisterPage,
  ServiceUnavailablePage,
} from './pages.jsx'
import { DiscoveryPage } from './DiscoveryPage.jsx'
import { RequestsPage } from './RequestsPage.jsx'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <LoadingScreen />
  return user ? children : <Navigate to="/login" replace />
}

function ApplicationRoutes() {
  const { sessionError, refreshSession } = useAuth()
  const location = useLocation()
  if (sessionError && location.pathname.startsWith('/dashboard')) {
    return <ServiceUnavailablePage message={sessionError} onRetry={refreshSession} />
  }
  return <Routes>
    <Route path="/" element={<LandingPage />} />
    <Route path="/login" element={<LoginPage />} />
    <Route path="/register" element={<RegisterPage />} />
    <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
    <Route path="/discover" element={<ProtectedRoute><DiscoveryPage /></ProtectedRoute>} />
    <Route path="/requests/sent" element={<ProtectedRoute><RequestsPage direction="sent" /></ProtectedRoute>} />
    <Route path="/requests/received" element={<ProtectedRoute><RequestsPage direction="received" /></ProtectedRoute>} />
    <Route path="/profile" element={sessionError ? <ServiceUnavailablePage message={sessionError} onRetry={refreshSession} /> : <ProtectedRoute><ProfilePage /></ProtectedRoute>} />
    <Route path="/profile/edit" element={sessionError ? <ServiceUnavailablePage message={sessionError} onRetry={refreshSession} /> : <ProtectedRoute><EditProfilePage /></ProtectedRoute>} />
    <Route path="/profile/:id" element={sessionError ? <ServiceUnavailablePage message={sessionError} onRetry={refreshSession} /> : <ProtectedRoute><ProfilePage /></ProtectedRoute>} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
}

export default function App() {
  return <BrowserRouter><AuthProvider><ApplicationRoutes /></AuthProvider></BrowserRouter>
}
