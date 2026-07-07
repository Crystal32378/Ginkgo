import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { formatBrainProtocol, type KnowledgeItem, type KnowledgeType } from '@/lib/brain'

export const dynamic = 'force-dynamic'

/**
 * GET /api/projects/[id]/memory  (backward compat — 之前的端點)
 *
 * v2 架構下等同於 /brain。為了不破壞既有 Chrome 擴充，保留這個端點。
 *
 *   - ?format=text     → Brain Protocol 純文本
 *   - ?format=markdown → Brain Protocol 純文本（相同）
 *   - 預設 JSON        → { project, brainVersion, memory: {items} }
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await ctx.params
    const format = req.nextUrl.searchParams.get('format') || 'json'

    const project = await db.project.findUnique({ where: { id: projectId } })
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const items = await db.knowledgeItem.findMany({
      where: { projectId, status: 'active' },
      orderBy: [{ type: 'asc' }, { itemId: 'asc' }],
    })

    const brainItems: KnowledgeItem[] = items.map((i) => ({
      id: i.id,
      itemId: i.itemId,
      type: i.type as KnowledgeType,
      name: i.name,
      content: i.content,
      rationale: i.rationale,
      confidence: i.confidence,
      status: 'active',
      sourcePillId: i.sourcePillId,
      supersededById: i.supersededById,
      createdAt: i.createdAt.toISOString(),
      updatedAt: i.updatedAt.toISOString(),
    }))

    if (format === 'text' || format === 'markdown' || format === 'protocol') {
      const text = formatBrainProtocol(project.name, project.brainVersion, brainItems)
      return new NextResponse(text, {
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      })
    }

    return NextResponse.json({
      project: { id: project.id, name: project.name, emoji: project.emoji },
      brainVersion: project.brainVersion,
      memory: { items: brainItems },
      activeCount: brainItems.length,
      note: 'v2 architecture — use /api/projects/[id]/brain for the canonical endpoint',
    })
  } catch (error) {
    console.error('[GET /api/projects/[id]/memory]', error)
    return NextResponse.json({ error: 'Failed to fetch memory' }, { status: 500 })
  }
}
