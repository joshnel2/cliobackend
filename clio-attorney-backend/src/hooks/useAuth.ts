import { useState, useEffect } from 'react'

interface AuthState {
  isAuthenticated: boolean
  isLoading: boolean
  firmId: string | null
  login: (firmId: string) => void
  logout: () => void
}

export function useAuth(): AuthState {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [firmId, setFirmId] = useState<string | null>(null)

  useEffect(() => {
    // Check if user is already authenticated
    const storedFirmId = localStorage.getItem('firmId')
    if (storedFirmId) {
      setFirmId(storedFirmId)
      setIsAuthenticated(true)
    }
    setIsLoading(false)
  }, [])

  const login = (newFirmId: string) => {
    localStorage.setItem('firmId', newFirmId)
    setFirmId(newFirmId)
    setIsAuthenticated(true)
  }

  const logout = () => {
    localStorage.removeItem('firmId')
    setFirmId(null)
    setIsAuthenticated(false)
  }

  return {
    isAuthenticated,
    isLoading,
    firmId,
    login,
    logout,
  }
}