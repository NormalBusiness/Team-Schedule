import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}
function addDays(iso, n) {
  const d = new Date(iso)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

export default function Projects({ session }) {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState(todayISO())
  const [endDate, setEndDate] = useState(addDays(todayISO(), 30))
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
    if (!startDate || !endDate || startDate > endDate) { alert('프로젝트 기간을 확인해주세요.'); return }
    const { error } = await supabase.from('projects').insert({
      name: name.trim(),
      description: description.trim(),
      start_date: startDate,
      end_date: endDate,
      created_by: session.user.id,
    })
    if (!error) {
      setName('')
      setDescription('')
      setStartDate(todayISO())
      setEndDate(addDays(todayISO(), 30))
      setShowForm(false)
      loadProjects()
    }
  }

  async function deleteProject(e, project) {
    e.stopPropagation()
    if (!confirm(`"${project.name}" 프로젝트를 삭제할까요?\n포함된 모든 일정도 함께 삭제되며, 되돌릴 수 없습니다.`)) return
    await supabase.from('projects').delete().eq('id', project.id)
    loadProjects()
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
              <button className="project-delete-btn" onClick={(e) => deleteProject(e, p)} title="프로젝트 삭제" aria-label="프로젝트 삭제">×</button>
              <h3>{p.name}</h3>
              <p>{p.description || '설명이 없습니다.'}</p>
              <div className="meta">
                {p.start_date && p.end_date ? `${p.start_date.replace(/-/g, '.')} — ${p.end_date.replace(/-/g, '.')}` : `${new Date(p.created_at).toLocaleDateString('ko-KR')} 생성`}
              </div>
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
            <div className="field-row">
              <div className="field">
                <label>시작일</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="field">
                <label>종료일</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
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
