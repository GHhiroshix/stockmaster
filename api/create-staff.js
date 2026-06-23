import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, email, password, company_id } = req.body;

  if (!name || !email || !password || !company_id) {
    return res.status(400).json({ error: '必須項目が不足しています' });
  }

  // サービスロールキーで管理者クライアントを作成
  const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // 1. Supabase Authでユーザー作成
    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authErr) {
      return res.status(400).json({ error: authErr.message });
    }

    const userId = authData.user.id;

    // 2. プロフィール作成（スタッフ権限）
    const { error: profErr } = await supabaseAdmin
      .from('profiles')
      .insert({ id: userId, company_id, name, email, role: 'staff' });

    if (profErr) {
      // プロフィール作成失敗時はAuthユーザーも削除
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return res.status(400).json({ error: profErr.message });
    }

    return res.status(200).json({ success: true, userId });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
