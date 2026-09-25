import { useState } from 'react'
import { api, errorText } from '../api'
import type { Application, ApplyInput, Musician, Slot, Song } from '../types'
import { isComplete, Seal, slotLabels } from './QuestBoard'
import { Contact, PasswordGate, relativeTime } from './ui'

interface Props {
  song: Song
  musicians: Musician[]
  password: string | undefined
  onUnlock: (pw: string) => void
  onChanged: () => Promise<void>
  onEdit: () => void
  onDeleted: () => void
  onOpenMusician: (id: string) => void
  toast: (msg: string) => void
}

export function QuestDetail(props: Props) {
  const { song, musicians, password, onUnlock, onChanged, toast } = props
  const [showGate, setShowGate] = useState(false)
  const [busy, setBusy] = useState(false)
  const [newSlot, setNewSlot] = useState('')
  const managing = password !== undefined
  const done = isComplete(song)
  const filled = song.slots.filter((s) => s.filled_at).length
  const labels = slotLabels(song.slots)

  /** 執行需要密碼的動作，完成後重新載入資料 */
  async function run(action: () => Promise<void>, success?: string): Promise<boolean> {
    setBusy(true)
    try {
      await action()
      await onChanged()
      if (success) toast(success)
      return true
    } catch (e) {
      toast(errorText(e))
      return false
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`quest-detail ${busy ? 'is-busy' : ''}`}>
      {done && <span className="stamp stamp-corner">成團</span>}
      <h2 className="detail-title">{song.title}</h2>
      {song.artist && <p className="detail-sub">原唱 {song.artist}</p>}

      <dl className="info">
        <dt>主唱</dt>
        <dd>{song.singer}</dd>
        <dt>聯絡</dt>
        <dd>
          <Contact text={song.contact} />
        </dd>
        {song.ref_url && (
          <>
            <dt>參考</dt>
            <dd>
              {/^https?:\/\//i.test(song.ref_url) ? (
                <a href={song.ref_url} target="_blank" rel="noreferrer">
                  {song.ref_url}
                </a>
              ) : (
                song.ref_url
              )}
            </dd>
          </>
        )}
        <dt>貼出</dt>
        <dd>{relativeTime(song.created_at)}</dd>
      </dl>
      {song.notes && <p className="notes">{song.notes}</p>}

      <h3 className="section-title">
        需要的樂手<span className="count">{done ? '全部到齊' : `${filled} / ${song.slots.length}`}</span>
      </h3>
      <ul className="slot-detail-list">
        {song.slots.map((slot) => (
          <SlotRow
            key={slot.id}
            slot={slot}
            label={labels[slot.id]}
            applications={song.applications.filter((a) => a.slot_id === slot.id)}
            musicians={musicians}
            password={password}
            canRemove={song.slots.length > 1}
            run={run}
            onOpenMusician={props.onOpenMusician}
          />
        ))}
      </ul>

      {managing && (
        <form
          className="row add-slot"
          onSubmit={(e) => {
            e.preventDefault()
            if (!newSlot.trim()) return
            run(() => api.addSlot(song.id, password, newSlot.trim()), `已加上「${newSlot.trim()}」`).then(
              (ok) => ok && setNewSlot(''),
            )
          }}
        >
          <input value={newSlot} onChange={(e) => setNewSlot(e.target.value)} maxLength={20} placeholder="還要找什麼樂手？例如：和聲" />
          <button className="btn btn-line" disabled={!newSlot.trim()}>
            加上
          </button>
        </form>
      )}

      <div className="owner-zone">
        {managing ? (
          <div className="row wrap">
            <span className="muted">你正在管理這首歌</span>
            <span className="spacer" />
            <button className="btn btn-line" onClick={props.onEdit}>
              修改資料
            </button>
            <button
              className="btn btn-danger"
              onClick={() => {
                if (confirm(`要撤下「${song.title}」嗎？報名紀錄會一起刪除。`))
                  run(() => api.deleteSong(song.id, password), `已撤下「${song.title}」`).then((ok) => ok && props.onDeleted())
              }}
            >
              撤下這首歌
            </button>
          </div>
        ) : showGate ? (
          <PasswordGate
            label="這首歌的管理密碼"
            hint="忘記密碼的話，找樂團負責人。"
            verify={(pw) => api.verifySong(song.id, pw)}
            onUnlock={onUnlock}
          />
        ) : (
          <button className="link-btn" onClick={() => setShowGate(true)}>
            我是這首歌的主唱
          </button>
        )}
      </div>
    </div>
  )
}

