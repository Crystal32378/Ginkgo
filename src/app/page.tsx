'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { GinkgoLeaf, GinkgoSpinning, GinkgoRain } from '@/components/ginkgo-leaf'
import {
  type KnowledgeItem,
  type KnowledgeType,
  type DeltaOperation,
  type DistillationRitualStep,
  KNOWLEDGE_TYPES,
  TYPE_EMOJI,
  TYPE_LABEL_ZH,
  formatBrainProtocol,
} from '@/lib/brain'
import {
  Plus,
  ArrowLeft,
  Copy,
  Trash2,
  History,
  Code2,
  FlaskConical,
  Leaf,
  MessageSquare,
  Link as LinkIcon,
  Download,
  ExternalLink,
  Terminal,
  Sparkles,
  CheckCircle2,
  Database,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'

// ==================== Types ====================
interface Project {
  id: string
  name: string
  description: string | null
  emoji: string
  brainVersion: number
  createdAt: string
  updatedAt: string
  _count?: { pills: number; knowledgeItems: number }
}

interface PillMeta {
  id: string
  title: string | null
  tokenEstimate: number
  createdAt: string
  knowledgeItemCount: number
  distillationCount: number
}

interface DiaryEntry {
  id: string
  pillId: string
  pillTitle: string | null
  brainVersionBefore: number
  brainVersionAfter: number
  ritualSteps: DistillationRitualStep[]
  deltaSummary: { added?: number; updated?: number; retired?: number; byType?: Record<string, number> }
  tokensRead: number
  tokensSavedEstimate: number
  createdAt: string
}

interface DistillResponse {
  pillId: string
  title: string
  brainVersionBefore: number
  brainVersionAfter: number
  ritual: DistillationRitualStep[]
  delta: DeltaOperation['delta']
  todayGinkgo: Record<string, number>
  tokensRead: number
  tokensSavedEstimate: number
  backend: string
}

// ==================== Main Page ====================
export default function Home() {
  const [view, setView] = useState<'list' | 'detail'>('list')
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-amber-50 via-stone-50 to-emerald-50">
      <Header />
      <main className="flex-1 container mx-auto max-w-7xl px-4 py-6 md:py-10">
        {view === 'list' ? (
          <ProjectListView
            onOpen={(p) => {
              setSelectedProject(p)
              setView('detail')
            }}
          />
        ) : (
          <ProjectDetailView
            project={selectedProject}
            onBack={() => {
              setView('list')
              setSelectedProject(null)
            }}
          />
        )}
      </main>
      <Footer />
      <Toaster />
    </div>
  )
}

// ==================== Header ====================
function Header() {
  return (
    <header className="border-b border-amber-200/60 bg-amber-50/40 backdrop-blur-sm sticky top-0 z-10">
      <div className="container mx-auto max-w-7xl px-4 py-3 flex items-center gap-3">
        <div className="flex items-center gap-2 text-amber-700">
          <GinkgoLeaf size={28} className="text-amber-600" />
          <div>
            <h1 className="text-lg font-bold tracking-tight text-stone-800">銀杏藥局</h1>
            <p className="text-[10px] text-stone-500 -mt-0.5">Ginkgo Distillation Engine · 治療 AI 失憶症</p>
          </div>
        </div>
        <div className="ml-auto hidden sm:flex items-center gap-1.5 text-xs text-stone-500">
          <Badge variant="outline" className="bg-amber-100/60 border-amber-200 text-amber-800">
            <Leaf className="w-3 h-3 mr-1" />
            8-type Brain
          </Badge>
          <Badge variant="outline" className="bg-emerald-100/60 border-emerald-200 text-emerald-800">
            <History className="w-3 h-3 mr-1" />
            Delta + Diary
          </Badge>
        </div>
      </div>
    </header>
  )
}

function Footer() {
  return (
    <footer className="mt-auto border-t border-amber-200/60 bg-amber-50/30">
      <div className="container mx-auto max-w-7xl px-4 py-4 text-xs text-stone-500 flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-1.5">
          <GinkgoLeaf size={12} className="text-amber-600" />
          蒸餾引擎 — 把對話變成可演化的專案知識
        </span>
        <span className="text-stone-400 font-mono">v2 · local-first · SQLite</span>
      </div>
    </footer>
  )
}

