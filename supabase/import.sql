-- 搬家步驟 2：在「新」專案先執行 schema.sql，再執行這份
-- 把下面「貼在這裡」那一行整行換成步驟 1 複製的內容（前後的 $dump$ 要保留）
do $import$
declare d json := $dump$
貼在這裡
$dump$;
begin
  insert into public.musicians        select * from json_populate_recordset(null::public.musicians,        d->'musicians');
  insert into public.songs            select * from json_populate_recordset(null::public.songs,            d->'songs');
  insert into public.slots            select * from json_populate_recordset(null::public.slots,            d->'slots');
  insert into public.applications     select * from json_populate_recordset(null::public.applications,     d->'applications');
  insert into public.song_secrets     select * from json_populate_recordset(null::public.song_secrets,     d->'song_secrets');
  insert into public.musician_secrets select * from json_populate_recordset(null::public.musician_secrets, d->'musician_secrets');
  insert into public.app_secrets      select * from json_populate_recordset(null::public.app_secrets,      d->'app_secrets')
    on conflict (key) do update set password_hash = excluded.password_hash;
end $import$;
