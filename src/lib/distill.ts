// Ginkgo Distillation Engine — 把對話蒸餾成 Brain 的 delta operation
//
// 與 refine.ts 不同：
//   - refine.ts 是「summary engine」— 輸出完整記憶摘要
//   - distill.ts 是「distillation engine」— 輸出 delta operation（add/update/retire）
//     + ritual steps（推理過程，可檢視）
//
// Backend：支援 zai 與 openai（沿用 refine.ts 的選擇機制）

import ZAI from 'z-ai-web-dev-sdk'
import {
  type KnowledgeItem,
  type KnowledgeType,
  type DeltaOperation,
  type DistillationRitualStep,
  KNOWLEDGE_TYPES,
  TYPE_LABEL_ZH,
} from './brain'
import {
  type ProfileItem,
  type ProfileType,
  type ProfileDeltaOperation,
  PROFILE_TYPES,
  emptyProfileDelta,
} from './profile'

const SYSTEM_PROMPT = `你是「Ginkgo」的蒸餾引擎 (Distillation Engine)。

你的任務不是「摘要對話」，而是「提煉知識」— 同時做兩件事：
1. 把對話中的 stable knowledge 蒸餾成 Project Brain 的 delta operation
2. 觀察對話中透露的「如何與這個人合作」的模式，提煉成 User Profile suggestions

# Brain 的 8 種知識類型（專案知識）

- DECISION   — 已定案的決策（含為什麼）
- CONSTRAINT — 外部或技術限制（不是選擇，是必須遵守的）
- PRINCIPLE  — 團隊慣例、設計原則
- DEFINITION — 名詞定義
- FACT       — 關於世界/tech stack/使用者的事實
- QUESTION   — 仍待討論、下次必須回來的問題
- RISK       — 有時效性的風險
- HYPOTHESIS — 未驗證的假設（要標 confidence 0-1）

# User Profile 的 6 種 type（跨專案、長期生效的合作記憶）

- REASONING_PATTERN  — 思考模式（如「先問 Why」「第一性原理」）— AI 應主動展現
- COLLABORATION_PREF — 協作偏好（如「不喜歡重複」「重視一致性」）— AI 應遵守
- COMMUNICATION_STYLE — 溝通風格（如「中英混寫」「簡潔」）— AI 應匹配
- WORKING_RHYTHM     — 工作節奏（如「burst 模式」「深夜不回」）— AI 應配合
- DOMAIN_CONTEXT     — 領域背景（如「熟悉 Next.js」「做過 SaaS」）— AI 應預設理解
- PET_PEEVE          — 地雷（如「討厭 AI 漂移」「討厭前言」）— AI 應主動避開

# 蒸餾原則

1. **蒸餾，不是摘要** — 萃取「跨時間、跨模型、跨 Agent 持續發揮價值的內容」
2. **重複偵測** — Brain 裡已有的不重複 add
3. **演化偵測** — 對話中推翻了 Brain 既有的 decision → update + 記錄「為什麼推翻」
4. **退役偵測** — Hypothesis 被驗證/推翻 → retire
5. **每條都要具體** — 禁止「討論了一些事情」這種廢話
6. **token 效率** — 每條 1-2 行

# Profile suggestion 的特殊規則

User Profile 是長期記憶，錯了會持續污染所有未來對話。所以：
1. **高標準** — 只在對話中有明確、重複、強烈的訊號時才提建議。單一模糊訊號不要提。
2. **觀察使用者行為**，不是使用者說的話 — 例如使用者連續 3 次說「不要前言」，這是 COLLABORATION_PREF；使用者說一次「我討厭前言」不夠。
3. **觀察使用者對 AI 的糾正** — 「你重複了」「我說過了」「不用解釋這個」是 PET_PEEVE 的強訊號。
4. **不要提抽象 personality** — 「使用者很聰明」「使用者有創意」這種不要。要可執行的指令。
5. **空陣列 OK** — 大多數對話不會透露 profile 訊號。沒有就回空陣列，不要硬擠。

# 輸出格式（純 JSON，不要 markdown 包裹）

{
  "ritual": [
    {"step": "Reading conversation", "tokens": 18432, "status": "done"},
    {"step": "Comparing with Brain", "detail": "23 active items", "status": "done"},
    {"step": "Finding repeated decisions", "found": 3, "status": "done"},
    {"step": "Extracting new principles", "found": 2, "status": "done"},
    {"step": "Observing user collaboration patterns", "found": 1, "status": "done"},
    {"step": "Building delta", "status": "done"}
  ],
  "delta": {
    "add": [
      {"type": "DECISION", "name": "memory-structure", "content": "...", "rationale": "...", "confidence": 0.9}
    ],
    "update": [
      {"id": "D3", "content": "updated...", "rationale": "refined because..."}
    ],
    "retire": [
      {"id": "H1", "reason": "validated", "supersededBy": "F12"}
    ]
  },
  "profileDelta": {
    "add": [
      {
        "type": "COLLABORATION_PREF",
        "name": "no-repetition",
        "content": "使用者連續 3 次糾正「你重複了」，明顯偏好 AI 不重複已說過的內容",
        "rationale": "從對話中觀察到重複糾正 pattern"
      }
    ],
    "update": [
      {"id": "RP1", "content": "refined...", "rationale": "..."}
    ],
    "retire": [
      {"id": "CP2", "reason": "使用者明確表示不再在意這個"}
    ]
  }
}

# 重要

- "id" 在 update/retire 中必須是 Brain 或 Profile 既有的 itemId
- 如果對話沒有 stable knowledge 可萃取，delta 都空陣列
- 如果對話沒有明確 profile 訊號，profileDelta 都空陣列（這是常態，不要硬擠）
- ritual 步驟要真實反映你做了什麼，包含 "Observing user collaboration patterns" 這一步
- 輸出必須是合法 JSON`

