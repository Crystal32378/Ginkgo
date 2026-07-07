import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// 列出這個專案的所有 pills（對話 log）
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await ctx.params
    const pills = await db.pill.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        tokenEstimate: true,
        createdAt: true,
        _count: { select: { knowledgeItems: true, distillationLogs: true } },
      },
    })

    return NextResponse.json({
      pills: pills.map((p) => ({
        ...p,
        knowledgeItemCount: p._count.knowledgeItems,
        distillationCount: p._count.distillationLogs,
        _count: undefined,
      })),
    })
  } catch (error) {
    console.error('[GET /api/projects/[id]/pills]', error)
    return NextResponse.json({ error: 'Failed to list pills' }, { status: 500 })
  }
}

// 刪除單一 pill（同時 cascade 刪掉 distillationLog，但 KnowledgeItem 設 sourcePillId=null）
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string; pillId: string }> }) {
  try {
    const { id: projectId, pillId } = await ctx.params

    const pill = await db.pill.findUnique({ where: { id: pillId } })
    if (!pill || pill.projectId !== projectId) {
      return NextResponse.json({ error: 'Pill not found' }, { status: 404 })
    }

    await db.pill.delete({ where: { id: pillId } })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[DELETE /api/projects/[id]/pills/[pillId]]', error)
    return NextResponse.json({ error: 'Failed to delete pill' }, { status: 500 })
  }
}
