-- ============================================================================
-- StockMaster Phase 2: 監査ログ（sm_audit_logs）＋会社管理者ヘルパー
-- 作成日: 2026-11-23
-- 対象: GitHub GHhiroshix/stockmaster（Supabase プロジェクトは weSt と共有）
-- テーブル名が sm_ 始まりなのは、共有DBに weSt 側の audit_logs
-- （SQL 0140、tenant_id キー）が既に存在するため。最初の適用試行で
-- 「column company_id does not exist」になったのはこの名前衝突が原因
-- （create table if not exists が weSt の表を拾い、company_id の無い
-- 表にインデックスを作ろうとした）。weSt の audit_logs には一切触らない。
--
-- （ユーザーが Supabase SQL Editor で手動適用する前提）
-- 1. このファイルの内容をすべて SQL Editor に貼り付けて実行する。
-- 冪等（create or replace / create table if not exists /
-- ポリシーは drop policy if exists してから create）なので、
-- 途中失敗後の再実行も可。
-- 2. この DB 適用が終わってから、対応する src/App.jsx の変更を
-- GitHub に push すること（設計メモ
-- StockMaster-phase2-audit-log.md の作業順序どおり）。
--
-- 適用後チェック:
-- select tablename, rowsecurity from pg_tables
-- where schemaname = 'public' and tablename = 'sm_audit_logs';
-- → 1行、rowsecurity = true
-- select policyname, cmd from pg_policies
-- where schemaname = 'public' and tablename = 'sm_audit_logs'
-- order by policyname;
-- → sm_audit_logs_insert（INSERT）/ sm_audit_logs_select（SELECT）の2件
-- select proname from pg_proc
-- where pronamespace = 'public'::regnamespace
-- and proname = 'is_company_admin';
-- → 1件
--
-- 方針:
-- - ログは追記専用。UPDATE / DELETE ポリシーを作らないため、RLS が
-- 有効な状態では API 経由の書き換え・削除はできない（ポリシー無し＝拒否）。
-- - INSERT は「自社のログを、本人の名義で」だけ許可する
-- （company_id = current_company_id() かつ user_id = auth.uid()）。
-- - SELECT は自社の管理者だけ（is_company_admin()）。
-- - is_company_admin() は is_platform_admin() と同じ形（security definer、
-- set search_path = ''）で、profiles 参照の再帰を回避する。
-- - user_id には FK を付けない。スタッフが削除されても、その人の操作記録は
-- 監査ログとして残り続けるべきため（user_name / user_email はスナップ
-- ショットとして列に保持する）。
-- ============================================================================

-- ---- 1. 会社管理者ヘルパー ----
create or replace function public.is_company_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select coalesce((select p.role = 'admin' from public.profiles p where p.id = auth.uid()), false) $$;

revoke execute on function public.is_company_admin() from public, anon;
grant execute on function public.is_company_admin() to authenticated;

-- ---- 2. 監査ログテーブル ----
create table if not exists public.sm_audit_logs (
id uuid not null default gen_random_uuid() primary key,
company_id uuid not null references public.companies(id) on delete cascade,
user_id uuid not null,
user_name text,
user_email text,
action text not null,
target_name text,
target_jan text,
qty integer,
detail jsonb,
created_at timestamptz not null default now()
);
create index if not exists sm_audit_logs_company_created_idx on public.sm_audit_logs (company_id, created_at desc);

-- ---- 3. GRANT ----
grant select, insert on public.sm_audit_logs to authenticated;
grant all on public.sm_audit_logs to service_role;

-- ---- 4. RLS とポリシー（UPDATE / DELETE ポリシーは作らない＝追記専用）----
alter table public.sm_audit_logs enable row level security;

drop policy if exists sm_audit_logs_insert on public.sm_audit_logs;
create policy sm_audit_logs_insert on public.sm_audit_logs
for insert to authenticated
with check (company_id = public.current_company_id() and user_id = auth.uid());

drop policy if exists sm_audit_logs_select on public.sm_audit_logs;
create policy sm_audit_logs_select on public.sm_audit_logs
for select to authenticated
using (company_id = public.current_company_id() and public.is_company_admin());
