-- Lost & Found Matcher backend for Supabase.
-- Public browser access is controlled by explicit grants and RLS below.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated, supabase_auth_admin;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  role text not null default 'user' check (role in ('user', 'staff')),
  full_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.lost_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category text not null check (category in (
    'โทรศัพท์', 'กระเป๋า', 'กุญแจ', 'เอกสาร', 'เครื่องประดับ',
    'อุปกรณ์อิเล็กทรอนิกส์', 'เสื้อผ้า', 'อื่นๆ'
  )),
  location text not null check (location in (
    'อาคาร A ชั้น 1', 'อาคาร A ชั้น 2', 'อาคาร A ชั้น 3',
    'อาคาร B ชั้น 1', 'อาคาร B ชั้น 2', 'อาคาร B ชั้น 3',
    'อาคาร C ชั้น 1', 'อาคาร C ชั้น 2', 'อาคาร C ชั้น 3',
    'โรงอาหาร', 'ห้องสมุด', 'ลานจอดรถ', 'สนามกีฬา', 'อื่นๆ'
  )),
  color text not null check (color in (
    'ดำ', 'ขาว', 'แดง', 'น้ำเงิน', 'เขียว', 'เหลือง', 'ชมพู',
    'ม่วง', 'ส้ม', 'น้ำตาล', 'เทา', 'หลายสี'
  )),
  date_from timestamptz not null,
  date_to timestamptz not null,
  image_url text,
  description text check (description is null or char_length(description) <= 2000),
  status text not null default 'open' check (status in ('open', 'matched', 'closed')),
  created_at timestamptz not null default now(),
  constraint lost_items_valid_date_range check (date_from <= date_to)
);

create table if not exists public.found_items (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references auth.users (id) on delete restrict,
  category text not null check (category in (
    'โทรศัพท์', 'กระเป๋า', 'กุญแจ', 'เอกสาร', 'เครื่องประดับ',
    'อุปกรณ์อิเล็กทรอนิกส์', 'เสื้อผ้า', 'อื่นๆ'
  )),
  location text not null check (location in (
    'อาคาร A ชั้น 1', 'อาคาร A ชั้น 2', 'อาคาร A ชั้น 3',
    'อาคาร B ชั้น 1', 'อาคาร B ชั้น 2', 'อาคาร B ชั้น 3',
    'อาคาร C ชั้น 1', 'อาคาร C ชั้น 2', 'อาคาร C ชั้น 3',
    'โรงอาหาร', 'ห้องสมุด', 'ลานจอดรถ', 'สนามกีฬา', 'อื่นๆ'
  )),
  color text not null check (color in (
    'ดำ', 'ขาว', 'แดง', 'น้ำเงิน', 'เขียว', 'เหลือง', 'ชมพู',
    'ม่วง', 'ส้ม', 'น้ำตาล', 'เทา', 'หลายสี'
  )),
  found_date timestamptz not null,
  image_url text not null,
  description text check (description is null or char_length(description) <= 2000),
  status text not null default 'available' check (status in ('available', 'matched', 'claimed')),
  created_at timestamptz not null default now()
);

create table if not exists public.claim_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users (id) on delete cascade,
  lost_item_id uuid not null references public.lost_items (id) on delete cascade,
  found_item_id uuid not null references public.found_items (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lost_items_user_created_idx on public.lost_items (user_id, created_at desc);
create index if not exists lost_items_category_status_idx on public.lost_items (category, status);
create index if not exists found_items_category_status_date_idx on public.found_items (category, status, found_date desc);
create index if not exists claim_requests_requester_created_idx on public.claim_requests (requester_id, created_at desc);
create index if not exists claim_requests_status_created_idx on public.claim_requests (status, created_at desc);
create unique index if not exists claim_requests_pending_pair_idx
  on public.claim_requests (requester_id, lost_item_id, found_item_id)
  where status = 'pending';

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    'user'
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(public.profiles.full_name, excluded.full_name);
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;
grant execute on function private.handle_new_user() to supabase_auth_admin;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure private.handle_new_user();

-- This narrowly scoped definer helper returns only the caller's staff flag.
create or replace function private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles as profile
    where profile.id = (select auth.uid())
      and profile.role = 'staff'
  );
