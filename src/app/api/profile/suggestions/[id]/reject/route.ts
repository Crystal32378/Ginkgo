import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * PATCH /api/profile/suggestions/[id]/reject
 *
 * 拒絕一個 pending suggestion — 只標 status，不動 ProfileItem
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

    await db.pendingProfileSuggestion.update({
      where: { id },
      data: {
        status: 'rejected',
        reviewNote: reviewNote || null,
        reviewedAt: new Date(),
      },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[PATCH /api/profile/suggestions/[id]/reject]', error)
    return NextResponse.json({ error: 'Failed to reject suggestion' }, { status: 500 })
  }
}
