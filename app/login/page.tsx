'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

type Mode = 'login' | 'signup'

const COPY: Record<Mode, {
  title: string
  subtitle: string
  submit: string
  switchText: string
  toggle: string
  autocomplete: string
}> = {
  login: {
    title: 'welcome back',
    subtitle: 'log in to pick up where you left off.',
    submit: 'log in',
    switchText: 'new here?',
    toggle: 'create an account',
    autocomplete: 'current-password',
  },
  signup: {
    title: 'make an account',
    subtitle: 'just an email and a password — that’s it.',
    submit: 'sign up',
    switchText: 'already have an account?',
    toggle: 'log in instead',
    autocomplete: 'new-password',
  },
}

export default function LoginPage() {
  const router = useRouter()
  const [supabase] = useState(() => createClient())

  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [emailErr, setEmailErr] = useState(false)
  const [passErr, setPassErr] = useState(false)
  const [authErr, setAuthErr] = useState('')
  const [loading, setLoading] = useState(false)

  const copy = COPY[mode]

  function clearErrors() {
    setEmailErr(false)
    setPassErr(false)
    setAuthErr('')
  }

  function toggleMode() {
    setMode((m) => (m === 'login' ? 'signup' : 'login'))
    clearErrors()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    clearErrors()

    const emailVal = email.trim()
    let ok = true
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
      setEmailErr(true)
      ok = false
    }
    if (password.length < 6) {
      setPassErr(true)
      ok = false
    }
    if (!ok) return

    setLoading(true)
    const { error } =
      mode === 'signup'
        ? await supabase.auth.signUp({ email: emailVal, password })
        : await supabase.auth.signInWithPassword({ email: emailVal, password })
    setLoading(false)

    if (error) {
      setAuthErr(error.message)
      return
    }
    router.push('/')
    router.refresh()
  }

  return (
    <div className="stage">
      <div className="auth-card sketch">
        <svg className="auth-doodle" viewBox="0 0 46 46" aria-hidden="true">
          <path
            d="M6 30 C 14 10, 30 6, 40 14"
            fill="none"
            stroke="var(--due)"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M40 14 L 34 12 M40 14 L 38 20"
            fill="none"
            stroke="var(--due)"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </svg>

        <p className="auth-brand">task tracker</p>
        <h1 className="auth-title">{copy.title}</h1>
        <p className="auth-subtitle">{copy.subtitle}</p>

        <form onSubmit={handleSubmit} noValidate>
          <label className={'field' + (emailErr ? ' invalid' : '')}>
            <span className="lbl">email</span>
            <input
              className="ink-input"
              type="email"
              autoComplete="email"
              placeholder="you@email.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                clearErrors()
              }}
            />
            <p className="auth-err">enter a valid email.</p>
          </label>

          <label className={'field' + (passErr ? ' invalid' : '')}>
            <span className="lbl">password</span>
            <input
              className="ink-input"
              type="password"
              autoComplete={copy.autocomplete}
              placeholder="••••••••"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                clearErrors()
              }}
            />
            <p className="auth-err">at least 6 characters.</p>
          </label>

          <button className="auth-submit sketch" type="submit" disabled={loading}>
            {loading ? 'one sec…' : copy.submit}
          </button>
        </form>

        {authErr && <p className="auth-form-err">{authErr}</p>}

        <p className="auth-switch">
          <span>{copy.switchText}</span>{' '}
          <button type="button" onClick={toggleMode}>
            {copy.toggle}
          </button>
        </p>
      </div>
    </div>
  )
}
