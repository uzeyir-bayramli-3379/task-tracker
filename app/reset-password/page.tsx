'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [supabase] = useState(() => createClient())

  // the recovery link drops a `code` in the URL which the browser client
  // exchanges for a session on load — gate the form until that's ready.
  const [ready, setReady] = useState(false)
  const [linkErr, setLinkErr] = useState(false)

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')

  const [passErr, setPassErr] = useState(false)
  const [confirmErr, setConfirmErr] = useState(false)
  const [authErr, setAuthErr] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    let settled = false
    const settle = () => {
      settled = true
      setReady(true)
    }

    // PASSWORD_RECOVERY fires once the link's token is parsed; we also
    // check for an already-established session in case it landed first.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) settle()
    })

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) settle()
    })

    // if no session materialises, the link was bad or expired
    const timer = setTimeout(() => {
      if (!settled) setLinkErr(true)
    }, 2500)

    return () => {
      clearTimeout(timer)
      sub.subscription.unsubscribe()
    }
  }, [supabase])

  function clearErrors() {
    setPassErr(false)
    setConfirmErr(false)
    setAuthErr('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    clearErrors()

    let ok = true
    if (password.length < 6) {
      setPassErr(true)
      ok = false
    }
    if (confirm !== password) {
      setConfirmErr(true)
      ok = false
    }
    if (!ok) return

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) {
      setAuthErr(error.message)
      return
    }
    setDone(true)
    setTimeout(() => {
      router.push('/login')
      router.refresh()
    }, 1200)
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
        <h1 className="auth-title">new password</h1>
        <p className="auth-subtitle">pick something you’ll remember this time.</p>

        {done ? (
          <p className="auth-form-msg">password updated — taking you to log in…</p>
        ) : linkErr ? (
          <>
            <p className="auth-form-err">this reset link is invalid or expired.</p>
            <p className="auth-switch">
              <button type="button" onClick={() => router.push('/login')}>
                back to log in
              </button>
            </p>
          </>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <label className={'field' + (passErr ? ' invalid' : '')}>
              <span className="lbl">new password</span>
              <input
                className="ink-input"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  clearErrors()
                }}
              />
              <p className="auth-err">at least 6 characters.</p>
            </label>

            <label className={'field' + (confirmErr ? ' invalid' : '')}>
              <span className="lbl">confirm password</span>
              <input
                className="ink-input"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                value={confirm}
                onChange={(e) => {
                  setConfirm(e.target.value)
                  clearErrors()
                }}
              />
              <p className="auth-err">passwords don’t match.</p>
            </label>

            <button
              className="auth-submit sketch"
              type="submit"
              disabled={loading || !ready}
            >
              {loading ? 'one sec…' : ready ? 'update password' : 'verifying link…'}
            </button>
          </form>
        )}

        {authErr && <p className="auth-form-err">{authErr}</p>}
      </div>
    </div>
  )
}
