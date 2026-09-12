'use client'

import { useState } from 'react'
import { login } from './actions'
import { LayoutGrid } from 'lucide-react'

export default function LoginPage() {
  const [errorMsg, setErrorMsg] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrorMsg('')
    setLoading(true)
    
    const formData = new FormData(e.currentTarget)
    
    try {
      const result = await login(formData)
      if (result?.error) {
        setErrorMsg(result.error)
        setLoading(false)
      }
    } catch (err) {
      setErrorMsg('An unexpected error occurred')
      setLoading(false)
    }
  }

  async function handleGuestLogin(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault()
    setErrorMsg('')
    setLoading(true)
    
    const formData = new FormData()
    formData.append('email', 'guestuser@gmail.com')
    formData.append('password', '0987654321')
    
    try {
      const result = await login(formData)
      if (result?.error) {
        setErrorMsg(result.error)
        setLoading(false)
      }
    } catch (err) {
      setErrorMsg('An unexpected error occurred')
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md bg-card rounded-2xl shadow-xl border p-8">
      <div className="flex flex-col items-center mb-8">
        <div className="w-16 h-16 bg-black rounded-2xl flex items-center justify-center shadow-inner mb-4 overflow-hidden border">
          <img src="/images/logo.png" alt="TestBento Logo" className="w-full h-full object-cover" />
        </div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">TestBento</h1>
        <p className="text-muted-foreground text-sm mt-1">Organized Quality Assurance Platform</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMsg && (
          <div className="p-3 text-sm bg-red-50 text-red-600 rounded-lg border border-red-100 flex items-start gap-2">
            <span className="font-bold">!</span> {errorMsg}
          </div>
        )}

        <div>
          <label className="form-label" htmlFor="email">Email</label>
          <input 
            id="email" 
            name="email" 
            type="email" 
            required 
            className="form-input" 
            placeholder="admin@company.com"
          />
        </div>

        <div>
          <label className="form-label" htmlFor="password">Password</label>
          <input 
            id="password" 
            name="password" 
            type="password" 
            required 
            className="form-input" 
            placeholder="••••••••"
          />
        </div>

        <button 
          type="submit" 
          disabled={loading}
          className="btn-primary w-full justify-center h-11 mt-2 text-base"
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>

        <div className="relative flex py-2 items-center">
          <div className="flex-grow border-t border-muted"></div>
          <span className="flex-shrink-0 mx-4 text-muted-foreground text-sm">or</span>
          <div className="flex-grow border-t border-muted"></div>
        </div>

        <button 
          type="button" 
          onClick={handleGuestLogin}
          disabled={loading}
          className="btn-secondary w-full justify-center h-11 text-base bg-secondary text-secondary-foreground hover:bg-secondary/80 border"
        >
          {loading ? 'Entering Cave...' : 'Login as Guest (Recruiter)'}
        </button>
      </form>
    </div>
  )
}

