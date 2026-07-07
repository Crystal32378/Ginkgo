import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// 刪除單一藥丸
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string; pillId: string }> }) {
  try {
    const { id: projectId, pillId } = await ctx.params

    const pill = await db.pill.findUnique({ where: { id: pillId } })
    if (!pill || pill.projectId !== projectId) {
      return NextResponse.json({ error: 'Pill not found' }, { status: 404 })
    }

    // 如果刪的是 current pill，把前一顆設為 current
    const wasCurrent = pill.isCurrent
    await db.pill.delete({ where: { id: pillId } })

    if (wasCurrent && pill.previousPillId) {
      await db.pill.update({
        where: { id: pill.previousPillId },
        data: { isCurrent: true },
      })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[DELETE /api/projects/[id]/pills/[pillId]]', error)
    return NextResponse.json({ error: 'Failed to delete pill' }, { status: 500 })
  }
}
