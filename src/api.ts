import { createClient } from '@supabase/supabase-js'
import type { ApplyInput, Musician, MusicianInput, Song, SongInput } from './types'

export interface Api {
  demo: boolean
  load(): Promise<{ songs: Song[]; musicians: Musician[] }>
  createSong(input: SongInput, instruments: string[], password: string): Promise<string>
  verifySong(songId: string, password: string): Promise<boolean>
  updateSong(songId: string, password: string, input: SongInput): Promise<void>
  deleteSong(songId: string, password: string): Promise<void>
  addSlot(songId: string, password: string, instrument: string): Promise<void>
  removeSlot(slotId: string, password: string): Promise<void>
  fillSlot(slotId: string, password: string, name: string, musicianId: string | null): Promise<void>
  clearSlot(slotId: string, password: string): Promise<void>
  apply(slotId: string, input: ApplyInput): Promise<void>
  acceptApplication(applicationId: string, password: string): Promise<void>
  rejectApplication(applicationId: string, password: string): Promise<void>
  createMusician(input: MusicianInput, password: string): Promise<string>
  verifyMusician(musicianId: string, password: string): Promise<boolean>
  updateMusician(musicianId: string, password: string, input: MusicianInput): Promise<void>
  deleteMusician(musicianId: string, password: string): Promise<void>
}

const ERROR_TEXT: Record<string, string> = {
  invalid_password: '密碼不對。',
  password_too_short: '密碼至少 4 個字。',
  no_slots: '至少要留一個位置。',
  too_many_slots: '一首歌最多 12 個位置。',
  slot_filled: '這個位置已經有人了。',
  already_applied: '你已經報名過這個位置，等主唱確認。',
  too_many_applications: '這個位置報名的人太多了，直接聯絡主唱吧。',
  not_found: '找不到這筆資料，可能已經刪掉了。',
}

export function errorText(e: unknown): string {
  const msg = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String(e.message) : String(e)
  for (const [code, text] of Object.entries(ERROR_TEXT)) if (msg.includes(code)) return text
  if (msg.includes('check constraint')) return '有欄位是空的或太長，檢查一下再送出。'
  return msg || '發生未知錯誤'
}

// ───────────── Supabase ─────────────

