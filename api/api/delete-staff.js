import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user_id, company_id, requester_id } = req.body;

  if (!user_id || !company_id || !requester_id) {
    return res.status(400).json({ error: '必須項目が不足しています' });
  }

  const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // 依頼者が管理者かどうか確認
  const { data: requester } = await supabaseAdmin
    .from('profiles')
    .select('role, company_id')
    .eq('id', requester_id)
    .single();

  if (!requester || requester.role !== 'admin' || requester.company_id !== company_id) {
    return res.status(403).json({ error: '権限がありません' });
  }

  // 自分自身は削除できない
  if (user_id === requester_id) {
    return res.status(400).json({ error: '自分自身は削除できません' });
  }

  // 削除対象が同じ会社か確認
  const { data: target } = await supabaseAdmin
    .from('profiles')
    .select('company_id, role')
    .eq('id', user_id)
    .single();

  if (!target || target.company_id !== company_id) {
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
