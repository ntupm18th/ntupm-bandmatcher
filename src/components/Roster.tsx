import { useMemo, useState } from 'react'
import { api, errorText } from '../api'
import type { Musician, Song } from '../types'
import { Contact, InstrumentTag, PasswordGate } from './ui'
import { jitter } from './QuestBoard'

/** 某位樂手已被錄取的歌曲 */
function questsOf(musician: Musician, songs: Song[]) {
  return songs.flatMap((song) =>
    song.slots.filter((s) => s.filled_by_musician === musician.id).map((slot) => ({ song, slot })),
  )
}

export function Roster({ musicians, songs, onOpen }: { musicians: Musician[]; songs: Song[]; onOpen: (id: string) => void }) {
  const [instrument, setInstrument] = useState('')
  const [query, setQuery] = useState('')
  const allInstruments = useMemo(() => [...new Set(musicians.flatMap((m) => m.instruments))], [musicians])

  const visible = musicians.filter((m) => {
    if (instrument && !m.instruments.includes(instrument)) return false
    const q = query.trim().toLowerCase()
    return !q || m.name.toLowerCase().includes(q) || m.bio.toLowerCase().includes(q)
  })

  return (
    <section>
      <div className="toolbar">
        <div className="seg seg-scroll">
          <button className={instrument === '' ? 'on' : ''} onClick={() => setInstrument('')}>
            全部 {musicians.length}
          </button>
          {allInstruments.map((x) => (
            <button key={x} className={instrument === x ? 'on' : ''} onClick={() => setInstrument(x)}>
              {x} {musicians.filter((m) => m.instruments.includes(x)).length}
            </button>
          ))}
        </div>
        <input className="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜尋名字、自介" />
      </div>

      {visible.length === 0 ? (
        <div className="empty paper">
          <p>{musicians.length === 0 ? '名冊上還沒有人。按「登記樂手資料」寫下你會的樂器。' : '沒有符合條件的樂手。'}</p>
        </div>
      ) : (
        <div className="roster">
          {visible.map((m) => {
            const quests = questsOf(m, songs)
            return (
              <button
                key={m.id}
                className="card paper"
                style={{ '--tilt': `${jitter(m.id, 0.8)}deg` } as React.CSSProperties}
                onClick={() => onOpen(m.id)}
              >
                <span className="tape tape-c" aria-hidden />
                <div className="card-name">{m.name}</div>
                <div className="card-plays">{m.instruments.join('、')}</div>
                {m.bio && <p className="card-bio">{m.bio}</p>}
                {quests.length > 0 && <div className="card-foot">已經在 {quests.length} 首歌裡</div>}
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}

export function MusicianDetail({
  musician,
  songs,
  password,
  onUnlock,
  onEdit,
  onDeleted,
  onOpenSong,
  toast,
}: {
  musician: Musician
  songs: Song[]
  password: string | undefined
  onUnlock: (pw: string) => void
  onEdit: () => void
  onDeleted: () => void
  onOpenSong: (id: string) => void
  toast: (msg: string) => void
}) {
  const [showGate, setShowGate] = useState(false)
  const quests = questsOf(musician, songs)
  const applied = songs.flatMap((song) =>
    song.applications.filter((a) => a.musician_id === musician.id && a.status === 'pending').map((a) => ({ song, a })),
  )

  return (
    <div className="musician-detail">
      <h2 className="detail-title">{musician.name}</h2>
      <div className="tags">
        {musician.instruments.map((x) => (
          <InstrumentTag key={x} name={x} />
        ))}
      </div>
      <dl className="info">
        <dt>聯絡</dt>
        <dd>
          <Contact text={musician.contact} />
        </dd>
      </dl>
      {musician.bio && <p className="notes">{musician.bio}</p>}

      {(quests.length > 0 || applied.length > 0) && <h3 className="section-title">參加的歌</h3>}
      <ul className="quest-log">
        {quests.map(({ song, slot }) => (
          <li key={slot.id}>
            <button className="link-btn" onClick={() => onOpenSong(song.id)}>
              {song.title}
            </button>{' '}
            <span className="muted">{slot.instrument}</span> <span className="status status-ok">已確認</span>
          </li>
        ))}
        {applied.map(({ song, a }) => (
          <li key={a.id}>
            <button className="link-btn" onClick={() => onOpenSong(song.id)}>
              {song.title}
            </button>{' '}
            <span className="muted">{song.slots.find((s) => s.id === a.slot_id)?.instrument}</span>{' '}
            <span className="status">等確認</span>
          </li>
        ))}
      </ul>

      <div className="owner-zone">
        {password !== undefined ? (
          <div className="row wrap">
            <span className="muted">你正在編輯自己的資料</span>
            <span className="spacer" />
            <button className="btn btn-ghost" onClick={onEdit}>
              修改資料
            </button>
            <button
              className="btn btn-danger"
              onClick={async () => {
                if (!confirm(`要把「${musician.name}」從名冊刪掉嗎？`)) return
                try {
                  await api.deleteMusician(musician.id, password)
                  toast(`已刪掉${musician.name}的資料`)
                  onDeleted()
                } catch (e) {
                  toast(errorText(e))
                }
              }}
            >
              刪掉我的資料
            </button>
          </div>
        ) : showGate ? (
          <PasswordGate label="你登記時設的密碼" verify={(pw) => api.verifyMusician(musician.id, pw)} onUnlock={onUnlock} />
        ) : (
          <button className="link-btn" onClick={() => setShowGate(true)}>
            這是我，我要修改
          </button>
        )}
      </div>
    </div>
  )
}
