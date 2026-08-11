import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const DISCORD_WEBHOOK_URL = Deno.env.get('DISCORD_WEBHOOK_URL') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const CAT_LABEL: Record<string, string> = { art: '아트', plan: '기획', dev: '플밍', effect: '이펙트', sound: '사운드' }

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

async function postToDiscord(content: string) {
  if (!DISCORD_WEBHOOK_URL) {
    console.warn('DISCORD_WEBHOOK_URL 시크릿이 설정되어 있지 않습니다.')
    return
  }
  const res = await fetch(DISCORD_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  })
  if (!res.ok) {
    const text = await res.text()
    console.error('디스코드 웹훅 응답 오류', res.status, text)
  } else {
    console.log('디스코드 전송 성공', res.status)
  }
}

// 담당자 이름 -> 디스코드 멘션 문자열. discord_id가 등록되어 있으면 실제 핑이 울리는 <@id> 형태,
// 없으면 그냥 @이름 텍스트로 표시됨.
// 한글은 입력 환경에 따라 눈에는 같아 보여도 유니코드 정규화 형태(NFC/NFD)가 달라
// 문자열이 다르게 취급될 수 있어, 비교 전에 NFC로 통일한다.
function norm(s: string | null | undefined): string {
  return (s ?? '').normalize('NFC').trim()
}

async function buildMentionMap(names: string[]): Promise<Record<string, string>> {
  const map: Record<string, string> = {}
  const uniqueNames = Array.from(new Set(names.filter(Boolean).map(norm)))
  if (uniqueNames.length === 0) return map
  const { data, error } = await supabase.from('profiles').select('name, discord_id').in('name', uniqueNames)
  if (error) {
    console.error('profiles 조회 실패', error)
  }
  console.log('멘션 매칭 대상:', uniqueNames, '/ profiles 조회 결과:', data)
  ;(data || []).forEach((p: any) => {
    map[norm(p.name)] = p.discord_id ? `<@${p.discord_id}>` : `@${p.name}`
  })
  uniqueNames.forEach((n) => {
    if (!map[n]) map[n] = `@${n}`
  })
  return map
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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  let body
  try {
    body = await req.json()
  } catch {
    console.warn('요청 본문이 비어있거나 JSON 형식이 아닙니다. (테스트 호출일 수 있음)')
    return new Response(JSON.stringify({ ok: false, error: 'empty or invalid JSON body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    console.log('notify-discord 호출됨, type =', body?.type)

    // ---------- 업무 배정 알림 ----------
    if (body.type === 'assigned') {
      const t = body.task
      const cat = CAT_LABEL[t.category] || t.category
      const mentionMap = await buildMentionMap([t.assignee])
      const mention = t.assignee ? (mentionMap[norm(t.assignee)] || `@${t.assignee}`) : '담당자 미지정'
      const content =
        `📌 **${t.title}** 업무가 ${mention}님에게 배정되었습니다.\n` +
        `프로젝트: ${body.projectName ?? '알 수 없음'} · 카테고리: ${cat}\n` +
        `기간: ${t.start_date} ~ ${t.end_date}`
      await postToDiscord(content)
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ---------- 마감 임박/초과 알림 (자동 스케줄 또는 수동 버튼) ----------
    if (body.type === 'digest') {
      const today = todayISO()

      // 시작일이 도래한 '예정' 일정을 자동으로 '진행중'으로 전환
      let promoteQuery = supabase.from('tasks').update({ status: 'doing' }).eq('status', 'todo').lte('start_date', today)
      if (body.projectId) promoteQuery = promoteQuery.eq('project_id', body.projectId)
      const { error: promoteError } = await promoteQuery
      if (promoteError) console.error('자동 상태 전환 실패', promoteError)

      let query = supabase
        .from('tasks')
        .select('title, assignee, status, end_date, category, projects(name)')
        .neq('status', 'done')
      if (body.projectId) {
        query = query.eq('project_id', body.projectId)
      }
      const { data: tasks, error } = await query
      if (error) throw error

      const soonCutoff = addDaysISO(2)

      const overdue = (tasks || []).filter((t: any) => t.end_date < today)
      const dueSoon = (tasks || []).filter((t: any) => t.end_date >= today && t.end_date <= soonCutoff)
      // 마감 임박/초과에 이미 포함되지 않은, 그 외 진행 중인 업무 전체
      const inProgress = (tasks || []).filter((t: any) => t.status === 'doing' && t.end_date > soonCutoff)

      if (overdue.length === 0 && dueSoon.length === 0 && inProgress.length === 0) {
        return new Response(JSON.stringify({ ok: true, skipped: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const allNames = [...overdue, ...dueSoon, ...inProgress].map((t: any) => t.assignee).filter(Boolean)
      const mentionMap = await buildMentionMap(allNames)
      const mentionOf = (name?: string) => (name ? mentionMap[norm(name)] || `@${name}` : '미지정')

      let content = `📅 **오늘의 일정 알림** (${today})\n`
      if (overdue.length > 0) {
        content += `\n**⛔ 기한 초과 (${overdue.length}건)**\n`
        overdue.forEach((t: any) => {
          content += `- ${t.title} · ${mentionOf(t.assignee)} · ${t.projects?.name ?? ''} · ~${t.end_date}\n`
        })
      }
      if (dueSoon.length > 0) {
        content += `\n**⚠️ 마감 임박 (${dueSoon.length}건)**\n`
        dueSoon.forEach((t: any) => {
          content += `- ${t.title} · ${mentionOf(t.assignee)} · ${t.projects?.name ?? ''} · ~${t.end_date}\n`
        })
      }
      if (inProgress.length > 0) {
        content += `\n**🔧 진행 중인 업무 (${inProgress.length}건)**\n`
        inProgress.forEach((t: any) => {
          const cat = CAT_LABEL[t.category] || t.category
          content += `- ${t.title} (${cat}) · ${mentionOf(t.assignee)} · ${t.projects?.name ?? ''} · ~${t.end_date}\n`
        })
      }
      await postToDiscord(content)
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ---------- 컨펌(피드백) 요청 알림 ----------
    if (body.type === 'confirm_request') {
      const t = body.task
      const cat = CAT_LABEL[t.category] || t.category
      const mentionMap = await buildMentionMap([body.directorName])
      const mention = body.directorName ? (mentionMap[norm(body.directorName)] || `@${body.directorName}`) : '디렉터 미지정'
      const content =
        `🔔 컨펌 요청이 도착했어요, ${mention}님!\n` +
        `**${t.title}** (${cat}) · 담당자: ${t.assignee || '미지정'}\n` +
        `프로젝트: ${body.projectName ?? '알 수 없음'} · 기간: ${t.start_date} ~ ${t.end_date}` +
        (t.feedback_start ? `\n피드백 기간: ${t.feedback_start} ~ ${t.end_date}` : '')
      await postToDiscord(content)
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ ok: false, error: 'unknown type' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
