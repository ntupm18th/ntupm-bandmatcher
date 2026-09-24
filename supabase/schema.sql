-- 樂手懸賞榜 資料庫結構
-- 在 Supabase Dashboard → SQL Editor 貼上整份執行即可（可重複執行）。
--
-- 設計重點：
--   * 所有資料表對外只開放「讀取」，寫入一律透過下方的 RPC 函式。
--   * 歌曲與樂手檔案各自有編輯密碼，只存 bcrypt 雜湊，放在前端讀不到的 *_secrets 表。
--   * 團長可以設定一組管理員密碼（見檔案最後），能管理任何歌曲與檔案。

create extension if not exists pgcrypto with schema extensions;

-- ───────────────────────── 資料表 ─────────────────────────

create table if not exists public.musicians (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 40),
  instruments text[] not null default '{}' check (cardinality(instruments) <= 12),
  bio         text not null default '' check (char_length(bio) <= 1000),
  contact     text not null default '' check (char_length(contact) <= 200),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.songs (
  id         uuid primary key default gen_random_uuid(),
  title      text not null check (char_length(title) between 1 and 80),
  artist     text not null default '' check (char_length(artist) <= 80),
  singer     text not null check (char_length(singer) between 1 and 40),
  contact    text not null default '' check (char_length(contact) <= 200),
  notes      text not null default '' check (char_length(notes) <= 1000),
  ref_url    text not null default '' check (char_length(ref_url) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.slots (
  id                 uuid primary key default gen_random_uuid(),
  song_id            uuid not null references public.songs on delete cascade,
  instrument         text not null check (char_length(instrument) between 1 and 20),
  position           int not null default 0,
  filled_by_name     text check (char_length(filled_by_name) <= 40),
  filled_by_musician uuid references public.musicians on delete set null,
  filled_at          timestamptz
);
create index if not exists slots_song_idx on public.slots (song_id);

create table if not exists public.applications (
  id          uuid primary key default gen_random_uuid(),
  song_id     uuid not null references public.songs on delete cascade,
  slot_id     uuid not null references public.slots on delete cascade,
  musician_id uuid references public.musicians on delete set null,
  name        text not null check (char_length(name) between 1 and 40),
  contact     text not null default '' check (char_length(contact) <= 200),
  message     text not null default '' check (char_length(message) <= 300),
  status      text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at  timestamptz not null default now()
);
create index if not exists applications_song_idx on public.applications (song_id);

create table if not exists public.song_secrets (
  song_id       uuid primary key references public.songs on delete cascade,
  password_hash text not null
);

create table if not exists public.musician_secrets (
  musician_id   uuid primary key references public.musicians on delete cascade,
  password_hash text not null
);

create table if not exists public.app_secrets (
  key           text primary key,
  password_hash text not null
);

-- ───────────────────────── 權限 ─────────────────────────

alter table public.musicians        enable row level security;
alter table public.songs            enable row level security;
alter table public.slots            enable row level security;
alter table public.applications     enable row level security;
alter table public.song_secrets     enable row level security;
alter table public.musician_secrets enable row level security;
alter table public.app_secrets      enable row level security;

revoke all on public.musicians, public.songs, public.slots, public.applications,
              public.song_secrets, public.musician_secrets, public.app_secrets
  from anon, authenticated;
grant select on public.musicians, public.songs, public.slots, public.applications
  to anon, authenticated;

drop policy if exists "public read" on public.musicians;
drop policy if exists "public read" on public.songs;
drop policy if exists "public read" on public.slots;
drop policy if exists "public read" on public.applications;
create policy "public read" on public.musicians    for select using (true);
create policy "public read" on public.songs        for select using (true);
create policy "public read" on public.slots        for select using (true);
create policy "public read" on public.applications for select using (true);

-- ───────────────────────── 內部工具函式 ─────────────────────────

create or replace function public._password_ok(p_hash text, p_password text)
returns boolean language sql stable security definer
set search_path = public, extensions as $$
  select p_hash is not null and p_hash = crypt(coalesce(p_password, ''), p_hash)
      or exists (
        select 1 from public.app_secrets
        where key = 'admin' and password_hash = crypt(coalesce(p_password, ''), password_hash)
      );
$$;

create or replace function public._hash(p_password text)
returns text language plpgsql volatile security definer
set search_path = public, extensions as $$
begin
  if char_length(coalesce(p_password, '')) < 4 then
    raise exception 'password_too_short' using errcode = 'P0001';
  end if;
  return crypt(p_password, gen_salt('bf', 8));
end $$;

create or replace function public._require_song(p_song uuid, p_password text)
returns void language plpgsql stable security definer
set search_path = public, extensions as $$
begin
  if not public._password_ok((select password_hash from public.song_secrets where song_id = p_song), p_password) then
    raise exception 'invalid_password' using errcode = 'P0001';
  end if;
end $$;

create or replace function public._require_musician(p_musician uuid, p_password text)
returns void language plpgsql stable security definer
set search_path = public, extensions as $$
begin
  if not public._password_ok((select password_hash from public.musician_secrets where musician_id = p_musician), p_password) then
    raise exception 'invalid_password' using errcode = 'P0001';
  end if;
end $$;

create or replace function public._clean_instruments(p text[])
returns text[] language sql immutable as $$
  select coalesce(array_agg(t order by first_pos), '{}')
  from (
    select btrim(x) as t, min(pos) as first_pos
    from unnest(coalesce(p, '{}')) with ordinality as u(x, pos)
    where btrim(x) <> ''
    group by btrim(x)
  ) s;
$$;

revoke execute on function public._password_ok(text, text)          from public, anon, authenticated;
revoke execute on function public._hash(text)                       from public, anon, authenticated;
revoke execute on function public._require_song(uuid, text)         from public, anon, authenticated;
revoke execute on function public._require_musician(uuid, text)     from public, anon, authenticated;

-- ───────────────────────── 歌曲（懸賞任務） ─────────────────────────

create or replace function public.create_song(
  p_title text, p_artist text, p_singer text, p_contact text,
  p_notes text, p_ref_url text, p_instruments text[], p_password text
) returns uuid language plpgsql security definer
set search_path = public, extensions as $$
declare
  v_id uuid;
  v_hash text := public._hash(p_password);
  i int;
begin
  if cardinality(coalesce(p_instruments, '{}')) = 0 then
    raise exception 'no_slots' using errcode = 'P0001';
  end if;
  if cardinality(p_instruments) > 12 then
    raise exception 'too_many_slots' using errcode = 'P0001';
  end if;

  insert into public.songs (title, artist, singer, contact, notes, ref_url)
  values (btrim(p_title), btrim(coalesce(p_artist, '')), btrim(p_singer),
          btrim(coalesce(p_contact, '')), btrim(coalesce(p_notes, '')), btrim(coalesce(p_ref_url, '')))
  returning id into v_id;

  insert into public.song_secrets (song_id, password_hash) values (v_id, v_hash);

  for i in 1 .. cardinality(p_instruments) loop
    insert into public.slots (song_id, instrument, position)
    values (v_id, btrim(p_instruments[i]), i);
  end loop;

  return v_id;
end $$;

create or replace function public.verify_song_password(p_song uuid, p_password text)
returns boolean language sql stable security definer
set search_path = public, extensions as $$
  select public._password_ok((select password_hash from public.song_secrets where song_id = p_song), p_password);
$$;

create or replace function public.update_song(
  p_song uuid, p_password text,
  p_title text, p_artist text, p_singer text, p_contact text, p_notes text, p_ref_url text
) returns void language plpgsql security definer
set search_path = public, extensions as $$
begin
  perform public._require_song(p_song, p_password);
  update public.songs set
    title = btrim(p_title), artist = btrim(coalesce(p_artist, '')), singer = btrim(p_singer),
    contact = btrim(coalesce(p_contact, '')), notes = btrim(coalesce(p_notes, '')),
    ref_url = btrim(coalesce(p_ref_url, '')), updated_at = now()
  where id = p_song;
end $$;

create or replace function public.delete_song(p_song uuid, p_password text)
returns void language plpgsql security definer
set search_path = public, extensions as $$
begin
  perform public._require_song(p_song, p_password);
  delete from public.songs where id = p_song;
end $$;

create or replace function public.add_slot(p_song uuid, p_password text, p_instrument text)
returns uuid language plpgsql security definer
set search_path = public, extensions as $$
declare v_id uuid;
begin
  perform public._require_song(p_song, p_password);
  if (select count(*) from public.slots where song_id = p_song) >= 12 then
    raise exception 'too_many_slots' using errcode = 'P0001';
  end if;
  insert into public.slots (song_id, instrument, position)
  values (p_song, btrim(p_instrument),
          coalesce((select max(position) from public.slots where song_id = p_song), 0) + 1)
  returning id into v_id;
  update public.songs set updated_at = now() where id = p_song;
  return v_id;
end $$;

create or replace function public.remove_slot(p_slot uuid, p_password text)
returns void language plpgsql security definer
set search_path = public, extensions as $$
declare v_song uuid := (select song_id from public.slots where id = p_slot);
begin
  perform public._require_song(v_song, p_password);
  if (select count(*) from public.slots where song_id = v_song) <= 1 then
    raise exception 'no_slots' using errcode = 'P0001';
  end if;
  delete from public.slots where id = p_slot;
  update public.songs set updated_at = now() where id = v_song;
end $$;

-- 主唱直接指定某個位置由誰負責（例如私下已經找到人）
create or replace function public.fill_slot(p_slot uuid, p_password text, p_name text, p_musician uuid)
returns void language plpgsql security definer
set search_path = public, extensions as $$
declare v_song uuid := (select song_id from public.slots where id = p_slot);
begin
  perform public._require_song(v_song, p_password);
  update public.slots set
    filled_by_name = btrim(p_name), filled_by_musician = p_musician, filled_at = now()
  where id = p_slot;
  update public.songs set updated_at = now() where id = v_song;
end $$;

-- 清空某個位置；原本被接受的申請會退回「待確認」
create or replace function public.clear_slot(p_slot uuid, p_password text)
returns void language plpgsql security definer
set search_path = public, extensions as $$
declare v_song uuid := (select song_id from public.slots where id = p_slot);
begin
  perform public._require_song(v_song, p_password);
  update public.slots set filled_by_name = null, filled_by_musician = null, filled_at = null
  where id = p_slot;
  update public.applications set status = 'pending'
  where slot_id = p_slot and status = 'accepted';
  update public.songs set updated_at = now() where id = v_song;
end $$;

-- ───────────────────────── 接任務（申請） ─────────────────────────

create or replace function public.apply_slot(
  p_slot uuid, p_musician uuid, p_name text, p_contact text, p_message text
) returns uuid language plpgsql security definer
set search_path = public, extensions as $$
declare
  v_song uuid := (select song_id from public.slots where id = p_slot);
  v_id uuid;
begin
  if v_song is null then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.slots where id = p_slot and filled_at is not null) then
    raise exception 'slot_filled' using errcode = 'P0001';
  end if;
  if (select count(*) from public.applications where slot_id = p_slot and status = 'pending') >= 20 then
    raise exception 'too_many_applications' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.applications
             where slot_id = p_slot and status = 'pending' and lower(name) = lower(btrim(p_name))) then
    raise exception 'already_applied' using errcode = 'P0001';
  end if;

  insert into public.applications (song_id, slot_id, musician_id, name, contact, message)
  values (v_song, p_slot, p_musician, btrim(p_name), btrim(coalesce(p_contact, '')), btrim(coalesce(p_message, '')))
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.accept_application(p_application uuid, p_password text)
returns void language plpgsql security definer
set search_path = public, extensions as $$
declare a public.applications;
begin
  select * into a from public.applications where id = p_application;
  if a.id is null then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  perform public._require_song(a.song_id, p_password);
  if exists (select 1 from public.slots where id = a.slot_id and filled_at is not null) then
    raise exception 'slot_filled' using errcode = 'P0001';
  end if;
  update public.applications set status = 'accepted' where id = a.id;
  update public.slots set filled_by_name = a.name, filled_by_musician = a.musician_id, filled_at = now()
  where id = a.slot_id;
  update public.songs set updated_at = now() where id = a.song_id;
