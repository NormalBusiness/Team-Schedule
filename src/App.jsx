import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Login from './pages/Login.jsx'
import Projects from './pages/Projects.jsx'
import Board from './pages/Board.jsx'

export default function App() {
  const [session, setSession] = useState(undefined) // undefined = loading

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  if (session === undefined) {
    return <div style={{ padding: 40, color: 'var(--text-mute)' }}>불러오는 중...</div>
  }

  if (!session) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route path="/" element={<Projects session={session} />} />
      <Route path="/board/:projectId" element={<Board session={session} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
