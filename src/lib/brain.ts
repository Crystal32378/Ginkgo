// Brain 結構定義 — 8 種知識類型 + 格式化為 Protocol 文本

// 8 種 type（user 提的 9 種中砍掉 Assumption，併入 Hypothesis 加 confidence 欄位）
export const KNOWLEDGE_TYPES = [
  'DECISION',
  'CONSTRAINT',
  'PRINCIPLE',
  'DEFINITION',
  'FACT',
  'QUESTION',
  'RISK',
  'HYPOTHESIS',
] as const

export type KnowledgeType = (typeof KNOWLEDGE_TYPES)[number]

// type → ID 前綴
const TYPE_PREFIX: Record<KnowledgeType, string> = {
  DECISION: 'D',
  CONSTRAINT: 'C',
  PRINCIPLE: 'P',
  DEFINITION: 'DEF',
  FACT: 'F',
  QUESTION: 'Q',
  RISK: 'R',
  HYPOTHESIS: 'H',
}

// 反查：前綴 → type
const PREFIX_TO_TYPE: Record<string, KnowledgeType> = Object.entries(TYPE_PREFIX).reduce(
  (acc, [type, prefix]) => {
    acc[prefix] = type as KnowledgeType
    return acc
  },
  {} as Record<string, KnowledgeType>,
)

export function prefixForType(type: KnowledgeType): string {
  return TYPE_PREFIX[type]
}

export function typeFromItemId(itemId: string): KnowledgeType | null {
  const match = itemId.match(/^([A-Z]+)/)
  if (!match) return null
  return PREFIX_TO_TYPE[match[1]] ?? null
}

// type → emoji（給「今日銀杏」用）
export const TYPE_EMOJI: Record<KnowledgeType, string> = {
  DECISION: '✅',
  CONSTRAINT: '🔗',
  PRINCIPLE: '🧠',
  DEFINITION: '📖',
  FACT: '📌',
  QUESTION: '❓',
  RISK: '⚠️',
  HYPOTHESIS: '🔮',
}

// type → 中文名（給 UI 用）
export const TYPE_LABEL_ZH: Record<KnowledgeType, string> = {
  DECISION: '決策',
  CONSTRAINT: '限制',
  PRINCIPLE: '原則',
  DEFINITION: '定義',
  FACT: '事實',
  QUESTION: '問題',
  RISK: '風險',
  HYPOTHESIS: '假設',
}

export interface KnowledgeItem {
  id: string // DB cuid
  itemId: string // "D1", "C1", ...
  type: KnowledgeType
  name: string
  content: string
  rationale?: string | null
  confidence?: number | null
  status: 'active' | 'retired'
  sourcePillId?: string | null
  supersededById?: string | null
  createdAt: string
  updatedAt: string
}

export interface DistillationRitualStep {
  step: string
  detail?: string
  tokens?: number
  found?: number
  status: 'done'
}

export interface DeltaOperation {
  ritual: DistillationRitualStep[]
  delta: {
    add: Array<{
      type: KnowledgeType
      name: string
      content: string
      rationale?: string
      confidence?: number
    }>
    update: Array<{
      id: string // existing itemId like "D3"
      content?: string
      rationale?: string
      confidence?: number
    }>
    retire: Array<{
      id: string // existing itemId
      reason: string
      supersededBy?: string // optional: new itemId that replaces this
    }>
  }
}

/**
 * 把 Brain 的所有 active items 格式化成 Protocol 文本（給 AI 讀的）
 *
 * 範例：
 *   # Project Brain v0.24 · 25 items · 2026-07-07
 *
 *   [D17] DECISION  memory-structure = 4-section
 *                    rationale: solves amnesia
 *                    since: 2026-07-07 · source: pill_002
 *
 *   [C1]  CONSTRAINT  must run locally without cloud dependencies
 *                     source: user requirement
 *   ...
 */
export function formatBrainProtocol(
  projectName: string,
  brainVersion: number,
  items: KnowledgeItem[],
): string {
  const active = items.filter((i) => i.status === 'active')
  const lines: string[] = []

  lines.push(`# Project Brain v${brainVersion.toFixed(2)} · ${active.length} items · ${projectName}`)
  lines.push(`# distilled: ${new Date().toISOString().slice(0, 10)}`)
  lines.push(`#`)
  lines.push(`# 8-type taxonomy: DECISION / CONSTRAINT / PRINCIPLE / DEFINITION / FACT / QUESTION / RISK / HYPOTHESIS`)
  lines.push(`# Use [ID] to reference any item (e.g., "Regarding D3, ...")`)
  lines.push('')

  // 按 type 分組，每組內按 itemId 排序
  const grouped: Record<string, KnowledgeItem[]> = {}
  for (const item of active) {
    if (!grouped[item.type]) grouped[item.type] = []
    grouped[item.type].push(item)
  }

  for (const type of KNOWLEDGE_TYPES) {
    const group = grouped[type]
    if (!group || group.length === 0) continue
    // 按 itemId 數字排序
    group.sort((a, b) => {
      const na = parseInt(a.itemId.replace(/^[A-Z]+/, ''), 10) || 0
      const nb = parseInt(b.itemId.replace(/^[A-Z]+/, ''), 10) || 0
      return na - nb
    })

    lines.push(`# === ${type} (${group.length}) ===`)
    for (const item of group) {
      lines.push(formatItemLine(item))
    }
    lines.push('')
  }

  return lines.join('\n')
}

function formatItemLine(item: KnowledgeItem): string {
  const lines: string[] = []
  // 主行：[ID] TYPE  content
  lines.push(`[${item.itemId}] ${item.type}  ${item.content}`)

  // 縮排欄位
  const indent = ' '.repeat(Math.max(item.itemId.length + 2, 6))
  if (item.rationale) {
    lines.push(`${indent}rationale: ${item.rationale}`)
  }
  if (item.type === 'HYPOTHESIS' && item.confidence != null) {
    lines.push(`${indent}confidence: ${item.confidence.toFixed(2)}`)
  }
  if (item.sourcePillId) {
    lines.push(`${indent}source: ${item.sourcePillId.slice(-6)}`)
  }
  return lines.join('\n')
}

/**
 * 計算下一個 itemId（例如目前最大是 D5 → 下一個是 D6）
 */
export function nextItemId(existingItems: KnowledgeItem[], type: KnowledgeType): string {
  const prefix = prefixForType(type)
  let max = 0
  for (const item of existingItems) {
    if (typeFromItemId(item.itemId) === type) {
      const num = parseInt(item.itemId.replace(/^[A-Z]+/, ''), 10) || 0
      if (num > max) max = num
    }
  }
  return `${prefix}${max + 1}`
}

/**
 * 給「今日銀杏」用的統計 — 從 delta 計算每種 type 新增幾個
 */
export function summarizeDelta(delta: DeltaOperation['delta']): Record<KnowledgeType, number> {
  const result = {} as Record<KnowledgeType, number>
  for (const type of KNOWLEDGE_TYPES) result[type] = 0
  for (const add of delta.add) {
    if (result[add.type] !== undefined) result[add.type]++
  }
  return result
}

/**
 * 粗估 token 數 — 1 token ≈ 4 chars（英文）或 ≈ 1.5 chars（中文混合）
 * 用 3 作為折衷
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3)
}
