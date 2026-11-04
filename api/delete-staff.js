// delete staff api

import { createClient } from '@supabase/supabase-js';

// 呼び出した人が「本当にログイン中の管理者本人」かどうかをサーバー側で確認する
async function getVerifiedAdmin(req, supabaseAdmin) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return null;

  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !userData?.user) return null;

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', userData.user.id)
    .single();

  if (!profile || profile.role !== 'admin' || profile.is_approved === false) return null;
  return profile;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user_id } = req.body;
  if (!user_id) {
    return res.status(400).json({ error: '必須項目が不足しています' });
  }

  const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // ログイン中の本人確認。承認済みの管理者本人でなければ処理しない
  const admin = await getVerifiedAdmin(req, supabaseAdmin);
  if (!admin) {
    return res.status(403).json({ error: '権限がありません（管理者としてログインし直してください）' });
  }

  // 自分自身は削除できない
  if (user_id === admin.id) {
    return res.status(400).json({ error: '自分自身は削除できません' });
  }

  // 削除対象が同じ会社かどうかを確認（他社のスタッフは消せないようにする）
  const { data: target } = await supabaseAdmin
    .from('profiles')
    .select('company_id')
    .eq('id', user_id)
    .single();

  if (!target || target.company_id !== admin.company_id) {
    return res.status(403).json({ error: '権限がありません' });
  }

  // プロフィール削除
  await supabaseAdmin.from('profiles').delete().eq('id', user_id);

  // Authユーザー削除
  const { error } = await supabaseAdmin.auth.admin.deleteUser(user_id);
  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.status(200).json({ success: true });
}
