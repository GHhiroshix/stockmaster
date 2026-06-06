import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";

// ── 初期カテゴリーデータ ──────────────────────────────
const CATS_INITIAL = [
  { id:"c1", name:"介護用品", emoji:"🏥", children:[
    { id:"c1-1", name:"排泄ケア", children:[
      { id:"c1-1-1", name:"紙おむつ（パンツ型）" },
      { id:"c1-1-2", name:"紙おむつ（テープ型）" },
      { id:"c1-1-3", name:"尿取りパッド" },
      { id:"c1-1-4", name:"排泄処理用品" },
    ]},
    { id:"c1-2", name:"移動・移乗", children:[
      { id:"c1-2-1", name:"車椅子" },
      { id:"c1-2-2", name:"歩行器・歩行補助" },
      { id:"c1-2-3", name:"杖・松葉杖" },
      { id:"c1-2-4", name:"移乗ボード" },
    ]},
    { id:"c1-3", name:"食事・嚥下", children:[
      { id:"c1-3-1", name:"介護食・嚥下食" },
      { id:"c1-3-2", name:"栄養補助食品" },
      { id:"c1-3-3", name:"食事補助用品" },
    ]},
    { id:"c1-4", name:"入浴・清拭", children:[
      { id:"c1-4-1", name:"入浴補助用品" },
      { id:"c1-4-2", name:"清拭用品" },
      { id:"c1-4-3", name:"皮膚保護用品" },
    ]},
    { id:"c1-5", name:"床ずれ防止", children:[
      { id:"c1-5-1", name:"床ずれ防止マット" },
      { id:"c1-5-2", name:"体位変換用品" },
    ]},
  ]},
  { id:"c2", name:"衛生・医療", emoji:"💊", children:[
    { id:"c2-1", name:"感染対策", children:[
      { id:"c2-1-1", name:"マスク" },
      { id:"c2-1-2", name:"手袋・グローブ" },
      { id:"c2-1-3", name:"消毒液・除菌" },
    ]},
    { id:"c2-2", name:"医療用品", children:[
      { id:"c2-2-1", name:"包帯・ガーゼ" },
      { id:"c2-2-2", name:"体温計・血圧計" },
      { id:"c2-2-3", name:"サポーター・コルセット" },
    ]},
  ]},
  { id:"c3", name:"日用雑貨", emoji:"🧴", children:[
    { id:"c3-1", name:"洗濯・清掃", children:[
      { id:"c3-1-1", name:"洗濯洗剤" },
      { id:"c3-1-2", name:"掃除用品" },
      { id:"c3-1-3", name:"ゴミ袋・ポリ袋" },
    ]},
    { id:"c3-2", name:"ボディケア", children:[
      { id:"c3-2-1", name:"シャンプー・リンス" },
      { id:"c3-2-2", name:"ボディソープ" },
      { id:"c3-2-3", name:"歯磨き用品" },
    ]},
    { id:"c3-3", name:"キッチン用品", children:[
      { id:"c3-3-1", name:"調理器具" },
      { id:"c3-3-2", name:"食器・カトラリー" },
      { id:"c3-3-3", name:"キッチン消耗品" },
    ]},
  ]},
  { id:"c4", name:"食料品・飲料", emoji:"🍱", children:[
    { id:"c4-1", name:"飲料", children:[
      { id:"c4-1-1", name:"お茶・水" },
      { id:"c4-1-2", name:"栄養ドリンク" },
      { id:"c4-1-3", name:"ジュース・炭酸" },
    ]},
    { id:"c4-2", name:"食品", children:[
      { id:"c4-2-1", name:"レトルト・缶詰" },
      { id:"c4-2-2", name:"菓子・スナック" },
      { id:"c4-2-3", name:"調味料" },
    ]},
  ]},
  { id:"c5", name:"家電・機器", emoji:"💻", children:[
    { id:"c5-1", name:"介護機器", children:[
      { id:"c5-1-1", name:"電動ベッド・マット" },
      { id:"c5-1-2", name:"リフト・昇降機" },
      { id:"c5-1-3", name:"見守り機器" },
    ]},
    { id:"c5-2", name:"生活家電", children:[
      { id:"c5-2-1", name:"調理家電" },
      { id:"c5-2-2", name:"冷暖房機器" },
      { id:"c5-2-3", name:"その他家電" },
    ]},
  ]},
];

const EMOJIS = ["🏥","💊","🧴","🍱","💻","📦","🏠","🚗","👗","🎮","🍎","🔧","📚","💄","🎵","🏃"];

const PRODUCTS = {
  "4901777317895": { name:"コカ・コーラ 500ml", price:180, brand:"コカ・コーラ" },
  "4571245494429": { name:"キリン一番搾り 350ml×24本", price:3980, brand:"キリン" },
  "4902102114775": { name:"ポカリスエット 500ml", price:160, brand:"大塚製薬" },
  "4902105047422": { name:"カップヌードル レギュラー", price:240, brand:"日清食品" },
  "4901335018062": { name:"カルビーポテトチップス うすしお 60g", price:150, brand:"カルビー" },
  "4902430457286": { name:"アリエール 洗濯洗剤 詰替 900g", price:398, brand:"P&G" },
  "4549660566175": { name:"ソニー WF-1000XM5 イヤホン", price:39600, brand:"SONY" },
};

const INIT_DB = [
  { id:1, jan:"4903111540938", name:"ライフリー うす型軽快パンツ M", price:5236, cost:3500, qty:10, reorderPoint:5, catL1:"c1", catL2:"c1-1", catL3:"c1-1-1", maker:"ユニ・チャーム", supplier:"ユニ・チャーム直販", addedAt:"2026-04-01" },
  { id:2, jan:"4902430457286", name:"アリエール 洗濯洗剤 詰替 900g",  price:398,  cost:220,  qty:24, reorderPoint:10, catL1:"c3", catL2:"c3-1", catL3:"c3-1-1", maker:"P&G",           supplier:"P&G Japan",   addedAt:"2026-04-05" },
  { id:3, jan:"4902102114775", name:"ポカリスエット 500ml",           price:160,  cost:90,   qty:48, reorderPoint:24, catL1:"c4", catL2:"c4-1", catL3:"c4-1-2", maker:"大塚製薬",       supplier:"大塚物流",    addedAt:"2026-04-10" },
];

const INIT_HISTORY = [
  { id:1, date:"2026-04-01", jan:"4903111540938", name:"ライフリー うす型軽快パンツ M", qty:10, cost:3500, totalCost:35000, maker:"ユニ・チャーム", supplier:"ユニ・チャーム直販", note:"初回仕入れ" },
  { id:2, date:"2026-04-05", jan:"4902430457286", name:"アリエール 洗濯洗剤 詰替 900g", qty:24, cost:220, totalCost:5280, maker:"P&G", supplier:"P&G Japan", note:"" },
  { id:3, date:"2026-04-10", jan:"4902102114775", name:"ポカリスエット 500ml", qty:48, cost:90, totalCost:4320, maker:"大塚製薬", supplier:"大塚物流", note:"" },
];

// ── カテゴリーヘルパー ────────────────────────────────
function findL1(cats, id) { return cats.find(c => c.id===id) || null; }
function findL2(cats, l1id, l2id) { const l1=findL1(cats,l1id); return l1?(l1.children.find(c=>c.id===l2id)||null):null; }
function findL3(cats, l1id, l2id, l3id) { const l2=findL2(cats,l1id,l2id); return l2?(l2.children.find(c=>c.id===l3id)||null):null; }
function catLabel(cats, l1id, l2id, l3id) {
  return [findL1(cats,l1id)?.name, findL2(cats,l1id,l2id)?.name, findL3(cats,l1id,l2id,l3id)?.name].filter(Boolean).join(" › ") || "未分類";
}

function fmtY(n) { return "¥" + Number(n||0).toLocaleString(); }
function calcM(p,c) { if(!p||!c) return null; return Math.round((p-c)/p*100); }
function mCol(m) { if(m===null) return "#666"; if(m>=30) return "#3FB950"; if(m>=10) return "#D29922"; return "#F85149"; }
function today() { return new Date().toISOString().slice(0,10); }

function exportCSV(db, cats) {
  const hdr = "JAN,商品名,大分類,中分類,小分類,メーカー,仕入れ先,単価,仕入れ値,粗利率,在庫数,発注点,登録日";
  const rows = db.map(i => [
    i.jan, `"${i.name}"`,
    findL1(cats,i.catL1)?.name||"", findL2(cats,i.catL1,i.catL2)?.name||"", findL3(cats,i.catL1,i.catL2,i.catL3)?.name||"",
    `"${i.maker||""}"`, `"${i.supplier||""}"`,
    i.price, i.cost||0, calcM(i.price,i.cost)||"", i.qty, i.reorderPoint||0, i.addedAt
  ].join(","));
  dl("\uFEFF"+[hdr,...rows].join("\n"), "stock.csv");
}

