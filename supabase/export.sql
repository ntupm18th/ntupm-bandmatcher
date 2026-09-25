-- 搬家步驟 1：在「舊」Supabase 專案的 SQL Editor 執行，複製結果那一格（dump）的全部內容
select json_build_object(
  'musicians',        (select coalesce(json_agg(t), '[]') from public.musicians t),
  'songs',            (select coalesce(json_agg(t), '[]') from public.songs t),
  'slots',            (select coalesce(json_agg(t), '[]') from public.slots t),
  'applications',     (select coalesce(json_agg(t), '[]') from public.applications t),
  'song_secrets',     (select coalesce(json_agg(t), '[]') from public.song_secrets t),
  'musician_secrets', (select coalesce(json_agg(t), '[]') from public.musician_secrets t),
  'app_secrets',      (select coalesce(json_agg(t), '[]') from public.app_secrets t)
)::text as dump;
