import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// 取得單一專案詳情（含所有藥丸的 metadata，但不含 summaryJson 全文 — 太大）
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const project = await db.project.findUnique({
      where: { id },
      include: {
        pills: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            title: true,
            isCurrent: true,
            previousPillId: true,
            createdAt: true,
            // 不回傳 conversationText / summaryJson — 列表用不到
          },
        },
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    return NextResponse.json({ project })
  } catch (error) {
    console.error('[GET /api/projects/[id]]', error)
    return NextResponse.json({ error: 'Failed to fetch project' }, { status: 500 })
  }
}

// 刪除專案（含所有藥丸 — cascade）
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    await db.project.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[DELETE /api/projects/[id]]', error)
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 })
  }
}
