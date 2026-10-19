
import React from 'react'
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
import { SessionDetailPage, SessionsPage } from './SessionsPage.jsx'
import { ConversationPage, MessagesPage } from './ChatPage.jsx'
import { ReviewsPage } from './ReviewsPage.jsx'


class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error) {
    console.error('SkillSwap page rendering failed:', error)
  }

  render() {
    if (this.state.hasError) {
      return <main className="app-shell"><section className="empty-panel error-panel" role="alert"><h1>This page could not be displayed</h1><p>An unexpected display error occurred. Your saved data has not been intentionally cleared.</p><button className="secondary-button" onClick={() => window.location.reload()}>Reload SkillSwap</button><a className="secondary-button" href="/sessions">Go to sessions</a></section></main>
    }
    return this.props.children
  }
}

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
    <Route path="/sessions" element={<ProtectedRoute><SessionsPage /></ProtectedRoute>} />
    <Route path="/sessions/:id" element={<ProtectedRoute><SessionDetailPage /></ProtectedRoute>} />
    <Route path="/messages" element={<ProtectedRoute><MessagesPage /></ProtectedRoute>} />
    <Route path="/messages/:conversationId" element={<ProtectedRoute><ConversationPage /></ProtectedRoute>} />
    <Route path="/reviews" element={<ProtectedRoute><ReviewsPage /></ProtectedRoute>} />
    <Route path="/profile" element={sessionError ? <ServiceUnavailablePage message={sessionError} onRetry={refreshSession} /> : <ProtectedRoute><ProfilePage /></ProtectedRoute>} />
    <Route path="/profile/edit" element={sessionError ? <ServiceUnavailablePage message={sessionError} onRetry={refreshSession} /> : <ProtectedRoute><EditProfilePage /></ProtectedRoute>} />
    <Route path="/profile/:id" element={sessionError ? <ServiceUnavailablePage message={sessionError} onRetry={refreshSession} /> : <ProtectedRoute><ProfilePage /></ProtectedRoute>} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
}

export default function App() {
  return <AppErrorBoundary><BrowserRouter><AuthProvider><ApplicationRoutes /></AuthProvider></BrowserRouter></AppErrorBoundary>
}
