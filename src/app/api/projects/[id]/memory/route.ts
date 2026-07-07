import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { type MemorySummary, EMPTY_MEMORY, formatMemoryCard } from '@/lib/memory'

export const dynamic = 'force-dynamic'

/**
 * 給 agent 用的記憶端點
 *
 * GET /api/projects/[id]/memory
 *   - 預設回傳當前活躍藥丸的 JSON（給 agent 程式 parse）
 *   - ?format=text 回傳格式化好的「記憶卡」純文本（直接貼到 system prompt）
 *   - ?format=markdown 回傳 markdown 版本
 *
 * 範例：
 *   curl /api/projects/abc/memory
 *   curl /api/projects/abc/memory?format=text
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await ctx.params
    const format = req.nextUrl.searchParams.get('format') || 'json'

    const project = await db.project.findUnique({ where: { id: projectId } })
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const currentPill = await db.pill.findFirst({
      where: { projectId, isCurrent: true },
      orderBy: { createdAt: 'desc' },
    })

    if (!currentPill) {
      if (format === 'text' || format === 'markdown') {
        return new NextResponse(
          `🌿 【銀杏記憶卡】專案：${project.name}\n（這個專案還沒有記憶藥丸，請先在 UI 中煉一顆）`,
          { headers: { 'content-type': 'text/plain; charset=utf-8' } },
        )
      }
      return NextResponse.json({
        project: { id: project.id, name: project.name },
        memory: EMPTY_MEMORY,
        pillId: null,
        message: 'No pill yet',
      })
    }

    let summary: MemorySummary = EMPTY_MEMORY
    try {
      summary = JSON.parse(currentPill.summaryJson) as MemorySummary
    } catch {
      /* keep empty */
    }

    if (format === 'text') {
      const text = formatMemoryCard(project.name, summary, currentPill.title ?? undefined)
      return new NextResponse(text, {
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      })
    }

    if (format === 'markdown') {
      const md = formatMemoryAsMarkdown(project.name, summary, currentPill.title ?? undefined)
      return new NextResponse(md, {
        headers: { 'content-type': 'text/markdown; charset=utf-8' },
      })
    }

    // 預設 JSON
    return NextResponse.json({
      project: { id: project.id, name: project.name, emoji: project.emoji },
      pill: {
        id: currentPill.id,
        title: currentPill.title,
        createdAt: currentPill.createdAt,
      },
      memory: summary,
    })
  } catch (error) {
    console.error('[GET /api/projects/[id]/memory]', error)
    return NextResponse.json({ error: 'Failed to fetch memory' }, { status: 500 })
  }
}

function formatMemoryAsMarkdown(projectName: string, summary: MemorySummary, pillTitle?: string): string {
  const lines: string[] = []
  lines.push(`# 🌿 銀杏記憶卡 — ${projectName}`)
  if (pillTitle) lines.push(`\n*最近一次對話：${pillTitle}*\n`)

  if (summary.decisions.length > 0) {
    lines.push('## ✅ 已定案的決策')
    summary.decisions.forEach((d) => lines.push(`- ${d}`))
    lines.push('')
  }
  if (summary.openQuestions.length > 0) {
    lines.push('## ⚠️ 仍待討論的開放問題')
    summary.openQuestions.forEach((q) => lines.push(`- ${q}`))
    lines.push('')
  }
  if (summary.actionItems.length > 0) {
    lines.push('## 📋 行動項')
    summary.actionItems.forEach((a) => {
      const icon = a.status === 'done' ? '✅' : a.status === 'blocked' ? '🚫' : '⭕'
      const owner = a.owner ? ` — *@${a.owner}*` : ''
      lines.push(`- ${icon} ${a.task}${owner}`)
    })
    lines.push('')
  }
  if (summary.contextAnchors.length > 0) {
    lines.push('## 🎯 背景錨點（不可遺忘的脈絡）')
    summary.contextAnchors.forEach((c) => lines.push(`- ${c}`))
    lines.push('')
  }
  return lines.join('\n')
}