export interface DistillResult {
  delta: DeltaOperation
  profileDelta: ProfileDeltaOperation
  title: string
  rawResponse: string
  backend: string
  tokensRead: number
}

export async function distillConversation(
  conversationText: string,
  brainItems: KnowledgeItem[],
  brainVersion: number,
  profileItems: ProfileItem[] = [],
): Promise<DistillResult> {
  const backend = (process.env.GINKGO_LLM_BACKEND || 'zai').toLowerCase()

  // 準備 Brain 現況摘要給 LLM
  const activeItems = brainItems.filter((i) => i.status === 'active')
  const brainSummary = activeItems.length === 0
    ? '（Brain 是空的 — 這是第一次蒸餾）'
    : activeItems
        .map((i) => {
          const parts = [`[${i.itemId}] ${i.type}  ${i.content}`]
          if (i.rationale) parts.push(`       rationale: ${i.rationale}`)
          if (i.type === 'HYPOTHESIS' && i.confidence != null) {
            parts.push(`       confidence: ${i.confidence.toFixed(2)}`)
          }
          return parts.join('\n')
        })
        .join('\n')

  // 準備 Profile 現況摘要
  const activeProfile = profileItems.filter((i) => i.status === 'active')
  const profileSummary = activeProfile.length === 0
    ? '（Profile 是空的 — 還沒有任何已確認的合作記憶）'
    : activeProfile
        .map((i) => {
          const parts = [`[${i.itemId}] ${i.type}  ${i.content}`]
          if (i.rationale) parts.push(`       rationale: ${i.rationale}`)
          return parts.join('\n')
        })
        .join('\n')

  const tokensRead = Math.ceil(conversationText.length / 3)

  const userPrompt = `請蒸餾以下對話，同時輸出 Brain delta + Profile suggestions。

=====
CURRENT BRAIN (v${brainVersion.toFixed(2)}, ${activeItems.length} active items):
${brainSummary}

=====
CURRENT USER PROFILE (${activeProfile.length} active items):
${profileSummary}

=====
CONVERSATION (${tokensRead} tokens estimated):
${conversationText}

=====

請輸出純 JSON。記得：
1. update/retire 中的 id 必須是 Brain 或 Profile 既有的 itemId
2. add 中的新 item 不需要給 itemId（系統會自動編號）
3. ritual 步驟要真實反映你做了什麼，包含觀察 user collaboration patterns
4. profileDelta 沒有明確訊號就空陣列 — 大多數對話不會透露 profile 訊號，這是常態`

  let rawResponse: string
  if (backend === 'openai') {
    rawResponse = await callOpenAI(SYSTEM_PROMPT, userPrompt)
  } else {
    rawResponse = await callZai(SYSTEM_PROMPT, userPrompt)
  }

  const delta = parseDeltaJson(rawResponse)
  const profileDelta = parseProfileDeltaJson(rawResponse)
  const title = extractTitle(delta, profileDelta, conversationText)

  return { delta, profileDelta, title, rawResponse, backend, tokensRead }
}

