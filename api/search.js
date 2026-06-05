
// Vercel Serverless Function
// Yahoo!ショッピング: ① jan_code検索 → ② キーワード検索 の順で試す
 
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
 
  const YAHOO_ID = process.env.YAHOO_CLIENT_ID;
 
  if (YAHOO_ID) {
    // ① jan_codeパラメータで検索（正確）
    try {
      const url1 = "https://shopping.yahooapis.jp/ShoppingWebService/V3/itemSearch?appid=" + YAHOO_ID + "&jan_code=" + jan + "&results=1";
      const res1 = await fetch(url1);
      const data1 = await res1.json();
      console.log("[Yahoo jan_code] hits:", data1.totalResultsReturned);
 
      if (data1.totalResultsReturned > 0 && data1.hits && data1.hits.length > 0) {
        const h = data1.hits[0];
        console.log("[Yahoo jan_code] 取得:", h.name);
        return res.status(200).json({
          name:   h.name,
          price:  h.price || 0,
          brand:  (h.brand && h.brand.name) || "",
          source: "Yahoo(JAN)",
        });
      }
    } catch(e) {
      console.log("[Yahoo jan_code] エラー:", e.message);
    }
 
    // ② キーワード検索でJANコードを探す（jan_codeで0件の場合の保険）
    try {
      const url2 = "https://shopping.yahooapis.jp/ShoppingWebService/V3/itemSearch?appid=" + YAHOO_ID + "&query=" + jan + "&results=5";
      const res2 = await fetch(url2);
      const data2 = await res2.json();
      console.log("[Yahoo query] hits:", data2.totalResultsReturned);
 
      if (data2.totalResultsReturned > 0 && data2.hits && data2.hits.length > 0) {
        // JANコードが一致する商品を優先
        let match = data2.hits.find(h => h.janCode === jan);
        const h = match || data2.hits[0];
        console.log("[Yahoo query] 取得:", h.name);
        return res.status(200).json({
          name:   h.name,
          price:  h.price || 0,
          brand:  (h.brand && h.brand.name) || "",
          source: "Yahoo(query)",
        });
      }
    } catch(e) {
      console.log("[Yahoo query] エラー:", e.message);
    }
  } else {
    console.log("[Yahoo] CLIENT_ID未設定");
  }
 
  // ③ Open Food Facts（食品・飲料の保険）
  try {
    const offUrl = "https://world.openfoodfacts.org/api/v0/product/" + jan + ".json";
    const offRes = await fetch(offUrl);
    const offData = await offRes.json();
    console.log("[OFF] status:", offData.status);
 
    if (offData.status === 1 && offData.product) {
      const p = offData.product;
      const name = p.product_name_ja || p.product_name || p.abbreviated_product_name || "";
      if (name) {
        console.log("[OFF] 取得:", name);
        return res.status(200).json({
          name:   name,
          price:  0,
          brand:  p.brands || "",
          source: "OpenFoodFacts",
        });
      }
    }
  } catch(e) {
    console.log("[OFF] エラー:", e.message);
  }
 
  console.log("[search] 該当なし");
  return res.status(404).json({ error: "商品が見つかりませんでした" });
}
