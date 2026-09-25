import { useMemo, useState } from 'react'
import type { Slot, Song } from '../types'
import { relativeTime } from './ui'

export function isComplete(song: Song) {
  return song.slots.length > 0 && song.slots.every((s) => s.filled_at)
}

/** 由 id 算出固定的小角度，讓紙張和印章看起來是手貼、手蓋的 */
export function jitter(id: string, range: number) {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0
  return ((Math.abs(h) % 1000) / 1000 - 0.5) * 2 * range
}

/** 同一首歌有重複的樂器時加上編號：電吉他1、電吉他2；只有一個就不加 */
export function numberDuplicates(names: string[]): string[] {
  const total = new Map<string, number>()
  for (const n of names) total.set(n, (total.get(n) ?? 0) + 1)
  const seen = new Map<string, number>()
  return names.map((n) => {
    if (total.get(n)! < 2) return n
    const i = (seen.get(n) ?? 0) + 1
    seen.set(n, i)
    return `${n}${i}`
  })
}

/** 每個位置顯示用的名稱（slot id → 名稱），slots 需依 position 排好 */
export function slotLabels(slots: Slot[]): Record<string, string> {
  const labels = numberDuplicates(slots.map((s) => s.instrument))
  return Object.fromEntries(slots.map((s, i) => [s.id, labels[i]]))
}

type Filter = 'open' | 'done' | 'all'

export function QuestBoard({ songs, onOpen }: { songs: Song[]; onOpen: (id: string) => void }) {
  const [filter, setFilter] = useState<Filter>('open')
  const [instrument, setInstrument] = useState('')
  const [query, setQuery] = useState('')

  const openInstruments = useMemo(
    () => [...new Set(songs.flatMap((s) => s.slots.filter((x) => !x.filled_at).map((x) => x.instrument)))],
    [songs],
  )

  const visible = songs.filter((s) => {
    const done = isComplete(s)
    if (filter === 'open' && done) return false
    if (filter === 'done' && !done) return false
    if (instrument && !s.slots.some((x) => !x.filled_at && x.instrument === instrument)) return false
    const q = query.trim().toLowerCase()
    if (q && ![s.title, s.artist, s.singer].some((x) => x.toLowerCase().includes(q))) return false
    return true
  })

  const counts = { open: songs.filter((s) => !isComplete(s)).length, done: songs.filter(isComplete).length }

  return (
    <section>
      <div className="toolbar">
        <div className="seg">
          <button className={filter === 'open' ? 'on' : ''} onClick={() => setFilter('open')}>
            還缺人 {counts.open}
          </button>
          <button className={filter === 'done' ? 'on' : ''} onClick={() => setFilter('done')}>
            已湊齊 {counts.done}
          </button>
          <button className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>
            全部
          </button>
        </div>
        <select value={instrument} onChange={(e) => setInstrument(e.target.value)} aria-label="依缺少的樂器篩選">
          <option value="">所有樂器</option>
          {openInstruments.map((x) => (
            <option key={x} value={x}>
              缺{x}
            </option>
          ))}
        </select>
        <input className="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜尋歌名、原唱、主唱" />
      </div>

      {visible.length === 0 ? (
        <div className="empty paper">
          <p>{songs.length === 0 ? '板子上還沒有歌。主唱可以按「徵樂手」貼上第一首。' : '沒有符合條件的歌。'}</p>
        </div>
      ) : (
        <div className="board">
          {visible.map((s) => (
            <QuestCard key={s.id} song={s} onOpen={() => onOpen(s.id)} />
          ))}
        </div>
      )}
    </section>
  )
}

// 全形字：中日韓文字、全形標點（：，。「」）與全形英數，寬度都是 1 個字
const CJK = /[\u2e80-\u9fff\uf900-\ufaff\uac00-\ud7af\ufe30-\ufe4f\uff00-\uffef]/
const LATIN_EM = 0.55 // 英文字平均字寬約 0.55em
const MIN_SIZE = 8

const textWidth = (s: string) => [...s].reduce((w, c) => w + (CJK.test(c) ? 1 : LATIN_EM), 0)

/** 單行放不下就從中間切成兩行 */
function splitWord(word: string): string[] {
  const c = [...word]
  if (c.length <= 5) return [word]
  const mid = Math.ceil(c.length / 2)
  return [c.slice(0, mid).join(''), c.slice(mid).join('')]
}

/** 圓形印章裡能放的寬度：兩行字的四個角比較靠近圓周，所以要窄一點 */
const innerWidth = (lines: number) => (lines === 1 ? 34 : 29)