// ============== Backend: z-ai-web-dev-sdk ==============
async function callZai(systemPrompt: string, userPrompt: string): Promise<string> {
  const zai = await ZAI.create()
  const completion = await zai.chat.completions.create({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    thinking: { type: 'enabled' },
    temperature: 0.3,
  })
  return (completion.choices[0]?.message?.content ?? '').trim()
}

// ============== Backend: OpenAI ==============
async function callOpenAI(systemPrompt: string, userPrompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY required when GINKGO_LLM_BACKEND=openai')
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
    }),
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`OpenAI API error: HTTP ${res.status} — ${errText.slice(0, 300)}`)
  }
  const data = await res.json()
  return (data?.choices?.[0]?.message?.content ?? '').trim()
}

// ============== 解析 ==============
function parseDeltaJson(raw: string): DeltaOperation {
  let cleaned = raw
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenceMatch) cleaned = fenceMatch[1].trim()

  let parsed: any
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    const firstBrace = cleaned.indexOf('{')
    const lastBrace = cleaned.lastIndexOf('}')
    if (firstBrace !== -1 && lastBrace !== -1) {
      try {
        parsed = JSON.parse(cleaned.slice(firstBrace, lastBrace + 1))
      } catch {
        return emptyDelta()
      }
    } else {
      return emptyDelta()
    }
  }

  return normalizeDelta(parsed)
}

function emptyDelta(): DeltaOperation {
  return { ritual: [], delta: { add: [], update: [], retire: [] } }
}

function normalizeDelta(obj: any): DeltaOperation {
  const validTypes = new Set<string>(KNOWLEDGE_TYPES)

  const ritual: DistillationRitualStep[] = Array.isArray(obj?.ritual)
    ? obj.ritual
        .filter((s: any) => s && typeof s === 'object' && typeof s.step === 'string')
        .map((s: any) => ({
          step: String(s.step),
          detail: s.detail != null ? String(s.detail) : undefined,
          tokens: typeof s.tokens === 'number' ? s.tokens : undefined,
          found: typeof s.found === 'number' ? s.found : undefined,
          status: 'done' as const,
        }))
    : []

  const add = Array.isArray(obj?.delta?.add)
    ? obj.delta.add
        .filter((a: any) => a && typeof a === 'object' && typeof a.content === 'string')
        .filter((a: any) => validTypes.has(String(a.type)))
        .map((a: any) => ({
          type: String(a.type) as KnowledgeType,
          name: typeof a.name === 'string' ? a.name : '',
          content: String(a.content),
          rationale: typeof a.rationale === 'string' ? a.rationale : undefined,
          confidence: typeof a.confidence === 'number' ? a.confidence : undefined,
        }))
    : []

  const update = Array.isArray(obj?.delta?.update)
    ? obj.delta.update
        .filter((u: any) => u && typeof u === 'object' && typeof u.id === 'string')
        .map((u: any) => ({
          id: String(u.id),
          content: typeof u.content === 'string' ? u.content : undefined,
          rationale: typeof u.rationale === 'string' ? u.rationale : undefined,
          confidence: typeof u.confidence === 'number' ? u.confidence : undefined,
        }))
        .filter((u: any) => u.content || u.rationale || u.confidence != null)
    : []

  const retire = Array.isArray(obj?.delta?.retire)
    ? obj.delta.retire
        .filter((r: any) => r && typeof r === 'object' && typeof r.id === 'string')
        .map((r: any) => ({
          id: String(r.id),
          reason: typeof r.reason === 'string' ? r.reason : '',
          supersededBy: typeof r.supersededBy === 'string' ? r.supersededBy : undefined,
        }))
    : []

  return { ritual, delta: { add, update, retire } }
}

