import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'

const CAT_LABEL = { art: '아트', plan: '기획', dev: '플밍', effect: '이펙트' }
const CAT_ORDER = ['art', 'plan', 'dev', 'effect']
const STATUS_LABEL = { todo: '예정', doing: '진행중', done: '완료' }
const DAY_W = 34

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}
function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000)
}
function addDays(iso, n) {
  const d = new Date(iso)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}
function isOverdue(t) {
  return t.status !== 'done' && t.end_date < todayISO()
}
function isDueSoon(t) {
  return t.status !== 'done' && !isOverdue(t) && daysBetween(todayISO(), t.end_date) <= 2
}

const emptyForm = { title: '', category: 'art', assignee: '', status: 'todo', start_date: todayISO(), end_date: addDays(todayISO(), 3), description: '' }

export default function Board({ session }) {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const [project, setProject] = useState(null)
  const [tasks, setTasks] = useState([])
  const [activeCats, setActiveCats] = useState(new Set(CAT_ORDER))
  const [activeAssignee, setActiveAssignee] = useState('all')
  const [formOpen, setFormOpen] = useState(false)
  const [detailTask, setDetailTask] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [dragging, setDragging] = useState(null)
  const gridRefs = useRef({})

  useEffect(() => {
    loadProject()
    loadTasks()
    const channel = supabase
      .channel(`tasks-${projectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `project_id=eq.${projectId}` }, () => {
        loadTasks()
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [projectId])

  async function loadProject() {
    const { data } = await supabase.from('projects').select('*').eq('id', projectId).single()
    setProject(data)
  }
  async function loadTasks() {
    const { data, error } = await supabase.from('tasks').select('*').eq('project_id', projectId).order('start_date')
    if (!error) setTasks(data)
  }

  const range = useMemo(() => {
    if (tasks.length === 0) {
      const t = todayISO()
      return { start: addDays(t, -3), end: addDays(t, 14) }
    }
    let min = tasks[0].start_date, max = tasks[0].end_date
    tasks.forEach((t) => {
      if (t.start_date < min) min = t.start_date
      if (t.end_date > max) max = t.end_date
    })
    min = addDays(min, -3)
    max = addDays(max, 4)
    const today = todayISO()
    if (today < min) min = addDays(today, -3)
    if (today > max) max = addDays(today, 4)
    return { start: min, end: max }
  }, [tasks])

  const totalDays = daysBetween(range.start, range.end) + 1
  const trackWidth = totalDays * DAY_W
  const todayOffset = daysBetween(range.start, todayISO())
  const todayLeft = todayOffset * DAY_W + DAY_W / 2

  const assignees = useMemo(
    () => Array.from(new Set(tasks.map((t) => t.assignee).filter(Boolean))).sort(),
    [tasks]
  )

  const filteredTasks = tasks.filter((t) => activeAssignee === 'all' || t.assignee === activeAssignee)
  const dueSoonCount = filteredTasks.filter(isDueSoon).length
  const overdueCount = filteredTasks.filter(isOverdue).length

  function toggleCat(cat) {
    setActiveCats((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) {
        if (next.size === 1) return prev
        next.delete(cat)
      } else {
        next.add(cat)
      }
      return next
    })
  }

  function openAddForm() {
    setEditingId(null)
    setForm(emptyForm)
    setFormOpen(true)
  }
  function openEditForm(t) {
    setEditingId(t.id)
    setForm({
      title: t.title, category: t.category, assignee: t.assignee || '',
      status: t.status, start_date: t.start_date, end_date: t.end_date, description: t.description || '',
    })
    setDetailTask(null)
    setFormOpen(true)
  }

  async function saveTask(e) {
    e.preventDefault()
    if (!form.title.trim()) { alert('업무 제목을 입력하세요.'); return }
    if (!form.start_date || !form.end_date || form.start_date > form.end_date) { alert('시작일과 종료일을 확인하세요.'); return }
    const payload = {
      title: form.title.trim(), category: form.category, assignee: form.assignee.trim(),
      status: form.status, start_date: form.start_date, end_date: form.end_date,
      description: form.description.trim(), project_id: projectId, created_by: session.user.id,
    }
    if (editingId) {
      await supabase.from('tasks').update(payload).eq('id', editingId)
    } else {
      await supabase.from('tasks').insert(payload)
    }
    setFormOpen(false)
    loadTasks()
  }

  async function deleteTask() {
    if (!editingId) return
    if (!confirm('이 일정을 삭제할까요?')) return
    await supabase.from('tasks').delete().eq('id', editingId)
    setFormOpen(false)
    loadTasks()
  }

  function computeDayFromEvent(e, cat) {
    const el = gridRefs.current[cat]
    if (!el) return 0
    const rect = el.getBoundingClientRect()
    const x = e.clientX - rect.left
    let day = Math.floor(x / DAY_W)
    if (day < 0) day = 0
    if (day > totalDays - 1) day = totalDays - 1
    return day
  }
  function handleGridMouseDown(cat, e) {
    e.preventDefault()
    const day = computeDayFromEvent(e, cat)
    setDragging({ cat, startDay: day, currentDay: day })
  }

  useEffect(() => {
    if (!dragging) return
    function onMove(e) {
      const day = computeDayFromEvent(e, dragging.cat)
      setDragging((prev) => (prev ? { ...prev, currentDay: day } : prev))
    }
    function onUp() {
      setDragging((prev) => {
        if (prev) {
          const min = Math.min(prev.startDay, prev.currentDay)
          const max = Math.max(prev.startDay, prev.currentDay)
          setEditingId(null)
          setForm({ ...emptyForm, category: prev.cat, start_date: addDays(range.start, min), end_date: addDays(range.start, max) })
          setFormOpen(true)
        }
        return null
      })
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [dragging, range.start])

  return (
    <div className="page-wrap">
      <div className="board-topbar">
        <span className="back-link" onClick={() => navigate('/')}>← 프로젝트 목록</span>
      </div>
      <div className="topbar">
        <div>
          <h1>{project?.name || '불러오는 중...'}</h1>
          <div className="sub">{range.start.replace(/-/g, '.')} — {range.end.replace(/-/g, '.')}</div>
        </div>
        <button className="btn primary" onClick={openAddForm}>+ 새 일정 추가</button>
      </div>

      {(overdueCount > 0 || dueSoonCount > 0) && (
        <div className="board-alert">
          {overdueCount > 0 && <span className="alert-pill overdue">기한 초과 {overdueCount}건</span>}
          {dueSoonCount > 0 && <span className="alert-pill due-soon">마감 임박 {dueSoonCount}건</span>}
        </div>
      )}

      <div className="filters">
        {CAT_ORDER.map((cat) => (
          <div key={cat} className={`chip ${activeCats.has(cat) ? 'active' : ''}`} data-cat={cat} onClick={() => toggleCat(cat)}>
            {CAT_LABEL[cat]}
          </div>
        ))}
        {assignees.length > 0 && (
          <select className="assignee-select" value={activeAssignee} onChange={(e) => setActiveAssignee(e.target.value)}>
            <option value="all">담당자 전체</option>
            {assignees.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        )}
      </div>

      <div className="board">
        <div className="gantt-scroll">
          <div className="gantt">
            <div className="gantt-header">
              <div className="row-label-col">업무</div>
              <div style={{ display: 'flex' }}>
                {Array.from({ length: totalDays }, (_, i) => {
                  const iso = addDays(range.start, i)
                  const d = new Date(iso)
                  const dow = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()]
                  const isWeekend = d.getDay() === 0 || d.getDay() === 6
                  const isToday = iso === todayISO()
                  return (
                    <div key={iso} className={`day-cell ${isWeekend ? 'weekend' : ''} ${isToday ? 'today' : ''}`}>
                      {d.getMonth() + 1}/{d.getDate()}<span className="dow">{dow}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {CAT_ORDER.filter((c) => activeCats.has(c)).map((cat) => {
              const catTasks = filteredTasks.filter((t) => t.category === cat)
              const isDraggingThis = dragging && dragging.cat === cat
              let selLeft = 0, selWidth = 0
              if (isDraggingThis) {
                const min = Math.min(dragging.startDay, dragging.currentDay)
                const max = Math.max(dragging.startDay, dragging.currentDay)
                selLeft = min * DAY_W
                selWidth = (max - min + 1) * DAY_W
              }
              return (
                <div className="cat-group" key={cat}>
                  <div className={`cat-title-row ${cat}`}>
                    <div className="row-label-col">{CAT_LABEL[cat]} · {catTasks.length}</div>
                    <div
                      className="cat-drag-grid"
                      ref={(el) => (gridRefs.current[cat] = el)}
                      style={{ width: trackWidth }}
                      title="드래그하여 새 일정 추가"
                      onMouseDown={(e) => handleGridMouseDown(cat, e)}
                    >
                      {isDraggingThis && <div className="drag-select" style={{ left: selLeft, width: selWidth }}></div>}
                    </div>
                  </div>
                  {catTasks.map((t) => {
                    const off = daysBetween(range.start, t.start_date)
                    const len = daysBetween(t.start_date, t.end_date) + 1
                    const left = off * DAY_W
                    const width = Math.max(len * DAY_W - 6, DAY_W - 6)
                    const overdue = isOverdue(t)
                    const dueSoon = isDueSoon(t)
                    return (
                      <div className={`task-row ${cat}`} key={t.id}>
                        <div className="row-label-col" title={t.title}>{t.title}</div>
                        <div className="task-track" style={{ width: trackWidth }}>
                          <div className="today-line" style={{ left: todayLeft }}></div>
                          <div
                            className={`bar ${cat} ${t.status === 'done' ? 'status-done' : ''} ${overdue ? 'overdue' : ''} ${dueSoon ? 'due-soon' : ''}`}
                            style={{ left, width }}
                            onClick={() => setDetailTask(t)}
                          >
                            {t.title}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className={`overlay ${detailTask ? 'open' : ''}`} onClick={(e) => e.target === e.currentTarget && setDetailTask(null)}>
        {detailTask && (
          <div className="modal">
            <div className="detail-title">{detailTask.title}</div>
            <div className="detail-meta">
              <span className={`badge ${detailTask.category}`}>{CAT_LABEL[detailTask.category]}</span>
              <span className="badge status">{STATUS_LABEL[detailTask.status]}</span>
              {isOverdue(detailTask) && <span className="badge danger">기한 초과</span>}
              {isDueSoon(detailTask) && <span className="badge warning">마감 임박</span>}
            </div>
            <div className="detail-row"><span>담당자</span><span>{detailTask.assignee || '미지정'}</span></div>
            <div className="detail-row"><span>시작일</span><span>{detailTask.start_date}</span></div>
            <div className="detail-row"><span>종료일</span><span>{detailTask.end_date}</span></div>
            <div className="detail-desc">{detailTask.description || '세부 내역이 없습니다.'}</div>
            <div className="modal-actions">
              <button className="btn" onClick={() => setDetailTask(null)}>닫기</button>
              <button className="btn primary" onClick={() => openEditForm(detailTask)}>수정</button>
            </div>
          </div>
        )}
      </div>

      <div className={`overlay ${formOpen ? 'open' : ''}`} onClick={(e) => e.target === e.currentTarget && setFormOpen(false)}>
        <div className="modal">
          <h2>{editingId ? '일정 수정' : '새 일정 추가'}</h2>
          <form onSubmit={saveTask}>
            <div className="field">
              <label>업무 제목</label>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="예: NS_Money 플립북 애니메이션 작업" autoFocus />
            </div>
            <div className="field">
              <label>카테고리</label>
              <div className="cat-select">
                {CAT_ORDER.map((cat) => (
                  <div key={cat} className={`cat-opt ${form.category === cat ? 'sel' : ''}`} data-cat={cat} onClick={() => setForm({ ...form, category: cat })}>
                    {CAT_LABEL[cat]}
                  </div>
                ))}
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label>담당자</label>
                <input value={form.assignee} onChange={(e) => setForm({ ...form, assignee: e.target.value })} placeholder="담당자 이름" list="assignee-list" />
                <datalist id="assignee-list">
                  {assignees.map((a) => <option key={a} value={a} />)}
                </datalist>
              </div>
              <div className="field">
                <label>상태</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="todo">예정</option>
                  <option value="doing">진행중</option>
                  <option value="done">완료</option>
                </select>
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label>시작일</label>
                <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
              </div>
              <div className="field">
                <label>종료일</label>
                <input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
              </div>
            </div>
            <div className="field">
              <label>세부 내역</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="업무에 대한 상세 설명, 참고사항 등을 입력하세요" />
            </div>
            <div className="modal-actions">
              {editingId && <button type="button" className="btn danger" onClick={deleteTask}>삭제</button>}
              <button type="button" className="btn" onClick={() => setFormOpen(false)}>취소</button>
              <button type="submit" className="btn primary">저장</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