$$;

revoke all on function private.is_staff() from public, anon;
grant execute on function private.is_staff() to authenticated;

-- Score is deterministic and never reads or processes image data.
create or replace function private.score_match(
  p_lost_color text,
  p_found_color text,
  p_lost_location text,
  p_found_location text,
  p_date_from timestamptz,
  p_date_to timestamptz,
  p_found_date timestamptz
)
returns integer
language sql
immutable
security invoker
set search_path = ''
as $$
  select
    35
    + case
        when p_lost_color = p_found_color then 25
        when p_lost_color = 'หลายสี' or p_found_color = 'หลายสี' then 15
        else 0
      end
    + case
        when p_lost_location = p_found_location then 25
        when substring(p_lost_location from '^(อาคาร\s+\S+)') is not null
          and substring(p_lost_location from '^(อาคาร\s+\S+)')
            = substring(p_found_location from '^(อาคาร\s+\S+)') then 15
        else 0
      end
    + case
        when p_found_date between p_date_from and p_date_to then 15
        when (case when p_found_date < p_date_from
                   then p_date_from - p_found_date
                   else p_found_date - p_date_to end) <= interval '1 day' then 12
        when (case when p_found_date < p_date_from
                   then p_date_from - p_found_date
                   else p_found_date - p_date_to end) <= interval '3 days' then 8
        when (case when p_found_date < p_date_from
                   then p_date_from - p_found_date
                   else p_found_date - p_date_to end) <= interval '7 days' then 4
        else 0
      end;
$$;

revoke all on function private.score_match(text, text, text, text, timestamptz, timestamptz, timestamptz)
  from public, anon;
grant execute on function private.score_match(text, text, text, text, timestamptz, timestamptz, timestamptz)
  to authenticated;

alter table public.profiles enable row level security;
alter table public.lost_items enable row level security;
alter table public.found_items enable row level security;
alter table public.claim_requests enable row level security;

drop policy if exists profiles_select_self_or_staff on public.profiles;
create policy profiles_select_self_or_staff
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.is_staff()));

drop policy if exists lost_items_select_owner_or_staff on public.lost_items;
create policy lost_items_select_owner_or_staff
  on public.lost_items for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_staff()));

drop policy if exists lost_items_insert_self on public.lost_items;
create policy lost_items_insert_self
  on public.lost_items for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'open');

drop policy if exists lost_items_update_owner_or_staff on public.lost_items;
create policy lost_items_update_owner_or_staff
  on public.lost_items for update to authenticated
  using (user_id = (select auth.uid()) or (select private.is_staff()))
  with check (
    (select private.is_staff())
    or (user_id = (select auth.uid()) and status in ('open', 'closed'))
  );

drop policy if exists found_items_select_authenticated on public.found_items;
create policy found_items_select_authenticated
  on public.found_items for select to authenticated
  using (true);

drop policy if exists found_items_insert_staff on public.found_items;
create policy found_items_insert_staff
  on public.found_items for insert to authenticated
  with check (staff_id = (select auth.uid()) and (select private.is_staff()));

drop policy if exists found_items_update_staff on public.found_items;
create policy found_items_update_staff
  on public.found_items for update to authenticated
  using ((select private.is_staff()))
  with check ((select private.is_staff()));

drop policy if exists claim_requests_select_requester_or_staff on public.claim_requests;
create policy claim_requests_select_requester_or_staff
  on public.claim_requests for select to authenticated
  using (requester_id = (select auth.uid()) or (select private.is_staff()));

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.set_updated_at() from public, anon, authenticated;
drop trigger if exists claim_requests_set_updated_at on public.claim_requests;
create trigger claim_requests_set_updated_at
  before update on public.claim_requests
  for each row execute procedure private.set_updated_at();