end $$;

create or replace function public.reject_application(p_application uuid, p_password text)
returns void language plpgsql security definer
set search_path = public, extensions as $$
declare a public.applications;
begin
  select * into a from public.applications where id = p_application;
  if a.id is null then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  perform public._require_song(a.song_id, p_password);
  if a.status = 'accepted' then
    update public.slots set filled_by_name = null, filled_by_musician = null, filled_at = null
    where id = a.slot_id;
  end if;
  update public.applications set status = 'rejected' where id = a.id;
end $$;

-- ───────────────────────── 樂手檔案 ─────────────────────────

create or replace function public.create_musician(
  p_name text, p_instruments text[], p_bio text, p_contact text, p_password text
) returns uuid language plpgsql security definer
set search_path = public, extensions as $$
declare
  v_id uuid;
  v_hash text := public._hash(p_password);
begin
  insert into public.musicians (name, instruments, bio, contact)
  values (btrim(p_name), public._clean_instruments(p_instruments),
          btrim(coalesce(p_bio, '')), btrim(coalesce(p_contact, '')))
  returning id into v_id;
  insert into public.musician_secrets (musician_id, password_hash) values (v_id, v_hash);
  return v_id;
end $$;

create or replace function public.verify_musician_password(p_musician uuid, p_password text)
returns boolean language sql stable security definer
set search_path = public, extensions as $$
  select public._password_ok((select password_hash from public.musician_secrets where musician_id = p_musician), p_password);
$$;

create or replace function public.update_musician(
  p_musician uuid, p_password text, p_name text, p_instruments text[], p_bio text, p_contact text
) returns void language plpgsql security definer
set search_path = public, extensions as $$
begin
  perform public._require_musician(p_musician, p_password);
  update public.musicians set
    name = btrim(p_name), instruments = public._clean_instruments(p_instruments),
    bio = btrim(coalesce(p_bio, '')), contact = btrim(coalesce(p_contact, '')), updated_at = now()
  where id = p_musician;
end $$;

create or replace function public.delete_musician(p_musician uuid, p_password text)
returns void language plpgsql security definer
set search_path = public, extensions as $$
begin
  perform public._require_musician(p_musician, p_password);
  delete from public.musicians where id = p_musician;
end $$;

-- ───────────────────────── 管理員密碼（選用） ─────────────────────────
-- 設定後，這組密碼可以管理所有歌曲與樂手檔案（主唱忘記密碼時很有用）。
-- 取消下一行的註解、換成你自己的密碼後執行：
--
-- insert into public.app_secrets (key, password_hash)
-- values ('admin', extensions.crypt('換成你的管理員密碼', extensions.gen_salt('bf', 8)))
-- on conflict (key) do update set password_hash = excluded.password_hash;
