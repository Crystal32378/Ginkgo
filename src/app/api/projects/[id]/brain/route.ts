import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { formatBrainProtocol, type KnowledgeItem, type KnowledgeType } from '@/lib/brain'
import { formatProfileProtocol, type ProfileItem, type ProfileType } from '@/lib/profile'

export const dynamic = 'force-dynamic'

/**
 * GET /api/projects/[id]/brain
 *   - 預設回傳 Brain 的所有 active KnowledgeItem（JSON）
 *   - ?format=protocol → 回傳 Brain Protocol 純文本（前面自動加 User Profile 區塊）
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

    // 取得 User Profile（全局，跨專案）
    const profileRecords = await db.profileItem.findMany({
      where: { status: 'active' },
      orderBy: [{ type: 'asc' }, { itemId: 'asc' }],
    })
    const profileItems: ProfileItem[] = profileRecords.map((i) => ({
      id: i.id,
      itemId: i.itemId,
      type: i.type as ProfileType,
      name: i.name,
      content: i.content,
      rationale: i.rationale,
      status: 'active',
      source: i.source,
      sourceSuggestionId: i.sourceSuggestionId,
      createdAt: i.createdAt.toISOString(),
      updatedAt: i.updatedAt.toISOString(),
    }))

    if (format === 'protocol') {
      // Profile 在前，Brain 在後 — Profile 是「你是誰 + 怎麼合作」，Brain 是「這個專案知道什麼」
      const profileText = formatProfileProtocol(profileItems)
      const brainText = formatBrainProtocol(project.name, project.brainVersion, brainItems)
      const text = profileText ? `${profileText}\n---\n\n${brainText}` : brainText
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
      profile: {
        items: profileItems,
        activeCount: profileItems.length,
      },
    })
  } catch (error) {
    console.error('[GET /api/projects/[id]/brain]', error)
    return NextResponse.json({ error: 'Failed to fetch brain' }, { status: 500 })
  }
}
