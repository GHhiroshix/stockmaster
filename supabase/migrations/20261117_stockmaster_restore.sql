-- ============================================================================
-- StockMaster 復旧 SQL のマイグレーション記録
-- 作成日: 2026-11-18
-- 対象: GitHub GHhiroshix/stockmaster
-- 由来: 2026-11-17 に Supabase SQL Editor で実行した Block 1〜6 の記録。
-- これは実DBからのダンプではなく実行記録の転記だが、2026-11-18 に
-- 読み取り専用クエリで実DBと照合済み:
-- (1) pg_tables の rowsecurity: 6テーブルすべて true（一致）
-- (2) pg_policies: 新規5テーブルの18件は一致。profiles は下書きの2件に
--     加えて既存の3件（insert_profile / select_own_profile /
--     update_own_profile）が存在したため、実DBどおり5件すべてを記録した
-- (3) pg_indexes（products）: products_pkey / products_company_id_idx /
--     products_company_jan_uniq（一致）
-- このファイルは既に適用済みの内容の記録である。
-- 実DBに対して再実行しないこと（CREATE TABLE 等は重複エラーになる）。
-- profiles テーブル自体は作らない。weSt と共有の既存テーブルで、
-- 2026-11-17 の事前確認で8列が確定済みのため、このファイルは
-- profiles が既に存在することを前提とする。
-- 会社行（Block 3-(1)）はユーザー固有のデータのため含めない。
-- FK（Block 3-(2)）だけを下部に含めた。
-- ============================================================================

-- ---- Block 1: RLS ヘルパー関数（再帰回避・security definer）----
create or replace function public.current_company_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$ select company_id from public.profiles where id = auth.uid() $$;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select coalesce((select p.is_platform_admin from public.profiles p where p.id = auth.uid()), false) $$;

revoke execute on function public.current_company_id() from public, anon;
revoke execute on function public.is_platform_admin() from public, anon;
grant execute on function public.current_company_id() to authenticated;
grant execute on function public.is_platform_admin() to authenticated;

-- ---- Block 2: 5テーブルの再作成 ----
create table public.companies (
id uuid not null default gen_random_uuid() primary key,
name text not null,
created_by uuid default auth.uid(),
created_at timestamptz not null default now()
);

create table public.products (
id bigint generated always as identity primary key,
company_id uuid not null references public.companies(id) on delete cascade,
jan text not null,
name text not null,
price integer not null default 0,
cost integer not null default 0,
qty integer not null default 0,
reorder_point integer not null default 5,
cat_l1 text not null default '',
cat_l2 text not null default '',
cat_l3 text not null default '',
maker text not null default '',
supplier text not null default '',
location text not null default '',
added_at date not null default current_date,
image_url text not null default '',
created_at timestamptz not null default now()
);
create index products_company_id_idx on public.products (company_id);

create table public.incoming (
id bigint generated always as identity primary key,
company_id uuid not null references public.companies(id) on delete cascade,
date date not null,
jan text not null default '',
name text not null,
qty integer not null default 0,
cost integer not null default 0,
total_cost integer not null default 0,
maker text not null default '',
supplier text not null default '',
note text not null default '',
created_at timestamptz not null default now()
);
create index incoming_company_date_idx on public.incoming (company_id, date desc);

create table public.outgoing (
id bigint generated always as identity primary key,
company_id uuid not null references public.companies(id) on delete cascade,
date date not null,
jan text not null default '',
name text not null,
qty integer not null default 0,
price integer not null default 0,
total_price integer not null default 0,
destination text not null default '',
note text not null default '',
created_at timestamptz not null default now()
);
create index outgoing_company_date_idx on public.outgoing (company_id, date desc);

create table public.categories (
id text primary key,
company_id uuid not null references public.companies(id) on delete cascade,
data jsonb not null default '[]'::jsonb,
created_at timestamptz not null default now(),
updated_at timestamptz not null default now()
);
create index categories_company_id_idx on public.categories (company_id);

-- 同じ会社の中で同じJANは1つだけ（2026-11-17 に作成済みを確認）
create unique index products_company_jan_uniq on public.products (company_id, jan);

-- ---- Block 3-(2): profiles.company_id への FK（会社行は含めない）----
-- 実行済み（2026-11-17）。既に存在する場合は何もしない。
do $$
begin
if not exists (select 1 from pg_constraint where conname = 'profiles_company_id_fk') then
alter table public.profiles
add constraint profiles_company_id_fk
foreign key (company_id) references public.companies(id) on delete cascade;
end if;
end $$;