function exportInventoryCSV(db, cats) {
  const hdr = "JAN,商品名,大分類,中分類,小分類,メーカー,仕入れ先,単価,仕入れ値,帳簿在庫数,実在庫数,差異,備考";
  const rows = db.map(i => [
    i.jan, `"${i.name}"`,
    findL1(cats,i.catL1)?.name||"", findL2(cats,i.catL1,i.catL2)?.name||"", findL3(cats,i.catL1,i.catL2,i.catL3)?.name||"",
    `"${i.maker||""}"`, `"${i.supplier||""}"`,
    i.price, i.cost||0, i.qty, "", "", ""
  ].join(","));
  dl("\uFEFF"+[hdr,...rows].join("\n"), "inventory_count.csv");
}

function exportHistoryCSV(history) {
  const hdr = "仕入れ日,JAN,商品名,仕入れ数量,仕入れ単価,仕入れ合計,メーカー,仕入れ先,備考";
  const rows = history.map(h => [
    h.date, h.jan, `"${h.name}"`, h.qty, h.cost, h.totalCost,
    `"${h.maker||""}"`, `"${h.supplier||""}"`, `"${h.note||""}"`
  ].join(","));
  dl("\uFEFF"+[hdr,...rows].join("\n"), "purchase_history.csv");
}

function dl(content, filename) {
  const blob = new Blob([content],{type:"text/csv;charset=utf-8;"});
  Object.assign(document.createElement("a"),{href:URL.createObjectURL(blob),download:filename}).click();
}

// ── カメラスキャナー ──────────────────────────────────
function CameraScanner({ onDetected, onClose }) {
  const videoRef = useRef(null);
  const [err, setErr] = useState("");
  const [scanning, setScanning] = useState(false);
  useEffect(() => {
    let controls = null;
    const reader = new BrowserMultiFormatReader();
    (async () => {
      try {
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        const back = devices.find(d => /back|rear|environment/i.test(d.label)) || devices[devices.length-1];
        setScanning(true);
        controls = await reader.decodeFromVideoDevice(back?.deviceId, videoRef.current,
          (result) => { if(result) { onDetected(result.getText()); controls?.stop(); } }
        );
      } catch(e) { setErr("カメラエラー: " + e.message); }
    })();
    return () => { controls?.stop(); };
  }, [onDetected]);
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.92)",zIndex:500,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{fontSize:16,color:"#E6EDF3",marginBottom:16,fontWeight:700}}>📷 バーコードをスキャン</div>
      {err ? <div style={{color:"#F85149",fontSize:13}}>{err}</div> : (
        <div style={{position:"relative"}}>
          <video ref={videoRef} style={{width:"min(360px,90vw)",borderRadius:8,display:"block"}} playsInline muted />
          <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:"70%",height:60,border:"2px solid #3FB950",borderRadius:4,boxShadow:"0 0 0 1000px rgba(0,0,0,.4)"}} />
        </div>
      )}
      {scanning && !err && <div style={{color:"#3FB950",fontSize:12,marginTop:10}}>バーコードをフレームに合わせてください</div>}
      <button style={{marginTop:20,background:"transparent",color:"#F85149",border:"1px solid rgba(248,81,73,.4)",borderRadius:6,padding:"10px 28px",cursor:"pointer",fontSize:14,fontWeight:700}} onClick={onClose}>キャンセル</button>
    </div>
  );
}

// ── カテゴリー選択（3段階） ───────────────────────────
function CategorySelect({ cats, l1, l2, l3, onChange, inpS }) {
  const l2opts = l1 ? (findL1(cats,l1)?.children||[]) : [];
  const l3opts = l2 ? (findL2(cats,l1,l2)?.children||[]) : [];
  return (
    <div style={{display:"flex",flexDirection:"column",gap:8}}>
      <div>
        <div style={{fontSize:11,color:"#8B949E",marginBottom:3}}>大分類</div>
        <select style={inpS} value={l1||""} onChange={e => onChange(e.target.value,"","")}>
          <option value="">選択してください</option>
          {cats.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
        </select>
      </div>
      <div>
        <div style={{fontSize:11,color:"#8B949E",marginBottom:3}}>中分類</div>
        <select style={inpS} value={l2||""} onChange={e => onChange(l1,e.target.value,"")} disabled={!l1}>
          <option value="">選択してください</option>
          {l2opts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div>
        <div style={{fontSize:11,color:"#8B949E",marginBottom:3}}>小分類</div>
        <select style={inpS} value={l3||""} onChange={e => onChange(l1,l2,e.target.value)} disabled={!l2}>
          <option value="">選択してください</option>
          {l3opts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
    </div>
  );
}

// ── 商品カード（iPad表示） ────────────────────────────
function ItemCard({ item, cats, onEdit, onDelete }) {
  const m = calcM(item.price, item.cost);
  const isAl = item.qty <= (item.reorderPoint||0);
  const l1 = findL1(cats, item.catL1);
  const l3 = findL3(cats, item.catL1, item.catL2, item.catL3);
  const badge = item.qty===0 ? {text:"在庫なし",col:"#F85149",bg:"rgba(248,81,73,.12)"}
    : isAl ? {text:"⚠発注要",col:"#F85149",bg:"rgba(248,81,73,.12)"}
    : item.qty<=5 ? {text:"残りわずか",col:"#D29922",bg:"rgba(210,153,34,.12)"}
    : {text:"在庫あり",col:"#3FB950",bg:"rgba(63,185,80,.12)"};
  return (
    <div style={{background:"#21262D",border:"1px solid #30363D",borderRadius:10,padding:14,marginBottom:10}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
        <div style={{flex:1,minWidth:0,marginRight:8}}>
          <div style={{fontWeight:600,fontSize:14,lineHeight:1.4,marginBottom:2}}>{item.name}</div>
          <div style={{fontFamily:"monospace",fontSize:10,color:"#484F58"}}>{item.jan}</div>
        </div>
        <span style={{flexShrink:0,background:badge.bg,color:badge.col,padding:"3px 8px",borderRadius:6,fontSize:11,fontWeight:700}}>{badge.text}</span>
      </div>
      {(l1||l3) && (
        <div style={{fontSize:11,color:"#8B949E",marginBottom:8}}>
          {l1 && <span>{l1.emoji} {l1.name}</span>}
          {l3 && <span style={{color:"#484F58"}}> › {l3.name}</span>}
        </div>
      )}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:8}}>
        <div style={{background:"#1C2128",borderRadius:6,padding:"8px 10px"}}>
          <div style={{fontSize:9,color:"#484F58",marginBottom:3}}>単価</div>
          <div style={{fontFamily:"monospace",fontWeight:700,color:"#58A6FF",fontSize:14}}>{fmtY(item.price)}</div>
        </div>
        <div style={{background:"#1C2128",borderRadius:6,padding:"8px 10px"}}>
          <div style={{fontSize:9,color:"#484F58",marginBottom:3}}>在庫数</div>
          <div style={{fontFamily:"monospace",fontWeight:700,fontSize:20}}>{item.qty}</div>
        </div>
        <div style={{background:"#1C2128",borderRadius:6,padding:"8px 10px"}}>
          <div style={{fontSize:9,color:"#484F58",marginBottom:3}}>粗利率</div>
          <div style={{fontFamily:"monospace",fontWeight:700,color:mCol(m),fontSize:14}}>{m!==null?m+"%":"—"}</div>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,fontSize:11,color:"#8B949E",marginBottom:6}}>
        <div>仕入れ値: <span style={{fontFamily:"monospace",color:"#E6EDF3"}}>{item.cost?fmtY(item.cost):"—"}</span></div>
        <div>発注点: <span style={{fontFamily:"monospace",color:"#E6EDF3"}}>{item.reorderPoint||0}</span></div>
        {item.maker && <div>メーカー: <span style={{color:"#E6EDF3"}}>{item.maker}</span></div>}
        {item.supplier && <div>仕入れ先: <span style={{color:"#E6EDF3"}}>{item.supplier}</span></div>}
      </div>
      <div style={{display:"flex",gap:8,marginTop:10}}>
        <button style={{flex:1,background:"rgba(88,166,255,.1)",color:"#58A6FF",border:"1px solid rgba(88,166,255,.3)",borderRadius:6,cursor:"pointer",fontSize:13,padding:"8px 0",fontWeight:600}} onClick={() => onEdit(item)}>✏ 編集</button>
        <button style={{background:"transparent",color:"#F85149",border:"1px solid rgba(248,81,73,.3)",borderRadius:6,cursor:"pointer",fontSize:13,padding:"8px 14px"}} onClick={() => onDelete(item.id)}>削除</button>
      </div>
    </div>
  );
}

