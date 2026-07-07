# 🌿 銀杏藥局 Ginkgo Pharmacy

> **治療 AI 失憶症的蒸餾引擎。**
>
> 一鍵把當前對話蒸餾成可演化的 Project Brain，下次開新對話直接注入。
> AI 不再重新提問、不再推翻已定案決策、不再提議已否決方向。

```
每一顆銀杏，讓 Agent 記得你
每一次提煉，讓記憶更持續
每一次重啟，讓專案更穩定
```

---

## 為什麼需要

同一個專案來回討論很多次後，AI 會：

- ❌ 重新提問已經討論過的事
- ❌ 推翻已經定案的決策
- ❌ 提議已經被否決過的方向

ChatGPT 的「記憶」功能會跨對話汙染。這個工具用 **project_id 隔離** + **8 段式 Brain 結構** + **delta 蒸餾** 解決這件事。

## 核心概念

### 不是摘要引擎，是蒸餾引擎

| | Summary Engine（傳統） | Distillation Engine（Ginkgo） |
|---|---|---|
| 輸出 | 完整記憶摘要 | delta operation（add/update/retire） |
| 儲存 | 每次對話一份 snapshot | 單一演化中的 Brain |
| 演化軌跡 | ❌ 會丟失 | ✅ 保留退役 item + 取代關係 |
| Token 效率 | 重述全部脈絡 | 引用 ID（「關於 D3...」） |

### Brain 的 8 種知識類型

| Type | Emoji | 解決什麼痛點 |
|---|:---:|---|
| DECISION | ✅ | 已定案的決策（含為什麼） |
| CONSTRAINT | 🔗 | 外部或技術限制（必須遵守的） |
| PRINCIPLE | 🧠 | 團隊慣例、設計原則 |
| DEFINITION | 📖 | 名詞定義 |
| FACT | 📌 | 關於世界/tech stack/使用者的事實 |
| QUESTION | ❓ | 仍待討論、下次必須回來的問題 |
| RISK | ⚠️ | 有時效性的風險 |
| HYPOTHESIS | 🔮 | 未驗證的假設（含 confidence 0-1） |

每條 item 有 ID（如 `[D17]`），下次對話可直接引用，token 量比完整摘要少 60-70%。

### Distillation Diary

每次蒸餾都記錄 LLM 真實回報的推理步驟，可檢視、不是黑盒：

```
$ distill --verbose
✓ Reading conversation (216 tokens)
✓ Comparing with Brain (0 active items)
✓ Finding repeated decisions (0)
✓ Retiring obsolete — no items to retire
✓ Extracting new principles (4)
✓ Building delta
```

---

## 三個元件

```
/                          # Next.js 網頁 app + API server
  src/
    app/
      page.tsx             # 雙面板 UI（左：暖色人類側 / 右：深色 Agent 側）
      api/                 # REST API（給擴充與 agent 用）
    lib/
      brain.ts             # 8 type 定義 + Protocol 格式化
      distill.ts           # Delta 運算 + ritual 輸出
      auth.ts              # API token 認證
      fetch-conversation.ts # 從 share URL 抓對話
  prisma/schema.prisma     # Project + KnowledgeItem + Pill + DistillationLog

/download/ginkgo-extension/ # Chrome 擴充（獨立專案）
  manifest.json
  src/
    content.js             # 注入 🌿 按鈕到 ChatGPT/Claude
    content.css
    background.js
    popup.{html,js,css}    # 擴充設定頁
```

---

## 快速開始

### 1. Server 端

```bash
# 複製 repo
git clone https://github.com/Crystal32378/Ginkao.git
cd Ginkao

# 裝依賴
bun install

# 設環境變數
cp .env.example .env
# 編輯 .env，至少設 GINKGO_API_TOKEN（用 openssl rand -hex 32 產生）

# 初始化資料庫
bun run db:push

# 啟動
bun run dev
```

打開 `http://localhost:3000` → 新增專案 → 開始蒸餾。

### 2. Chrome 擴充

1. 開 `chrome://extensions/`
2. 右上角打開「開發人員模式」
3. 點「載入未打包」→ 選 `download/ginkgo-extension/` 資料夾
4. 點擴充圖示 🌿 → 填：
   - **API Base URL**：你的 server 網址
   - **API Token**：你在 `.env` 設的 `GINKGO_API_TOKEN`
   - **預設專案 ID**：點「📋 撈專案」自動帶出
5. 打開 ChatGPT 或 Claude → 右下角 🌿 浮動按鈕 → 一鍵蒸餾

### 3. 給你的 agent 程式用