function SlotRow({
  slot,
  label,
  applications,
  musicians,
  password,
  canRemove,
  run,
  onOpenMusician,
}: {
  slot: Slot
  label: string
  applications: Application[]
  musicians: Musician[]
  password: string | undefined
  canRemove: boolean
  run: (action: () => Promise<void>, success?: string) => Promise<boolean>
  onOpenMusician: (id: string) => void
}) {
  const [applying, setApplying] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const managing = password !== undefined
  const visibleApps = applications.filter((a) => a.status !== 'rejected' || managing)
  const filledMusician = musicians.find((m) => m.id === slot.filled_by_musician)

  return (
    <li className={`slot-row ${slot.filled_at ? 'filled' : ''}`}>
      <div className="slot-main">
        <div className="stamp-box">
          <span className="stamp-label">{label}</span>
          {slot.filled_at && <Seal slot={slot} />}
        </div>

        <div className="slot-body">
          <div className="row wrap">
            {slot.filled_at ? (
              filledMusician ? (
                <button className="link-btn name" onClick={() => onOpenMusician(filledMusician.id)}>
                  {slot.filled_by_name}
                </button>
              ) : (
                <span className="name">{slot.filled_by_name}</span>
              )
            ) : (
              <span className="muted">還沒有人</span>
            )}
            <span className="spacer" />
            {!slot.filled_at && !managing && (
              <button className={`btn btn-small ${applying ? 'btn-line' : ''}`} onClick={() => setApplying(!applying)}>
                {applying ? '取消' : '我來'}
              </button>
            )}
            {managing && !slot.filled_at && (
              <button className="btn btn-small btn-line" onClick={() => setAssigning(!assigning)}>
                {assigning ? '取消' : '直接填人'}
              </button>
            )}
            {managing && slot.filled_at && (
              <button
                className="btn btn-small btn-line"
                onClick={() => run(() => api.clearSlot(slot.id, password), `已把${slot.filled_by_name}移出這個位置`)}
              >
                移出
              </button>
            )}
            {managing && canRemove && (
              <button
                className="btn btn-small btn-danger"
                onClick={() =>
                  confirm(`刪掉「${label}」這個位置？`) &&
                  run(() => api.removeSlot(slot.id, password), `已刪掉「${label}」`)
                }
              >
                刪掉位置
              </button>
            )}
          </div>

          {applying && (
            <ApplyForm
              slot={slot}
              label={label}
              musicians={musicians}
              onSubmit={async (input) => {
                if (await run(() => api.apply(slot.id, input), '已報名，主唱確認後會蓋章')) setApplying(false)
              }}
            />
          )}

          {assigning && password !== undefined && (
            <AssignForm
              musicians={musicians}
              instrument={slot.instrument}
              onSubmit={async (name, mid) => {
                if (await run(() => api.fillSlot(slot.id, password, name, mid), `已填入${name}`)) setAssigning(false)
              }}
            />
          )}

          {visibleApps.length > 0 && (
            <ul className="applicants">
              {visibleApps.map((a) => (
                <li key={a.id} className={`applicant status-${a.status}`}>
                  <div className="row wrap">
                    {a.musician_id && musicians.some((m) => m.id === a.musician_id) ? (
                      <button className="link-btn name" onClick={() => onOpenMusician(a.musician_id!)}>
                        {a.name}
                      </button>
                    ) : (
                      <span className="name">{a.name}</span>
                    )}
                    <span className="status">{{ pending: '等確認', accepted: '已確認', rejected: '已婉拒' }[a.status]}</span>
                    <span className="muted small">{relativeTime(a.created_at)}</span>
                    <span className="spacer" />
                    {managing && a.status === 'pending' && (
                      <>
                        <button
                          className="btn btn-small btn-seal"
                          disabled={!!slot.filled_at}
                          onClick={() => run(() => api.acceptApplication(a.id, password), `已確認${a.name}`)}
                        >
                          確認
                        </button>
                        <button className="btn btn-small btn-line" onClick={() => run(() => api.rejectApplication(a.id, password), `已婉拒${a.name}`)}>
                          婉拒
                        </button>
                      </>
                    )}
                  </div>
                  <div className="small">
                    <Contact text={a.contact} />
                  </div>
                  {a.message && <p className="applicant-msg">{a.message}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </li>
  )
}

function ApplyForm({
  slot,
  label,
  musicians,
  onSubmit,
}: {
  slot: Slot
  label: string
  musicians: Musician[]
  onSubmit: (input: ApplyInput) => Promise<void>
}) {
  const [musicianId, setMusicianId] = useState('')
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const sorted = [...musicians].sort(
    (a, b) => Number(b.instruments.includes(slot.instrument)) - Number(a.instruments.includes(slot.instrument)),
  )

  return (
    <form
      className="inline-form"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        await onSubmit({ musician_id: musicianId || null, name, contact, message })
        setBusy(false)
      }}
    >
      {musicians.length > 0 && (
        <select
          value={musicianId}
          aria-label="從樂手名冊帶入"
          onChange={(e) => {
            setMusicianId(e.target.value)
            const m = musicians.find((x) => x.id === e.target.value)
            if (m) {
              setName(m.name)
              setContact(m.contact)
            }
          }}
        >
          <option value="">已經登記過？從名冊選自己</option>
          {sorted.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}（{m.instruments.join('、')}）
            </option>
          ))}
        </select>
      )}
      <div className="grid-2">
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="名字" aria-label="名字" required />
        <input value={contact} onChange={(e) => setContact(e.target.value)} maxLength={200} placeholder="IG、Line 或 Email" aria-label="聯絡方式" required />
      </div>
      <input value={message} onChange={(e) => setMessage(e.target.value)} maxLength={300} placeholder="想跟主唱說什麼（可不填）" aria-label="留言" />
      <button className="btn" disabled={busy}>
        {busy ? '送出中…' : `報名${label}`}
      </button>
    </form>
  )
}

function AssignForm({
  musicians,
  instrument,
  onSubmit,
}: {
  musicians: Musician[]
  instrument: string
  onSubmit: (name: string, musicianId: string | null) => Promise<void>
}) {
  const [musicianId, setMusicianId] = useState('')
  const [name, setName] = useState('')
  const sorted = [...musicians].sort((a, b) => Number(b.instruments.includes(instrument)) - Number(a.instruments.includes(instrument)))

  return (
    <form
      className="inline-form"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit(name.trim(), musicianId || null)
      }}
    >
      <span className="hint">私下已經找到人，就直接填進來。</span>
      <div className="grid-2">
        <select
          value={musicianId}
          aria-label="從名冊選擇"
          onChange={(e) => {
            setMusicianId(e.target.value)
            const m = musicians.find((x) => x.id === e.target.value)
            if (m) setName(m.name)
          }}
        >
          <option value="">從名冊選（可不選）</option>
          {sorted.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}（{m.instruments.join('、')}）
            </option>
          ))}
        </select>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="名字" aria-label="名字" required />
      </div>
      <button className="btn btn-seal" disabled={!name.trim()}>
        蓋章
      </button>
    </form>
  )
}
