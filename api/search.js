// Vercel Serverless Function
// ブラウザ → このAPI → 楽天API という流れでCORSを回避

export default async function handler(req, res) {
  // CORSヘッダー設定
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const { jan } = req.query;

  if (!jan) {
    return res.status(400).json({ error: "JANコードが必要です" });
  }

  const APP_ID = process.env.RAKUTEN_APP_ID;

  if (!APP_ID) {
    return res.status(500).json({ error: "楽天アプリIDが設定されていません" });
  }

  try {
    const url = `https://app.rakuten.co.jp/services/api/IchibaItem/Search/20220601?format=json&keyword=${encodeURIComponent(jan)}&applicationId=${APP_ID}&hits=1`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      return res.status(400).json({ error: data.error_description || data.error });
    }

    if (!data.Items || data.Items.length === 0) {
      return res.status(404).json({ error: "商品が見つかりませんでした" });
    }

    const item = data.Items[0].Item;
    return res.status(200).json({
      name:  item.itemName,
      price: item.itemPrice,
      brand: item.shopName || "",
      image: item.mediumImageUrls?.[0]?.imageUrl || "",
    });

  } catch (e) {
    return res.status(500).json({ error: "APIエラー: " + e.message });
  }
}
