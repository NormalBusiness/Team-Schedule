import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'

export default function MemberPanel({ session }) {
  const [collapsed, setCollapsed] = useState(true)
  const [members, setMembers] = useState([])
  const [onlineIds, setOnlineIds] = useState(new Set())
  const [activeChat, setActiveChat] = useState(null)
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [unread, setUnread] = useState(new Set())

  const activeChatRef = useRef(null)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    activeChatRef.current = activeChat
  }, [activeChat])

  useEffect(() => {
    loadMembers()
  }, [])

  async function loadMembers() {
    const { data } = await supabase.from('profiles').select('id, name').neq('id', session.user.id).order('name')
    setMembers(data || [])
  }

  // ---------- 온라인 상태 (Presence) ----------
  useEffect(() => {
    const channel = supabase.channel('online-users', {
      config: { presence: { key: session.user.id } },
    })
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        setOnlineIds(new Set(Object.keys(state)))
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ online_at: new Date().toISOString() })
        }
      })
    return () => {
      supabase.removeChannel(channel)
    }
  }, [session.user.id])

  // ---------- 실시간 메시지 수신 ----------
  useEffect(() => {
    const channel = supabase
      .channel('dm-inbox')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${session.user.id}` },
        (payload) => {
          const msg = payload.new
          if (activeChatRef.current && activeChatRef.current.id === msg.sender_id) {
            setMessages((prev) => [...prev, msg])
          } else {
            setUnread((prev) => new Set(prev).add(msg.sender_id))
          }
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [session.user.id])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function openChat(member) {
    setActiveChat(member)
    setUnread((prev) => {
      const next = new Set(prev)
      next.delete(member.id)
      return next
    })
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(
        `and(sender_id.eq.${session.user.id},receiver_id.eq.${member.id}),and(sender_id.eq.${member.id},receiver_id.eq.${session.user.id})`
      )
      .order('created_at')
    setMessages(data || [])
  }

  async function sendMessage(e) {
    e.preventDefault()
    const text = draft.trim()
    if (!text || !activeChat) return
    setDraft('')
    const { data, error } = await supabase
      .from('messages')
      .insert({ sender_id: session.user.id, receiver_id: activeChat.id, content: text })
      .select()
      .single()
    if (!error && data) setMessages((prev) => [...prev, data])
  }

  const sortedMembers = [...members].sort((a, b) => {
    const aOnline = onlineIds.has(a.id) ? 0 : 1
    const bOnline = onlineIds.has(b.id) ? 0 : 1
    if (aOnline !== bOnline) return aOnline - bOnline
    return a.name.localeCompare(b.name)
  })

  const hasUnread = unread.size > 0

  return (
    <div className="member-panel">
      <button className="member-panel-tab" onClick={() => setCollapsed((c) => !c)}>
        <span className="tab-label-desktop">{collapsed ? (hasUnread ? '팀원 ●' : '팀원') : '접기 ›'}</span>
        <span className="tab-label-mobile">{collapsed ? '👥' : '✕'}</span>
        {collapsed && hasUnread && <span className="tab-unread-dot"></span>}
      </button>
      {!collapsed && (
        <div className="member-panel-body">
          {activeChat ? (
            <div className="chat-view">
              <div className="chat-header">
                <span className="chat-back" onClick={() => setActiveChat(null)}>←</span>
                <span className="chat-name">{activeChat.name}</span>
              </div>
              <div className="chat-messages">
                {messages.length === 0 && <div className="chat-empty">아직 메시지가 없어요. 먼저 말을 걸어보세요.</div>}
                {messages.map((m) => (
                  <div key={m.id} className={`chat-bubble ${m.sender_id === session.user.id ? 'mine' : 'theirs'}`}>
                    {m.content}
                  </div>
                ))}
                <div ref={messagesEndRef}></div>
              </div>
              <form className="chat-input-row" onSubmit={sendMessage}>
                <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="메시지 입력..." autoFocus />
                <button type="submit" className="btn primary btn-small">전송</button>
              </form>
            </div>
          ) : (
            <>
              <div className="member-panel-title">팀원 ({members.length})</div>
              <div className="member-list">
                {members.length === 0 && <div className="chat-empty">등록된 팀원이 없어요.</div>}
                {sortedMembers.map((m) => (
                  <div key={m.id} className="member-item" onClick={() => openChat(m)}>
                    <span className={`status-dot ${onlineIds.has(m.id) ? 'online' : ''}`}></span>
                    <span className="member-name">{m.name}</span>
                    {unread.has(m.id) && <span className="unread-dot"></span>}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
