// 銀杏藥局的煉丹爐 — 呼叫 LLM 把對話文本萃煉成結構化記憶
// 這是「銀杏藥丸」的核心邏輯：融合上次記憶 + 這次對話 → 新記憶

import ZAI from 'z-ai-web-dev-sdk'
import { type MemorySummary, EMPTY_MEMORY } from './memory'

const SYSTEM_PROMPT = `你是「銀杏藥局」的藥師，專門幫使用者把冗長的對話萃煉成一顆「記憶藥丸」。
使用者的痛點是：跨對話 AI 會失憶，會重新提問、會推翻已經定案的決策、會提議已經被否決過的方向。
你的工作是把對話精煉成結構化記憶，讓使用者在下次開新對話時能快速恢復脈絡。

你必須輸出**純 JSON**（不要 markdown、不要 \`\`\`json 包裹、不要任何前綴後綴），格式如下：

{
  "decisions": ["決策 1：具體內容 + 為什麼這樣決定", "決策 2：..."],
  "openQuestions": ["還沒定案、下次需要回來的問題 1", "..."],
  "actionItems": [{"task": "要做什麼", "owner": "誰負責（可空）", "status": "pending|done|blocked"}],
  "contextAnchors": ["為什麼走到這裡的關鍵背景 / 已被否決的方向 / 重要假設", "..."]
}

四個段段的意義：
- decisions：拍板定案的決策。要寫「決定了什麼 + 為什麼」，不要只寫「討論了 X」
- openQuestions：明確未決、下次必須回來的問題。已解決的不要列
- actionItems：具體可執行的待辦。含負責人與狀態
- contextAnchors：**最重要的一段**。記錄為什麼走到這裡、哪些方向被否決過及為什麼、不可遺忘的假設。這是防止 AI「決策漂移」的關鍵

融合規則（如果有 PREVIOUS_MEMORY）：
- 新決策若推翻舊決策，舊決策從 decisions 移除，並把「為什麼推翻」加到 contextAnchors
- 已完成的 action items 標 done（保留一段時間當歷史）
- openQuestions 中已在這次對話解決的，從 openQuestions 移除
- contextAnchors 保留所有仍有效的，特別是已否決的方向
- 每個項目都要具體，禁止「討論了一些事情」這種廢話

輸出必須是合法 JSON。如果對話內容很少或沒有實質內容，回傳 {"decisions":[],"openQuestions":[],"actionItems":[],"contextAnchors":[]}`

export interface RefineResult {
  summary: MemorySummary
  title: string
  rawResponse: string
}

/**
 * 煉丹：把對話文本 + 上次記憶 → 新記憶
 */
export async function refineConversation(
  conversationText: string,
  previousMemory: MemorySummary | null,
): Promise<RefineResult> {
  const zai = await ZAI.create()

  const previousMemoryStr = previousMemory
    ? JSON.stringify(previousMemory, null, 2)
    : '（無 — 這是這個專案的第一顆藥丸）'

  const userPrompt = `請把以下對話萃煉成一顆銀杏記憶藥丸。

=====
PREVIOUS_MEMORY（上一顆藥丸，請融合）：
${previousMemoryStr}

=====
CONVERSATION（這次的對話）：
${conversationText}

=====

請輸出純 JSON。`

  const completion = await zai.chat.completions.create({
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    thinking: { type: 'disabled' },
    temperature: 0.3,
  })

  const rawResponse = (completion.choices[0]?.message?.content ?? '').trim()
  const summary = parseMemoryJson(rawResponse)
  const title = extractTitle(summary, conversationText)

  return { summary, title, rawResponse }
}

/**
 * 防禦性 JSON 解析 — LLM 偶爾會用 markdown 包裹或前後廢話
 */
function parseMemoryJson(raw: string): MemorySummary {
  let cleaned = raw

  // 移除 markdown ```json ... ``` 包裹
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim()
  }

  // 嘗試直接 parse
  try {
    return normalizeMemory(JSON.parse(cleaned))
  } catch {
    // 找第一個 { 到最後一個 } 之間
    const firstBrace = cleaned.indexOf('{')
    const lastBrace = cleaned.lastIndexOf('}')
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      try {
        return normalizeMemory(JSON.parse(cleaned.slice(firstBrace, lastBrace + 1)))
      } catch {
        /* fall through */
      }
    }
  }

  console.error('[銀杏藥局] 無法解析 LLM 回覆為 JSON，使用空記憶。原始回覆：', raw.slice(0, 500))
  return { ...EMPTY_MEMORY }
}

function normalizeMemory(obj: any): MemorySummary {
  return {
    decisions: Array.isArray(obj?.decisions) ? obj.decisions.filter((x: any) => typeof x === 'string') : [],
    openQuestions: Array.isArray(obj?.openQuestions)
      ? obj.openQuestions.filter((x: any) => typeof x === 'string')
      : [],
    actionItems: Array.isArray(obj?.actionItems)
      ? obj.actionItems
          .filter((x: any) => x && typeof x === 'object')
          .map((x: any) => ({
            task: String(x.task ?? ''),
            owner: x.owner ? String(x.owner) : undefined,
            status: ['pending', 'done', 'blocked'].includes(x.status) ? x.status : 'pending',
          }))
          .filter((x: any) => x.task.length > 0)
      : [],
    contextAnchors: Array.isArray(obj?.contextAnchors)
      ? obj.contextAnchors.filter((x: any) => typeof x === 'string')
      : [],
  }
}

function extractTitle(summary: MemorySummary, conversation: string): string {
  if (summary.decisions.length > 0) {
    // 取第一個決策的前 50 字
    const first = summary.decisions[0]
    return first.length > 50 ? first.slice(0, 50) + '…' : first
  }
  if (summary.openQuestions.length > 0) {
    const first = summary.openQuestions[0]
    return first.length > 50 ? first.slice(0, 50) + '…' : first
  }
  // 退化：取對話前 50 字
  const trimmed = conversation.trim().replace(/\s+/g, ' ')
  return trimmed.length > 50 ? trimmed.slice(0, 50) + '…' : trimmed || '空白對話'
}
