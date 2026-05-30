// Vercel Serverless Function
// ① Open Food Facts → ② 楽天API の順で検索

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const { jan } = req.query;
  if (!jan) return res.status(400).json({ error: "JANコードが必要です" });

  // ① Open Food Facts で検索（食品・飲料に強い・無料）
  try {
    const offUrl = `https://world.openfoodfacts.org/api/v0/product/${jan}.json`;
    const offRes = await fetch(offUrl);
    const offData = await offRes.json();

    if (offData.status === 1 && offData.product) {
      const p = offData.product;
      const name =
        p.product_name_ja ||
        p.product_name ||
        p.abbreviated_product_name ||
        "";
      const brand = p.brands || "";

      if (name) {
        return res.status(200).json({
          name:   name,
          price:  0,
          brand:  brand,
          source: "OpenFoodFacts",
        });
      }
    }
  } catch(e) {
    // Open Food Facts が失敗しても続行
  }

  // ② 楽天API で検索（家電・日用品に強い）
  const APP_ID = process.env.RAKUTEN_APP_ID;
  if (APP_ID) {
    try {
      const rakutenUrl = `https://app.rakuten.co.jp/services/api/IchibaItem/Search/20220601?format=json&keyword=${encodeURIComponent(jan)}&applicationId=${APP_ID}&hits=1`;
      const rakutenRes = await fetch(rakutenUrl);
      const rakutenData = await rakutenRes.json();

      if (!rakutenData.error && rakutenData.Items && rakutenData.Items.length > 0) {
        const item = rakutenData.Items[0].Item;
        return res.status(200).json({
          name:   item.itemName,
          price:  item.itemPrice,
          brand:  item.shopName || "",
          source: "Rakuten",
        });
      }
    } catch(e) {
      // 楽天も失敗
    }
  }

  // どちらも見つからない
  return res.status(404).json({ error: "商品が見つかりませんでした" });
}
