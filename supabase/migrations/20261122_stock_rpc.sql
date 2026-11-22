-- ============================================================================
-- StockMaster Phase 1: 在庫増減のサーバー側（RPC）化
-- 作成日: 2026-11-22
-- 対象: GitHub GHhiroshix/stockmaster（Supabase プロジェクトは weSt と共有）
--
-- （ユーザーが Supabase SQL Editor で手動適用する前提）
-- 1. このファイルの内容をすべて SQL Editor に貼り付けて実行する。
-- 冪等（create or replace / do ブロック）なので、途中失敗後の再実行も可。
-- 2. 適用後に下記「適用後チェック」を実行し、関数6件と制約1件を確認する。
-- 3. この DB 適用が終わってから、対応する src/App.jsx の変更を
-- GitHub に push すること（順序が逆だと旧コード/新コードと関数の
-- 組み合わせが壊れる。理由は設計メモ参照）。
--
-- CHECK 制約の追加は既存行を検証するため、products に
-- qty < 0 の行が1件でもあると制約追加が失敗する。事前に次のクエリで
-- 0件であることを確認すること（通常は画面側クランプにより存在しない）:
-- select id, jan, qty from public.products where qty < 0;
--
--
-- select proname from pg_proc
-- where pronamespace = 'public'::regnamespace
-- and proname like 'sm\_%' order by proname;
-- → sm_delete_incoming / sm_delete_outgoing / sm_issue_stock /
-- sm_receive_stock / sm_receive_stock_by_jan / sm_set_qty の6件
-- select conname from pg_constraint
-- where conname = 'products_qty_nonnegative';
-- → 1件
--
--
-- - 数量の増減は必ず相対更新（qty = qty ± n）にし、履歴の insert/delete と
-- 1関数＝1トランザクションにまとめる（画面側の読み→計算→書き戻し廃止）。
-- - 出庫は条件付き更新（qty >= n のときだけ成功）。0行更新なら在庫不足
-- 例外（errcode 'SM001'）を投げて全体をロールバックする。
-- - 履歴削除に伴う入庫ロールバックだけは現行仕様どおり 0 でクランプする
-- （greatest(qty - n, 0)）。削除自体を失敗させないため。非対称の理由は
-- 設計メモ StockMaster-phase1-stock-rpc.md 参照。
-- - 会社スコープは public.current_company_id() で関数内に明示する。
-- - 関数は security invoker（呼び出し元の権限で実行）。テーブル側の RLS
-- ポリシーが二重の防衛として効くようにするため。既存ヘルパー
-- （current_company_id 等）は profiles の再帰回避のため definer だが、
-- 本関数群は業務テーブルへの通常アクセスなので invoker が適切。
-- - set search_path = '' とし、全オブジェクトを public. で修飾する
-- （既存ヘルパーの慣習に合わせる）。
--
--
-- SM001: 在庫不足（出庫数が現在庫を超えた）
-- SM003: 数量パラメータ不正（0以下、または絶対値設定で負数）
-- SM004: 会社に所属していない（current_company_id() が null）
-- P0002: 対象が自社に存在しない（no_data_found）
-- ============================================================================

-- ---- 1. products.qty への CHECK 制約（負の在庫を DB でも禁止） ----
do $$
begin
if not exists (
select 1 from pg_constraint
where conname = 'products_qty_nonnegative'
and conrelid = 'public.products'::regclass
) then
alter table public.products
add constraint products_qty_nonnegative check (qty >= 0);
end if;
end $$;

