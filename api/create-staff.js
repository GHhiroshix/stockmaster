import { createClient } from '@supabase/supabase-js';

// 呼び出した人が「本当にログイン中の管理者本人」かどうかをサーバー側で確認する
// （これまではブラウザが送ってきた情報をそのまま信じていたため、誰でも他社にスタッフを追加できてしまっていた）
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

  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: '必須項目が不足しています' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'パスワードは6文字以上にしてください' });
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

  // company_idはブラウザからは受け取らず、確認できた管理者自身の会社IDを使う
  const company_id = admin.company_id;

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
      .insert({ id: userId, company_id, name, email, role: 'staff', is_approved: true });

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
