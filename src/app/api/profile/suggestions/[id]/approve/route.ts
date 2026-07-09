import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { type ProfileItem, type ProfileType, nextProfileItemId } from '@/lib/profile'

export const dynamic = 'force-dynamic'

/**
 * PATCH /api/profile/suggestions/[id]/approve
 *
 * 核准一個 pending suggestion：
 *   - add → 建立 ProfileItem
 *   - update → 更新既有 ProfileItem
 *   - retire → 把既有 ProfileItem 標 retired
 *
 * body (optional): { reviewNote?: string }
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const body = await req.json().catch(() => ({}))
    const reviewNote = body?.reviewNote

    const suggestion = await db.pendingProfileSuggestion.findUnique({ where: { id } })
    if (!suggestion) {
      return NextResponse.json({ error: 'Suggestion not found' }, { status: 404 })
    }
    if (suggestion.status !== 'pending') {
      return NextResponse.json({ error: `Suggestion is already ${suggestion.status}` }, { status: 400 })
    }

    let resultItem: any = null

    if (suggestion.operation === 'add') {
      // 計算新 itemId
      const existingItems = await db.profileItem.findMany()
      const existingProfileItems: ProfileItem[] = existingItems.map((i) => ({
        id: i.id,
        itemId: i.itemId,
        type: i.type as ProfileType,
        name: i.name,
        content: i.content,
        rationale: i.rationale,
        status: i.status as 'active' | 'retired',
        source: i.source,
        sourceSuggestionId: i.sourceSuggestionId,
        createdAt: i.createdAt.toISOString(),
        updatedAt: i.updatedAt.toISOString(),
      }))

      const itemId = nextProfileItemId(existingProfileItems, suggestion.type as ProfileType)
      resultItem = await db.profileItem.create({
        data: {
          itemId,
          type: suggestion.type,
          name: suggestion.name || (suggestion.content || '').slice(0, 30),
          content: suggestion.content || '',
          rationale: suggestion.rationale,
          status: 'active',
          source: 'suggestion',
          sourceSuggestionId: suggestion.id,
        },
      })
    } else if (suggestion.operation === 'update') {
      if (!suggestion.existingItemId) {
        return NextResponse.json({ error: 'Suggestion missing existingItemId for update' }, { status: 400 })
      }
      const existing = await db.profileItem.findFirst({
        where: { itemId: suggestion.existingItemId },
      })
      if (!existing) {
        return NextResponse.json({ error: `Existing item ${suggestion.existingItemId} not found` }, { status: 404 })
      }
      const updateData: any = { updatedAt: new Date() }
      if (suggestion.content) updateData.content = suggestion.content
      if (suggestion.rationale) updateData.rationale = suggestion.rationale
      resultItem = await db.profileItem.update({ where: { id: existing.id }, data: updateData })
    } else if (suggestion.operation === 'retire') {
      if (!suggestion.existingItemId) {
        return NextResponse.json({ error: 'Suggestion missing existingItemId for retire' }, { status: 400 })
      }
      const existing = await db.profileItem.findFirst({
        where: { itemId: suggestion.existingItemId },
      })
      if (!existing) {
        return NextResponse.json({ error: `Existing item ${suggestion.existingItemId} not found` }, { status: 404 })
      }
      resultItem = await db.profileItem.update({
        where: { id: existing.id },
        data: { status: 'retired', updatedAt: new Date() },
      })
    } else {
      return NextResponse.json({ error: `Unknown operation: ${suggestion.operation}` }, { status: 400 })
    }

    // 標記 suggestion 為 approved
    await db.pendingProfileSuggestion.update({
      where: { id },
      data: {
        status: 'approved',
        reviewNote: reviewNote || null,
        reviewedAt: new Date(),
      },
    })

    return NextResponse.json({
      ok: true,
      operation: suggestion.operation,
      resultItem: resultItem
        ? {
            id: resultItem.id,
            itemId: resultItem.itemId,
            type: resultItem.type,
            status: resultItem.status,
          }
        : null,
    })
  } catch (error) {
    console.error('[PATCH /api/profile/suggestions/[id]/approve]', error)
    return NextResponse.json({ error: 'Failed to approve suggestion' }, { status: 500 })
  }
}
