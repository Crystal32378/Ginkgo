import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * GET /api/projects/[id]/diary
 *   - 回傳這個專案的所有蒸餾 log（Distillation Diary）
 *   - 用於右側「Distillation Diary」面板
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await ctx.params

    const project = await db.project.findUnique({ where: { id: projectId } })
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const logs = await db.distillationLog.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        pill: {
          select: { id: true, title: true, tokenEstimate: true, createdAt: true },
        },
      },
    })

    const parsed = logs.map((log) => {
      let ritual: any[] = []
      let delta: any = {}
      try {
        ritual = JSON.parse(log.ritualSteps)
      } catch {
        /* empty */
      }
      try {
        delta = JSON.parse(log.deltaSummary)
      } catch {
        /* empty */
      }
      return {
        id: log.id,
        pillId: log.pillId,
        pillTitle: log.pill?.title,
        brainVersionBefore: log.brainVersionBefore,
        brainVersionAfter: log.brainVersionAfter,
        ritualSteps: ritual,
        deltaSummary: delta,
        tokensRead: log.tokensRead,
        tokensSavedEstimate: log.tokensSavedEstimate,
        createdAt: log.createdAt.toISOString(),
      }
    })

    return NextResponse.json({ logs: parsed })
  } catch (error) {
    console.error('[GET /api/projects/[id]/diary]', error)
    return NextResponse.json({ error: 'Failed to fetch diary' }, { status: 500 })
  }
}
