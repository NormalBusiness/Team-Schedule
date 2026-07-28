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

  const [profile, setProfile] = useState(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const [nickname, setNickname] = useState('')
  const [discordId, setDiscordId] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)

  useEffect(() => {
    loadProjects()
    loadProfile()
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

  async function loadProfile() {
    const { data } = await supabase.from('profiles').select('name, discord_id').eq('id', session.user.id).single()
    if (data) setProfile(data)
  }

  function openProfileForm() {
    setNickname(profile?.name || '')
    setDiscordId(profile?.discord_id || '')
    setProfileOpen(true)
  }

  async function saveProfile(e) {
    e.preventDefault()
    const newName = nickname.trim()
    if (!newName) { alert('닉네임을 입력해주세요.'); return }
    const oldName = profile?.name || ''
    setProfileSaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({ name: newName, discord_id: discordId.trim() || null })
      .eq('id', session.user.id)
    if (error) {
      setProfileSaving(false)
      alert('저장에 실패했어요: ' + error.message)
      return
    }
    if (oldName && oldName !== newName) {
      const { data: updatedTasks, error: taskError } = await supabase
        .from('tasks')
        .update({ assignee: newName })
        .eq('assignee', oldName)
        .select('id')
      if (taskError) {
        console.error('담당자명 일괄 변경 실패', taskError)
      } else if (updatedTasks && updatedTasks.length > 0) {
        alert(`닉네임을 변경했어요. "${oldName}"으로 배정되어 있던 일정 ${updatedTasks.length}건의 담당자명도 "${newName}"으로 함께 바꿨어요.`)
      }
    }
    setProfileSaving(false)
    setProfileOpen(false)
    loadProfile()
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
          <div className="sub">
            {profile?.name ? `${profile.name} · ` : ''}{session.user.email}
            <span className="period-edit-link" onClick={openProfileForm}>닉네임 변경</span>
          </div>
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

      <div className={`overlay ${profileOpen ? 'open' : ''}`} onClick={(e) => e.target === e.currentTarget && setProfileOpen(false)}>
        <div className="modal">
          <h2>내 프로필</h2>
          <form onSubmit={saveProfile}>
            <div className="field">
              <label>닉네임</label>
              <input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="담당자로 표시될 이름" autoFocus />
            </div>
            <div className="field">
              <label>디스코드 사용자 ID (선택)</label>
              <input value={discordId} onChange={(e) => setDiscordId(e.target.value)} placeholder="예: 123456789012345678" />
              <div className="field-hint">
                등록하면 업무 배정/마감 임박 알림에서 진짜로 멘션(핑)이 울려요. 비워두면 "@닉네임" 텍스트로만 표시돼요.
                <br />
                디스코드 앱 → 설정 → 고급 → 개발자 모드 켜기 → 내 프로필 우클릭 → "사용자 ID 복사"로 확인할 수 있어요.
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setProfileOpen(false)}>취소</button>
              <button type="submit" className="btn primary" disabled={profileSaving}>{profileSaving ? '저장 중...' : '저장'}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
