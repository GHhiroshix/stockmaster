// Vercel Serverless Function
// Yahoo!などの画像サーバーはブラウザから直接読み込むとブロックされる場合があるため、
// サーバー側で一度取得してからそのまま返す「画像プロキシ」
export default async function handler(req, res) {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "urlが必要です" });

  // 想定していない外部サイトへの中継を防ぐため、許可するホストだけに限定
  let target;
  try {
    target = new URL(url);
  } catch (e) {
    return res.status(400).json({ error: "不正なURLです" });
  }
  const allowedHosts = [/\.yimg\.jp$/, /\.c\.yimg\.jp$/, /openfoodfacts\.org$/, /\.openfoodfacts\.org$/];
  if (!allowedHosts.some(re => re.test(target.hostname))) {
    return res.status(400).json({ error: "許可されていない画像元です" });
  }

  try {
    const upstream = await fetch(target.toString(), {
      headers: {
        // Yahoo!の画像CDNはリファラーで弾く場合があるため、Yahoo由来に見せる
        "Referer": "https://shopping.yahoo.co.jp/",
        "User-Agent": "Mozilla/5.0",
      },
    });
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: "画像取得に失敗しました" });
    }
    const contentType = upstream.headers.get("content-type") || "image/jpeg";
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=86400"); // 1日キャッシュ
    return res.status(200).send(buf);
  } catch (e) {
    return res.status(500).json({ error: "画像取得エラー: " + e.message });
  }
}
