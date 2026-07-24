import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function Projects({ session }) {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    loadProjects()
  }, [])

  async function loadProjects() {
    setLoading(true)
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false })
    if (!error) setProjects(data)
    setLoading(false)
  }

  async function createProject(e) {
    e.preventDefault()
    if (!name.trim()) return
    const { error } = await supabase.from('projects').insert({
      name: name.trim(),
      description: description.trim(),
      created_by: session.user.id,
    })
    if (!error) {
      setName('')
      setDescription('')
      setShowForm(false)
      loadProjects()
    }
  }

  return (
    <div className="page-wrap">
      <div className="topbar">
        <div>
          <h1>프로젝트</h1>
          <div className="sub">{session.user.email}</div>
        </div>
        <div className="topbar-actions">
          <button className="btn" onClick={() => supabase.auth.signOut()}>로그아웃</button>
          <button className="btn primary" onClick={() => setShowForm(true)}>+ 새 프로젝트</button>
        </div>
      </div>

      {loading ? (
        <div className="empty">불러오는 중...</div>
      ) : projects.length === 0 ? (
        <div className="empty">아직 프로젝트가 없습니다. 새 프로젝트를 만들어보세요.</div>
      ) : (
        <div className="project-grid">
          {projects.map((p) => (
            <div className="project-card" key={p.id} onClick={() => navigate(`/board/${p.id}`)}>
              <h3>{p.name}</h3>
              <p>{p.description || '설명이 없습니다.'}</p>
              <div className="meta">{new Date(p.created_at).toLocaleDateString('ko-KR')} 생성</div>
            </div>
          ))}
        </div>
      )}

      <div className={`overlay ${showForm ? 'open' : ''}`} onClick={(e) => e.target === e.currentTarget && setShowForm(false)}>
        <div className="modal">
          <h2>새 프로젝트</h2>
          <form onSubmit={createProject}>
            <div className="field">
              <label>프로젝트 이름</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="예: MoneyPulate" autoFocus />
            </div>
            <div className="field">
              <label>설명</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="프로젝트에 대한 간단한 설명" />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setShowForm(false)}>취소</button>
              <button type="submit" className="btn primary">만들기</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
