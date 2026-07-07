import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// 列出所有專案
export async function GET() {
  try {
    const projects = await db.project.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { pills: true, knowledgeItems: true } },
      },
    })
    return NextResponse.json({ projects })
  } catch (error) {
    console.error('[GET /api/projects]', error)
    return NextResponse.json({ error: 'Failed to list projects' }, { status: 500 })
  }
}

// 建立新專案
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, description, emoji } = body ?? {}

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    const project = await db.project.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        emoji: emoji?.trim() || '🌿',
      },
    })

    return NextResponse.json({ project }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/projects]', error)
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 })
  }
}
