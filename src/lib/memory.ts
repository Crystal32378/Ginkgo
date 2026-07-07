// 銀杏藥丸的 4 段式結構化記憶
// 這是 LLM 萃取出來、存到資料庫、餵給下次對話的核心格式

export type ActionStatus = 'pending' | 'done' | 'blocked'

export interface ActionItem {
  task: string
  owner?: string
  status: ActionStatus
}

export interface MemorySummary {
  /** ✅ 拍板定案的決策（含為什麼這樣決定） */
  decisions: string[]
  /** ⚠️ 還沒定、下次必須回來的問題 */
  openQuestions: string[]
  /** 📋 誰要做什麼、狀態 */
  actionItems: ActionItem[]
  /** 🎯 為什麼走到這裡 — 阻止 AI 重新提議已否決過的方向 */
  contextAnchors: string[]
}

export const EMPTY_MEMORY: MemorySummary = {
  decisions: [],
  openQuestions: [],
  actionItems: [],
  contextAnchors: [],
}

/**
 * 把 MemorySummary 物件格式化成可貼到下次對話的純文本「記憶卡」
 * 這是給「你自己」用的：貼到 ChatGPT/Claude 新對話的第一則訊息
 */
export function formatMemoryCard(projectName: string, summary: MemorySummary, pillTitle?: string): string {
  const lines: string[] = []
  lines.push(`🌿 【銀杏記憶卡】專案：${projectName}`)
  if (pillTitle) lines.push(`   最近一次對話：${pillTitle}`)
  lines.push(`   載入時間：${new Date().toLocaleString('zh-TW')}`)
  lines.push('')
  lines.push('請在後續回覆中遵循以下脈絡，避免重新提問已討論過的事項或重新提議已否決的方向：')
  lines.push('')

  if (summary.decisions.length > 0) {
    lines.push('✅ 已定案的決策')
    summary.decisions.forEach((d, i) => lines.push(`  ${i + 1}. ${d}`))
    lines.push('')
  }

  if (summary.openQuestions.length > 0) {
    lines.push('⚠️ 仍待討論的開放問題')
    summary.openQuestions.forEach((q, i) => lines.push(`  ${i + 1}. ${q}`))
    lines.push('')
  }

  if (summary.actionItems.length > 0) {
    lines.push('📋 行動項')
    summary.actionItems.forEach((a, i) => {
      const statusIcon = a.status === 'done' ? '✓' : a.status === 'blocked' ? '✗' : '○'
      const ownerStr = a.owner ? ` (${a.owner})` : ''
      lines.push(`  ${statusIcon} ${a.task}${ownerStr}`)
    })
    lines.push('')
  }

  if (summary.contextAnchors.length > 0) {
    lines.push('🎯 背景錨點（重要假設、已否決的方向、不可遺忘的脈絡）')
    summary.contextAnchors.forEach((c, i) => lines.push(`  ${i + 1}. ${c}`))
    lines.push('')
  }

  if (
    summary.decisions.length === 0 &&
    summary.openQuestions.length === 0 &&
    summary.actionItems.length === 0 &&
    summary.contextAnchors.length === 0
  ) {
    lines.push('（這顆藥丸是空的 — 還沒煉出東西來）')
  }

  return lines.join('\n')
}
