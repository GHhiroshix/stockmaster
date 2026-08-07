// 承認待ちの新規会社（管理者アカウント）一覧を取得するAPI
// プラットフォーム管理者（is_platform_admin = true の人）だけが呼び出せる

import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { requester_id } = req.body;
  if (!requester_id) {
    return res.status(400).json({ error: '必須項目が不足しています' });
  }

  const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // 依頼者がプラットフォーム管理者か確認
  const { data: requester } = await supabaseAdmin
    .from('profiles')
    .select('is_platform_admin')
    .eq('id', requester_id)
    .single();

  if (!requester || !requester.is_platform_admin) {
    return res.status(403).json({ error: '権限がありません' });
  }

  // 承認待ちの管理者（＝新規に作られた会社）一覧を取得
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, name, email, company_id, created_at, companies(name)')
    .eq('role', 'admin')
    .eq('is_approved', false)
    .order('created_at', { ascending: false });

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.status(200).json({ pending: data });
}
