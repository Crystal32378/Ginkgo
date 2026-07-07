import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { formatBrainProtocol, type KnowledgeItem, type KnowledgeType } from '@/lib/brain'

export const dynamic = 'force-dynamic'

/**
 * GET /api/projects/[id]/brain
 *   - 預設回傳 Brain 的所有 active KnowledgeItem（JSON）
 *   - ?format=protocol → 回傳 Brain Protocol 純文本（給 agent 貼到 system prompt）
 *   - ?include=retired → 也包含已退役的 items
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await ctx.params
    const format = req.nextUrl.searchParams.get('format') || 'json'
    const includeRetired = req.nextUrl.searchParams.get('include') === 'retired'

    const project = await db.project.findUnique({ where: { id: projectId } })
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const where: any = { projectId }
    if (!includeRetired) where.status = 'active'

    const items = await db.knowledgeItem.findMany({
      where,
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
      status: i.status as 'active' | 'retired',
      sourcePillId: i.sourcePillId,
      supersededById: i.supersededById,
      createdAt: i.createdAt.toISOString(),
      updatedAt: i.updatedAt.toISOString(),
    }))

    if (format === 'protocol') {
      const text = formatBrainProtocol(project.name, project.brainVersion, brainItems)
      return new NextResponse(text, {
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      })
    }

    return NextResponse.json({
      project: {
        id: project.id,
        name: project.name,
        emoji: project.emoji,
      },
      brainVersion: project.brainVersion,
      items: brainItems,
      activeCount: brainItems.filter((i) => i.status === 'active').length,
    })
  } catch (error) {
    console.error('[GET /api/projects/[id]/brain]', error)
    return NextResponse.json({ error: 'Failed to fetch brain' }, { status: 500 })
  }
}
