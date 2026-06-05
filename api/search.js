// Vercel Serverless Function
// ① Yahoo!ショッピング(jan_codeパラメータ) → ② Open Food Facts の順で検索
 
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
 
  // ① Yahoo!ショッピングAPI（jan_codeパラメータ使用）
  const YAHOO_ID = process.env.YAHOO_CLIENT_ID;
  if (YAHOO_ID) {
    try {
      console.log("[Yahoo] 検索開始:", jan);
      const yahooUrl = "https://shopping.yahooapis.jp/ShoppingWebService/V3/itemSearch?appid=" + YAHOO_ID + "&jan_code=" + jan + "&results=1";
      const yahooRes = await fetch(yahooUrl);
      const yahooData = await yahooRes.json();
      console.log("[Yahoo] hits:", yahooData.totalResultsReturned);
 
      if (yahooData.totalResultsReturned > 0 && yahooData.hits && yahooData.hits.length > 0) {
        const h = yahooData.hits[0];
        console.log("[Yahoo] 取得:", h.name);
        return res.status(200).json({
          name:   h.name,
          price:  h.price || 0,
          brand:  (h.brand && h.brand.name) || "",
          source: "Yahoo",
        });
      } else {
        console.log("[Yahoo] 見つからず");
      }
    } catch(e) {
      console.log("[Yahoo] エラー:", e.message);
    }
  } else {
    console.log("[Yahoo] CLIENT_ID未設定");
  }
 
  // ② Open Food Facts（食品・飲料）
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
      if (name) {
        console.log("[OFF] 取得:", name);
        return res.status(200).json({
          name:   name,
          price:  0,
          brand:  brand,
          source: "OpenFoodFacts",
        });
      }
    }
    console.log("[OFF] 見つからず");
  } catch(e) {
    console.log("[OFF] エラー:", e.message);
  }
 
  console.log("[search] 該当なし");
  return res.status(404).json({ error: "商品が見つかりませんでした" });
}
