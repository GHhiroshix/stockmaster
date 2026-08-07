// 新規会社（管理者アカウント）を承認・却下するAPI
// プラットフォーム管理者（is_platform_admin = true の人）だけが呼び出せる

import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { requester_id, user_id, action } = req.body; // action: 'approve' | 'reject'
  if (!requester_id || !user_id || !action) {
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

  if (action === 'approve') {
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ is_approved: true })
      .eq('id', user_id);
    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  if (action === 'reject') {
    // プロフィール・会社・Authユーザーをまとめて削除
    const { data: target } = await supabaseAdmin
      .from('profiles')
      .select('company_id')
      .eq('id', user_id)
      .single();

    await supabaseAdmin.from('profiles').delete().eq('id', user_id);
    if (target?.company_id) {
      await supabaseAdmin.from('companies').delete().eq('id', target.company_id);
    }
    const { error } = await supabaseAdmin.auth.admin.deleteUser(user_id);
    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  return res.status(400).json({ error: '不正なactionです' });
}
