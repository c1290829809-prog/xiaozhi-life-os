create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.memories (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  title text not null,
  body text not null,
  tag text not null default '新记录',
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.tasks (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  text text not null,
  time_text text not null default '',
  done boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.boxes (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  icon text not null default '✧',
  title text not null,
  item_count integer not null default 0,
  detail text not null default '',
  status text not null default '私密',
  box_type text not null default '灵感',
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.chat_messages (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  message_role text not null check (message_role in ('user', 'assistant')),
  body text not null,
  display_time text not null default '刚刚',
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.profiles enable row level security;
alter table public.memories enable row level security;
alter table public.tasks enable row level security;
alter table public.boxes enable row level security;
alter table public.chat_messages enable row level security;

drop policy if exists "profiles own row" on public.profiles;
create policy "profiles own row" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
drop policy if exists "memories own rows" on public.memories;
create policy "memories own rows" on public.memories for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "tasks own rows" on public.tasks;
create policy "tasks own rows" on public.tasks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "boxes own rows" on public.boxes;
create policy "boxes own rows" on public.boxes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "chat messages own rows" on public.chat_messages;
create policy "chat messages own rows" on public.chat_messages for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();