-- ---- 2. 入庫（スキャン入庫・既存商品） ----
-- 在庫を相対増し、付随属性（cost / カテゴリ / maker / supplier）が
-- p_attrs にあれば同じ更新で最終値をセットする。
-- p_incoming が null でなければ入庫履歴も同じトランザクションで記録する
-- （現行仕様: 仕入れ単価が 0 のときは履歴を記録しないため任意引数）。
-- 戻り値: {"new_qty": int, "incoming": jsonb|null}
create or replace function public.sm_receive_stock(
  p_product_id bigint,
  p_qty integer,
  p_attrs jsonb default null,
  p_incoming jsonb default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_company uuid := public.current_company_id();
  v_new_qty integer;
  v_inc public.incoming%rowtype;
  v_inc_json jsonb := null;
begin
  if v_company is null then
    raise exception 'user is not associated with a company' using errcode = 'SM004';
  end if;
  if p_qty is null or p_qty <= 0 then
    raise exception 'quantity must be positive' using errcode = 'SM003';
  end if;

  update public.products p
     set qty = p.qty + p_qty,
         cost = coalesce((p_attrs->>'cost')::integer, p.cost),
         cat_l1 = coalesce(p_attrs->>'cat_l1', p.cat_l1),
         cat_l2 = coalesce(p_attrs->>'cat_l2', p.cat_l2),
         cat_l3 = coalesce(p_attrs->>'cat_l3', p.cat_l3),
         maker = coalesce(p_attrs->>'maker', p.maker),
         supplier = coalesce(p_attrs->>'supplier', p.supplier)
   where p.id = p_product_id
     and p.company_id = v_company
  returning p.qty into v_new_qty;

  if not found then
    raise exception 'product not found in your company' using errcode = 'P0002';
  end if;

  if p_incoming is not null then
    insert into public.incoming
      (company_id, date, jan, name, qty, cost, total_cost, maker, supplier, note)
    values
      (v_company,
       (p_incoming->>'date')::date,
       coalesce(p_incoming->>'jan', ''),
       p_incoming->>'name',
       coalesce((p_incoming->>'qty')::integer, 0),
       coalesce((p_incoming->>'cost')::integer, 0),
       coalesce((p_incoming->>'total_cost')::integer, 0),
       coalesce(p_incoming->>'maker', ''),
       coalesce(p_incoming->>'supplier', ''),
       coalesce(p_incoming->>'note', ''))
    returning * into v_inc;
    v_inc_json := to_jsonb(v_inc);
  end if;

  return jsonb_build_object('new_qty', v_new_qty, 'incoming', v_inc_json);
end;
$$;

-- ---- 3. 出庫（スキャン出庫 / 手動出庫で商品行がある場合） ----
-- 条件付き更新で在庫不足なら例外（SM001）を投げ、履歴も記録しない。
-- p_outgoing が null でなければ出庫履歴も同じトランザクションで記録する。
-- 戻り値: {"new_qty": int, "outgoing": jsonb|null}
create or replace function public.sm_issue_stock(
  p_product_id bigint,
  p_qty integer,
  p_outgoing jsonb default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_company uuid := public.current_company_id();
  v_new_qty integer;
  v_out public.outgoing%rowtype;
  v_out_json jsonb := null;
begin
  if v_company is null then
    raise exception 'user is not associated with a company' using errcode = 'SM004';
  end if;
  if p_qty is null or p_qty <= 0 then
    raise exception 'quantity must be positive' using errcode = 'SM003';
  end if;

  update public.products p
     set qty = p.qty - p_qty
   where p.id = p_product_id
     and p.company_id = v_company
     and p.qty >= p_qty
  returning p.qty into v_new_qty;

  if not found then
    if exists (select 1 from public.products p
                where p.id = p_product_id and p.company_id = v_company) then
      raise exception 'insufficient stock' using errcode = 'SM001';
    else
      raise exception 'product not found in your company' using errcode = 'P0002';
    end if;
  end if;

  if p_outgoing is not null then
    insert into public.outgoing
      (company_id, date, jan, name, qty, price, total_price, destination, note)
    values
      (v_company,
       (p_outgoing->>'date')::date,
       coalesce(p_outgoing->>'jan', ''),
       p_outgoing->>'name',
       coalesce((p_outgoing->>'qty')::integer, 0),
       coalesce((p_outgoing->>'price')::integer, 0),
       coalesce((p_outgoing->>'total_price')::integer, 0),
       coalesce(p_outgoing->>'destination', ''),
       coalesce(p_outgoing->>'note', ''))
    returning * into v_out;
    v_out_json := to_jsonb(v_out);
  end if;

  return jsonb_build_object('new_qty', v_new_qty, 'outgoing', v_out_json);
end;
$$;

-- ---- 4. 入庫（手動入庫モーダル: JAN で商品を特定） ----
-- 入庫履歴は常に記録する。JAN が一致する自社商品があれば在庫も相対増し、
-- 商品が無ければ履歴のみ記録する（現行仕様の維持）。
-- 戻り値: {"product_id": bigint|null, "new_qty": int|null, "incoming": jsonb}
create or replace function public.sm_receive_stock_by_jan(
  p_jan text,
  p_qty integer,
  p_incoming jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_company uuid := public.current_company_id();
  v_product_id bigint := null;
  v_new_qty integer := null;
  v_inc public.incoming%rowtype;
begin
  if v_company is null then
    raise exception 'user is not associated with a company' using errcode = 'SM004';
  end if;
  if p_qty is null or p_qty <= 0 then
    raise exception 'quantity must be positive' using errcode = 'SM003';
  end if;
  if p_incoming is null then
    raise exception 'incoming record is required' using errcode = 'SM003';
  end if;

  insert into public.incoming
    (company_id, date, jan, name, qty, cost, total_cost, maker, supplier, note)
  values
    (v_company,
     (p_incoming->>'date')::date,
     coalesce(p_incoming->>'jan', ''),
     p_incoming->>'name',
     coalesce((p_incoming->>'qty')::integer, 0),
     coalesce((p_incoming->>'cost')::integer, 0),
     coalesce((p_incoming->>'total_cost')::integer, 0),
     coalesce(p_incoming->>'maker', ''),
     coalesce(p_incoming->>'supplier', ''),
     coalesce(p_incoming->>'note', ''))
  returning * into v_inc;

  if coalesce(p_jan, '') <> '' then
    select p.id into v_product_id
      from public.products p
     where p.company_id = v_company and p.jan = p_jan;

    if v_product_id is not null then
      update public.products p
         set qty = p.qty + p_qty
       where p.id = v_product_id
      returning p.qty into v_new_qty;
      if not found then
        v_product_id := null;
        v_new_qty := null;
      end if;
    end if;
  end if;

  return jsonb_build_object(
    'product_id', v_product_id,
    'new_qty', v_new_qty,
    'incoming', to_jsonb(v_inc)
  );
end;
$$;

-- ---- 5. 入庫履歴の削除（在庫ロールバック付き） ----
-- 履歴を消し、JAN が一致する自社商品の在庫を履歴数量だけ戻す。
-- ロールバックは現行仕様どおり 0 でクランプし、削除自体は失敗させない。
-- 戻り値: {"product_id": bigint|null, "new_qty": int|null}
create or replace function public.sm_delete_incoming(
  p_id bigint
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_company uuid := public.current_company_id();
  v_row public.incoming%rowtype;
  v_product_id bigint := null;
  v_new_qty integer := null;
begin
  if v_company is null then
    raise exception 'user is not associated with a company' using errcode = 'SM004';
  end if;

  -- DELETE ... RETURNING で「実際に消した行」だけを対象にする。
  -- 同じ履歴を2セッションが同時に消してもロールバックが二重に効くことは
  -- ない（行を取得できた側だけが進み、もう片方は P0002 になる）。
  delete from public.incoming i
   where i.id = p_id and i.company_id = v_company
  returning * into v_row;

  if not found then
    raise exception 'incoming record not found in your company' using errcode = 'P0002';
  end if;

  if coalesce(v_row.jan, '') <> '' then
    update public.products p
       set qty = greatest(p.qty - v_row.qty, 0)
     where p.company_id = v_company and p.jan = v_row.jan
    returning p.id, p.qty into v_product_id, v_new_qty;
    if not found then
      v_product_id := null;
      v_new_qty := null;
    end if;
  end if;

  return jsonb_build_object('product_id', v_product_id, 'new_qty', v_new_qty);
end;
$$;

-- ---- 6. 出庫履歴の削除（在庫ロールバック付き） ----
-- 履歴を消し、JAN が一致する自社商品の在庫を履歴数量だけ戻す（加算）。
-- 戻り値: {"product_id": bigint|null, "new_qty": int|null}
create or replace function public.sm_delete_outgoing(
  p_id bigint
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_company uuid := public.current_company_id();
  v_row public.outgoing%rowtype;
  v_product_id bigint := null;
  v_new_qty integer := null;
begin
  if v_company is null then
    raise exception 'user is not associated with a company' using errcode = 'SM004';
  end if;

  delete from public.outgoing o
   where o.id = p_id and o.company_id = v_company
  returning * into v_row;

  if not found then
    raise exception 'outgoing record not found in your company' using errcode = 'P0002';
  end if;

  if coalesce(v_row.jan, '') <> '' then
    update public.products p
       set qty = p.qty + v_row.qty
     where p.company_id = v_company and p.jan = v_row.jan
    returning p.id, p.qty into v_product_id, v_new_qty;
    if not found then
      v_product_id := null;
      v_new_qty := null;
    end if;
  end if;

  return jsonb_build_object('product_id', v_product_id, 'new_qty', v_new_qty);
end;
$$;

-- ---- 7. 在庫数の絶対値設定（棚卸し的な修正用） ----
-- 商品編集モーダルと一覧のインライン編集の qty だけが使う。
-- 会社チェックと負数チェックを行い、設定後の数量を返す。
create or replace function public.sm_set_qty(
  p_product_id bigint,
  p_qty integer
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_company uuid := public.current_company_id();
  v_new_qty integer;
begin
  if v_company is null then
    raise exception 'user is not associated with a company' using errcode = 'SM004';
  end if;
  if p_qty is null or p_qty < 0 then
    raise exception 'quantity must be >= 0' using errcode = 'SM003';
  end if;

  update public.products p
     set qty = p_qty
   where p.id = p_product_id
     and p.company_id = v_company
  returning p.qty into v_new_qty;

  if not found then
    raise exception 'product not found in your company' using errcode = 'P0002';
  end if;

  return v_new_qty;
end;
$$;

-- ---- 8. EXECUTE 権限（既存ヘルパーと同じパターン） ----
revoke execute on function public.sm_receive_stock(bigint, integer, jsonb, jsonb) from public, anon;
revoke execute on function public.sm_issue_stock(bigint, integer, jsonb) from public, anon;
revoke execute on function public.sm_receive_stock_by_jan(text, integer, jsonb) from public, anon;
revoke execute on function public.sm_delete_incoming(bigint) from public, anon;
revoke execute on function public.sm_delete_outgoing(bigint) from public, anon;
revoke execute on function public.sm_set_qty(bigint, integer) from public, anon;

grant execute on function public.sm_receive_stock(bigint, integer, jsonb, jsonb) to authenticated;
grant execute on function public.sm_issue_stock(bigint, integer, jsonb) to authenticated;
grant execute on function public.sm_receive_stock_by_jan(text, integer, jsonb) to authenticated;
grant execute on function public.sm_delete_incoming(bigint) to authenticated;
grant execute on function public.sm_delete_outgoing(bigint) to authenticated;
grant execute on function public.sm_set_qty(bigint, integer) to authenticated;
