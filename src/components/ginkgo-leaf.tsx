'use client'

/**
 * 銀杏葉 mascot — 一片可愛的扇形銀杏葉
 * 用於：頁首 logo、煉丹中…載入動畫、空狀態裝飾
 */
export function GinkgoLeaf({ className = '', size = 24 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* 銀杏葉扇形本體 */}
      <path
        d="M32 56 C32 56 30 48 28 44 C20 36 8 30 8 20 C8 12 16 8 24 12 C28 14 30 12 30 8 C30 6 31 4 32 4 C33 4 34 6 34 8 C34 12 36 14 40 12 C48 8 56 12 56 20 C56 30 44 36 36 44 C34 48 32 56 32 56 Z"
        fill="currentColor"
      />
      {/* 葉脈紋路 */}
      <path
        d="M32 54 L32 18 M32 30 L20 22 M32 30 L44 22 M32 38 L16 30 M32 38 L48 30 M32 46 L22 40 M32 46 L42 40"
        stroke="rgba(0,0,0,0.15)"
        strokeWidth="0.8"
        strokeLinecap="round"
      />
      {/* 葉柄 */}
      <path
        d="M32 56 L32 62"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** 煉丹中…的旋轉銀杏葉 */
export function GinkgoSpinning({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <div
      className={`inline-block animate-spin ${className}`}
      style={{ animationDuration: '2.5s' }}
    >
      <GinkgoLeaf size={size} />
    </div>
  )
}

/** 一群飄落的銀杏葉（用於空狀態裝飾） */
export function GinkgoRain({ count = 5 }: { count?: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="absolute animate-bounce opacity-30"
          style={{
            left: `${(i + 1) * (100 / (count + 1))}%`,
            top: `${(i % 3) * 30}%`,
            animationDuration: `${2 + i * 0.3}s`,
            animationDelay: `${i * 0.4}s`,
          }}
        >
          <GinkgoLeaf size={20 + (i % 3) * 8} />
        </div>
      ))}
    </div>
  )
}
