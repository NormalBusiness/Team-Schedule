import { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function Login() {
  const [mode, setMode] = useState('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setInfo('')
    setLoading(true)
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        if (!name.trim()) throw new Error('이름을 입력해주세요.')
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name: name.trim() } },
        })
        if (error) throw error
        setInfo('가입 확인 이메일을 보냈습니다. 메일함을 확인한 뒤 로그인해주세요.')
      }
    } catch (err) {
      setError(err.message || '오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h1>팀 일정 관리</h1>
        <div className="sub">{mode === 'login' ? '팀 계정으로 로그인하세요' : '팀 계정을 새로 만드세요'}</div>

        {error && <div className="auth-error">{error}</div>}
        {info && <div className="auth-error" style={{ color: 'var(--plan)', background: 'var(--plan-bg)', borderColor: 'var(--plan)' }}>{info}</div>}

        <form onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <div className="field">
              <label>이름</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="담당자 표시에 사용될 이름"
                required
              />
            </div>
          )}
          <div className="field">
            <label>이메일</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@team.com"
              required
            />
          </div>
          <div className="field">
            <label>비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="6자 이상"
              minLength={6}
              required
            />
          </div>
          <button className="btn primary" type="submit" style={{ width: '100%' }} disabled={loading}>
            {loading ? '처리 중...' : mode === 'login' ? '로그인' : '가입하기'}
          </button>
        </form>

        <div className="auth-toggle">
          {mode === 'login' ? (
            <>계정이 없나요? <span onClick={() => { setMode('signup'); setError(''); setInfo('') }}>가입하기</span></>
          ) : (
            <>이미 계정이 있나요? <span onClick={() => { setMode('login'); setError(''); setInfo('') }}>로그인</span></>
          )}
        </div>
      </div>
    </div>
  )
}
