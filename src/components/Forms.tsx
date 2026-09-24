import { useState } from 'react'
import { api, errorText } from '../api'
import { COMMON_INSTRUMENTS } from '../instruments'
import type { Musician, MusicianInput, Song, SongInput } from '../types'
import { Field } from './ui'

function CustomInstrumentInput({ onAdd }: { onAdd: (name: string) => void }) {
  const [value, setValue] = useState('')
  const add = () => {
    if (value.trim()) onAdd(value.trim())
    setValue('')
  }
  return (
    <div className="row">
      <input
        value={value}
        maxLength={20}
        placeholder="清單裡沒有的樂器"
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            add()
          }
        }}
      />
      <button type="button" className="btn btn-ghost" onClick={add}>
        加入
      </button>
    </div>
  )
}

// ───────────── 發布 / 編輯歌曲 ─────────────

export function SongForm({ song, password, onDone }: { song?: Song; password?: string; onDone: (id: string, password?: string) => void }) {
  const [form, setForm] = useState<SongInput>({
    title: song?.title ?? '',
    artist: song?.artist ?? '',
    singer: song?.singer ?? '',
    contact: song?.contact ?? '',
    notes: song?.notes ?? '',
    ref_url: song?.ref_url ?? '',
  })
  const [slots, setSlots] = useState<string[]>([])
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (k: keyof SongInput) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!song) {
      if (!slots.length) return setError('至少選一個要找的樂手。')
      if (pw.length < 4) return setError('密碼至少 4 個字。')
      if (pw !== pw2) return setError('兩次輸入的密碼不一樣。')
    }
    setBusy(true)
    try {
      if (song) {
        await api.updateSong(song.id, password!, form)
        onDone(song.id)
      } else {
        onDone(await api.createSong(form, slots, pw), pw)
      }
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      <h2 className="form-title">{song ? '修改這首歌' : '徵樂手'}</h2>
      {!song && <p className="form-lead">貼一首你想唱的歌，寫下缺哪些樂手。有人報名時，由你決定要不要。</p>}
      <div className="grid-2">
        <Field label="歌名">
          <input value={form.title} onChange={set('title')} maxLength={80} required autoFocus />
        </Field>
        <Field label="原唱或版本">
          <input value={form.artist} onChange={set('artist')} maxLength={80} placeholder="可不填" />
        </Field>
        <Field label="你的名字">
          <input value={form.singer} onChange={set('singer')} maxLength={40} required />
        </Field>
        <Field label="聯絡方式" hint="IG、Line 或 Email，樂手會用這個找你。">
          <input value={form.contact} onChange={set('contact')} maxLength={200} required />
        </Field>
      </div>
      <Field label="參考連結">
        <input type="url" value={form.ref_url} onChange={set('ref_url')} maxLength={300} placeholder="YouTube、Spotify 或譜的連結，可不填" />
      </Field>
      <Field label="備註">
        <textarea value={form.notes} onChange={set('notes')} maxLength={1000} rows={3} placeholder="要不要轉調、想要的編曲、方便練團的時間" />
      </Field>

      {!song && (
        <>
          <div className="field">
            <span className="field-label">要找的樂手</span>
            <span className="hint">同一種可以按兩次，例如兩把電吉他。</span>
            <div className="chip-picker">
              {COMMON_INSTRUMENTS.filter((x) => x !== '主唱').map((name) => (
                <button type="button" key={name} className="chip" onClick={() => slots.length < 12 && setSlots([...slots, name])}>
                  + {name}
                </button>
              ))}
            </div>
            <CustomInstrumentInput onAdd={(name) => slots.length < 12 && setSlots([...slots, name])} />
            <div className="slot-preview">
              {slots.length === 0 && <span className="muted">還沒選</span>}
              {slots.map((name, i) => (
                <button type="button" key={i} className="chip chip-on" onClick={() => setSlots(slots.filter((_, j) => j !== i))} aria-label={`移除${name}`}>
                  {name} ✕
                </button>
              ))}
            </div>
          </div>
          <div className="grid-2">
            <Field label="管理密碼" hint="確認報名、修改內容時要用，至少 4 個字。">
              <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} minLength={4} required />
            </Field>
            <Field label="再輸入一次">
              <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} minLength={4} required />
            </Field>
          </div>
        </>
      )}

      {error && <p className="error">{error}</p>}
      <div className="form-actions">
        <button className="btn" disabled={busy}>
          {busy ? '送出中…' : song ? '儲存' : '貼上懸賞榜'}
        </button>
      </div>
    </form>
  )
}

// ───────────── 登錄 / 編輯樂手 ─────────────

export function MusicianForm({
  musician,
  password,
  onDone,
}: {
  musician?: Musician
  password?: string
  onDone: (id: string, password?: string) => void
}) {
  const [form, setForm] = useState<MusicianInput>({
    name: musician?.name ?? '',
    instruments: musician?.instruments ?? [],
    bio: musician?.bio ?? '',
    contact: musician?.contact ?? '',
  })
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const toggle = (name: string) =>
    setForm({
      ...form,
      instruments: form.instruments.includes(name) ? form.instruments.filter((x) => x !== name) : [...form.instruments, name],
    })
  const custom = form.instruments.filter((x) => !COMMON_INSTRUMENTS.includes(x))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!form.instruments.length) return setError('至少選一種樂器。')
    if (!musician) {
      if (pw.length < 4) return setError('密碼至少 4 個字。')
      if (pw !== pw2) return setError('兩次輸入的密碼不一樣。')
    }
    setBusy(true)
    try {
      if (musician) {
        await api.updateMusician(musician.id, password!, form)
        onDone(musician.id)
      } else {
        onDone(await api.createMusician(form, pw), pw)
      }
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      <h2 className="form-title">{musician ? '修改我的資料' : '登記樂手資料'}</h2>
      {!musician && <p className="form-lead">寫下你會的樂器和聯絡方式，主唱找人時就看得到你。</p>}
      <div className="grid-2">
        <Field label="名字或暱稱">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={40} required autoFocus />
        </Field>
        <Field label="聯絡方式" hint="IG、Line 或 Email。">
          <input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} maxLength={200} required />
        </Field>
      </div>
      <div className="field">
        <span className="field-label">會的樂器</span>
        <div className="chip-picker">
          {COMMON_INSTRUMENTS.map((name) => (
            <button type="button" key={name} className={`chip ${form.instruments.includes(name) ? 'chip-on' : ''}`} onClick={() => toggle(name)}>
              {name}
            </button>
          ))}
          {custom.map((name) => (
            <button type="button" key={name} className="chip chip-on" onClick={() => toggle(name)}>
              {name} ✕
            </button>
          ))}
        </div>
        <CustomInstrumentInput onAdd={(name) => !form.instruments.includes(name) && setForm({ ...form, instruments: [...form.instruments, name] })} />
      </div>
      <Field label="自我介紹">
        <textarea
          value={form.bio}
          onChange={(e) => setForm({ ...form, bio: e.target.value })}
          maxLength={1000}
          rows={4}
          placeholder="玩多久了、喜歡什麼曲風、什麼時候能練團"
        />
      </Field>
      {!musician && (
        <div className="grid-2">
          <Field label="密碼" hint="之後修改或刪掉資料時要用，至少 4 個字。">
            <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} minLength={4} required />
          </Field>
          <Field label="再輸入一次">
            <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} minLength={4} required />
          </Field>
        </div>
      )}
      {error && <p className="error">{error}</p>}
      <div className="form-actions">
        <button className="btn" disabled={busy}>
          {busy ? '送出中…' : musician ? '儲存' : '登記'}
        </button>
      </div>
    </form>
  )
}
