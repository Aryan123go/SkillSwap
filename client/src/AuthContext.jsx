import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiRequest } from './api.js'
import { AuthContext } from './authContext.js'

async function readSession() {
  try {
    const { user } = await apiRequest('/auth/me')
    return { user, error: '' }
  } catch (error) {
    return error.status === 401
      ? { user: null, error: '' }
      : { user: null, error: error.message }
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sessionError, setSessionError] = useState('')

  const retrySession = useCallback(() => {
    setLoading(true)
    setSessionError('')
    readSession().then(({ user: currentUser, error }) => {
      setUser(currentUser)
      setSessionError(error)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    let active = true
    readSession().then(({ user: currentUser, error }) => {
      if (!active) return
      setUser(currentUser)
      setSessionError(error)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [])

  const signIn = useCallback(async (credentials) => {
    const data = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    })
    setUser(data.user)
    return data.user
  }, [])

  const register = useCallback(async (details) => {
    const data = await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify(details),
    })
    setUser(data.user)
    return data.user
  }, [])

  const signOut = useCallback(async () => {
    await apiRequest('/auth/logout', { method: 'POST' })
    setUser(null)
  }, [])

  const value = useMemo(() => ({
    user,
    setUser,
    loading,
    sessionError,
    refreshSession: retrySession,
    signIn,
    register,
    signOut,
  }), [user, loading, sessionError, retrySession, signIn, register, signOut])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
