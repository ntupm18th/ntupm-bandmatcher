export interface Musician {
  id: string
  name: string
  instruments: string[]
  bio: string
  contact: string
  created_at: string
}

export interface Slot {
  id: string
  song_id: string
  instrument: string
  position: number
  filled_by_name: string | null
  filled_by_musician: string | null
  filled_at: string | null
}

export type ApplicationStatus = 'pending' | 'accepted' | 'rejected'

export interface Application {
  id: string
  song_id: string
  slot_id: string
  musician_id: string | null
  name: string
  contact: string
  message: string
  status: ApplicationStatus
  created_at: string
}

export interface Song {
  id: string
  title: string
  artist: string
  singer: string
  contact: string
  notes: string
  ref_url: string
  created_at: string
  slots: Slot[]
  applications: Application[]
}

export interface SongInput {
  title: string
  artist: string
  singer: string
  contact: string
  notes: string
  ref_url: string
}

export interface MusicianInput {
  name: string
  instruments: string[]
  bio: string
  contact: string
}

export interface ApplyInput {
  musician_id: string | null
  name: string
  contact: string
  message: string
}
