import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'

const CAT_LABEL = { art: '아트', plan: '기획', dev: '플밍', effect: '이펙트', sound: '사운드' }
const CAT_ORDER = ['art', 'plan', 'dev', 'effect', 'sound']
const STATUS_LABEL = { todo: '예정', doing: '진행중', done: '완료' }
const DAY_W = 34

function todayISO() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
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

const emptyForm = { title: '', category: 'art', assignee: '', status: 'todo', start_date: todayISO(), end_date: addDays(todayISO(), 3), description: '', feedback_start: '' }

export default function Board({ session }) {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const [project, setProject] = useState(null)
  const [tasks, setTasks] = useState([])
  const [teamMembers, setTeamMembers] = useState([])
  const [activeCats, setActiveCats] = useState(new Set(CAT_ORDER))
  const [activeAssignee, setActiveAssignee] = useState('all')
  const [formOpen, setFormOpen] = useState(false)
  const [detailTask, setDetailTask] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [originalAssignee, setOriginalAssignee] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [dragging, setDragging] = useState(null)
  const [taskDrag, setTaskDrag] = useState(null)
  const gridRefs = useRef({})
  const scrollRef = useRef(null)
  const hasCenteredRef = useRef(false)

  const [assigneeOpen, setAssigneeOpen] = useState(false)
  const [assigneeError, setAssigneeError] = useState('')
  const [assigneeShake, setAssigneeShake] = useState(false)

  const [periodOpen, setPeriodOpen] = useState(false)
  const [periodForm, setPeriodForm] = useState({ start_date: '', end_date: '' })
  const [sendingDigest, setSendingDigest] = useState(false)

  useEffect(() => {
    loadProject()
    loadTasks()
    loadTeamMembers()
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
  async function loadTeamMembers() {
    const { data, error } = await supabase.from('profiles').select('name').order('name')
    if (!error) setTeamMembers((data || []).map((r) => r.name).filter(Boolean))
  }

  const range = useMemo(() => {
    if (project?.start_date && project?.end_date) {
      return { start: project.start_date, end: project.end_date }
    }
    const t = todayISO()
    return { start: addDays(t, -3), end: addDays(t, 30) }
  }, [project])

  const totalDays = daysBetween(range.start, range.end) + 1
  const trackWidth = totalDays * DAY_W
  const todayOffset = daysBetween(range.start, todayISO())
  const todayLeft = todayOffset * DAY_W + DAY_W / 2
  const dayLineOffsets = useMemo(() => Array.from({ length: totalDays }, (_, i) => i * DAY_W), [totalDays])
  const weekGroups = useMemo(() => {
    const groups = []
    let i = 0
    let week = 1
    while (i < totalDays) {
      const span = Math.min(7, totalDays - i)
      groups.push({ label: `${week}주차`, span })
      i += span
      week++
    }
    return groups
  }, [totalDays])

  useEffect(() => {
    hasCenteredRef.current = false
  }, [projectId])

  useEffect(() => {
    if (!project || hasCenteredRef.current) return
    const el = scrollRef.current
    if (!el) return
    const todayCenterPx = todayOffset * DAY_W + DAY_W / 2
    el.scrollLeft = Math.max(0, todayCenterPx - el.clientWidth / 2)
    hasCenteredRef.current = true
  }, [project, todayOffset])

  const assignees = useMemo(
    () => Array.from(new Set(tasks.map((t) => t.assignee).filter(Boolean))).sort(),
    [tasks]
  )
  const assigneeSuggestions = useMemo(() => {
    const q = form.assignee.trim()
    if (!q) return []
    return teamMembers.filter((m) => m.includes(q)).slice(0, 6)
  }, [form.assignee, teamMembers])

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
    setOriginalAssignee(null)
    setForm(emptyForm)
    setAssigneeError('')
    setAssigneeOpen(false)
    setFormOpen(true)
  }
  function openEditForm(t) {
    setEditingId(t.id)
    setOriginalAssignee(t.assignee || '')
    setForm({
      title: t.title, category: t.category, assignee: t.assignee || '',
      status: t.status, start_date: t.start_date, end_date: t.end_date, description: t.description || '',
      feedback_start: t.feedback_start || '',
    })
    setAssigneeError('')
    setAssigneeOpen(false)
    setDetailTask(null)
    setFormOpen(true)
  }

  function handleAssigneeChange(e) {
    const v = e.target.value
    setForm((f) => ({ ...f, assignee: v }))
    setAssigneeError('')
    const trimmed = v.trim()
    if (!trimmed) {
      setAssigneeOpen(false)
    } else if (teamMembers.includes(trimmed)) {
      setAssigneeOpen(false)
    } else {
      setAssigneeOpen(true)
    }
  }
  function selectAssignee(name) {
    setForm((f) => ({ ...f, assignee: name }))
    setAssigneeError('')
    setAssigneeOpen(false)
  }
  function handleAssigneeBlur(e) {
    const v = e.target.value
    setTimeout(() => {
      setAssigneeOpen(false)
      const trimmed = v.trim()
      if (trimmed && !teamMembers.includes(trimmed)) {
        setAssigneeError('등록되지 않은 담당자입니다')
      } else {
        setAssigneeError('')
      }
    }, 120)
  }
  function triggerAssigneeShake() {
    setAssigneeShake(true)
    setTimeout(() => setAssigneeShake(false), 400)
  }

  async function saveTask(e) {
    e.preventDefault()
    if (!form.title.trim()) { alert('업무 제목을 입력하세요.'); return }
    if (!form.start_date || !form.end_date || form.start_date > form.end_date) { alert('시작일과 종료일을 확인하세요.'); return }
    if (form.feedback_start && (form.feedback_start < form.start_date || form.feedback_start > form.end_date)) {
      alert('피드백 시작일은 일정 기간 내에 있어야 해요.')
      return
    }
    const trimmedAssignee = form.assignee.trim()
    if (trimmedAssignee && !teamMembers.includes(trimmedAssignee)) {
      setAssigneeError('등록되지 않은 담당자입니다')
      triggerAssigneeShake()
      return
    }
    const payload = {
      title: form.title.trim(), category: form.category, assignee: trimmedAssignee,
      status: form.status, start_date: form.start_date, end_date: form.end_date,
      description: form.description.trim(), project_id: projectId, created_by: session.user.id,
      feedback_start: form.feedback_start || null,
    }
    if (editingId) {
      await supabase.from('tasks').update(payload).eq('id', editingId)
    } else {
      await supabase.from('tasks').insert(payload)
    }
    const shouldNotify = trimmedAssignee && (editingId === null || originalAssignee !== trimmedAssignee)
    if (shouldNotify) {
      supabase.functions
        .invoke('notify-discord', { body: { type: 'assigned', task: payload, projectName: project?.name } })
        .catch((err) => console.warn('디스코드 알림 전송 실패', err))
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

  function openPeriodForm() {
    setPeriodForm({ start_date: project.start_date, end_date: project.end_date })
    setPeriodOpen(true)
  }
  async function savePeriod(e) {
    e.preventDefault()
    if (!periodForm.start_date || !periodForm.end_date || periodForm.start_date > periodForm.end_date) {
      alert('프로젝트 기간을 확인해주세요.')
      return
    }
    await supabase.from('projects').update({ start_date: periodForm.start_date, end_date: periodForm.end_date }).eq('id', projectId)
    setPeriodOpen(false)
    loadProject()
  }

  async function sendDeadlineAlert() {
    setSendingDigest(true)
    try {
      const { data, error } = await supabase.functions.invoke('notify-discord', { body: { type: 'digest', projectId } })
      if (error) throw error
      if (data?.skipped) {
        alert('현재 마감 임박이나 기한 초과인 일정이 없어요.')
      } else {
        alert('디스코드에 알림을 보냈어요.')
      }
    } catch (err) {
      console.error('마감 임박 알림 전송 실패', err)
      alert('알림 전송에 실패했어요. 콘솔을 확인해주세요.')
    } finally {
      setSendingDigest(false)
    }
  }

  function clampToRange(iso) {
    if (iso < range.start) return range.start
    if (iso > range.end) return range.end
    return iso
  }

  function handleBarMouseDown(t, e, mode) {
    e.preventDefault()
    e.stopPropagation()
    const downDay = computeDayFromEvent(e, t.category)
    setTaskDrag({ taskId: t.id, category: t.category, mode, origStart: t.start_date, origEnd: t.end_date, downDay, deltaDays: 0 })
  }

  function computeTaskDragDates(drag) {
    const delta = drag.deltaDays || 0
    let newStart = drag.origStart
    let newEnd = drag.origEnd
    if (drag.mode === 'move') {
      newStart = clampToRange(addDays(drag.origStart, delta))
      newEnd = clampToRange(addDays(drag.origEnd, delta))
    } else if (drag.mode === 'resize-start') {
      newStart = clampToRange(addDays(drag.origStart, delta))
      if (newStart > drag.origEnd) newStart = drag.origEnd
    } else if (drag.mode === 'resize-end') {
      newEnd = clampToRange(addDays(drag.origEnd, delta))
      if (newEnd < drag.origStart) newEnd = drag.origStart
    }
    return { newStart, newEnd }
  }

  useEffect(() => {
    if (!taskDrag) return
    function onMove(e) {
      const day = computeDayFromEvent(e, taskDrag.category)
      setTaskDrag((prev) => (prev ? { ...prev, deltaDays: day - prev.downDay } : prev))
    }
    function onUp() {
      setTaskDrag((prev) => {
        if (prev) {
          if (prev.deltaDays === 0) {
            const t = tasks.find((x) => x.id === prev.taskId)
            if (t) setDetailTask(t)
          } else {
            const { newStart, newEnd } = computeTaskDragDates(prev)
            supabase
              .from('tasks')
              .update({ start_date: newStart, end_date: newEnd })
              .eq('id', prev.taskId)
              .then(() => loadTasks())
          }
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
  }, [taskDrag])

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
          setAssigneeError('')
          setAssigneeOpen(false)
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
          <div className="sub">
            {range.start.replace(/-/g, '.')} — {range.end.replace(/-/g, '.')}
            {project && <span className="period-edit-link" onClick={openPeriodForm}>기간 수정</span>}
          </div>
        </div>
        <button className="btn primary" onClick={openAddForm}>+ 새 일정 추가</button>
      </div>

      {(overdueCount > 0 || dueSoonCount > 0) && (
        <div className="board-alert">
          {overdueCount > 0 && <span className="alert-pill overdue">기한 초과 {overdueCount}건</span>}
          {dueSoonCount > 0 && <span className="alert-pill due-soon">마감 임박 {dueSoonCount}건</span>}
          <button className="btn btn-small" onClick={sendDeadlineAlert} disabled={sendingDigest}>
            {sendingDigest ? '전송 중...' : '디스코드로 알림 보내기'}
          </button>
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

      <div className="legend-hint">
        <span className="legend-swatch"></span> 빗금 = 피드백(컨펌) 기간
      </div>

      <div className="board">
        <div className="gantt-scroll" ref={scrollRef}>
          <div className="gantt">
            <div className="gantt-header">
              <div className="week-row">
                <div className="row-label-col"></div>
                <div style={{ display: 'flex' }}>
                  {weekGroups.map((g, idx) => (
                    <div key={idx} className="week-cell" style={{ width: g.span * DAY_W }}>{g.label}</div>
                  ))}
                </div>
              </div>
              <div className="day-row">
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
                      {dayLineOffsets.map((x, i) => (
                        <div key={i} className="grid-line" style={{ left: x }}></div>
                      ))}
                      {isDraggingThis && <div className="drag-select" style={{ left: selLeft, width: selWidth }}></div>}
                    </div>
                  </div>
                  {catTasks.map((t) => {
                    const isDraggingTask = taskDrag && taskDrag.taskId === t.id
                    let dispStart = t.start_date
                    let dispEnd = t.end_date
                    if (isDraggingTask) {
                      const computed = computeTaskDragDates(taskDrag)
                      dispStart = computed.newStart
                      dispEnd = computed.newEnd
                    }
                    const off = daysBetween(range.start, dispStart)
                    const len = daysBetween(dispStart, dispEnd) + 1
                    const left = off * DAY_W
                    const width = Math.max(len * DAY_W - 6, DAY_W - 6)
                    const overdue = isOverdue(t)
                    const dueSoon = isDueSoon(t)
                    let feedbackLeft = null
                    let feedbackWidth = null
                    if (t.feedback_start && t.feedback_start >= dispStart && t.feedback_start <= dispEnd) {
                      feedbackLeft = daysBetween(dispStart, t.feedback_start) * DAY_W
                      feedbackWidth = width - feedbackLeft
                    }
                    return (
                      <div className={`task-row ${cat}`} key={t.id}>
                        <div className="row-label-col" title={t.title}>{t.title}</div>
                        <div className="task-track" style={{ width: trackWidth }}>
                          {dayLineOffsets.map((x, i) => (
                            <div key={i} className="grid-line" style={{ left: x }}></div>
                          ))}
                          <div className="today-line" style={{ left: todayLeft }}></div>
                          <div
                            className={`bar ${cat} ${t.status === 'done' ? 'status-done' : ''} ${overdue ? 'overdue' : ''} ${dueSoon ? 'due-soon' : ''} ${isDraggingTask ? 'dragging' : ''}`}
                            style={{ left, width }}
                            onMouseDown={(e) => handleBarMouseDown(t, e, 'move')}
                            title={t.feedback_start ? `작업: ${t.start_date}~${addDays(t.feedback_start, -1)} / 피드백: ${t.feedback_start}~${t.end_date}` : t.title}
                          >
                            <div className="bar-handle bar-handle-left" onMouseDown={(e) => handleBarMouseDown(t, e, 'resize-start')}></div>
                            {feedbackLeft !== null && (
                              <div className="bar-feedback" style={{ left: feedbackLeft, width: feedbackWidth }}></div>
                            )}
                            <span className="bar-label">{t.title}</span>
                            <div className="bar-handle bar-handle-right" onMouseDown={(e) => handleBarMouseDown(t, e, 'resize-end')}></div>
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
            {detailTask.feedback_start && (
              <div className="detail-row"><span>피드백 기간</span><span>{detailTask.feedback_start} ~ {detailTask.end_date}</span></div>
            )}
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
              <div className="field assignee-field">
                <label>담당자</label>
                <input
                  value={form.assignee}
                  onChange={handleAssigneeChange}
                  onFocus={() => form.assignee.trim() && assigneeSuggestions.length > 0 && setAssigneeOpen(true)}
                  onBlur={handleAssigneeBlur}
                  placeholder="담당자 이름 검색"
                  autoComplete="off"
                  className={assigneeShake ? 'shake' : ''}
                />
                {assigneeOpen && assigneeSuggestions.length > 0 && (
                  <div className="autocomplete-dropdown">
                    {assigneeSuggestions.map((name) => (
                      <div key={name} className="autocomplete-item" onMouseDown={() => selectAssignee(name)}>{name}</div>
                    ))}
                  </div>
                )}
                {assigneeError && <div className="field-error">{assigneeError}</div>}
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
              <label>피드백(컨펌) 시작일 — 선택</label>
              <div className="field-row" style={{ alignItems: 'center' }}>
                <input
                  type="date"
                  value={form.feedback_start}
                  min={form.start_date}
                  max={form.end_date}
                  onChange={(e) => setForm({ ...form, feedback_start: e.target.value })}
                />
                {form.feedback_start && (
                  <button type="button" className="btn btn-small" onClick={() => setForm({ ...form, feedback_start: '' })}>없음</button>
                )}
              </div>
              <div className="field-hint">지정한 날짜부터 종료일까지가 피드백 기간이 돼요. 막대에 빗금으로 표시돼요.</div>
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

      <div className={`overlay ${periodOpen ? 'open' : ''}`} onClick={(e) => e.target === e.currentTarget && setPeriodOpen(false)}>
        <div className="modal">
          <h2>프로젝트 기간 수정</h2>
          <form onSubmit={savePeriod}>
            <div className="field-row">
              <div className="field">
                <label>시작일</label>
                <input type="date" value={periodForm.start_date} onChange={(e) => setPeriodForm({ ...periodForm, start_date: e.target.value })} />
              </div>
              <div className="field">
                <label>종료일</label>
                <input type="date" value={periodForm.end_date} onChange={(e) => setPeriodForm({ ...periodForm, end_date: e.target.value })} />
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setPeriodOpen(false)}>취소</button>
              <button type="submit" className="btn primary">저장</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