function fitLines(lines: string[]): { lines: string[]; size: number } {
  const size = Math.min(12, innerWidth(lines.length) / Math.max(...lines.map(textWidth)))
  return { lines, size }
}

/**
 * 依名字排成印章的樣子，名字照原樣刻（含標點）：
 * 中文橫排，先由左到右排滿一行，再往下換行：
 * 1 字置中放大；2 字一行；3～4 字每行兩字；5～9 字每行三字；更長取前 9 字。
 * 英文或混合：最多兩行，字級依最長那行縮小；名字太長時只刻第一個字（名），再不夠就截斷加「…」。
 */
function sealLayout(raw: string): { rows?: string[][]; lines?: string[]; size: number } {
  const name = raw.trim()
  const chars = [...name]
  if (chars.length > 0 && chars.every((c) => CJK.test(c))) {
    const c = chars.slice(0, 9)
    if (c.length === 1) return { rows: [c], size: 22 }
    if (c.length === 2) return { rows: [c], size: 15 }
    if (c.length <= 4) return { rows: [c.slice(0, 2), c.slice(2)], size: 13 }
    if (c.length <= 6) return { rows: [c.slice(0, 3), c.slice(3)], size: 10 }
    return { rows: [c.slice(0, 3), c.slice(3, 6), c.slice(6)], size: 8.5 }
  }

  const words = name.split(/\s+/)
  const candidates: string[][] = []
  if (words.length > 1) {
    const mid = Math.ceil(words.length / 2)
    candidates.push([words.slice(0, mid).join(' '), words.slice(mid).join(' ')])
    candidates.push(splitWord(words[0])) // 只刻第一個字
  } else {
    candidates.push(splitWord(name))
  }
  for (const lines of candidates) {
    const fitted = fitLines(lines)
    if (fitted.size >= MIN_SIZE) return fitted
  }

  // 還是放不下：每行截到放得下為止
  const lines = candidates[candidates.length - 1]
  const max = innerWidth(lines.length)
  const cut = (s: string) => {
    if (textWidth(s) * MIN_SIZE <= max) return s
    let out = ''
    for (const c of s) {
      if (textWidth(out + c + '…') * MIN_SIZE > max) break
      out += c
    }
    return out + '…'
  }
  return { lines: lines.map(cut), size: MIN_SIZE }
}

export function Seal({ slot }: { slot: Slot }) {
  const name = slot.filled_by_name ?? ''
  const { rows, lines, size } = sealLayout(name)
  return (
    <span
      className="seal"
      style={{ '--r': `${jitter(slot.id, 14)}deg`, fontSize: `${size}px` } as React.CSSProperties}
      title={name}
      aria-label={name}
    >
      {rows ? (
        <span className="seal-rows" aria-hidden>
          {rows.map((row, i) => (
            <span key={i}>{row.join('')}</span>
          ))}
        </span>
      ) : (
        <span className="seal-lines" aria-hidden>
          {lines!.map((l, i) => (
            <span key={i}>{l}</span>
          ))}
        </span>
      )}
    </span>
  )
}

function QuestCard({ song, onOpen }: { song: Song; onOpen: () => void }) {
  const done = isComplete(song)
  const missing = song.slots.filter((s) => !s.filled_at).length
  const pending = song.applications.filter((a) => a.status === 'pending').length
  const labels = slotLabels(song.slots)

  return (
    <button
      className={`notice paper ${done ? 'is-done' : ''}`}
      style={{ '--tilt': `${jitter(song.id, 1.6)}deg` } as React.CSSProperties}
      onClick={onOpen}
    >
      <span className="tape tape-l" aria-hidden />
      <span className="tape tape-r" aria-hidden />

      <div className="notice-head">
        <h3 className="notice-title">{song.title}</h3>
        {!done && <span className="missing">缺 {missing}</span>}
      </div>
      <p className="notice-meta">
        {song.artist && <>原唱 {song.artist}　</>}主唱 {song.singer}
      </p>

      <ol className="stamp-card">
        {song.slots.map((slot) => (
          <li key={slot.id} className={slot.filled_at ? 'filled' : ''}>
            <span className="stamp-label">{labels[slot.id]}</span>
            {slot.filled_at && <Seal slot={slot} />}
          </li>
        ))}
      </ol>

      <div className="notice-foot">
        <span>{!done && pending > 0 ? `${pending} 人報名，等主唱確認` : ''}</span>
        <span>{relativeTime(song.created_at)}</span>
      </div>

      {done && <span className="stamp">成團</span>}
    </button>
  )
}