// ==================== Project List View ====================
function ProjectListView({ onOpen }: { onOpen: (p: Project) => void }) {
  const { toast } = useToast()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newProject, setNewProject] = useState({ name: '', description: '', emoji: '🌿' })

  const fetchProjects = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/projects')
      const data = await res.json()
      setProjects(data.projects ?? [])
    } catch (err) {
      toast({ title: '載入專案失敗', description: String(err), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  const handleCreate = async () => {
    if (!newProject.name.trim()) {
      toast({ title: '請填專案名稱', variant: 'destructive' })
      return
    }
    setCreating(true)
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(newProject),
      })
      if (!res.ok) throw new Error('create failed')
      await fetchProjects()
      setNewProject({ name: '', description: '', emoji: '🌿' })
      toast({ title: '專案已建立', description: '可以開始蒸餾了' })
    } catch (err) {
      toast({ title: '建立失敗', description: String(err), variant: 'destructive' })
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/projects/${id}`, { method: 'DELETE' })
      await fetchProjects()
      toast({ title: '專案已刪除' })
    } catch (err) {
      toast({ title: '刪除失敗', description: String(err), variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-6">
      {/* Hero */}
      <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-emerald-50/50 relative overflow-hidden">
        <GinkgoRain count={6} />
        <CardContent className="pt-8 pb-8 relative z-10">
          <div className="flex items-start gap-4 flex-wrap">
            <div className="flex-1 min-w-[280px]">
              <h2 className="text-2xl md:text-3xl font-bold text-stone-800 mb-2 flex items-center gap-2 flex-wrap">
                Distillation Engine
                <span className="text-amber-600">
                  <GinkgoLeaf size={28} className="inline" />
                </span>
              </h2>
              <p className="text-stone-600 text-sm leading-relaxed">
                不是摘要引擎，是<span className="font-semibold text-amber-700">蒸餾引擎</span>。
                把對話持續提煉成可演化的 Project Brain — 8 種知識類型、delta 運算、可檢視的推理過程。
                下次對話直接讀 Brain，不再重新解釋背景。
              </p>
              <div className="mt-4 grid grid-cols-4 md:grid-cols-8 gap-1.5 text-xs">
                {KNOWLEDGE_TYPES.map((t) => (
                  <div key={t} className="flex flex-col items-center bg-white/70 border border-amber-200/60 rounded-md px-1 py-1.5">
                    <span className="text-base">{TYPE_EMOJI[t]}</span>
                    <span className="font-medium text-stone-700 text-[10px] mt-0.5">{TYPE_LABEL_ZH[t]}</span>
                  </div>
                ))}
              </div>
            </div>
            <Dialog>
              <DialogTrigger asChild>
                <Button className="bg-amber-600 hover:bg-amber-700 text-white shadow-md">
                  <Plus className="w-4 h-4 mr-1" />
                  新增專案
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <GinkgoLeaf size={20} className="text-amber-600" />
                    新增記憶專案
                  </DialogTitle>
                  <DialogDescription>
                    不同專案的 Brain 互相隔離 — 換專案就換一整組知識，避免汙染。
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 py-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="p-name">專案名稱 *</Label>
                    <Input
                      id="p-name"
                      placeholder="例如：銀杏藥局產品開發"
                      value={newProject.name}
                      onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="p-emoji">代表 emoji</Label>
                    <Input
                      id="p-emoji"
                      placeholder="🌿"
                      className="w-20 text-center text-lg"
                      value={newProject.emoji}
                      onChange={(e) => setNewProject({ ...newProject, emoji: e.target.value.slice(0, 4) })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="p-desc">簡介（可選）</Label>
                    <Textarea
                      id="p-desc"
                      placeholder="這個專案在做什么？"
                      rows={2}
                      value={newProject.description}
                      onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleCreate} disabled={creating} className="bg-amber-600 hover:bg-amber-700">
                    {creating ? '建立中…' : '建立'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* 專案列表 */}
      <section>
        <h3 className="text-lg font-semibold text-stone-700 mb-3 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-amber-600" />
          你的記憶專案
        </h3>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 rounded-2xl" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <EmptyProjects />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((p) => (
              <ProjectCard key={p.id} project={p} onOpen={() => onOpen(p)} onDelete={() => handleDelete(p.id)} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function EmptyProjects() {
  return (
    <Card className="border-dashed border-amber-200 bg-amber-50/30 relative overflow-hidden">
      <GinkgoRain count={4} />
      <CardContent className="py-12 text-center relative z-10">
        <div className="text-amber-600 mb-3 flex justify-center">
          <GinkgoLeaf size={48} />
        </div>
        <p className="text-stone-600 mb-1">還沒有專案</p>
        <p className="text-xs text-stone-400">按上面的「新增專案」開始你的第一顆 Brain</p>
      </CardContent>
    </Card>
  )
}

function ProjectCard({ project, onOpen, onDelete }: { project: Project; onOpen: () => void; onDelete: () => void }) {
  return (
    <Card className="group hover:shadow-md transition-all border-amber-100 bg-white hover:border-amber-300 relative overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-start gap-2">
          <span className="text-2xl">{project.emoji}</span>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base text-stone-800 truncate">{project.name}</CardTitle>
            <CardDescription className="text-xs text-stone-500 mt-0.5">
              Brain v{(project.brainVersion ?? 0).toFixed(2)} · {new Date(project.updatedAt).toLocaleDateString('zh-TW')}
            </CardDescription>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                className="opacity-0 group-hover:opacity-100 transition text-stone-400 hover:text-red-500 p-1"
                aria-label="刪除"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>刪除這個專案？</AlertDialogTitle>
                <AlertDialogDescription>
                  這會連同所有 Brain 知識、對話 log、蒸餾日記一併刪除，無法復原。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete} className="bg-red-500 hover:bg-red-600">
                  刪除
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardHeader>
      <CardContent className="pt-0 pb-3">
        <p className="text-xs text-stone-500 line-clamp-2 min-h-[2rem]">
          {project.description || '（沒有簡介）'}
        </p>
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className="bg-amber-100 text-amber-800 text-xs">
            <Database className="w-3 h-3 mr-1" />
            {project._count?.knowledgeItems ?? 0} 知識
          </Badge>
          <Badge variant="secondary" className="bg-stone-100 text-stone-700 text-xs">
            <FlaskConical className="w-3 h-3 mr-1" />
            {project._count?.pills ?? 0} 對話
          </Badge>
        </div>
      </CardContent>
      <CardFooter className="pt-0">
        <Button onClick={onOpen} variant="outline" className="w-full border-amber-200 text-amber-700 hover:bg-amber-50">
          打開 Brain
        </Button>
      </CardFooter>
    </Card>
  )
}

// ==================== Project Detail View ====================
function ProjectDetailView({ project, onBack }: { project: Project | null; onBack: () => void }) {
  const { toast } = useToast()
  const [brainItems, setBrainItems] = useState<KnowledgeItem[]>([])
  const [brainVersion, setBrainVersion] = useState(0)
  const [diary, setDiary] = useState<DiaryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [conversation, setConversation] = useState('')
  const [distilling, setDistilling] = useState(false)
  const [ritualSteps, setRitualSteps] = useState<DistillationRitualStep[] | null>(null)
  const [lastDistill, setLastDistill] = useState<DistillResponse | null>(null)
  const [showApiHelp, setShowApiHelp] = useState(false)

  const fetchAll = useCallback(async () => {
    if (!project) return
    setLoading(true)
    try {
      const [brainRes, diaryRes] = await Promise.all([
        fetch(`/api/projects/${project.id}/brain`),
        fetch(`/api/projects/${project.id}/diary`),
      ])
      const brainData = await brainRes.json()
      const diaryData = await diaryRes.json()
      setBrainItems(brainData.items ?? [])
      setBrainVersion(brainData.brainVersion ?? 0)
      setDiary(diaryData.logs ?? [])
    } catch (err) {
      toast({ title: '載入失敗', description: String(err), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [project, toast])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const handleDistill = async () => {
    if (!project) return
    if (!conversation.trim()) {
      toast({ title: '請貼上對話內容', variant: 'destructive' })
      return
    }
    setDistilling(true)
    setRitualSteps([])
    setLastDistill(null)
    try {
      const res = await fetch(`/api/projects/${project.id}/distill`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ conversationText: conversation }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'distill failed')
      }
      const data: DistillResponse = await res.json()

      // 逐條顯示 ritual 步驟（動畫感）
      for (let i = 0; i < data.ritual.length; i++) {
        await new Promise((r) => setTimeout(r, 280))
        setRitualSteps(data.ritual.slice(0, i + 1))
      }
      setRitualSteps(data.ritual)
      setLastDistill(data)
      setBrainVersion(data.brainVersionAfter)
      setConversation('')

      toast({
        title: `蒸餾完成 · Brain v${data.brainVersionAfter.toFixed(2)}`,
        description: `+${data.delta.add.length} / ~${data.delta.update.length} / -${data.delta.retire.length}`,
      })

      // 重新撈 Brain + Diary
      await fetchAll()
    } catch (err) {
      toast({ title: '蒸餾失敗', description: String(err), variant: 'destructive' })
    } finally {
      setDistilling(false)
    }
  }

  if (!project) {
    return (
      <div className="text-center py-20">
        <Button onClick={onBack} variant="outline">
          <ArrowLeft className="w-4 h-4 mr-1" />
          返回
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button onClick={onBack} variant="ghost" size="sm" className="text-stone-600">
          <ArrowLeft className="w-4 h-4 mr-1" />
          返回專案列表
        </Button>
        <Separator orientation="vertical" className="h-6" />
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-2xl">{project.emoji}</span>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-stone-800 truncate">{project.name}</h2>
            {project.description && <p className="text-xs text-stone-500 truncate">{project.description}</p>}
          </div>
          <Badge variant="outline" className="ml-2 font-mono text-xs bg-stone-100">
            Brain v{brainVersion.toFixed(2)}
          </Badge>
        </div>
        <Dialog open={showApiHelp} onOpenChange={setShowApiHelp}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="border-emerald-200 text-emerald-700 hover:bg-emerald-50">
              <Code2 className="w-3.5 h-3.5 mr-1" />
              <span className="hidden sm:inline">Agent API</span>
              <span className="sm:hidden">API</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-emerald-600" />
                Agent API 端點
              </DialogTitle>
              <DialogDescription>讓你的 agent 撈 Brain Protocol 注入到下次對話的 system prompt。</DialogDescription>
            </DialogHeader>
            <ApiHelpContent projectId={project.id} />
          </DialogContent>
        </Dialog>
      </div>

      {/* 主區塊：左邊是輸入+今日銀杏，右邊是 Brain Protocol（深色） */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* === 左邊（人類側 — 暖色） === */}
        <div className="space-y-4">
          <DistillCard
            conversation={conversation}
            setConversation={setConversation}
            onDistill={handleDistill}
            distilling={distilling}
            ritualSteps={ritualSteps}
          />

          {lastDistill && !distilling && <TodayGinkgoCard distill={lastDistill} />}

          {/* Brain items 列表（暖色版） */}
          {!loading && brainItems.filter((i) => i.status === 'active').length > 0 && (
            <BrainItemsCard items={brainItems} />
          )}
        </div>

        {/* === 右邊（Agent 側 — 深色科技） === */}
        <div className="space-y-4">
          <BrainProtocolPanel
            projectName={project.name}
            brainVersion={brainVersion}
            items={brainItems}
            loading={loading}
          />
        </div>
      </div>

      {/* === 下方：Distillation Diary === */}
      <DistillationDiaryPanel diary={diary} />
    </div>
  )
}

function ApiHelpContent({ projectId }: { projectId: string }) {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://your-app.example'
  const jsonUrl = `${baseUrl}/api/projects/${projectId}/brain`
  const protoUrl = `${baseUrl}/api/projects/${projectId}/brain?format=protocol`

  return (
    <div className="space-y-3 py-2">
      <div className="space-y-1.5">
        <Label className="text-xs text-stone-500">JSON 格式（給程式 parse）</Label>
        <pre className="text-[11px] bg-stone-900 text-emerald-300 rounded-lg p-3 overflow-x-auto font-mono">{`curl ${jsonUrl}`}</pre>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-stone-500">Protocol 純文本（貼到 system prompt）</Label>
        <pre className="text-[11px] bg-stone-900 text-amber-300 rounded-lg p-3 overflow-x-auto font-mono">{`curl ${protoUrl}`}</pre>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-stone-500">Python 範例</Label>
        <pre className="text-[11px] bg-stone-900 text-stone-100 rounded-lg p-3 overflow-x-auto font-mono">
{`import requests
brain = requests.get("${protoUrl}").text
# 把 brain 貼到下次對話的 system prompt 開頭
# Brain 自帶 [D1] [C1] 等 ID，可直接引用："關於 D3, ..."`}
        </pre>
      </div>
      <p className="text-xs text-stone-500 leading-relaxed">
        💡 Brain Protocol 設計成給機器讀的：每條 item 有 ID（如 [D17]），下次對話可直接引用，
        token 量比完整摘要少約 60-70%。
      </p>
    </div>
  )
}

