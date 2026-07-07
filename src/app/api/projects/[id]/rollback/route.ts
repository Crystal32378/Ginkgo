import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * 回滾到指定的藥丸 — 把指定 pill 設為 current，後續建立的都標為非 current
 *
 * POST /api/projects/[id]/rollback
 * body: { pillId: string }
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await ctx.params
    const { pillId } = await req.json()

    if (!pillId) {
      return NextResponse.json({ error: 'pillId is required' }, { status: 400 })
    }

    const target = await db.pill.findUnique({ where: { id: pillId } })
    if (!target || target.projectId !== projectId) {
      return NextResponse.json({ error: 'Pill not found in this project' }, { status: 404 })
    }

    await db.$transaction(async (tx) => {
      // 全部先標 false
      await tx.pill.updateMany({
        where: { projectId },
        data: { isCurrent: false },
      })
      // 指定那顆標 true
      await tx.pill.update({
        where: { id: pillId },
        data: { isCurrent: true },
      })
    })

    return NextResponse.json({ ok: true, currentPillId: pillId })
  } catch (error) {
    console.error('[POST /api/projects/[id]/rollback]', error)
    return NextResponse.json({ error: 'Failed to rollback' }, { status: 500 })
  }
}