```python
import requests

BASE = "https://your-app.example"
TOKEN = "your_token"
PROJECT_ID = "cm..."

# 開新對話前撈 Brain Protocol
headers = {"Authorization": f"Bearer {TOKEN}"}
brain = requests.get(
    f"{BASE}/api/projects/{PROJECT_ID}/brain?format=protocol",
    headers=headers
).text
# 把 brain 貼到下次對話的 system prompt 開頭
# Brain 自帶 [D1] [C1] 等 ID，可直接引用："關於 D3, ..."

# 對話結束後蒸餾
requests.post(
    f"{BASE}/api/projects/{PROJECT_ID}/distill",
    headers={**headers, "Content-Type": "application/json"},
    json={"conversationText": "..."},
)
```

---

## API 端點

所有 `/api/projects/**` 都需帶 `Authorization: Bearer <token>`（除非 `GINKGO_API_TOKEN` 留空）。
同源瀏覽器請求（網頁 UI）自動放行。

| 方法 | 路徑 | 說明 |
|---|---|---|
| GET | `/api/projects` | 列出所有專案 |
| POST | `/api/projects` | 建立新專案 |
| GET | `/api/projects/{id}` | 取得專案詳情 |
| DELETE | `/api/projects/{id}` | 刪除專案 |
| **POST** | **`/api/projects/{id}/distill`** | **蒸餾對話 → delta 套用到 Brain** |
| GET | `/api/projects/{id}/brain` | 取得 Brain（JSON） |
| GET | `/api/projects/{id}/brain?format=protocol` | 取得 Brain Protocol 純文本 |
| GET | `/api/projects/{id}/diary` | 取得蒸餾日記 |
| GET | `/api/projects/{id}/pills` | 列出對話 log |
| GET | `/api/projects/{id}/memory` | backward compat（導向 brain） |
| GET | `/api/import-url?url=...` | 從 ChatGPT/Claude share URL 抓對話 |

---

## LLM Backend

| Backend | 設定 | 成本 | 備註 |
|---|---|---|---|
| `zai`（預設） | `GINKGO_LLM_BACKEND=zai` | 免費 | 用 z-ai-web-dev-sdk |
| `openai` | `GINKGO_LLM_BACKEND=openai` + `OPENAI_API_KEY` | GPT-4o-mini 約 $0.005/次 | 需 server 在 OpenAI 支援地區 |

$5 USD 的 OpenAI 額度，單人使用約可撐 2-8 個月（看對話密度）。

---

## 分享給朋友

1. 部署 server 到 Vercel / Railway / Fly.io
2. 設 `GINKGO_API_TOKEN`
3. 把 `download/ginkgo-extension/` 打包成 zip 傳給朋友
4. 朋友自己：解壓 → `chrome://extensions/` 載入未打包 → 填設定 → 開始用

⚠️ **目前沒有多租戶隔離** — 所有知道 token 的人都能看到所有專案。要嚴格隔離建議各自部署。

---

## 設計哲學

### 給人看的，給 AI 看的，分兩層

**人類側（暖色）**
- 銀杏暖金配色、圓角、emoji
- 今日銀杏卡：4 個 stat block + 可展開詳情
- Brain 知識列表：item ID + emoji + rationale

**Agent 側（深色科技）**
- macOS 終端風格 brain.protocol 面板
- mono font + 語法高亮（amber ID / emerald type / stone rationale）
- 紅黃綠小圓點 + 狀態列
- 一鍵 Copy → 貼到 GPT/Claude/Agent

**中間橋梁**：蒸餾儀式動畫，逐條顯示 LLM 真實推理步驟。

### Local-first

- SQLite，不上雲
- 沒有帳號系統
- 你的對話 + Brain 都在你自己的機器上

---

## 已知限制

- ChatGPT share URL 被 Cloudflare 擋（HTTP 403）— server-side 抓不到，請用 Chrome 擴充或手動貼
- 沒有多租戶隔離
- Claude DOM 結構會變，content script 含 fallback 但可能需隨 UI 更新調整

## Roadmap

- [ ] Chrome 擴充：把 🌿 按鈕搬到對話輸入框旁 + 主動提醒「該蒸餾了」
- [ ] User Profile 層（記得你這個人，不只是專案知識）
- [ ] 從 ChatGPT/Claude 資料匯出匯入
- [ ] MCP server（給 Claude Desktop / Cursor 用）
- [ ] Custom GPT Action schema
- [ ] Token-saved 累計 dashboard
- [ ] Brain item reference 關係圖

---

## License

MIT

## 致謝

靈感來自跟 AI 來回討論同一個專案時的失憶痛點。銀杏葉象徵記憶力（雖然科學上銀杏對記憶的療效有爭議，但這裡是隱喻）。
