-- Run once in Supabase Dashboard > SQL Editor for private memory photo sync.
-- This migration does not change existing memory records.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'memory-images',
  'memory-images',
  false,
  12582912,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.memory_media (
  user_id uuid not null references auth.users(id) on delete cascade,
  memory_id text not null,
  image_path text not null,
  background_removed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, memory_id),
  constraint memory_media_memory_owner_fk
    foreign key (user_id, memory_id)
    references public.memories(user_id, id)
    on delete cascade
);

alter table public.memory_media enable row level security;
drop policy if exists "memory media own rows" on public.memory_media;
create policy "memory media own rows"
on public.memory_media for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "memory images owner read" on storage.objects;
create policy "memory images owner read"
on storage.objects for select
to authenticated
using (bucket_id = 'memory-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "memory images owner insert" on storage.objects;
create policy "memory images owner insert"
on storage.objects for insert
to authenticated
with check (bucket_id = 'memory-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "memory images owner update" on storage.objects;
create policy "memory images owner update"
on storage.objects for update
to authenticated
using (bucket_id = 'memory-images' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'memory-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "memory images owner delete" on storage.objects;
create policy "memory images owner delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'memory-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