create or replace function public.find_matches(p_lost_item_id uuid)
returns table (
  found_item_id uuid,
  category text,
  location text,
  color text,
  found_date timestamptz,
  image_url text,
  description text,
  score integer,
  percentage integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    found.id,
    found.category,
    found.location,
    found.color,
    found.found_date,
    found.image_url,
    found.description,
    private.score_match(
      lost.color, found.color, lost.location, found.location,
      lost.date_from, lost.date_to, found.found_date
    ) as score,
    private.score_match(
      lost.color, found.color, lost.location, found.location,
      lost.date_from, lost.date_to, found.found_date
    ) as percentage
  from public.lost_items as lost
  join public.found_items as found on found.category = lost.category
  where lost.id = p_lost_item_id
    and lost.status = 'open'
    and found.status = 'available'
    and private.score_match(
      lost.color, found.color, lost.location, found.location,
      lost.date_from, lost.date_to, found.found_date
    ) >= 50
  order by score desc, found.created_at desc;
$$;

create or replace function public.request_match_claim(
  p_lost_item_id uuid,
  p_found_item_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_requester_id uuid := (select auth.uid());
  v_score integer;
  v_request_id uuid;
begin
  if v_requester_id is null then
    raise exception using errcode = '42501', message = 'Sign in is required.';
  end if;

  select private.score_match(
    lost.color, found.color, lost.location, found.location,
    lost.date_from, lost.date_to, found.found_date
  )
  into v_score
  from public.lost_items as lost
  join public.found_items as found on found.id = p_found_item_id
  where lost.id = p_lost_item_id
    and lost.user_id = v_requester_id
    and lost.status = 'open'
    and found.status = 'available'
    and found.category = lost.category
  for update of lost, found;

  if v_score is null or v_score < 50 then
    raise exception using errcode = '42501', message = 'This item is not an eligible match.';
  end if;

  insert into public.claim_requests (requester_id, lost_item_id, found_item_id)
  values (v_requester_id, p_lost_item_id, p_found_item_id)
  on conflict (requester_id, lost_item_id, found_item_id) where status = 'pending'
  do update set updated_at = now()
  returning id into v_request_id;

  return v_request_id;
end;
$$;

-- Resolve a claim and update both item states in one transaction.
create or replace function public.review_claim_request(
  p_claim_request_id uuid,
  p_approve boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claim public.claim_requests%rowtype;
  v_locked_id uuid;
begin
  if not (select private.is_staff()) then
    raise exception using errcode = '42501', message = 'Staff access is required.';
  end if;

  select * into v_claim
  from public.claim_requests
  where id = p_claim_request_id
  for update;

  if not found or v_claim.status <> 'pending' then
    raise exception using errcode = '22023', message = 'Claim request is not pending.';
  end if;

  if p_approve then
    select id into v_locked_id
    from public.lost_items
    where id = v_claim.lost_item_id and status = 'open'
    for update;
    if not found then
      raise exception using errcode = '22023', message = 'Lost report is no longer open.';
    end if;

    select id into v_locked_id
    from public.found_items
    where id = v_claim.found_item_id and status = 'available'
    for update;
    if not found then
      raise exception using errcode = '22023', message = 'Found item is no longer available.';
    end if;

    update public.claim_requests
    set status = 'approved'
    where id = v_claim.id;
    update public.found_items
    set status = 'claimed'
    where id = v_claim.found_item_id;
    update public.lost_items
    set status = 'matched'
    where id = v_claim.lost_item_id;
    update public.claim_requests
    set status = 'rejected'
    where status = 'pending'
      and id <> v_claim.id
      and (found_item_id = v_claim.found_item_id or lost_item_id = v_claim.lost_item_id);
  else
    update public.claim_requests
    set status = 'rejected'
    where id = v_claim.id;
  end if;

  return v_claim.id;
end;
$$;

revoke all on function public.find_matches(uuid) from public, anon;
grant execute on function public.find_matches(uuid) to authenticated;
revoke all on function public.request_match_claim(uuid, uuid) from public, anon;
grant execute on function public.request_match_claim(uuid, uuid) to authenticated;
revoke all on function public.review_claim_request(uuid, boolean) from public, anon;
grant execute on function public.review_claim_request(uuid, boolean) to authenticated;

create or replace function public.get_dashboard_summary()
returns table (
  total_lost bigint,
  total_found bigint,
  matched bigint,
  pending bigint
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if not (select private.is_staff()) then
    raise exception using errcode = '42501', message = 'Staff access is required.';
  end if;

  return query
  select
    (select count(*) from public.lost_items),
    (select count(*) from public.found_items),
    (select count(*) from public.lost_items where status = 'matched'),
    (select count(*) from public.lost_items where status = 'open')
      + (select count(*) from public.found_items where status = 'available');
end;
$$;

create or replace function public.get_weekly_stats(p_weeks integer default 8)
returns table (
  week_start date,
  lost_count bigint,
  found_count bigint
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if not (select private.is_staff()) then
    raise exception using errcode = '42501', message = 'Staff access is required.';
  end if;
  if p_weeks is null or p_weeks < 1 or p_weeks > 52 then
    raise exception using errcode = '22023', message = 'Weeks must be between 1 and 52.';
  end if;

  return query
  with weeks as (
    select generate_series(
      date_trunc('week', now()) - make_interval(weeks => p_weeks - 1),
      date_trunc('week', now()),
      interval '1 week'
    )::date as start_date
  ), lost as (
    select date_trunc('week', created_at)::date as start_date, count(*) as item_count
    from public.lost_items
    where created_at >= date_trunc('week', now()) - make_interval(weeks => p_weeks - 1)
    group by 1
  ), found as (
    select date_trunc('week', created_at)::date as start_date, count(*) as item_count
    from public.found_items
    where created_at >= date_trunc('week', now()) - make_interval(weeks => p_weeks - 1)
    group by 1
  )
  select
    weeks.start_date,
    coalesce(lost.item_count, 0),
    coalesce(found.item_count, 0)
  from weeks
  left join lost using (start_date)
  left join found using (start_date)
  order by weeks.start_date;
end;
$$;

revoke all on function public.get_dashboard_summary() from public, anon;
grant execute on function public.get_dashboard_summary() to authenticated;
revoke all on function public.get_weekly_stats(integer) from public, anon;
grant execute on function public.get_weekly_stats(integer) to authenticated;

-- Grant API roles only the table operations that RLS policies support.
grant usage on schema public to authenticated;
revoke all on public.profiles, public.lost_items, public.found_items, public.claim_requests
  from anon, authenticated;
grant select on public.profiles to authenticated;
grant select, insert, update on public.lost_items to authenticated;
grant select, insert, update on public.found_items to authenticated;
grant select on public.claim_requests to authenticated;

-- The app skill specifies a public bucket so found-item images can be displayed.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('item-images', 'item-images', true, 5242880, array['image/jpeg', 'image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists item_images_insert_owned_lost_or_staff_found on storage.objects;
create policy item_images_insert_owned_lost_or_staff_found
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'item-images'
    and (
      (
        (storage.foldername(name))[1] = 'lost'
        and exists (
          select 1 from public.lost_items as lost
          where lost.id::text = (storage.foldername(name))[2]
            and lost.user_id = (select auth.uid())
        )
      )
      or (
        (storage.foldername(name))[1] = 'found'
        and (select private.is_staff())
      )
    )
  );

drop policy if exists item_images_delete_owned_lost_or_staff_found on storage.objects;
create policy item_images_delete_owned_lost_or_staff_found
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'item-images'
    and (
      (
        (storage.foldername(name))[1] = 'lost'
        and exists (
          select 1 from public.lost_items as lost
          where lost.id::text = (storage.foldername(name))[2]
            and lost.user_id = (select auth.uid())
        )
      )
      or (
        (storage.foldername(name))[1] = 'found'
        and (select private.is_staff())
      )
    )
  );

