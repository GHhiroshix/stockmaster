-- ============================================================================
-- profiles の既存ポリシー2件を削除（権限昇格の穴を塞ぐ）
-- 実行日: 2026-11-18（Supabase SQL Editor で実行済み）
-- 前提: 20261117_stockmaster_restore.sql の状態（profiles に5ポリシー）
--
-- 背景: 2026-11-18 の照合で、profiles には復旧で作った2件
-- （profiles_select / profiles_insert）のほかに、weSt 時代の既存
-- ポリシー3件があることが分かった。うち2件が権限昇格の穴:
-- - insert_profile: WITH CHECK が true。ログイン済みなら誰でも、
--   他人の id・他社の company_id・is_platform_admin = true の行でも
--   作成でき、厳しい側の profiles_insert が実質無効になっていた。
-- - update_own_profile: 自分の行を更新できるが変更できる列に制限が
--   なく、自分の is_platform_admin / company_id を書き換えられた。
-- select_own_profile は自分の行＋自社の行のみで無害なため残す。
--
-- 削除して壊れる導線がないことは、2026-11-18 に両アプリのコードで
-- 確認済み: weSt は profiles をユーザー管理に使っておらず（専用の
-- tenant_users を使用）、StockMaster の profiles 更新は全て
-- service role の API 経由、登録時の insert は profiles_insert の
-- 条件（id = auth.uid() かつ is_platform_admin 自己申告不可）を満たす。
--
-- 実行後の状態: pg_policies の profiles 分は3件
-- （profiles_insert / profiles_select / select_own_profile）。
-- StockMaster・weSt 両方の再ログイン確認済み（2026-11-18）。
-- ============================================================================

drop policy insert_profile on public.profiles;
drop policy update_own_profile on public.profiles;

-- ロールバック（元に戻す場合）:
-- create policy insert_profile on public.profiles
-- for insert to authenticated with check (true);
-- create policy update_own_profile on public.profiles
-- for update to authenticated using (id = auth.uid());