-- ---- Block 4: GRANT ----
grant select, insert, update, delete on public.companies, public.categories, public.products, public.incoming, public.outgoing to authenticated;
grant all on public.companies, public.categories, public.products, public.incoming, public.outgoing to service_role;
grant select, insert, update, delete on public.profiles to authenticated;

-- ---- Block 5: 新規5テーブルへの RLS とポリシー ----
alter table public.companies enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.incoming enable row level security;
alter table public.outgoing enable row level security;

create policy companies_select on public.companies
for select to authenticated
using (id = public.current_company_id() or created_by = auth.uid() or public.is_platform_admin());
create policy companies_insert on public.companies
for insert to authenticated
with check (created_by = auth.uid());

create policy products_select on public.products
for select to authenticated using (company_id = public.current_company_id());
create policy products_insert on public.products
for insert to authenticated with check (company_id = public.current_company_id());
create policy products_update on public.products
for update to authenticated using (company_id = public.current_company_id()) with check (company_id = public.current_company_id());
create policy products_delete on public.products
for delete to authenticated using (company_id = public.current_company_id());

create policy incoming_select on public.incoming
for select to authenticated using (company_id = public.current_company_id());
create policy incoming_insert on public.incoming
for insert to authenticated with check (company_id = public.current_company_id());
create policy incoming_update on public.incoming
for update to authenticated using (company_id = public.current_company_id()) with check (company_id = public.current_company_id());
create policy incoming_delete on public.incoming
for delete to authenticated using (company_id = public.current_company_id());

create policy outgoing_select on public.outgoing
for select to authenticated using (company_id = public.current_company_id());
create policy outgoing_insert on public.outgoing
for insert to authenticated with check (company_id = public.current_company_id());
create policy outgoing_update on public.outgoing
for update to authenticated using (company_id = public.current_company_id()) with check (company_id = public.current_company_id());
create policy outgoing_delete on public.outgoing
for delete to authenticated using (company_id = public.current_company_id());

create policy categories_select on public.categories
for select to authenticated using (company_id = public.current_company_id());
create policy categories_insert on public.categories
for insert to authenticated with check (company_id = public.current_company_id());
create policy categories_update on public.categories
for update to authenticated using (company_id = public.current_company_id()) with check (company_id = public.current_company_id());
create policy categories_delete on public.categories
for delete to authenticated using (company_id = public.current_company_id());

-- ---- Block 6: profiles への RLS とポリシー ----
-- force row level security は付けない（weSt の purge_tenant_data の前提を壊さないため）
alter table public.profiles enable row level security;

create policy profiles_select on public.profiles
for select to authenticated
using (id = auth.uid() or company_id = public.current_company_id() or public.is_platform_admin());

create policy profiles_insert on public.profiles
for insert to authenticated
with check (id = auth.uid() and coalesce(is_platform_admin, false) = false);

-- ---- profiles の既存ポリシー（weSt 側で作成済み・復旧前から存在）----
-- 2026-11-18 の照合で存在を確認。RLS が無効だった間は効いておらず、
-- Block 6 で RLS を有効化したことで併せて有効になった。
-- ここには実DBの現状をそのまま記録する。内容の是非は別途検討する。
--
-- select_own_profile: 自分の行と自社の行のみ。範囲は profiles_select と
-- ほぼ同じで問題なし。weSt 側のヘルパー関数 get_my_company_id() に依存する
-- （このファイルでは定義しない）。
create policy select_own_profile on public.profiles
for select to authenticated
using (company_id = public.get_my_company_id() or id = auth.uid());
--
-- update_own_profile: 自分の行は更新できるが、変更できる列に制限がない。
-- 自分の行の is_platform_admin や company_id を本人が書き換えられる
-- 権限昇格の穴がある（2026-11-18 時点で未対応・要注意）。
create policy update_own_profile on public.profiles
for update to authenticated
using (id = auth.uid());
--
-- insert_profile: with check が true のため、ログイン済みなら誰でも
-- どんな profiles 行でも作成できる。上の profiles_insert の制限は
-- このポリシーがある限り実質無効（2026-11-18 時点で未対応・要注意）。
-- weSt のサインアップがこのポリシーに依存している可能性があるため、
-- 締める前に weSt 側の利用方法の確認が必要。
create policy insert_profile on public.profiles
for insert to authenticated
with check (true);

-- ---- 仕上げ: 2026-11-13 の緊急対応で付けた anon の profiles 権限を剥奪 ----
-- Block 6 の後に実行済み（2026-11-17）。
revoke all on public.profiles from anon;
