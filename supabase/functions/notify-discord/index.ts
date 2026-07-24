import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const DISCORD_WEBHOOK_URL = Deno.env.get('DISCORD_WEBHOOK_URL') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const CAT_LABEL: Record<string, string> = { art: '아트', plan: '기획', dev: '플밍', effect: '이펙트' }

async function postToDiscord(content: string) {
  if (!DISCORD_WEBHOOK_URL) {
    console.warn('DISCORD_WEBHOOK_URL 시크릿이 설정되어 있지 않습니다.')
    return
  }
  await fetch(DISCORD_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  })
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}
function addDaysISO(n: number) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

Deno.serve(async (req) => {
  try {
    const body = await req.json()

    // ---------- 업무 배정 알림 ----------
    if (body.type === 'assigned') {
      const t = body.task
      const cat = CAT_LABEL[t.category] || t.category
      const content =
        `📌 **${t.title}** 업무가 **${t.assignee}**님에게 배정되었습니다.\n` +
        `프로젝트: ${body.projectName ?? '알 수 없음'} · 카테고리: ${cat}\n` +
        `기간: ${t.start_date} ~ ${t.end_date}`
      await postToDiscord(content)
      return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } })
    }

    // ---------- 마감 임박/초과 일일 요약 알림 ----------
    if (body.type === 'digest') {
      const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
      const { data: tasks, error } = await supabase
        .from('tasks')
        .select('title, assignee, status, end_date, category, projects(name)')
        .neq('status', 'done')

      if (error) throw error

      const today = todayISO()
      const soonCutoff = addDaysISO(2)

      const overdue = (tasks || []).filter((t: any) => t.end_date < today)
      const dueSoon = (tasks || []).filter((t: any) => t.end_date >= today && t.end_date <= soonCutoff)

      if (overdue.length === 0 && dueSoon.length === 0) {
        return new Response(JSON.stringify({ ok: true, skipped: true }), { headers: { 'Content-Type': 'application/json' } })
      }

      let content = `📅 **오늘의 일정 알림** (${today})\n`
      if (overdue.length > 0) {
        content += `\n**⛔ 기한 초과 (${overdue.length}건)**\n`
        overdue.forEach((t: any) => {
          content += `- ${t.title} · ${t.assignee || '미지정'} · ${t.projects?.name ?? ''} · ~${t.end_date}\n`
        })
      }
      if (dueSoon.length > 0) {
        content += `\n**⚠️ 마감 임박 (${dueSoon.length}건)**\n`
        dueSoon.forEach((t: any) => {
          content += `- ${t.title} · ${t.assignee || '미지정'} · ${t.projects?.name ?? ''} · ~${t.end_date}\n`
        })
      }
      await postToDiscord(content)
      return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ ok: false, error: 'unknown type' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
