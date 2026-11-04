// 承認待ちの新規会社（管理者アカウント）一覧を取得するAPI
// プラットフォーム管理者（is_platform_admin = true の人）だけが呼び出せる

import { createClient } from '@supabase/supabase-js';

// 呼び出した人が「本当にログイン中の運営（プラットフォーム管理者）本人」かどうかをサーバー側で確認する
async function getVerifiedPlatformAdmin(req, supabaseAdmin) {
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

  if (!profile || !profile.is_platform_admin) return null;
  return profile;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // ログイン中の本人確認。運営（プラットフォーム管理者）本人でなければ処理しない
  const requester = await getVerifiedPlatformAdmin(req, supabaseAdmin);
  if (!requester) {
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
