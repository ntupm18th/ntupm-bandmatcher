import { useEffect, useState, type ReactNode } from 'react'

export function Modal({ onClose, children, wide }: { onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.classList.add('modal-open')
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.classList.remove('modal-open')
    }
  }, [onClose])

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal paper ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true">
        <button className="modal-close" onClick={onClose} aria-label="關閉">
          ✕
        </button>
        {children}
      </div>
    </div>
  )
}

export function InstrumentTag({ name }: { name: string }) {
  return <span className="tag">{name}</span>
}

/** 輸入密碼的小表單，用於解鎖管理模式 */
export function PasswordGate({
  label,
  hint,
  verify,
  onUnlock,
}: {
  label: string
  hint?: string
  verify: (pw: string) => Promise<boolean>
  onUnlock: (pw: string) => void
}) {
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  return (
    <form
      className="password-gate"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        setError('')
        try {
          if (await verify(pw)) onUnlock(pw)
          else setError('密碼不對，再試一次。')
        } catch {
          setError('連不上資料庫，稍後再試。')
        } finally {
          setBusy(false)
        }
      }}
    >
      <label>
        <span className="field-label">{label}</span>
        <div className="row">
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus required />
          <button className="btn" disabled={busy || !pw}>
            {busy ? '確認中…' : '進入管理'}
          </button>
        </div>
      </label>
      {hint && <p className="hint">{hint}</p>}
      {error && <p className="error">{error}</p>}
    </form>
  )
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </label>
  )
}

/** 把聯絡方式裡的網址、IG 帳號變成可點的連結 */
export function Contact({ text }: { text: string }) {
  if (!text) return <span className="muted">沒有留</span>
  const url = text.match(/https?:\/\/\S+/)?.[0]
  if (url)
    return (
      <a href={url} target="_blank" rel="noreferrer">
        {text}
      </a>
    )
  const ig = text.match(/(?:ig|instagram)\s*[:：]?\s*@?([A-Za-z0-9._]{2,30})/i)
  if (ig)
    return (
      <a href={`https://instagram.com/${ig[1]}`} target="_blank" rel="noreferrer">
        {text}
      </a>
    )
  return <span>{text}</span>
}

export function relativeTime(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return '剛剛'
  if (diff < 3600) return `${Math.floor(diff / 60)} 分鐘前`
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小時前`
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)} 天前`
  return new Date(iso).toLocaleDateString('zh-TW')
}