function supabaseApi(url: string, key: string): Api {
  const sb = createClient(url, key, { auth: { persistSession: false } })

  async function rpc<T = void>(fn: string, args: Record<string, unknown>): Promise<T> {
    const { data, error } = await sb.rpc(fn, args)
    if (error) throw new Error(error.message)
    return data as T
  }

  return {
    demo: false,
    async load() {
      // 只挑需要的欄位，一次載入，減少流量
      const [songs, musicians] = await Promise.all([
        sb
          .from('songs')
          .select(
            'id,title,artist,singer,contact,notes,ref_url,created_at,' +
              'slots(id,song_id,instrument,position,filled_by_name,filled_by_musician,filled_at),' +
              'applications(id,song_id,slot_id,musician_id,name,contact,message,status,created_at)',
          )
          .order('created_at', { ascending: false }),
        sb.from('musicians').select('id,name,instruments,bio,contact,created_at').order('created_at', { ascending: false }),
      ])
      if (songs.error) throw new Error(songs.error.message)
      if (musicians.error) throw new Error(musicians.error.message)
      const list = songs.data as unknown as Song[]
      for (const s of list) s.slots.sort((a, b) => a.position - b.position)
      return { songs: list, musicians: musicians.data as Musician[] }
    },
    createSong: (i, instruments, password) =>
      rpc<string>('create_song', {
        p_title: i.title, p_artist: i.artist, p_singer: i.singer, p_contact: i.contact,
        p_notes: i.notes, p_ref_url: i.ref_url, p_instruments: instruments, p_password: password,
      }),
    verifySong: (id, pw) => rpc<boolean>('verify_song_password', { p_song: id, p_password: pw }),
    updateSong: (id, pw, i) =>
      rpc('update_song', {
        p_song: id, p_password: pw, p_title: i.title, p_artist: i.artist, p_singer: i.singer,
        p_contact: i.contact, p_notes: i.notes, p_ref_url: i.ref_url,
      }),
    deleteSong: (id, pw) => rpc('delete_song', { p_song: id, p_password: pw }),
    addSlot: async (id, pw, instrument) => {
      await rpc('add_slot', { p_song: id, p_password: pw, p_instrument: instrument })
    },
    removeSlot: (id, pw) => rpc('remove_slot', { p_slot: id, p_password: pw }),
    fillSlot: (id, pw, name, mid) => rpc('fill_slot', { p_slot: id, p_password: pw, p_name: name, p_musician: mid }),
    clearSlot: (id, pw) => rpc('clear_slot', { p_slot: id, p_password: pw }),
    apply: async (slotId, i) => {
      await rpc('apply_slot', {
        p_slot: slotId, p_musician: i.musician_id, p_name: i.name, p_contact: i.contact, p_message: i.message,
      })
    },
    acceptApplication: (id, pw) => rpc('accept_application', { p_application: id, p_password: pw }),
    rejectApplication: (id, pw) => rpc('reject_application', { p_application: id, p_password: pw }),
    createMusician: (i, pw) =>
      rpc<string>('create_musician', {
        p_name: i.name, p_instruments: i.instruments, p_bio: i.bio, p_contact: i.contact, p_password: pw,
      }),
    verifyMusician: (id, pw) => rpc<boolean>('verify_musician_password', { p_musician: id, p_password: pw }),
    updateMusician: (id, pw, i) =>
      rpc('update_musician', {
        p_musician: id, p_password: pw, p_name: i.name, p_instruments: i.instruments, p_bio: i.bio, p_contact: i.contact,
      }),
    deleteMusician: (id, pw) => rpc('delete_musician', { p_musician: id, p_password: pw }),
  }
}

// ───────────── 示範模式：資料存在瀏覽器 localStorage ─────────────

interface DemoDb {
  songs: Song[]
  musicians: Musician[]
  passwords: Record<string, string>
}

const DEMO_KEY = 'bandmatcher-demo-v1'

