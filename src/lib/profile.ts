// User Profile — 6 種 type 定義 + Profile Protocol 格式化
//
// 設計理念（user 指定）：
// 不是記錄「你是誰」，而是累積「如何與你合作」
// 跨專案、長期生效。錯了比 Project Brain 更危險。

export const PROFILE_TYPES = [
  'REASONING_PATTERN',   // 思考模式 — AI 主動展現
  'COLLABORATION_PREF',  // 協作偏好 — AI 遵守限制
  'COMMUNICATION_STYLE', // 溝通風格 — AI 匹配輸出
  'WORKING_RHYTHM',      // 工作節奏 — AI 配合時機
  'DOMAIN_CONTEXT',      // 領域背景 — AI 預設理解
  'PET_PEEVE',           // 地雷 — AI 主動避開
] as const

export type ProfileType = (typeof PROFILE_TYPES)[number]

const TYPE_PREFIX: Record<ProfileType, string> = {
  REASONING_PATTERN: 'RP',
  COLLABORATION_PREF: 'CP',
  COMMUNICATION_STYLE: 'CS',
  WORKING_RHYTHM: 'WR',
  DOMAIN_CONTEXT: 'DC',
  PET_PEEVE: 'PP',
}

const PREFIX_TO_TYPE: Record<string, ProfileType> = Object.entries(TYPE_PREFIX).reduce(
  (acc, [type, prefix]) => {
    acc[prefix] = type as ProfileType
    return acc
  },
  {} as Record<string, ProfileType>,
)

export function prefixForType(type: ProfileType): string {
  return TYPE_PREFIX[type]
}

export function typeFromItemId(itemId: string): ProfileType | null {
  const match = itemId.match(/^([A-Z]+)/)
  if (!match) return null
  return PREFIX_TO_TYPE[match[1]] ?? null
}

export const PROFILE_TYPE_EMOJI: Record<ProfileType, string> = {
  REASONING_PATTERN: '🧠',
  COLLABORATION_PREF: '🤝',
  COMMUNICATION_STYLE: '✍️',
  WORKING_RHYTHM: '⏰',
  DOMAIN_CONTEXT: '🎯',
  PET_PEEVE: '🚫',
}

export const PROFILE_TYPE_LABEL_ZH: Record<ProfileType, string> = {
  REASONING_PATTERN: '思考模式',
  COLLABORATION_PREF: '協作偏好',
  COMMUNICATION_STYLE: '溝通風格',
  WORKING_RHYTHM: '工作節奏',
  DOMAIN_CONTEXT: '領域背景',
  PET_PEEVE: '地雷',
}

// AI 收到後該做什麼的指令描述（給 Profile Protocol 用）
const TYPE_DIRECTIVE: Record<ProfileType, string> = {
  REASONING_PATTERN: 'proactively demonstrate this thinking approach',
  COLLABORATION_PREF: 'strictly follow this constraint',
  COMMUNICATION_STYLE: 'match this output style',
  WORKING_RHYTHM: 'accommodate this timing pattern',
  DOMAIN_CONTEXT: 'assume this background without re-explanation',
  PET_PEEVE: 'actively avoid this',
}

export interface ProfileItem {
  id: string
  itemId: string
  type: ProfileType
  name: string
  content: string
  rationale?: string | null
  status: 'active' | 'retired'
  source: string
  sourceSuggestionId?: string | null
  createdAt: string
  updatedAt: string
}

export interface ProfileDeltaItem {
  type: ProfileType
  name: string
  content: string
  rationale?: string
}

export interface ProfileDeltaOperation {
  add: ProfileDeltaItem[]
  update: Array<{
    id: string // existing itemId like "RP1"
    content?: string
    rationale?: string
  }>
  retire: Array<{
    id: string // existing itemId
    reason: string
  }>
}

export function emptyProfileDelta(): ProfileDeltaOperation {
  return { add: [], update: [], retire: [] }
}

/**
 * 計算下一個 itemId（全局唯一編號，每個 type 獨立累加）
 */
export function nextProfileItemId(existingItems: ProfileItem[], type: ProfileType): string {
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
 * 把 Profile items 格式化成 Protocol 文本（給 AI 讀的）
 *
 * 範例：
 *   # User Profile · 6 items · 2026-07-09
 *   # These describe how to collaborate with this user — apply across all projects.
 *
 *   # === REASONING_PATTERN (1) ===
 *   [RP1] REASONING_PATTERN  ask-why-first
 *          rationale: user prefers understanding motivation before solution
 *          directive: proactively demonstrate this thinking approach
 */
export function formatProfileProtocol(items: ProfileItem[]): string {
  const active = items.filter((i) => i.status === 'active')
  if (active.length === 0) return ''

  const lines: string[] = []
  lines.push(`# User Profile · ${active.length} items · ${new Date().toISOString().slice(0, 10)}`)
  lines.push(`# These describe how to collaborate with this user — apply across all projects.`)
  lines.push(`#`)
  lines.push(`# 6-type taxonomy: REASONING_PATTERN / COLLABORATION_PREF / COMMUNICATION_STYLE / WORKING_RHYTHM / DOMAIN_CONTEXT / PET_PEEVE`)
  lines.push(`# Use [ID] to reference any item (e.g., "Per RP1, I will...")`)
  lines.push('')

  const grouped: Record<string, ProfileItem[]> = {}
  for (const item of active) {
    if (!grouped[item.type]) grouped[item.type] = []
    grouped[item.type].push(item)
  }

  for (const type of PROFILE_TYPES) {
    const group = grouped[type]
    if (!group || group.length === 0) continue
    group.sort((a, b) => {
      const na = parseInt(a.itemId.replace(/^[A-Z]+/, ''), 10) || 0
      const nb = parseInt(b.itemId.replace(/^[A-Z]+/, ''), 10) || 0
      return na - nb
    })

    lines.push(`# === ${type} (${group.length}) ===`)
    for (const item of group) {
      lines.push(formatProfileItemLine(item))
    }
    lines.push('')
  }

  return lines.join('\n')
}

function formatProfileItemLine(item: ProfileItem): string {
  const lines: string[] = []
  lines.push(`[${item.itemId}] ${item.type}  ${item.content}`)

  const indent = ' '.repeat(Math.max(item.itemId.length + 2, 6))
  if (item.rationale) {
    lines.push(`${indent}rationale: ${item.rationale}`)
  }
  // 加 directive 行 — 明確告訴 AI 這條 item 要怎麼應用
  const directive = TYPE_DIRECTIVE[item.type]
  if (directive) {
    lines.push(`${indent}directive: ${directive}`)
  }
  return lines.join('\n')
}
