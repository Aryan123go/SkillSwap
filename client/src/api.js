const apiUrl = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

export async function apiRequest(path, options = {}) {
  let response
  try {
    response = await fetch(`${apiUrl}/api${path}`, {
      ...options,
      credentials: 'include',
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    })
  } catch {
    throw new Error('Cannot reach SkillSwap right now. Check your connection and try again.')
  }

  let result
  try {
    result = await response.json()
  } catch {
    const error = new Error(response.ok
      ? 'The server returned an unreadable response.'
      : `The SkillSwap service is unavailable (HTTP ${response.status}).`)
    error.status = response.status
    throw error
  }

  if (!response.ok || !result.success) {
    const error = new Error(result.message || 'Something went wrong. Please try again.')
    error.code = result.code
    error.status = response.status
    throw error
  }
  return result.data
}