function demoApi(): Api {
  const now = () => new Date().toISOString()
  const uid = () => crypto.randomUUID()

  // localStorage 不能用時（無痕模式等）就只存在記憶體
  let memory: DemoDb | null = null

  function read(): DemoDb {
    try {
      const raw = localStorage.getItem(DEMO_KEY)
      if (raw) return JSON.parse(raw) as DemoDb
    } catch {
      /* 讀不到就用記憶體或範例資料 */
    }
    if (memory) return structuredClone(memory)
    const db = seed()
    write(db)
    return structuredClone(db)
  }
  function write(db: DemoDb) {
    memory = db
    try {
      localStorage.setItem(DEMO_KEY, JSON.stringify(db))
    } catch {
      /* 無痕模式等情況寫不進去，就只存在記憶體 */
    }
  }
  function mutate<T>(fn: (db: DemoDb) => T): Promise<T> {
    const db = read()
    try {
      const result = fn(db)
      write(db)
      return Promise.resolve(result)
    } catch (e) {
      return Promise.reject(e)
    }
  }
  function check(db: DemoDb, id: string, pw: string) {
    if (db.passwords[id] !== pw && pw !== 'admin') throw new Error('invalid_password')
  }
  function checkNew(pw: string) {
    if (pw.length < 4) throw new Error('password_too_short')
  }
  function findSlot(db: DemoDb, slotId: string) {
    for (const song of db.songs) {
      const slot = song.slots.find((s) => s.id === slotId)
      if (slot) return { song, slot }
    }
    throw new Error('not_found')
  }
  function findApp(db: DemoDb, appId: string) {
    for (const song of db.songs) {
      const app = song.applications.find((a) => a.id === appId)
      if (app) return { song, app, slot: song.slots.find((s) => s.id === app.slot_id)! }
    }
    throw new Error('not_found')
  }
  function song(db: DemoDb, id: string) {
    const s = db.songs.find((x) => x.id === id)
    if (!s) throw new Error('not_found')
    return s
  }
  function newSlot(songId: string, instrument: string, position: number) {
    return {
      id: uid(), song_id: songId, instrument: instrument.trim(), position,
      filled_by_name: null, filled_by_musician: null, filled_at: null,
    }
  }
  function cleanInstruments(list: string[]) {
    return [...new Set(list.map((x) => x.trim()).filter(Boolean))]
  }

  function seed(): DemoDb {
    const m1 = uid(), m2 = uid(), m3 = uid()
    const s1 = uid(), s2 = uid()
    const db: DemoDb = {
      musicians: [
        { id: m1, name: '阿哲', instruments: ['鼓', 'Cajon'], bio: '打鼓八年，什麼曲風都可以，最愛 math rock。', contact: 'IG @drum_jer', created_at: now() },
        { id: m2, name: 'Yuki', instruments: ['鍵盤', '合成器', '和聲'], bio: '古典鋼琴出身，最近在玩 synth pop。', contact: 'Line: yuki_keys', created_at: now() },
        { id: m3, name: '小胖', instruments: ['貝斯'], bio: '低音是靈魂。', contact: 'IG @fatbass', created_at: now() },
      ],
      songs: [
        {
          id: s1, title: '晴天', artist: '周杰倫', singer: '小明', contact: 'IG @ming_sings',
          notes: '原調，想要還原前奏的吉他 solo。', ref_url: '', created_at: now(),
          slots: [newSlot(s1, '電吉他', 1), newSlot(s1, '貝斯', 2), newSlot(s1, '鼓', 3), newSlot(s1, '鍵盤', 4)],
          applications: [],
        },
        {
          id: s2, title: '步步', artist: '五月天', singer: '阿芳', contact: 'Line: fang123',
          notes: '降兩個 key。', ref_url: '', created_at: now(),
          slots: [newSlot(s2, '木吉他', 1), newSlot(s2, '鍵盤', 2)],
          applications: [],
        },
      ],
      passwords: { [s1]: 'demo', [s2]: 'demo', [m1]: 'demo', [m2]: 'demo', [m3]: 'demo' },
    }
    const s = db.songs[0]
    s.slots[2].filled_by_name = '阿哲'
    s.slots[2].filled_by_musician = m1
    s.slots[2].filled_at = now()
    s.applications.push(
      { id: uid(), song_id: s1, slot_id: s.slots[2].id, musician_id: m1, name: '阿哲', contact: 'IG @drum_jer', message: '我來！', status: 'accepted', created_at: now() },
      { id: uid(), song_id: s1, slot_id: s.slots[1].id, musician_id: m3, name: '小胖', contact: 'IG @fatbass', message: '這首我練過', status: 'pending', created_at: now() },
    )
    return db
  }

  return {
    demo: true,
    load: async () => {
      const db = read()
      return { songs: db.songs, musicians: db.musicians }
    },
    createSong: (i, instruments, pw) =>
      mutate((db) => {
        checkNew(pw)
        const list = instruments.map((x) => x.trim()).filter(Boolean)
        if (!list.length) throw new Error('no_slots')
        if (list.length > 12) throw new Error('too_many_slots')
        const id = uid()
        db.songs.unshift({ id, ...i, created_at: now(), slots: list.map((x, n) => newSlot(id, x, n + 1)), applications: [] })
        db.passwords[id] = pw
        return id
      }),
    verifySong: async (id, pw) => {
      const db = read()
      return db.passwords[id] === pw || pw === 'admin'
    },
    updateSong: (id, pw, i) =>
      mutate((db) => {
        check(db, id, pw)
        Object.assign(song(db, id), i)
      }),
    deleteSong: (id, pw) =>
      mutate((db) => {
        check(db, id, pw)
        db.songs = db.songs.filter((s) => s.id !== id)
      }),
    addSlot: (id, pw, instrument) =>
      mutate((db) => {
        check(db, id, pw)
        const s = song(db, id)
        if (s.slots.length >= 12) throw new Error('too_many_slots')
        s.slots.push(newSlot(id, instrument, Math.max(0, ...s.slots.map((x) => x.position)) + 1))
      }),
    removeSlot: (slotId, pw) =>
      mutate((db) => {
        const { song } = findSlot(db, slotId)
        check(db, song.id, pw)
        if (song.slots.length <= 1) throw new Error('no_slots')
        song.slots = song.slots.filter((s) => s.id !== slotId)
        song.applications = song.applications.filter((a) => a.slot_id !== slotId)
      }),
    fillSlot: (slotId, pw, name, mid) =>
      mutate((db) => {
        const { song, slot } = findSlot(db, slotId)
        check(db, song.id, pw)
        Object.assign(slot, { filled_by_name: name.trim(), filled_by_musician: mid, filled_at: now() })
      }),
    clearSlot: (slotId, pw) =>
      mutate((db) => {
        const { song, slot } = findSlot(db, slotId)
        check(db, song.id, pw)
        Object.assign(slot, { filled_by_name: null, filled_by_musician: null, filled_at: null })
        for (const a of song.applications) if (a.slot_id === slotId && a.status === 'accepted') a.status = 'pending'
      }),
    apply: (slotId, i) =>
      mutate((db) => {
        const { song, slot } = findSlot(db, slotId)
        if (slot.filled_at) throw new Error('slot_filled')
        const pending = song.applications.filter((a) => a.slot_id === slotId && a.status === 'pending')
        if (pending.some((a) => a.name.toLowerCase() === i.name.trim().toLowerCase())) throw new Error('already_applied')
        if (pending.length >= 20) throw new Error('too_many_applications')
        song.applications.push({
          id: uid(), song_id: song.id, slot_id: slotId, musician_id: i.musician_id, name: i.name.trim(),
          contact: i.contact.trim(), message: i.message.trim(), status: 'pending', created_at: now(),
        })
      }),
    acceptApplication: (appId, pw) =>
      mutate((db) => {
        const { song, app, slot } = findApp(db, appId)
        check(db, song.id, pw)
        if (slot.filled_at) throw new Error('slot_filled')
        app.status = 'accepted'
        Object.assign(slot, { filled_by_name: app.name, filled_by_musician: app.musician_id, filled_at: now() })
      }),
    rejectApplication: (appId, pw) =>
      mutate((db) => {
        const { song, app, slot } = findApp(db, appId)
        check(db, song.id, pw)
        if (app.status === 'accepted') Object.assign(slot, { filled_by_name: null, filled_by_musician: null, filled_at: null })
        app.status = 'rejected'
      }),
    createMusician: (i, pw) =>
      mutate((db) => {
        checkNew(pw)
        const id = uid()
        db.musicians.unshift({ id, ...i, instruments: cleanInstruments(i.instruments), created_at: now() })
        db.passwords[id] = pw
        return id
      }),
    verifyMusician: async (id, pw) => {
      const db = read()
      return db.passwords[id] === pw || pw === 'admin'
    },
    updateMusician: (id, pw, i) =>
      mutate((db) => {
        check(db, id, pw)
        const m = db.musicians.find((x) => x.id === id)
        if (!m) throw new Error('not_found')
        Object.assign(m, i, { instruments: cleanInstruments(i.instruments) })
      }),
    deleteMusician: (id, pw) =>
      mutate((db) => {
        check(db, id, pw)
        db.musicians = db.musicians.filter((m) => m.id !== id)
        for (const s of db.songs)
          for (const slot of s.slots) if (slot.filled_by_musician === id) slot.filled_by_musician = null
      }),
  }
}

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const api: Api = url && key ? supabaseApi(url, key) : demoApi()
export const EVENT_NAME = (import.meta.env.VITE_EVENT_NAME as string | undefined) || ''