// ==================== Distill Card（含儀式動畫） ====================
function DistillCard({
  conversation,
  setConversation,
  onDistill,
  distilling,
  ritualSteps,
}: {
  conversation: string
  setConversation: (v: string) => void
  onDistill: () => void
  distilling: boolean
  ritualSteps: DistillationRitualStep[] | null
}) {
  const { toast } = useToast()
  const [tab, setTab] = useState<'paste' | 'url'>('paste')
  const [shareUrl, setShareUrl] = useState('')
  const [importing, setImporting] = useState(false)
  const [importMeta, setImportMeta] = useState<{ source: string; messageCount: number; title?: string } | null>(null)

  const handleImportUrl = async () => {
    if (!shareUrl.trim()) {
      toast({ title: '請貼分享連結', variant: 'destructive' })
      return
    }
    setImporting(true)
    setImportMeta(null)
    try {
      const res = await fetch(`/api/import-url?url=${encodeURIComponent(shareUrl.trim())}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'import failed')
      setConversation(data.conversationText)
      setImportMeta({ source: data.source, messageCount: data.messageCount, title: data.title })
      toast({
        title: `已從 ${data.source === 'chatgpt' ? 'ChatGPT' : data.source === 'claude' ? 'Claude' : '分享連結'} 抓取`,
        description: `${data.messageCount} 則訊息`,
      })
      setTab('paste')
    } catch (err) {
      toast({ title: '抓取失敗', description: String(err), variant: 'destructive' })
    } finally {
      setImporting(false)
    }
  }

  return (
    <Card className="border-amber-200 bg-white shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-stone-800">
          <FlaskConical className="w-4 h-4 text-amber-600" />
          蒸餾爐
          {brainItemsHint(conversation)}
        </CardTitle>
        <CardDescription className="text-xs">
          把對話餵進來，按「蒸餾」就會萃取穩定知識加入 Brain（不是摘要，是 delta 運算）。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as 'paste' | 'url')}>
          <TabsList className="grid w-full grid-cols-2 max-w-sm">
            <TabsTrigger value="paste" className="text-xs">
              <MessageSquare className="w-3 h-3 mr-1" />
              貼對話
            </TabsTrigger>
            <TabsTrigger value="url" className="text-xs">
              <LinkIcon className="w-3 h-3 mr-1" />
              分享連結
            </TabsTrigger>
          </TabsList>

          <TabsContent value="url" className="mt-3 space-y-2">
            <div className="flex gap-2">
              <Input
                placeholder="https://chatgpt.com/share/... 或 https://claude.ai/share/..."
                value={shareUrl}
                onChange={(e) => setShareUrl(e.target.value)}
                className="text-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !importing) handleImportUrl()
                }}
              />
              <Button
                onClick={handleImportUrl}
                disabled={importing || !shareUrl.trim()}
                variant="outline"
                className="border-amber-300 text-amber-700 hover:bg-amber-50 flex-shrink-0"
              >
                {importing ? (
                  <>
                    <GinkgoSpinning size={14} className="mr-1" />
                    抓取中…
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5 mr-1" />
                    抓取
                  </>
                )}
              </Button>
            </div>
            <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5 flex items-start gap-1">
              <span className="flex-shrink-0">⚠️</span>
              <span>
                <b>已知限制：</b>ChatGPT 分享連結會被 Cloudflare 擋下（HTTP 403），建議改用「貼對話」或安裝 Chrome 擴充。
              </span>
            </div>
          </TabsContent>

          <TabsContent value="paste" className="mt-3 space-y-2">
            {importMeta && (
              <div className="text-[11px] bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-md px-2.5 py-1.5 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3" />
                已從 {importMeta.source === 'chatgpt' ? 'ChatGPT' : 'Claude'} 抓取 · {importMeta.messageCount} 則訊息
              </div>
            )}
            <Textarea
              placeholder={`貼上對話全文...\n\nUser: ...\nAssistant: ...\n\n越完整，蒸餾出的知識越穩定。`}
              rows={6}
              value={conversation}
              onChange={(e) => {
                setConversation(e.target.value)
                if (importMeta) setImportMeta(null)
              }}
              className="resize-y text-sm leading-relaxed"
            />
          </TabsContent>
        </Tabs>

        {/* 儀式動畫區 */}
        {distilling && ritualSteps && (
          <RitualAnimation steps={ritualSteps} />
        )}

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-stone-500 font-mono">
            {conversation.length > 0 ? `~${Math.ceil(conversation.length / 3)} tokens` : '提示：對話越完整，Brain 演化越精準'}
          </p>
          <Button
            onClick={onDistill}
            disabled={distilling || !conversation.trim()}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {distilling ? (
              <>
                <GinkgoSpinning size={16} className="mr-1.5" />
                蒸餾中…
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-1.5" />
                蒸餾
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function brainItemsHint(_conversation: string) {
  return null // 預留
}

// ==================== Ritual Animation ====================
function RitualAnimation({ steps }: { steps: DistillationRitualStep[] }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [steps])

  return (
    <div className="rounded-xl border border-amber-200 bg-gradient-to-b from-amber-50/50 to-stone-50 p-4">
      <div className="flex items-center gap-2 mb-3 text-amber-700">
        <GinkgoSpinning size={16} />
        <span className="text-xs font-semibold tracking-wide">🌿 Distillating...</span>
      </div>
      <div ref={scrollRef} className="space-y-1.5 max-h-48 overflow-y-auto">
        {steps.map((step, i) => (
          <div key={i} className="flex items-start gap-2 text-xs animate-in fade-in slide-in-from-left-2 duration-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-stone-700 font-medium">{step.step}</span>
              {step.tokens != null && (
                <span className="text-stone-400 ml-1.5 font-mono">{step.tokens.toLocaleString()} tokens</span>
              )}
              {step.found != null && (
                <span className="text-amber-600 ml-1.5 font-mono">({step.found})</span>
              )}
              {step.detail && (
                <span className="text-stone-500 ml-1.5">— {step.detail}</span>
              )}
            </div>
          </div>
        ))}
        {steps.length === 0 && (
          <div className="text-xs text-stone-400 italic">準備中...</div>
        )}
      </div>
    </div>
  )
}

// ==================== Today's Ginkgo Card ====================
function TodayGinkgoCard({ distill }: { distill: DistillResponse }) {
  const [expanded, setExpanded] = useState(false)
  const todayGinkgo = distill.todayGinkgo || {}
  const hasActivity = distill.delta.add.length > 0 || distill.delta.update.length > 0 || distill.delta.retire.length > 0

  return (
    <Card className="border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50/50 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-stone-800 text-base">
          <GinkgoLeaf size={18} className="text-amber-600" />
          今日銀杏
          <Badge variant="outline" className="ml-auto text-xs font-mono bg-white">
            v{distill.brainVersionBefore.toFixed(2)} → v{distill.brainVersionAfter.toFixed(2)}
          </Badge>
        </CardTitle>
        <CardDescription className="text-xs">{distill.title}</CardDescription>
      </CardHeader>
      <CardContent className="pt-2">
        {!hasActivity ? (
          <p className="text-sm text-stone-500 italic py-2">
            這次對話沒有產生新的穩定知識（可能只是寒暄或測試）
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {distill.delta.add.length > 0 && (
                <StatBlock label="新增" count={distill.delta.add.length} emoji="✨" color="emerald" />
              )}
              {distill.delta.update.length > 0 && (
                <StatBlock label="演化" count={distill.delta.update.length} emoji="🔄" color="amber" />
              )}
              {distill.delta.retire.length > 0 && (
                <StatBlock label="退役" count={distill.delta.retire.length} emoji="⚰️" color="stone" />
              )}
              <StatBlock label="省下" count={distill.tokensSavedEstimate} suffix="tokens" emoji="💰" color="emerald" />
            </div>

            {/* 新增的條目按 type 分組 */}
            {Object.keys(todayGinkgo).length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {Object.entries(todayGinkgo).map(([type, count]) => (
                  <Badge key={type} variant="outline" className="bg-white text-xs">
                    {TYPE_EMOJI[type as KnowledgeType]} {TYPE_LABEL_ZH[type as KnowledgeType]} ×{count}
                  </Badge>
                ))}
              </div>
            )}

            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-3 flex items-center gap-1 text-xs text-amber-700 hover:text-amber-900"
            >
              {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              {expanded ? '收起詳情' : '展開詳情'}
            </button>

            {expanded && (
              <div className="mt-2 space-y-2 text-xs">
                {distill.delta.add.length > 0 && (
                  <div>
                    <p className="font-semibold text-emerald-700 mb-1">✨ 新增</p>
                    {distill.delta.add.map((a, i) => (
                      <div key={i} className="ml-3 mb-1 text-stone-700">
                        <span className="font-mono text-amber-600">[{TYPE_EMOJI[a.type]}]</span>{' '}
                        <span className="font-medium">{a.name || a.content.slice(0, 40)}</span>
                        {a.rationale && <span className="text-stone-500"> — {a.rationale}</span>}
                      </div>
                    ))}
                  </div>
                )}
                {distill.delta.update.length > 0 && (
                  <div>
                    <p className="font-semibold text-amber-700 mb-1">🔄 演化</p>
                    {distill.delta.update.map((u, i) => (
                      <div key={i} className="ml-3 mb-1 text-stone-700">
                        <span className="font-mono text-amber-600">[{u.id}]</span>{' '}
                        {u.content || u.rationale}
                      </div>
                    ))}
                  </div>
                )}
                {distill.delta.retire.length > 0 && (
                  <div>
                    <p className="font-semibold text-stone-600 mb-1">⚰️ 退役</p>
                    {distill.delta.retire.map((r, i) => (
                      <div key={i} className="ml-3 mb-1 text-stone-600">
                        <span className="font-mono">[{r.id}]</span> {r.reason}
                        {r.supersededBy && <span className="text-emerald-600"> → [{r.supersededBy}]</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

function StatBlock({
  label,
  count,
  suffix,
  emoji,
  color,
}: {
  label: string
  count: number
  suffix?: string
  emoji: string
  color: 'emerald' | 'amber' | 'stone'
}) {
  const colorMap = {
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    amber: 'bg-amber-50 border-amber-200 text-amber-800',
    stone: 'bg-stone-100 border-stone-200 text-stone-700',
  }
  return (
    <div className={`rounded-lg border p-2 ${colorMap[color]}`}>
      <div className="text-lg font-bold">
        {count.toLocaleString()}
        {suffix && <span className="text-xs ml-1 font-normal">{suffix}</span>}
      </div>
      <div className="text-xs">
        {emoji} {label}
      </div>
    </div>
  )
}

// ==================== Brain Items Card（人類版 — 暖色） ====================
function BrainItemsCard({ items }: { items: KnowledgeItem[] }) {
  const active = items.filter((i) => i.status === 'active')
  return (
    <Card className="border-amber-200 bg-white shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-stone-800 text-base">
          <Database className="w-4 h-4 text-amber-600" />
          Brain 知識列表
          <Badge variant="outline" className="ml-auto text-xs">{active.length} active</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-96 pr-3">
          <div className="space-y-1.5">
            {active.map((item) => (
              <div key={item.id} className="text-xs border-l-2 border-amber-300 pl-2 py-1">
                <div className="flex items-baseline gap-1.5">
                  <span className="font-mono text-amber-700 font-semibold">[{item.itemId}]</span>
                  <span className="text-stone-400">{TYPE_EMOJI[item.type]}</span>
                  <span className="text-stone-700 font-medium flex-1">{item.content}</span>
                </div>
                {item.rationale && (
                  <div className="text-stone-500 ml-7 mt-0.5 italic">↳ {item.rationale}</div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

// ==================== Brain Protocol Panel（Agent 側 — 深色科技） ====================
function BrainProtocolPanel({
  projectName,
  brainVersion,
  items,
  loading,
}: {
  projectName: string
  brainVersion: number
  items: KnowledgeItem[]
  loading: boolean
}) {
  const { toast } = useToast()
  const active = items.filter((i) => i.status === 'active')

  const handleCopy = () => {
    const text = formatBrainProtocol(projectName, brainVersion, items)
    navigator.clipboard.writeText(text).then(
      () => toast({ title: 'Brain Protocol 已複製 🌿', description: '貼到下次對話的 system prompt' }),
      () => toast({ title: '複製失敗', variant: 'destructive' }),
    )
  }

  return (
    <div className="rounded-xl border border-stone-700 bg-stone-900 shadow-lg overflow-hidden">
      {/* Terminal-like header */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-stone-950 border-b border-stone-700">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500/80" />
          <div className="w-3 h-3 rounded-full bg-amber-500/80" />
          <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
        </div>
        <div className="ml-2 flex items-center gap-1.5 text-xs text-stone-400 font-mono">
          <Terminal className="w-3.5 h-3.5" />
          brain.protocol
        </div>
        <Badge variant="outline" className="ml-auto text-xs font-mono bg-stone-800 border-stone-700 text-emerald-400">
          v{brainVersion.toFixed(2)} · {active.length} items
        </Badge>
        <Button
          onClick={handleCopy}
          size="sm"
          className="h-7 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono"
        >
          <Copy className="w-3 h-3 mr-1" />
          Copy
        </Button>
      </div>

      {/* Protocol content */}
      <div className="bg-stone-900 p-4 font-mono text-xs leading-relaxed max-h-[600px] overflow-y-auto">
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-3 w-3/4 bg-stone-700" />
            <Skeleton className="h-3 w-1/2 bg-stone-700" />
            <Skeleton className="h-3 w-2/3 bg-stone-700" />
          </div>
        ) : active.length === 0 ? (
          <div className="text-stone-500 italic">
            <span className="text-emerald-500">$</span> brain --status
            <br />
            <span className="text-amber-500">→ Brain is empty. Distill a conversation to begin.</span>
          </div>
        ) : (
          <ProtocolTextView projectName={projectName} brainVersion={brainVersion} items={items} />
        )}
      </div>

      {/* Status bar */}
      <div className="px-4 py-1.5 bg-stone-950 border-t border-stone-700 flex items-center gap-3 text-[10px] text-stone-500 font-mono">
        <span className="text-emerald-500">● ready</span>
        <span>·</span>
        <span>{active.length} active items</span>
        <span>·</span>
        <span>8-type taxonomy</span>
        <span className="ml-auto text-stone-600">paste-ready for GPT / Claude / Agent</span>
      </div>
    </div>
  )
}

function ProtocolTextView({
  projectName,
  brainVersion,
  items,
}: {
  projectName: string
  brainVersion: number
  items: KnowledgeItem[]
}) {
  const active = items.filter((i) => i.status === 'active')
  const grouped: Record<string, KnowledgeItem[]> = {}
  for (const item of active) {
    if (!grouped[item.type]) grouped[item.type] = []
    grouped[item.type].push(item)
  }

  return (
    <div>
      <div className="text-stone-500"># Project Brain v{brainVersion.toFixed(2)} · {active.length} items · {projectName}</div>
      <div className="text-stone-600"># distilled: {new Date().toISOString().slice(0, 10)}</div>
      <div className="text-stone-600"># Use [ID] to reference any item (e.g., "Regarding D3, ...")</div>
      <div className="text-stone-600">&nbsp;</div>

      {KNOWLEDGE_TYPES.map((type) => {
        const group = grouped[type]
        if (!group || group.length === 0) return null
        group.sort((a, b) => {
          const na = parseInt(a.itemId.replace(/^[A-Z]+/, ''), 10) || 0
          const nb = parseInt(b.itemId.replace(/^[A-Z]+/, ''), 10) || 0
          return na - nb
        })
        return (
          <div key={type}>
            <div className="text-stone-500"># === {type} ({group.length}) ===</div>
            {group.map((item) => (
              <div key={item.id} className="mb-1">
                <div>
                  <span className="text-amber-400">[{item.itemId}]</span>{' '}
                  <span className="text-emerald-400">{item.type}</span>{' '}
                  <span className="text-stone-100">{item.content}</span>
                </div>
                {item.rationale && (
                  <div className="text-stone-500 pl-6">rationale: {item.rationale}</div>
                )}
                {item.type === 'HYPOTHESIS' && item.confidence != null && (
                  <div className="text-stone-500 pl-6">confidence: {item.confidence.toFixed(2)}</div>
                )}
              </div>
            ))}
            <div className="text-stone-600">&nbsp;</div>
          </div>
        )
      })}
    </div>
  )
}

// ==================== Distillation Diary Panel ====================
function DistillationDiaryPanel({ diary }: { diary: DiaryEntry[] }) {
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <Card className="border-stone-200 bg-white">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-stone-800 text-base">
          <History className="w-4 h-4 text-stone-500" />
          Distillation Diary
          <Badge variant="outline" className="text-xs font-normal">{diary.length}</Badge>
          <span className="ml-auto text-xs text-stone-500 font-normal">推理過程可檢視 · 不是黑盒</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {diary.length === 0 ? (
          <div className="py-8 text-center text-sm text-stone-400">
            還沒有蒸餾紀錄 — 蒸餾第一次對話後這裡就會出現推理過程
          </div>
        ) : (
          <ScrollArea className="max-h-[500px] pr-3">
            <div className="space-y-2">
              {diary.map((entry) => {
                const isExpanded = expanded === entry.id
                return (
                  <div
                    key={entry.id}
                    className={`rounded-lg border transition-all ${
                      isExpanded ? 'border-stone-300 bg-stone-50' : 'border-stone-200 bg-white hover:border-stone-300'
                    }`}
                  >
                    <button
                      className="w-full text-left p-3 flex items-center gap-3"
                      onClick={() => setExpanded(isExpanded ? null : entry.id)}
                    >
                      <div className="font-mono text-xs text-stone-500 flex-shrink-0">
                        v{entry.brainVersionBefore.toFixed(2)} → v{entry.brainVersionAfter.toFixed(2)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-stone-700 truncate">
                          {entry.pillTitle || '(無標題)'}
                        </div>
                        <div className="text-[11px] text-stone-500 mt-0.5">
                          {new Date(entry.createdAt).toLocaleString('zh-TW')}
                          {' · '}
                          <span className="text-emerald-600">+{entry.deltaSummary.added || 0}</span>
                          {' / '}
                          <span className="text-amber-600">~{entry.deltaSummary.updated || 0}</span>
                          {' / '}
                          <span className="text-stone-500">-{entry.deltaSummary.retired || 0}</span>
                          {' · '}
                          read {entry.tokensRead.toLocaleString()} tok
                          {' · '}
                          <span className="text-emerald-700">saved ~{entry.tokensSavedEstimate.toLocaleString()} tok</span>
                        </div>
                      </div>
                      {isExpanded ? <ChevronDown className="w-3 h-3 text-stone-400" /> : <ChevronRight className="w-3 h-3 text-stone-400" />}
                    </button>
                    {isExpanded && (
                      <div className="px-3 pb-3 pt-1 border-t border-stone-100">
                        <div className="rounded-md bg-stone-900 p-3 font-mono text-[11px] text-stone-300">
                          <div className="text-emerald-400 mb-1.5">$ distill --verbose</div>
                          {entry.ritualSteps.map((step, i) => (
                            <div key={i} className="flex items-start gap-1.5">
                              <CheckCircle2 className="w-3 h-3 text-emerald-500 mt-0.5 flex-shrink-0" />
                              <span>
                                {step.step}
                                {step.tokens != null && <span className="text-amber-400 ml-1.5">{step.tokens.toLocaleString()} tok</span>}
                                {step.found != null && <span className="text-emerald-400 ml-1.5">({step.found})</span>}
                                {step.detail && <span className="text-stone-500 ml-1.5">— {step.detail}</span>}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}
