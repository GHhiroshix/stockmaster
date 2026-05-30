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

  console.log("[search] JAN:", jan);

  // ① Open Food Facts で検索
  try {
    console.log("[OFF] 検索開始:", jan);
    const offUrl = "https://world.openfoodfacts.org/api/v0/product/" + jan + ".json";
    const offRes = await fetch(offUrl);
    const offData = await offRes.json();
    console.log("[OFF] status:", offData.status);

    if (offData.status === 1 && offData.product) {
      const p = offData.product;
      const name = p.product_name_ja || p.product_name || p.abbreviated_product_name || "";
      const brand = p.brands || "";
      console.log("[OFF] 取得:", name, brand);

      if (name) {
        return res.status(200).json({
          name:   name,
          price:  0,
          brand:  brand,
          source: "OpenFoodFacts",
        });
      }
    } else {
      console.log("[OFF] 見つからず");
    }
  } catch(e) {
    console.log("[OFF] エラー:", e.message);
  }

  // ② 楽天API で検索
  const APP_ID = process.env.RAKUTEN_APP_ID;
  if (APP_ID) {
    try {
      console.log("[Rakuten] 検索開始:", jan);
      const rakutenUrl = "https://app.rakuten.co.jp/services/api/IchibaItem/Search/20220601?format=json&keyword=" + encodeURIComponent(jan) + "&applicationId=" + APP_ID + "&hits=1";
      const rakutenRes = await fetch(rakutenUrl);
      const rakutenData = await rakutenRes.json();
      console.log("[Rakuten] error:", rakutenData.error, "hits:", rakutenData.count);

      if (!rakutenData.error && rakutenData.Items && rakutenData.Items.length > 0) {
        const item = rakutenData.Items[0].Item;
        console.log("[Rakuten] 取得:", item.itemName);
        return res.status(200).json({
          name:   item.itemName,
          price:  item.itemPrice,
          brand:  item.shopName || "",
          source: "Rakuten",
        });
      } else {
        console.log("[Rakuten] 見つからず");
      }
    } catch(e) {
      console.log("[Rakuten] エラー:", e.message);
    }
  } else {
    console.log("[Rakuten] APP_ID未設定");
  }

  console.log("[search] 該当なし");
  return res.status(404).json({ error: "商品が見つかりませんでした" });
}