function extractTitle(delta: DeltaOperation, profileDelta: ProfileDeltaOperation, conversation: string): string {
  if (delta.delta.add.length > 0) {
    const first = delta.delta.add[0]
    const label = TYPE_LABEL_ZH[first.type] || first.type
    const text = first.name || first.content
    return `新增 ${label}: ${text.slice(0, 40)}${text.length > 40 ? '…' : ''}`
  }
  if (profileDelta.add.length > 0) {
    const first = profileDelta.add[0]
    return `Profile 建議: ${first.type} — ${first.name || first.content.slice(0, 30)}`
  }
  if (delta.delta.retire.length > 0) {
    return `退役 ${delta.delta.retire[0].id}: ${delta.delta.retire[0].reason.slice(0, 40)}`
  }
  if (delta.delta.update.length > 0) {
    return `更新 ${delta.delta.update[0].id}`
  }
  // 退化：取對話前 50 字
  const trimmed = conversation.trim().replace(/\s+/g, ' ')
  return trimmed.length > 50 ? trimmed.slice(0, 50) + '…' : trimmed || '空白對話'
}

// ============== Profile Delta 解析 ==============
function parseProfileDeltaJson(raw: string): ProfileDeltaOperation {
  let cleaned = raw
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenceMatch) cleaned = fenceMatch[1].trim()

  let parsed: any
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    const firstBrace = cleaned.indexOf('{')
    const lastBrace = cleaned.lastIndexOf('}')
    if (firstBrace !== -1 && lastBrace !== -1) {
      try {
        parsed = JSON.parse(cleaned.slice(firstBrace, lastBrace + 1))
      } catch {
        return emptyProfileDelta()
      }
    } else {
      return emptyProfileDelta()
    }
  }

  return normalizeProfileDelta(parsed)
}

function normalizeProfileDelta(obj: any): ProfileDeltaOperation {
  const validTypes = new Set<string>(PROFILE_TYPES)
  const pd = obj?.profileDelta
  if (!pd || typeof pd !== 'object') return emptyProfileDelta()

  const add = Array.isArray(pd.add)
    ? pd.add
        .filter((a: any) => a && typeof a === 'object' && typeof a.content === 'string')
        .filter((a: any) => validTypes.has(String(a.type)))
        .map((a: any) => ({
          type: String(a.type) as ProfileType,
          name: typeof a.name === 'string' ? a.name : '',
          content: String(a.content),
          rationale: typeof a.rationale === 'string' ? a.rationale : undefined,
        }))
    : []

  const update = Array.isArray(pd.update)
    ? pd.update
        .filter((u: any) => u && typeof u === 'object' && typeof u.id === 'string')
        .map((u: any) => ({
          id: String(u.id),
          content: typeof u.content === 'string' ? u.content : undefined,
          rationale: typeof u.rationale === 'string' ? u.rationale : undefined,
        }))
        .filter((u: any) => u.content || u.rationale)
    : []

  const retire = Array.isArray(pd.retire)
    ? pd.retire
        .filter((r: any) => r && typeof r === 'object' && typeof r.id === 'string')
        .map((r: any) => ({
          id: String(r.id),
          reason: typeof r.reason === 'string' ? r.reason : '',
        }))
    : []

  return { add, update, retire }
}
