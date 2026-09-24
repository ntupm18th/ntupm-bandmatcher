import { useCallback, useEffect, useRef, useState } from 'react'
import { api, EVENT_NAME, errorText } from './api'
import { MusicianForm, SongForm } from './components/Forms'
import { QuestBoard } from './components/QuestBoard'
import { QuestDetail } from './components/QuestDetail'
import { MusicianDetail, Roster } from './components/Roster'
import { Modal } from './components/ui'
import type { Musician, Song } from './types'

// ───────── 簡單的 hash 路由，方便把單一首歌的網址分享出去 ─────────

type Route =
  | { page: 'quests' }
  | { page: 'roster' }
  | { page: 'new-quest' }
  | { page: 'join' }
  | { page: 'quest'; id: string; edit?: boolean }
  | { page: 'musician'; id: string; edit?: boolean }

function parseHash(): Route {
  const [, a, id, edit] = location.hash.replace(/^#/, '').split('/')
  if (a === 'roster') return { page: 'roster' }
  if (a === 'new-quest') return { page: 'new-quest' }
  if (a === 'join') return { page: 'join' }
  if (a === 'quest' && id) return { page: 'quest', id, edit: edit === 'edit' }
  if (a === 'musician' && id) return { page: 'musician', id, edit: edit === 'edit' }
  return { page: 'quests' }
}

function go(path: string) {
  location.hash = path
}

// ───────── 本分頁記住已解鎖的密碼，關掉分頁就忘記 ─────────

const KEYS = 'bandmatcher-keys'
function loadKeys(): Record<string, string> {
  try {
    return JSON.parse(sessionStorage.getItem(KEYS) || '{}')
  } catch {
    return {}
  }
}

export default function App() {
  const [route, setRoute] = useState<Route>(parseHash)
  const [songs, setSongs] = useState<Song[]>([])
  const [musicians, setMusicians] = useState<Musician[]>([])
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [keys, setKeys] = useState<Record<string, string>>(loadKeys)
  const [toastMsg, setToastMsg] = useState('')
  const lastLoad = useRef(0)
  const toastTimer = useRef<number>(undefined)
  const baseTab = useRef<'quests' | 'roster'>('quests')

  const refresh = useCallback(async () => {
    lastLoad.current = Date.now()
    try {
      const data = await api.load()
      setSongs(data.songs)
      setMusicians(data.musicians)
      setLoadError('')
    } catch (e) {
      setLoadError(errorText(e))
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    refresh()
    const onHash = () => setRoute(parseHash())
    // 切回分頁時若超過一分鐘沒更新就重新載入（不用即時訂閱，省流量）
    const onVisible = () => document.visibilityState === 'visible' && Date.now() - lastLoad.current > 60_000 && refresh()
    window.addEventListener('hashchange', onHash)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('hashchange', onHash)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [refresh])

  const toast = useCallback((msg: string) => {
    setToastMsg(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToastMsg(''), 3200)
  }, [])

  const unlock = (id: string, pw: string) => {
    const next = { ...keys, [id]: pw }
    setKeys(next)
    try {
      sessionStorage.setItem(KEYS, JSON.stringify(next))
    } catch {
      /* 存不了就只在記憶體裡 */
    }
  }

  if (route.page === 'roster' || route.page === 'musician' || route.page === 'join') baseTab.current = 'roster'
  if (route.page === 'quests' || route.page === 'quest' || route.page === 'new-quest') baseTab.current = 'quests'
  const tab = baseTab.current
  const closeModal = () => go(tab === 'roster' ? '/roster' : '/')

  const song = route.page === 'quest' ? songs.find((s) => s.id === route.id) : undefined
  const musician = route.page === 'musician' ? musicians.find((m) => m.id === route.id) : undefined

  return (
    <div className="app">
      <header className="site-header">
        <div className="masthead">
          <h1>
            <span>流唱之夜</span>
            <span>樂手懸賞榜</span>
          </h1>
          {EVENT_NAME && <p className="event">{EVENT_NAME}</p>}
        </div>
        <div className="cta">
          <a className="btn" href="#/new-quest">
            徵樂手
          </a>
          <a className="btn btn-line" href="#/join">
            登記樂手資料
          </a>
        </div>
      </header>

      <nav className="tabs">
        <a href="#/" className={tab === 'quests' ? 'on' : ''}>
          懸賞榜<span>{songs.length}</span>
        </a>
        <a href="#/roster" className={tab === 'roster' ? 'on' : ''}>
          樂手名冊<span>{musicians.length}</span>
        </a>
      </nav>

      {api.demo && (
        <p className="demo-banner">
          示範模式：還沒接上資料庫，資料只存在這個瀏覽器。範例的密碼都是 <code>demo</code>。
        </p>
      )}

      <main>
        {!loaded ? (
          <p className="loading">載入中…</p>
        ) : loadError ? (
          <div className="empty paper">
            <p>讀不到資料：{loadError}</p>
            <button className="btn" onClick={refresh}>
              再試一次
            </button>
          </div>
        ) : tab === 'quests' ? (
          <QuestBoard songs={songs} onOpen={(id) => go(`/quest/${id}`)} />
        ) : (
          <Roster musicians={musicians} songs={songs} onOpen={(id) => go(`/musician/${id}`)} />
        )}
      </main>

      {route.page === 'new-quest' && (
        <Modal onClose={closeModal} wide>
          <SongForm
            onDone={async (id, pw) => {
              await refresh()
              if (pw) unlock(id, pw)
              toast('已貼上懸賞榜')
              go(`/quest/${id}`)
            }}
          />
        </Modal>
      )}

      {route.page === 'join' && (
        <Modal onClose={closeModal} wide>
          <MusicianForm
            onDone={async (id, pw) => {
              await refresh()
              if (pw) unlock(id, pw)
              toast('已登記')
              go(`/musician/${id}`)
            }}
          />
        </Modal>
      )}

      {route.page === 'quest' && loaded && (
        <Modal onClose={closeModal} wide>
          {!song ? (
            <p>找不到這首歌，可能已經撤下了。</p>
          ) : route.edit && keys[song.id] !== undefined ? (
            <SongForm
              song={song}
              password={keys[song.id]}
              onDone={async (id) => {
                await refresh()
                toast('已儲存')
                go(`/quest/${id}`)
              }}
            />
          ) : (
            <QuestDetail
              song={song}
              musicians={musicians}
              password={keys[song.id]}
              onUnlock={(pw) => unlock(song.id, pw)}
              onChanged={refresh}
              onEdit={() => go(`/quest/${song.id}/edit`)}
              onDeleted={closeModal}
              onOpenMusician={(id) => go(`/musician/${id}`)}
              toast={toast}
            />
          )}
        </Modal>
      )}

      {route.page === 'musician' && loaded && (
        <Modal onClose={closeModal}>
          {!musician ? (
            <p>找不到這位樂手，可能已經刪掉資料了。</p>
          ) : route.edit && keys[musician.id] !== undefined ? (
            <MusicianForm
              musician={musician}
              password={keys[musician.id]}
              onDone={async (id) => {
                await refresh()
                toast('已儲存')
                go(`/musician/${id}`)
              }}
            />
          ) : (
            <MusicianDetail
              musician={musician}
              songs={songs}
              password={keys[musician.id]}
              onUnlock={(pw) => unlock(musician.id, pw)}
              onEdit={() => go(`/musician/${musician.id}/edit`)}
              onDeleted={async () => {
                await refresh()
                closeModal()
              }}
              onOpenSong={(id) => go(`/quest/${id}`)}
              toast={toast}
            />
          )}
        </Modal>
      )}

      {toastMsg && (
        <div className="toast" role="status">
          {toastMsg}
        </div>
      )}
    </div>
  )
}