// ── メインアプリ ──────────────────────────────────────
export default function App() {
  const [tab, setTab]               = useState("inventory");
  const [cats, setCats]             = useState(() => { try { const s=localStorage.getItem("sm_cats"); return s?JSON.parse(s):CATS_INITIAL; } catch(e) { return CATS_INITIAL; } });
  const [db, setDb]                 = useState(() => { try { const s=localStorage.getItem("sm_db"); return s?JSON.parse(s):INIT_DB; } catch(e) { return INIT_DB; } });
  const [history, setHistory]       = useState(() => { try { const s=localStorage.getItem("sm_history"); return s?JSON.parse(s):INIT_HISTORY; } catch(e) { return INIT_HISTORY; } });
  const [jan, setJan]               = useState("");
  const [loading, setLoading]       = useState(false);
  const [modal, setModal]           = useState(null);
  const [editModal, setEditModal]   = useState(null);
  const [historyModal, setHistoryModal] = useState(null);
  const [arQty, setArQty]           = useState(1);
  const [arCost, setArCost]         = useState("");
  const [arL1, setArL1]             = useState("");
  const [arL2, setArL2]             = useState("");
  const [arL3, setArL3]             = useState("");
  const [arMaker, setArMaker]       = useState("");
  const [arSupplier, setArSupplier] = useState("");
  const [toasts, setToasts]         = useState([]);
  const [fCat, setFCat]             = useState("all");
  const [fTxt, setFTxt]             = useState("");
  const [fHisTxt, setFHisTxt]       = useState("");
  const [fHisFrom, setFHisFrom]     = useState("");
  const [fHisTo, setFHisTo]         = useState("");
  const [editItem, setEditItem]     = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const [isMobile, setIsMobile]     = useState(window.innerWidth < 1024);
  const [addCatModal, setAddCatModal] = useState(null);
  const [newCatName, setNewCatName] = useState("");
  const [newCatEmoji, setNewCatEmoji] = useState("📦");
  const ref = useRef(null);

  useEffect(() => { if(tab==="inventory"&&ref.current) ref.current.focus(); }, [tab]);
  useEffect(() => { const h=()=>setIsMobile(window.innerWidth<1024); window.addEventListener("resize",h); return ()=>window.removeEventListener("resize",h); }, []);
  useEffect(() => { try { localStorage.setItem("sm_db",JSON.stringify(db)); } catch(e) {} }, [db]);
  useEffect(() => { try { localStorage.setItem("sm_cats",JSON.stringify(cats)); } catch(e) {} }, [cats]);
  useEffect(() => { try { localStorage.setItem("sm_history",JSON.stringify(history)); } catch(e) {} }, [history]);

  const addToast = useCallback((msg, type="info") => {
    const id = Date.now()+Math.random();
    setToasts(t=>[...t,{id,msg,type}]);
    setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)),3400);
  }, []);

  // ── カテゴリーCRUD ──────────────────────────────────
  function openAddCat(level, l1id, l2id) { setAddCatModal({level,l1id:l1id||null,l2id:l2id||null}); setNewCatName(""); setNewCatEmoji("📦"); }
  function confirmAddCat() {
    if(!newCatName.trim()){addToast("名前を入力してください","err");return;}
    const id="c"+Date.now(); const {level,l1id,l2id}=addCatModal;
    if(level===1) setCats(c=>[...c,{id,name:newCatName,emoji:newCatEmoji,children:[]}]);
    else if(level===2) setCats(c=>c.map(l1=>l1.id!==l1id?l1:{...l1,children:[...l1.children,{id,name:newCatName,children:[]}]}));
    else setCats(c=>c.map(l1=>l1.id!==l1id?l1:{...l1,children:l1.children.map(l2=>l2.id!==l2id?l2:{...l2,children:[...l2.children,{id,name:newCatName}]})}));
    setAddCatModal(null); addToast("カテゴリーを追加しました","ok");
  }
  function delL1(l1id) { if(!window.confirm("大分類を削除しますか？関連商品の分類がリセットされます。"))return; setCats(c=>c.filter(l1=>l1.id!==l1id)); setDb(d=>d.map(i=>i.catL1===l1id?{...i,catL1:"",catL2:"",catL3:""}:i)); addToast("削除しました","info"); }
  function delL2(l1id,l2id) { if(!window.confirm("中分類を削除しますか？"))return; setCats(c=>c.map(l1=>l1.id!==l1id?l1:{...l1,children:l1.children.filter(l2=>l2.id!==l2id)})); setDb(d=>d.map(i=>i.catL2===l2id?{...i,catL2:"",catL3:""}:i)); addToast("削除しました","info"); }
  function delL3(l1id,l2id,l3id) { if(!window.confirm("小分類を削除しますか？"))return; setCats(c=>c.map(l1=>l1.id!==l1id?l1:{...l1,children:l1.children.map(l2=>l2.id!==l2id?l2:{...l2,children:l2.children.filter(l3=>l3.id!==l3id)})})); setDb(d=>d.map(i=>i.catL3===l3id?{...i,catL3:""}:i)); addToast("削除しました","info"); }

  // ── 商品検索 ─────────────────────────────────────────
  const processJan = useCallback(async (code) => {
    code=code.trim().replace(/\D/g,"");
    if(code.length<8){addToast("8〜13桁のJANコードを入力してください","err");return;}
    const local=PRODUCTS[code];
    if(local){
      const product={jan:code,name:local.name,price:local.price,cost:0,brand:local.brand};
      const existing=db.find(i=>i.jan===code)||null;
      setModal({product,isNew:!existing,existing});
      setArQty(1);setArCost("");setArL1("");setArL2("");setArL3("");
      setArMaker(existing?existing.maker||"":"");setArSupplier(existing?existing.supplier||"":"");
      setJan("");return;
    }
    setLoading(true); addToast("商品情報を検索中…","info");
    try {
      const res=await fetch("/api/search?jan="+encodeURIComponent(code));
      const data=await res.json();
      const product=res.ok&&data.name?{jan:code,name:data.name,price:data.price||0,cost:0,brand:data.brand||""}:{jan:code,name:"商品 (JAN:"+code+")",price:0,cost:0,brand:""};
      if(res.ok&&data.name) addToast("商品情報を取得しました","ok"); else addToast("商品が見つかりません。手入力してください","info");
      const existing=db.find(i=>i.jan===code)||null;
      setModal({product,isNew:!existing,existing});
      setArQty(1);setArCost(String(product.cost||""));setArL1("");setArL2("");setArL3("");
      setArMaker(existing?existing.maker||"":"");setArSupplier(existing?existing.supplier||"":"");
      setJan("");
    } catch(e) {
      const existing=db.find(i=>i.jan===code)||null;
      setModal({product:{jan:code,name:"商品 (JAN:"+code+")",price:0,cost:0,brand:""},isNew:!existing,existing});
      setArQty(1);setArCost("");setArL1("");setArL2("");setArL3("");setArMaker("");setArSupplier("");setJan("");
      addToast("通信エラー。手入力してください","err");
    }
    setLoading(false);
  }, [db,addToast]);

  const handleCameraDetect = useCallback((code) => { setShowCamera(false); addToast("スキャン成功: "+code,"ok"); setTimeout(()=>processJan(code),300); }, [processJan,addToast]);

  function confirmAdd() {
    if(!modal)return;
    const cost=parseInt(arCost)||0;
    const hRecord = { id:Date.now(), date:today(), jan:modal.product.jan, name:modal.product.name, qty:arQty, cost, totalCost:arQty*cost, maker:arMaker, supplier:arSupplier, note:"" };
    if(modal.isNew){
      const item={id:Date.now()+1,jan:modal.product.jan,name:modal.product.name,price:modal.product.price,cost,qty:arQty,reorderPoint:5,catL1:arL1,catL2:arL2,catL3:arL3,maker:arMaker,supplier:arSupplier,addedAt:today()};
      setDb(d=>[item,...d]);
      addToast("新規登録 ("+arQty+"個)","ok");
    } else {
      const prev=modal.existing.qty;
      setDb(d=>d.map(i=>i.jan===modal.product.jan?{...i,qty:i.qty+arQty,cost:cost||i.cost,catL1:arL1||i.catL1,catL2:arL2||i.catL2,catL3:arL3||i.catL3,maker:arMaker||i.maker,supplier:arSupplier||i.supplier}:i));
      addToast("在庫+"+arQty+"個 (計"+(modal.existing.qty+arQty)+"個)","ok");
    }
    if(cost>0) setHistory(h=>[hRecord,...h]);
    setModal(null); if(ref.current)ref.current.focus();
  }

  function saveEditModal() { if(!editModal)return; setDb(d=>d.map(i=>i.id===editModal.id?editModal:i)); setEditModal(null); addToast("保存しました","ok"); }
  function saveEdit(id,field,val) { const isNum=["price","cost","qty","reorderPoint"].includes(field); setDb(d=>d.map(i=>i.id!==id?i:{...i,[field]:isNum?Number(val)||0:val})); setEditItem(null); }

  function confirmAddHistory() {
    if(!historyModal)return;
    const h={...historyModal, id:Date.now(), totalCost:(historyModal.qty||0)*(historyModal.cost||0)};
    setHistory(hist=>[h,...hist]);
    setHistoryModal(null); addToast("仕入れ履歴を追加しました","ok");
  }

  function resetAllData() { if(!window.confirm("全データをリセットしますか？"))return; localStorage.removeItem("sm_db");localStorage.removeItem("sm_cats");localStorage.removeItem("sm_history"); window.location.reload(); }

  const alerts  = useMemo(()=>db.filter(i=>i.qty<=(i.reorderPoint||0)),[db]);
  const totalV  = db.reduce((s,i)=>s+i.price*i.qty,0);
  const totalC  = db.reduce((s,i)=>s+(i.cost||0)*i.qty,0);
  const rows    = useMemo(()=>db.filter(i=>{
    if(fCat==="alert")return i.qty<=(i.reorderPoint||0);
    if(fCat==="")return !i.catL1;
    if(fCat!=="all")return i.catL1===fCat;
    return true;
  }).filter(i=>{ if(!fTxt)return true; const t=fTxt.toLowerCase(); return i.name.toLowerCase().includes(t)||i.jan.includes(t)||(i.maker||"").toLowerCase().includes(t); }),[db,fCat,fTxt]);

  const hisRows = useMemo(()=>history.filter(h=>{
    if(fHisFrom&&h.date<fHisFrom)return false;
    if(fHisTo&&h.date>fHisTo)return false;
    if(fHisTxt){ const t=fHisTxt.toLowerCase(); if(!h.name.toLowerCase().includes(t)&&!h.jan.includes(t)&&!(h.supplier||"").toLowerCase().includes(t)&&!(h.maker||"").toLowerCase().includes(t))return false; }
    return true;
  }).sort((a,b)=>b.date.localeCompare(a.date)),[history,fHisTxt,fHisFrom,fHisTo]);

  const hisTotalCost = hisRows.reduce((s,h)=>s+h.totalCost,0);

  const inpS={background:"#1C2128",border:"1px solid #30363D",borderRadius:6,color:"#E6EDF3",fontFamily:"system-ui,sans-serif",fontSize:13,padding:"8px 10px",outline:"none",width:"100%"};
  const btnP={background:"#1F6FEB",color:"#fff",border:"none",borderRadius:6,cursor:"pointer",fontWeight:700,fontSize:13,padding:"8px 14px"};
  const btnG={background:"transparent",color:"#8B949E",border:"1px solid #30363D",borderRadius:6,cursor:"pointer",fontWeight:600,fontSize:12,padding:"8px 12px"};
  const btnS={background:"rgba(88,166,255,.1)",color:"#58A6FF",border:"1px solid rgba(88,166,255,.3)",borderRadius:6,cursor:"pointer",fontWeight:600,fontSize:11,padding:"3px 8px"};
  const btnD={background:"transparent",color:"#F85149",border:"1px solid rgba(248,81,73,.3)",borderRadius:6,cursor:"pointer",fontSize:11,padding:"3px 8px"};
  const thS={padding:"9px 12px",textAlign:"left",fontSize:10,fontWeight:700,textTransform:"uppercase",color:"#484F58",borderBottom:"1px solid #30363D",whiteSpace:"nowrap"};
  const tdS={padding:"10px 12px",fontSize:12,borderBottom:"1px solid #30363D",verticalAlign:"middle"};
  const eInp={background:"#1C2128",border:"1px solid #58A6FF",borderRadius:4,color:"#E6EDF3",fontFamily:"monospace",fontSize:12,padding:"3px 6px",outline:"none"};

  function EditCell(item,field,display,width,mono){
    const isNum=["price","cost","qty","reorderPoint"].includes(field);
    if(editItem&&editItem.id===item.id&&editItem.field===field){
      return <input autoFocus type={isNum?"number":"text"} defaultValue={item[field]} style={{...eInp,width:width||80}}
        onBlur={e=>saveEdit(item.id,field,e.target.value)}
        onKeyDown={e=>{if(e.key==="Enter")saveEdit(item.id,field,e.target.value);if(e.key==="Escape")setEditItem(null);}}/>;
    }
    return <span style={{cursor:"pointer",fontFamily:mono?"monospace":"inherit"}} onDoubleClick={()=>setEditItem({id:item.id,field})} title="ダブルクリックで編集">{display}</span>;
  }

  return (
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",background:"#0D1117",color:"#E6EDF3",fontFamily:"system-ui,sans-serif",fontSize:14}}>

      {/* TOPBAR */}
      <div style={{height:52,background:"#161B22",borderBottom:"1px solid #30363D",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 16px",position:"sticky",top:0,zIndex:300}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{fontSize:18,fontWeight:800}}>Stock<span style={{color:"#58A6FF"}}>Master</span></div>
          <span style={{fontSize:10,color:"#484F58",fontFamily:"monospace",background:"#21262D",border:"1px solid #30363D",padding:"2px 6px",borderRadius:4}}>💾 自動保存中</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <div style={{textAlign:"right"}}><div style={{fontFamily:"monospace",fontSize:13,fontWeight:600}}>{db.length}</div><div style={{fontSize:9,color:"#484F58"}}>SKU</div></div>
          <div style={{textAlign:"right"}}><div style={{fontFamily:"monospace",fontSize:13,fontWeight:600,color:"#58A6FF"}}>{fmtY(totalV)}</div><div style={{fontSize:9,color:"#484F58"}}>売価</div></div>
          <div style={{textAlign:"right"}}><div style={{fontFamily:"monospace",fontSize:13,fontWeight:600,color:"#3FB950"}}>{fmtY(totalV-totalC)}</div><div style={{fontSize:9,color:"#484F58"}}>含み益</div></div>
          {alerts.length>0&&<div style={{textAlign:"right"}}><div style={{fontFamily:"monospace",fontSize:13,fontWeight:600,color:"#F85149"}}>{alerts.length}</div><div style={{fontSize:9,color:"#484F58"}}>要発注</div></div>}
          <button style={{background:"transparent",border:"1px solid #30363D",borderRadius:4,cursor:"pointer",color:"#484F58",fontSize:10,padding:"3px 8px"}} onClick={resetAllData}>リセット</button>
        </div>
      </div>

      {/* NAV */}
      <div style={{background:"#161B22",borderBottom:"1px solid #30363D",display:"flex",padding:"0 16px",overflowX:"auto"}}>
        {[["inventory","📦 在庫"],["history","📋 仕入れ履歴"],["dashboard","📊 グラフ"],["categories","🗂 分類"]].map(it=>(
          <div key={it[0]} style={{flexShrink:0,padding:"10px 14px",fontSize:13,fontWeight:500,color:tab===it[0]?"#58A6FF":"#8B949E",cursor:"pointer",borderBottom:tab===it[0]?"2px solid #58A6FF":"2px solid transparent"}} onClick={()=>setTab(it[0])}>
            {it[1]}{it[0]==="inventory"&&alerts.length>0&&<span style={{marginLeft:5,background:"#F85149",color:"#fff",fontSize:9,padding:"1px 4px",borderRadius:9,fontWeight:700}}>{alerts.length}</span>}
          </div>
        ))}
      </div>

      {/* 在庫管理タブ */}
      {tab==="inventory"&&(
        <div style={{display:"flex",flexDirection:"column",flex:1,minHeight:0}}>
          <div style={{background:"#161B22",borderBottom:"1px solid #30363D",padding:12}}>
            <div style={{display:"flex",gap:8,maxWidth:600}}>
              <button style={{...btnP,background:"#238636",whiteSpace:"nowrap"}} onClick={()=>setShowCamera(true)}>📷 スキャン</button>
              <input ref={ref} style={{background:"#1C2128",border:"1px solid #30363D",borderRadius:6,color:"#E6EDF3",fontFamily:"monospace",fontSize:14,padding:"8px 10px",outline:"none",flex:1,letterSpacing:1}}
                type="text" inputMode="numeric" placeholder="JANコード手入力"
                value={jan} onChange={e=>setJan(e.target.value.replace(/\D/g,"").slice(0,13))}
                onKeyDown={e=>{if(e.key==="Enter"&&!loading)processJan(jan);}} maxLength={13}/>
              <button style={{...btnP,opacity:loading||!jan.trim()?0.4:1}} onClick={()=>processJan(jan)} disabled={loading||!jan.trim()}>{loading?"…":"検索"}</button>
            </div>
          </div>
          {alerts.length>0&&<div style={{margin:"10px 16px 0",background:"rgba(248,81,73,.1)",border:"1px solid rgba(248,81,73,.3)",borderRadius:8,padding:"8px 12px",color:"#F85149",fontSize:13}}>⚠️ <strong>{alerts.length}件</strong>が発注点以下です</div>}
          <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"nowrap",overflowX:"auto",padding:"10px 16px 0",paddingBottom:4}}>
            {[["all","すべて",db.length],["","未分類",db.filter(i=>!i.catL1).length]].map(x=>(
              <div key={x[0]} style={{flexShrink:0,display:"flex",alignItems:"center",gap:4,padding:"5px 12px",borderRadius:20,border:fCat===x[0]?"1px solid #1F6FEB":"1px solid #30363D",background:fCat===x[0]?"#1F6FEB":"#21262D",fontSize:12,fontWeight:500,color:fCat===x[0]?"#fff":"#8B949E",cursor:"pointer"}} onClick={()=>setFCat(x[0])}>
                {x[1]}<span style={{fontSize:9,fontFamily:"monospace",opacity:.7,marginLeft:2}}>{x[2]}</span>
              </div>
            ))}
            {alerts.length>0&&<div style={{flexShrink:0,display:"flex",alignItems:"center",gap:4,padding:"5px 12px",borderRadius:20,border:fCat==="alert"?"1px solid #F85149":"1px solid rgba(248,81,73,.4)",background:fCat==="alert"?"#F85149":"rgba(248,81,73,.1)",fontSize:12,fontWeight:500,color:fCat==="alert"?"#fff":"#F85149",cursor:"pointer"}} onClick={()=>setFCat("alert")}>⚠ 要発注<span style={{fontSize:9,fontFamily:"monospace",opacity:.8,marginLeft:2}}>{alerts.length}</span></div>}
            {cats.map(cat=>(
              <div key={cat.id} style={{flexShrink:0,display:"flex",alignItems:"center",gap:4,padding:"5px 12px",borderRadius:20,border:fCat===cat.id?"1px solid #1F6FEB":"1px solid #30363D",background:fCat===cat.id?"#1F6FEB":"#21262D",fontSize:12,fontWeight:500,color:fCat===cat.id?"#fff":"#8B949E",cursor:"pointer"}} onClick={()=>setFCat(cat.id)}>
                {cat.emoji} {cat.name}<span style={{fontSize:9,fontFamily:"monospace",opacity:.7,marginLeft:2}}>{db.filter(i=>i.catL1===cat.id).length}</span>
              </div>
            ))}
          </div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 16px 6px"}}>
            <div style={{fontSize:14,fontWeight:700}}>商品マスタ一覧 <span style={{fontSize:12,color:"#484F58",fontWeight:400}}>({rows.length}件)</span></div>
            <div style={{display:"flex",gap:6}}>
              <input style={{background:"#21262D",border:"1px solid #30363D",borderRadius:6,color:"#E6EDF3",fontSize:12,padding:"6px 10px",outline:"none",width:120}} placeholder="商品名/JAN/メーカー…" value={fTxt} onChange={e=>setFTxt(e.target.value)}/>
              <button style={{background:"rgba(63,185,80,.12)",color:"#3FB950",border:"1px solid rgba(63,185,80,.3)",borderRadius:6,cursor:"pointer",fontWeight:600,fontSize:12,padding:"6px 10px"}} onClick={()=>{exportCSV(db,cats);addToast("CSV出力しました","ok");}}>⬇ CSV</button>
              <button style={{background:"rgba(210,153,34,.12)",color:"#D29922",border:"1px solid rgba(210,153,34,.3)",borderRadius:6,cursor:"pointer",fontWeight:600,fontSize:12,padding:"6px 10px"}} onClick={()=>{exportInventoryCSV(db,cats);addToast("棚卸しCSVを出力しました","ok");}}>📋 棚卸し</button>
            </div>
          </div>
          {isMobile?(
            <div style={{padding:"0 16px 20px",flex:1,overflowY:"auto"}}>
              {rows.length===0?<div style={{padding:"40px 20px",textAlign:"center",color:"#484F58"}}><div style={{fontSize:40,marginBottom:8}}>📋</div>商品がありません</div>
                :rows.map(item=><ItemCard key={item.id} item={item} cats={cats} onEdit={setEditModal} onDelete={id=>{setDb(d=>d.filter(i=>i.id!==id));addToast("削除しました","info");}}/>)}
            </div>
          ):(
            <div style={{flex:1,overflow:"auto",padding:"0 16px 20px"}}>
              {rows.length===0?<div style={{padding:"40px 20px",textAlign:"center",color:"#484F58"}}><div style={{fontSize:40,marginBottom:8}}>📋</div>商品がありません</div>:(
                <div style={{background:"#21262D",borderRadius:8,border:"1px solid #30363D",overflow:"hidden",marginTop:4}}>
                  <table style={{width:"100%",borderCollapse:"collapse",minWidth:1000}}>
                    <thead><tr style={{background:"#1C2128"}}>{["JAN","商品名","大分類","小分類","メーカー","仕入れ先","単価","仕入れ値","粗利率","在庫","発注点","状態","登録日",""].map(h=><th key={h} style={thS}>{h}</th>)}</tr></thead>
                    <tbody>
                      {rows.map(item=>{
                        const m=calcM(item.price,item.cost); const isAl=item.qty<=(item.reorderPoint||0);
                        const l1=findL1(cats,item.catL1); const l3=findL3(cats,item.catL1,item.catL2,item.catL3);
                        return (
                          <tr key={item.id}>
                            <td style={{...tdS,fontFamily:"monospace",fontSize:10,color:"#484F58"}}>{item.jan}</td>
                            <td style={{...tdS,maxWidth:150}}>{EditCell(item,"name",item.name,130,false)}</td>
                            <td style={tdS}>{l1?<span style={{fontSize:11,fontWeight:600}}>{l1.emoji} {l1.name}</span>:<span style={{color:"#484F58",fontSize:11}}>—</span>}</td>
                            <td style={{...tdS,fontSize:11,color:"#8B949E",maxWidth:100}}>{l3?l3.name:"—"}</td>
                            <td style={{...tdS,maxWidth:100}}>{EditCell(item,"maker",item.maker||"—",90,false)}</td>
                            <td style={{...tdS,maxWidth:100}}>{EditCell(item,"supplier",item.supplier||"—",90,false)}</td>
                            <td style={{...tdS,fontFamily:"monospace",color:"#58A6FF",fontWeight:600}}>{EditCell(item,"price",fmtY(item.price),80,true)}</td>
                            <td style={{...tdS,fontFamily:"monospace",color:"#8B949E"}}>{EditCell(item,"cost",item.cost?fmtY(item.cost):"—",80,true)}</td>
                            <td style={{...tdS,fontFamily:"monospace",fontWeight:600,color:mCol(m)}}>{m!==null?m+"%":"—"}</td>
                            <td style={{...tdS,fontFamily:"monospace",fontWeight:700}}>{EditCell(item,"qty",item.qty,60,true)}</td>
                            <td style={{...tdS,fontFamily:"monospace",color:"#484F58"}}>{EditCell(item,"reorderPoint",item.reorderPoint||0,60,true)}</td>
                            <td style={tdS}>{item.qty===0?<span style={{background:"rgba(248,81,73,.12)",color:"#F85149",padding:"2px 6px",borderRadius:4,fontSize:10,fontWeight:700}}>在庫なし</span>:isAl?<span style={{background:"rgba(248,81,73,.12)",color:"#F85149",padding:"2px 6px",borderRadius:4,fontSize:10,fontWeight:700}}>⚠発注要</span>:item.qty<=5?<span style={{background:"rgba(210,153,34,.12)",color:"#D29922",padding:"2px 6px",borderRadius:4,fontSize:10,fontWeight:700}}>残りわずか</span>:<span style={{background:"rgba(63,185,80,.12)",color:"#3FB950",padding:"2px 6px",borderRadius:4,fontSize:10,fontWeight:700}}>在庫あり</span>}</td>
                            <td style={{...tdS,fontSize:10,color:"#484F58"}}>{item.addedAt}</td>
                            <td style={tdS}><button style={btnD} onClick={()=>{setDb(d=>d.filter(i=>i.id!==item.id));addToast("削除しました","info");}}>削除</button></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {rows.length>0&&<div style={{marginTop:6,fontSize:11,color:"#484F58"}}>💡 各セルをダブルクリックで編集できます</div>}
            </div>
          )}
        </div>
      )}

      {/* 仕入れ履歴タブ */}
      {tab==="history"&&(
        <div style={{display:"flex",flexDirection:"column",flex:1,minHeight:0}}>
          <div style={{background:"#161B22",borderBottom:"1px solid #30363D",padding:12}}>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
              <input style={{...inpS,width:130}} type="date" value={fHisFrom} onChange={e=>setFHisFrom(e.target.value)} placeholder="開始日"/>
              <span style={{color:"#484F58",fontSize:12}}>〜</span>
              <input style={{...inpS,width:130}} type="date" value={fHisTo} onChange={e=>setFHisTo(e.target.value)} placeholder="終了日"/>
              <input style={{...inpS,flex:1,minWidth:120}} type="text" placeholder="商品名/JAN/メーカー/仕入れ先…" value={fHisTxt} onChange={e=>setFHisTxt(e.target.value)}/>
              {(fHisFrom||fHisTo||fHisTxt)&&<button style={btnG} onClick={()=>{setFHisFrom("");setFHisTo("");setFHisTxt("");}}>クリア</button>}
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 16px 6px"}}>
            <div style={{fontSize:14,fontWeight:700}}>仕入れ履歴 <span style={{fontSize:12,color:"#484F58",fontWeight:400}}>({hisRows.length}件 / 合計 <span style={{color:"#F85149",fontWeight:600}}>{fmtY(hisTotalCost)}</span>)</span></div>
            <div style={{display:"flex",gap:6}}>
              <button style={{...btnP,background:"#238636"}} onClick={()=>setHistoryModal({date:today(),jan:"",name:"",qty:1,cost:0,totalCost:0,maker:"",supplier:"",note:""})}>+ 手動追加</button>
              <button style={{background:"rgba(63,185,80,.12)",color:"#3FB950",border:"1px solid rgba(63,185,80,.3)",borderRadius:6,cursor:"pointer",fontWeight:600,fontSize:12,padding:"6px 10px"}} onClick={()=>{exportHistoryCSV(hisRows);addToast("履歴CSVを出力しました","ok");}}>⬇ CSV</button>
            </div>
          </div>
          <div style={{flex:1,overflow:"auto",padding:"0 16px 20px"}}>
            {hisRows.length===0?<div style={{padding:"40px 20px",textAlign:"center",color:"#484F58"}}><div style={{fontSize:40,marginBottom:8}}>📋</div>履歴がありません</div>:(
              isMobile?(
                <div>
                  {hisRows.map(h=>(
                    <div key={h.id} style={{background:"#21262D",border:"1px solid #30363D",borderRadius:10,padding:14,marginBottom:10}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                        <span style={{fontFamily:"monospace",fontSize:12,color:"#58A6FF",fontWeight:600}}>{h.date}</span>
                        <button style={btnD} onClick={()=>{setHistory(hist=>hist.filter(x=>x.id!==h.id));addToast("削除しました","info");}}>削除</button>
                      </div>
                      <div style={{fontWeight:600,fontSize:13,marginBottom:4}}>{h.name}</div>
                      <div style={{fontFamily:"monospace",fontSize:10,color:"#484F58",marginBottom:8}}>{h.jan}</div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:8}}>
                        <div style={{background:"#1C2128",borderRadius:6,padding:"6px 8px"}}><div style={{fontSize:9,color:"#484F58",marginBottom:2}}>仕入れ数</div><div style={{fontFamily:"monospace",fontWeight:700,fontSize:16}}>{h.qty}</div></div>
                        <div style={{background:"#1C2128",borderRadius:6,padding:"6px 8px"}}><div style={{fontSize:9,color:"#484F58",marginBottom:2}}>単価</div><div style={{fontFamily:"monospace",fontWeight:700,color:"#8B949E",fontSize:13}}>{fmtY(h.cost)}</div></div>
                        <div style={{background:"#1C2128",borderRadius:6,padding:"6px 8px"}}><div style={{fontSize:9,color:"#484F58",marginBottom:2}}>合計</div><div style={{fontFamily:"monospace",fontWeight:700,color:"#F85149",fontSize:13}}>{fmtY(h.totalCost)}</div></div>
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4,fontSize:11,color:"#8B949E"}}>
                        {h.maker&&<div>メーカー: <span style={{color:"#E6EDF3"}}>{h.maker}</span></div>}
                        {h.supplier&&<div>仕入れ先: <span style={{color:"#E6EDF3"}}>{h.supplier}</span></div>}
                      </div>
                      {h.note&&<div style={{marginTop:6,fontSize:11,color:"#8B949E"}}>備考: {h.note}</div>}
                    </div>
                  ))}
                </div>
              ):(
                <div style={{background:"#21262D",borderRadius:8,border:"1px solid #30363D",overflow:"hidden",marginTop:4}}>
                  <table style={{width:"100%",borderCollapse:"collapse",minWidth:800}}>
                    <thead><tr style={{background:"#1C2128"}}>{["仕入れ日","商品名","JANコード","仕入れ数","仕入れ単価","仕入れ合計","メーカー","仕入れ先","備考",""].map(h=><th key={h} style={thS}>{h}</th>)}</tr></thead>
                    <tbody>
                      {hisRows.map(h=>(
                        <tr key={h.id}>
                          <td style={{...tdS,fontFamily:"monospace",color:"#58A6FF",fontWeight:600,whiteSpace:"nowrap"}}>{h.date}</td>
                          <td style={{...tdS,maxWidth:160}}>{h.name}</td>
                          <td style={{...tdS,fontFamily:"monospace",fontSize:10,color:"#484F58"}}>{h.jan}</td>
                          <td style={{...tdS,fontFamily:"monospace",fontWeight:700,textAlign:"right"}}>{h.qty}</td>
                          <td style={{...tdS,fontFamily:"monospace",color:"#8B949E",textAlign:"right"}}>{fmtY(h.cost)}</td>
                          <td style={{...tdS,fontFamily:"monospace",fontWeight:700,color:"#F85149",textAlign:"right"}}>{fmtY(h.totalCost)}</td>
                          <td style={{...tdS,color:"#8B949E"}}>{h.maker||"—"}</td>
                          <td style={{...tdS,color:"#8B949E"}}>{h.supplier||"—"}</td>
                          <td style={{...tdS,color:"#484F58",maxWidth:120}}>{h.note||"—"}</td>
                          <td style={tdS}><button style={btnD} onClick={()=>{setHistory(hist=>hist.filter(x=>x.id!==h.id));addToast("削除しました","info");}}>削除</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>
        </div>
      )}

      {/* グラフタブ */}
      {tab==="dashboard"&&(
        <div style={{padding:16,display:"flex",flexDirection:"column",gap:14}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10}}>
            {[{l:"売価評価額",v:fmtY(totalV),col:"#58A6FF"},{l:"原価評価額",v:fmtY(totalC),col:"#E6EDF3"},{l:"含み益",v:fmtY(totalV-totalC),col:"#3FB950"},{l:"要発注",v:alerts.length+"件",col:"#F85149"}].map(k=>(
              <div key={k.l} style={{background:"#21262D",border:"1px solid #30363D",borderRadius:8,padding:14}}>
                <div style={{fontSize:10,textTransform:"uppercase",color:"#484F58",marginBottom:4}}>{k.l}</div>
                <div style={{fontFamily:"monospace",fontSize:20,fontWeight:600,color:k.col}}>{k.v}</div>
              </div>
            ))}
          </div>
          <div style={{background:"#21262D",border:"1px solid #30363D",borderRadius:8,padding:16}}>
            <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>大分類別 在庫評価額</div>
            {cats.map(cat=>{
              const val=db.filter(i=>i.catL1===cat.id).reduce((s,i)=>s+i.price*i.qty,0);
              if(!val)return null;
              return <div key={cat.id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}><div style={{width:90,fontSize:11,color:"#8B949E",textAlign:"right"}}>{cat.emoji} {cat.name}</div><div style={{flex:1,height:16,background:"#1C2128",borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:Math.min(100,val/totalV*100)+"%",background:"#58A6FF",borderRadius:3}}></div></div><div style={{width:70,fontFamily:"monospace",fontSize:10,color:"#8B949E"}}>{fmtY(val)}</div></div>;
            })}
          </div>
          <div style={{background:"#21262D",border:"1px solid #30363D",borderRadius:8,padding:16}}>
            <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>商品別 粗利率ランキング</div>
            {db.filter(i=>i.cost).sort((a,b)=>calcM(b.price,b.cost)-calcM(a.price,a.cost)).slice(0,6).map(item=>{
              const m=calcM(item.price,item.cost);
              return <div key={item.id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}><div style={{width:90,fontSize:10,color:"#8B949E",textAlign:"right"}}>{item.name.slice(0,9)}{item.name.length>9?"…":""}</div><div style={{flex:1,height:16,background:"#1C2128",borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:m+"%",background:mCol(m),borderRadius:3}}></div></div><div style={{width:36,fontFamily:"monospace",fontSize:10,color:mCol(m),fontWeight:700}}>{m}%</div></div>;
            })}
          </div>
          {alerts.length>0&&(
            <div style={{background:"#21262D",border:"1px solid #30363D",borderRadius:8,padding:16}}>
              <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>⚠️ 発注アラート</div>
              {alerts.map(item=>(
                <div key={item.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid #30363D",fontSize:12}}>
                  <div>{item.name.slice(0,16)}{item.name.length>16?"…":""}</div>
                  <div style={{display:"flex",gap:12,fontFamily:"monospace",fontSize:11}}>
                    <span style={{color:"#F85149",fontWeight:700}}>在庫:{item.qty}</span>
                    <span style={{color:"#484F58"}}>発注点:{item.reorderPoint||0}</span>
                    <span style={{color:"#F85149",fontWeight:700}}>不足:{Math.max(0,(item.reorderPoint||0)-item.qty)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 分類タブ */}
      {tab==="categories"&&(
        <div style={{padding:16}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div style={{fontSize:16,fontWeight:700}}>カテゴリー管理</div>
            <button style={btnP} onClick={()=>openAddCat(1)}>+ 大分類を追加</button>
          </div>
          {cats.map(l1=>(
            <div key={l1.id} style={{background:"#21262D",border:"1px solid #30363D",borderRadius:8,padding:14,marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:22}}>{l1.emoji}</span>
                  <div><div style={{fontWeight:700,fontSize:15}}>{l1.name}</div><div style={{fontSize:11,color:"#484F58"}}>{db.filter(i=>i.catL1===l1.id).length} 商品</div></div>
                </div>
                <div style={{display:"flex",gap:6}}>
                  <button style={btnS} onClick={()=>openAddCat(2,l1.id)}>+ 中分類</button>
                  <button style={btnD} onClick={()=>delL1(l1.id)}>削除</button>
                </div>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {l1.children.map(l2=>(
                  <div key={l2.id} style={{background:"#1C2128",borderRadius:6,padding:"10px 12px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                      <div style={{fontSize:13,fontWeight:600}}>{l2.name}</div>
                      <div style={{display:"flex",gap:6}}>
                        <button style={btnS} onClick={()=>openAddCat(3,l1.id,l2.id)}>+ 小分類</button>
                        <button style={btnD} onClick={()=>delL2(l1.id,l2.id)}>削除</button>
                      </div>
                    </div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                      {l2.children.map(l3=>(
                        <div key={l3.id} style={{display:"flex",alignItems:"center",gap:4,background:"#0D1117",border:"1px solid #30363D",borderRadius:4,padding:"3px 8px"}}>
                          <span style={{fontSize:11,color:"#8B949E"}}>{l3.name}</span>
                          <span style={{fontSize:10,color:"#484F58"}}>({db.filter(i=>i.catL3===l3.id).length})</span>
                          <button style={{background:"transparent",border:"none",cursor:"pointer",color:"#F85149",fontSize:12,padding:"0 2px",lineHeight:1}} onClick={()=>delL3(l1.id,l2.id,l3.id)}>×</button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* カメラスキャナー */}
      {showCamera&&<CameraScanner onDetected={handleCameraDetect} onClose={()=>setShowCamera(false)}/>}

      {/* スキャン登録モーダル */}
      {modal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={e=>{if(e.target===e.currentTarget)setModal(null);}}>
          <div style={{background:"#161B22",border:"1px solid #444C56",borderRadius:10,width:"100%",maxWidth:480,boxShadow:"0 20px 60px rgba(0,0,0,.5)",maxHeight:"90vh",overflowY:"auto"}}>
            <div style={{padding:"14px 16px",borderBottom:"1px solid #30363D",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,background:"#161B22"}}>
              <div style={{fontSize:14,fontWeight:700}}>{modal.isNew?"✨ 新規商品を登録":"📦 在庫を追加"}</div>
              <button style={{background:"transparent",border:"none",cursor:"pointer",color:"#8B949E",fontSize:18}} onClick={()=>setModal(null)}>×</button>
            </div>
            <div style={{padding:"14px 16px"}}>
              <div style={{background:modal.isNew?"rgba(63,185,80,.12)":"rgba(88,166,255,.1)",borderRadius:7,padding:"8px 12px",fontSize:12,color:modal.isNew?"#3FB950":"#58A6FF",fontWeight:600,marginBottom:12}}>
                {modal.isNew?"🆕 未登録: 新規登録します":"🔄 登録済み (現在 "+modal.existing.qty+"個) → 在庫加算"}
              </div>
              <div style={{background:"#1C2128",borderRadius:7,padding:12,marginBottom:12,border:"1px solid #30363D"}}>
                <div style={{marginBottom:8}}><div style={{fontSize:11,color:"#8B949E",marginBottom:4}}>商品名</div><input style={inpS} type="text" value={modal.product.name} onChange={e=>{const v=e.target.value;setModal(m=>({...m,product:{...m.product,name:v}}));}}/></div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  <div><div style={{fontSize:11,color:"#8B949E",marginBottom:4}}>単価（円）</div><input style={inpS} type="number" min="0" value={modal.product.price} onChange={e=>{const v=e.target.value;setModal(m=>({...m,product:{...m.product,price:Number(v)||0}}));}}/></div>
                  <div><div style={{fontSize:11,color:"#8B949E",marginBottom:4}}>JAN</div><div style={{fontFamily:"monospace",fontSize:12,color:"#484F58",padding:"9px 10px",background:"#0D1117",borderRadius:6,border:"1px solid #30363D"}}>{modal.product.jan}</div></div>
                </div>
              </div>
              {modal.isNew&&(
                <>
                  <div style={{marginBottom:12}}><div style={{fontSize:11,color:"#8B949E",marginBottom:4}}>仕入れ値（円）</div><input style={inpS} type="number" min="0" placeholder="0" value={arCost} onChange={e=>setArCost(e.target.value)}/>{arCost&&calcM(modal.product.price,Number(arCost))!==null&&<div style={{fontSize:10,color:"#484F58",marginTop:2}}>粗利率: <span style={{fontWeight:700,color:mCol(calcM(modal.product.price,Number(arCost)))}}>{calcM(modal.product.price,Number(arCost))}%</span></div>}</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
                    <div><div style={{fontSize:11,color:"#8B949E",marginBottom:4}}>メーカー</div><input style={inpS} type="text" placeholder="例：ユニ・チャーム" value={arMaker} onChange={e=>setArMaker(e.target.value)}/></div>
                    <div><div style={{fontSize:11,color:"#8B949E",marginBottom:4}}>仕入れ先</div><input style={inpS} type="text" placeholder="例：〇〇商事" value={arSupplier} onChange={e=>setArSupplier(e.target.value)}/></div>
                  </div>
                  <div style={{marginBottom:12}}><CategorySelect cats={cats} l1={arL1} l2={arL2} l3={arL3} onChange={(l1,l2,l3)=>{setArL1(l1);setArL2(l2);setArL3(l3);}} inpS={inpS}/></div>
                </>
              )}
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"#1C2128",borderRadius:7,padding:"10px 14px",border:"1px solid #30363D"}}>
                <span style={{fontSize:12,color:"#8B949E"}}>入庫数量</span>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <button style={{width:32,height:32,border:"1px solid #444C56",borderRadius:7,background:"#2D333B",color:"#E6EDF3",cursor:"pointer",fontSize:18}} onClick={()=>setArQty(q=>Math.max(1,q-1))}>-</button>
                  <span style={{fontFamily:"monospace",fontSize:22,fontWeight:700,minWidth:40,textAlign:"center"}}>{arQty}</span>
                  <button style={{width:32,height:32,border:"1px solid #444C56",borderRadius:7,background:"#2D333B",color:"#E6EDF3",cursor:"pointer",fontSize:18}} onClick={()=>setArQty(q=>q+1)}>+</button>
                </div>
              </div>
            </div>
            <div style={{padding:"12px 16px",borderTop:"1px solid #30363D",display:"flex",justifyContent:"flex-end",gap:8}}>
              <button style={btnG} onClick={()=>setModal(null)}>キャンセル</button>
              <button style={btnP} onClick={confirmAdd}>{modal.isNew?"✨ 新規登録する":"📦 在庫を加算する"}</button>
            </div>
          </div>
        </div>
      )}

      {/* 編集モーダル */}
      {editModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={e=>{if(e.target===e.currentTarget)setEditModal(null);}}>
          <div style={{background:"#161B22",border:"1px solid #444C56",borderRadius:10,width:"100%",maxWidth:480,boxShadow:"0 20px 60px rgba(0,0,0,.5)",maxHeight:"90vh",overflowY:"auto"}}>
            <div style={{padding:"14px 16px",borderBottom:"1px solid #30363D",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,background:"#161B22"}}>
              <div style={{fontSize:14,fontWeight:700}}>✏ 商品を編集</div>
              <button style={{background:"transparent",border:"none",cursor:"pointer",color:"#8B949E",fontSize:18}} onClick={()=>setEditModal(null)}>×</button>
            </div>
            <div style={{padding:"14px 16px",display:"flex",flexDirection:"column",gap:10}}>
              <div><div style={{fontSize:11,color:"#8B949E",marginBottom:4}}>商品名</div><input style={inpS} type="text" value={editModal.name} onChange={e=>setEditModal(m=>({...m,name:e.target.value}))}/></div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                <div><div style={{fontSize:11,color:"#8B949E",marginBottom:4}}>単価（円）</div><input style={inpS} type="number" min="0" value={editModal.price} onChange={e=>setEditModal(m=>({...m,price:Number(e.target.value)||0}))}/></div>
                <div><div style={{fontSize:11,color:"#8B949E",marginBottom:4}}>仕入れ値（円）</div><input style={inpS} type="number" min="0" value={editModal.cost||""} onChange={e=>setEditModal(m=>({...m,cost:Number(e.target.value)||0}))}/></div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                <div><div style={{fontSize:11,color:"#8B949E",marginBottom:4}}>在庫数</div><input style={inpS} type="number" min="0" value={editModal.qty} onChange={e=>setEditModal(m=>({...m,qty:Number(e.target.value)||0}))}/></div>
                <div><div style={{fontSize:11,color:"#8B949E",marginBottom:4}}>発注点</div><input style={inpS} type="number" min="0" value={editModal.reorderPoint||0} onChange={e=>setEditModal(m=>({...m,reorderPoint:Number(e.target.value)||0}))}/></div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                <div><div style={{fontSize:11,color:"#8B949E",marginBottom:4}}>メーカー</div><input style={inpS} type="text" value={editModal.maker||""} onChange={e=>setEditModal(m=>({...m,maker:e.target.value}))}/></div>
                <div><div style={{fontSize:11,color:"#8B949E",marginBottom:4}}>仕入れ先</div><input style={inpS} type="text" value={editModal.supplier||""} onChange={e=>setEditModal(m=>({...m,supplier:e.target.value}))}/></div>
              </div>
              <CategorySelect cats={cats} l1={editModal.catL1||""} l2={editModal.catL2||""} l3={editModal.catL3||""} onChange={(l1,l2,l3)=>setEditModal(m=>({...m,catL1:l1,catL2:l2,catL3:l3}))} inpS={inpS}/>
            </div>
            <div style={{padding:"12px 16px",borderTop:"1px solid #30363D",display:"flex",justifyContent:"flex-end",gap:8}}>
              <button style={btnG} onClick={()=>setEditModal(null)}>キャンセル</button>
              <button style={btnP} onClick={saveEditModal}>💾 保存する</button>
            </div>
          </div>
        </div>
      )}

      {/* 仕入れ履歴 手動追加モーダル */}
      {historyModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={e=>{if(e.target===e.currentTarget)setHistoryModal(null);}}>
          <div style={{background:"#161B22",border:"1px solid #444C56",borderRadius:10,width:"100%",maxWidth:480,boxShadow:"0 20px 60px rgba(0,0,0,.5)",maxHeight:"90vh",overflowY:"auto"}}>
            <div style={{padding:"14px 16px",borderBottom:"1px solid #30363D",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,background:"#161B22"}}>
              <div style={{fontSize:14,fontWeight:700}}>📋 仕入れ履歴を追加</div>
              <button style={{background:"transparent",border:"none",cursor:"pointer",color:"#8B949E",fontSize:18}} onClick={()=>setHistoryModal(null)}>×</button>
            </div>
            <div style={{padding:"14px 16px",display:"flex",flexDirection:"column",gap:10}}>
              <div><div style={{fontSize:11,color:"#8B949E",marginBottom:4}}>仕入れ日 <span style={{color:"#F85149"}}>*</span></div><input style={inpS} type="date" value={historyModal.date} onChange={e=>setHistoryModal(m=>({...m,date:e.target.value}))}/></div>
              <div><div style={{fontSize:11,color:"#8B949E",marginBottom:4}}>商品名 <span style={{color:"#F85149"}}>*</span></div>
                <input style={inpS} type="text" placeholder="商品名を入力" value={historyModal.name} onChange={e=>setHistoryModal(m=>({...m,name:e.target.value}))}/>
                <div style={{marginTop:4}}>
                  <select style={{...inpS,fontSize:11}} onChange={e=>{const item=db.find(i=>i.id===Number(e.target.value));if(item)setHistoryModal(m=>({...m,jan:item.jan,name:item.name,cost:item.cost||0,maker:item.maker||"",supplier:item.supplier||"",totalCost:(m.qty||1)*(item.cost||0)}));}}>
                    <option value="">← 商品マスタから選択</option>
                    {db.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}
                  </select>
                </div>
              </div>
              <div><div style={{fontSize:11,color:"#8B949E",marginBottom:4}}>JANコード</div><input style={inpS} type="text" placeholder="JANコード" value={historyModal.jan} onChange={e=>setHistoryModal(m=>({...m,jan:e.target.value}))}/></div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                <div><div style={{fontSize:11,color:"#8B949E",marginBottom:4}}>仕入れ数量 <span style={{color:"#F85149"}}>*</span></div><input style={inpS} type="number" min="1" value={historyModal.qty} onChange={e=>setHistoryModal(m=>({...m,qty:Number(e.target.value)||1,totalCost:(Number(e.target.value)||1)*(m.cost||0)}))}/></div>
                <div><div style={{fontSize:11,color:"#8B949E",marginBottom:4}}>仕入れ単価（円）</div><input style={inpS} type="number" min="0" value={historyModal.cost} onChange={e=>setHistoryModal(m=>({...m,cost:Number(e.target.value)||0,totalCost:(m.qty||1)*(Number(e.target.value)||0)}))}/></div>
              </div>
              <div style={{background:"#1C2128",borderRadius:6,padding:"8px 12px",fontSize:12,color:"#E6EDF3"}}>仕入れ合計: <span style={{fontFamily:"monospace",fontWeight:700,color:"#F85149",fontSize:14}}>{fmtY(historyModal.totalCost)}</span></div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                <div><div style={{fontSize:11,color:"#8B949E",marginBottom:4}}>メーカー</div><input style={inpS} type="text" placeholder="例：ユニ・チャーム" value={historyModal.maker} onChange={e=>setHistoryModal(m=>({...m,maker:e.target.value}))}/></div>
                <div><div style={{fontSize:11,color:"#8B949E",marginBottom:4}}>仕入れ先</div><input style={inpS} type="text" placeholder="例：〇〇商事" value={historyModal.supplier} onChange={e=>setHistoryModal(m=>({...m,supplier:e.target.value}))}/></div>
              </div>
              <div><div style={{fontSize:11,color:"#8B949E",marginBottom:4}}>備考</div><input style={inpS} type="text" placeholder="メモ・備考など" value={historyModal.note} onChange={e=>setHistoryModal(m=>({...m,note:e.target.value}))}/></div>
            </div>
            <div style={{padding:"12px 16px",borderTop:"1px solid #30363D",display:"flex",justifyContent:"flex-end",gap:8}}>
              <button style={btnG} onClick={()=>setHistoryModal(null)}>キャンセル</button>
              <button style={btnP} onClick={confirmAddHistory}>追加する</button>
            </div>
          </div>
        </div>
      )}

      {/* カテゴリー追加モーダル */}
      {addCatModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={e=>{if(e.target===e.currentTarget)setAddCatModal(null);}}>
          <div style={{background:"#161B22",border:"1px solid #444C56",borderRadius:10,width:"100%",maxWidth:380,boxShadow:"0 20px 60px rgba(0,0,0,.5)"}}>
            <div style={{padding:"14px 16px",borderBottom:"1px solid #30363D",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{fontSize:14,fontWeight:700}}>{addCatModal.level===1?"大分類を追加":addCatModal.level===2?"中分類を追加":"小分類を追加"}</div>
              <button style={{background:"transparent",border:"none",cursor:"pointer",color:"#8B949E",fontSize:18}} onClick={()=>setAddCatModal(null)}>×</button>
            </div>
            <div style={{padding:"14px 16px"}}>
              <div style={{marginBottom:12}}><div style={{fontSize:11,color:"#8B949E",marginBottom:4}}>名前</div><input style={inpS} autoFocus type="text" placeholder={addCatModal.level===1?"例：介護用品":addCatModal.level===2?"例：排泄ケア":"例：紙おむつ（パンツ型）"} value={newCatName} onChange={e=>setNewCatName(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")confirmAddCat();}}/></div>
              {addCatModal.level===1&&(
                <div><div style={{fontSize:11,color:"#8B949E",marginBottom:6}}>アイコン</div><div style={{display:"flex",flexWrap:"wrap",gap:6}}>{EMOJIS.map(em=><span key={em} style={{fontSize:22,cursor:"pointer",padding:4,borderRadius:6,border:newCatEmoji===em?"2px solid #58A6FF":"2px solid transparent",background:newCatEmoji===em?"#1C2128":"transparent"}} onClick={()=>setNewCatEmoji(em)}>{em}</span>)}</div></div>
              )}
            </div>
            <div style={{padding:"12px 16px",borderTop:"1px solid #30363D",display:"flex",justifyContent:"flex-end",gap:8}}>
              <button style={btnG} onClick={()=>setAddCatModal(null)}>キャンセル</button>
              <button style={btnP} onClick={confirmAddCat}>追加する</button>
            </div>
          </div>
        </div>
      )}

      {/* トースト */}
      <div style={{position:"fixed",bottom:18,right:16,display:"flex",flexDirection:"column",gap:7,zIndex:999}}>
        {toasts.map(t=>(
          <div key={t.id} style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",borderRadius:7,fontSize:12,fontWeight:500,background:"#2D333B",color:"#E6EDF3",borderLeft:"3px solid "+(t.type==="ok"?"#3FB950":t.type==="err"?"#F85149":"#58A6FF"),boxShadow:"0 6px 20px rgba(0,0,0,.4)",minWidth:180}}>
            {t.type==="ok"?"✓":t.type==="err"?"✕":"ℹ"} {t.msg}
          </div>
        ))}
      </div>
    </div>
  );
}
