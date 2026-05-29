import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";

// ── 内蔵商品データベース ──────────────────────────────────────────
const PRODUCTS = {
  "4901777317895": { name:"コカ・コーラ 500ml", price:180, brand:"コカ・コーラ" },
  "4901777318090": { name:"コカ・コーラ ゼロ 500ml", price:180, brand:"コカ・コーラ" },
  "4571245494429": { name:"キリン一番搾り 350ml×24本", price:3980, brand:"キリン" },
  "4901085628081": { name:"サントリー 天然水 550ml", price:140, brand:"サントリー" },
  "4901001135232": { name:"午後の紅茶 ストレート 500ml", price:160, brand:"キリン" },
  "4901085645674": { name:"伊右衛門 緑茶 600ml", price:160, brand:"サントリー" },
  "4902102114775": { name:"ポカリスエット 500ml", price:160, brand:"大塚製薬" },
  "4902105047422": { name:"カップヌードル レギュラー", price:240, brand:"日清食品" },
  "4902105049853": { name:"カップヌードル シーフード", price:240, brand:"日清食品" },
  "4901990513401": { name:"どん兵衛 きつねうどん", price:240, brand:"日清食品" },
  "4901335018062": { name:"カルビーポテトチップス うすしお 60g", price:150, brand:"カルビー" },
  "4901335018147": { name:"カルビーポテトチップス のり塩 60g", price:150, brand:"カルビー" },
  "4908110350019": { name:"じゃがりこ サラダ 60g", price:160, brand:"カルビー" },
  "4901330542238": { name:"きのこの山 74g", price:280, brand:"明治" },
  "4901330542252": { name:"たけのこの里 70g", price:280, brand:"明治" },
  "4901001319337": { name:"亀田の柿の種 6袋詰 200g", price:380, brand:"亀田製菓" },
  "4902430457286": { name:"アリエール 洗濯洗剤 詰替 900g", price:398, brand:"P&G" },
  "4987176047656": { name:"ボールド 洗濯洗剤 詰替 840g", price:368, brand:"P&G" },
  "4904230104584": { name:"ビオレu 泡ハンドソープ 詰替 430ml", price:298, brand:"花王" },
  "4902430566865": { name:"パンテーン シャンプー 詰替 400ml", price:498, brand:"P&G" },
  "4549660566175": { name:"ソニー WF-1000XM5 イヤホン", price:39600, brand:"SONY" },
  "4902370548471": { name:"Nintendo Switch Joy-Con グレー", price:7678, brand:"任天堂" },
  "4549292231892": { name:"エネループ 単3形 4本パック", price:1200, brand:"Panasonic" },
  "4901681202676": { name:"コクヨ キャンパスノート A5 5冊", price:580, brand:"コクヨ" },
  "4901991631456": { name:"三菱鉛筆 ジェットストリーム 黒 0.7mm", price:220, brand:"三菱鉛筆" },
};

const INIT_CATS = [
  { id:"c1", name:"食品・飲料", emoji:"🥤", bg:"#1a3a2a", color:"#3FB950" },
  { id:"c2", name:"家電・PC",   emoji:"💻", bg:"#1a2a3a", color:"#58A6FF" },
  { id:"c3", name:"日用品",     emoji:"🧴", bg:"#3a2a1a", color:"#ED8936" },
  { id:"c4", name:"ゲーム",     emoji:"🎮", bg:"#2a1a3a", color:"#BC8CFF" },
];

const INIT_DB = [
  { id:1, jan:"4901777317895", name:"コカ・コーラ 500ml",          price:180,   cost:90,    qty:48, reorderPoint:20, categoryId:"c1", supplier:"コカ・コーラ社",  addedAt:"2026-04-01" },
  { id:2, jan:"4549660566175", name:"ソニー WF-1000XM5 イヤホン",   price:39600, cost:24500, qty:3,  reorderPoint:5,  categoryId:"c2", supplier:"ソニー販売",      addedAt:"2026-04-05" },
  { id:3, jan:"4902430457286", name:"アリエール 洗濯洗剤 詰替 900g",price:398,   cost:220,   qty:12, reorderPoint:6,  categoryId:"c3", supplier:"P&G Japan",       addedAt:"2026-04-10" },
  { id:4, jan:"4902370548471", name:"Nintendo Switch Joy-Con",      price:7678,  cost:4800,  qty:0,  reorderPoint:5,  categoryId:"c4", supplier:"任天堂販売",      addedAt:"2026-04-12" },
];

const EMOJIS = ["📦","🍎","🥤","💻","📱","👗","🏠","🎮","📚","🚗","💄","🍜","🧴","🔧","🎵","🏃"];
const PALETTES = [
  {bg:"#1a3a2a",color:"#3FB950"},{bg:"#1a2a3a",color:"#58A6FF"},
  {bg:"#3a2a1a",color:"#ED8936"},{bg:"#2a1a3a",color:"#BC8CFF"},
  {bg:"#3a1a1a",color:"#F85149"},{bg:"#2a2a1a",color:"#D29922"},
];

function fmtY(n) { return "¥" + Number(n||0).toLocaleString(); }
function calcM(p,c) { if(!p||!c) return null; return Math.round((p-c)/p*100); }
function mCol(m) { if(m===null) return "#666"; if(m>=30) return "#3FB950"; if(m>=10) return "#D29922"; return "#F85149"; }

function exportCSV(db, cats) {
  const catName = id => cats.find(c=>c.id===id)?.name || "未分類";
  const hdr = "JAN,商品名,カテゴリー,単価,仕入れ値,粗利率,在庫数,発注点,仕入れ先,登録日";
  const rows = db.map(i =>
    [i.jan,`"${i.name}"`,catName(i.categoryId),i.price,i.cost||0,calcM(i.price,i.cost)||"",i.qty,i.reorderPoint||0,`"${i.supplier||""}"`,,i.addedAt].join(",")
  );
  const blob = new Blob(["\uFEFF"+[hdr,...rows].join("\n")],{type:"text/csv;charset=utf-8;"});
  const a = Object.assign(document.createElement("a"),{href:URL.createObjectURL(blob),download:"stock.csv"});
  a.click();
}

// ── カメラスキャンコンポーネント ─────────────────────────────────
function CameraScanner({ onDetected, onClose }) {
  const videoRef = useRef(null);
  const readerRef = useRef(null);
  const [err, setErr] = useState("");
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    let controls = null;
    const reader = new BrowserMultiFormatReader();
    readerRef.current = reader;

    (async () => {
      try {
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        const backCamera = devices.find(d => /back|rear|environment/i.test(d.label)) || devices[devices.length - 1];
        const deviceId = backCamera?.deviceId;
        setScanning(true);
        controls = await reader.decodeFromVideoDevice(
          deviceId || undefined,
          videoRef.current,
          (result, err2) => {
            if (result) {
              onDetected(result.getText());
              controls?.stop();
            }
          }
        );
      } catch(e) {
        setErr("カメラエラー: " + e.message);
      }
    })();

    return () => { controls?.stop(); };
  }, [onDetected]);

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.9)",zIndex:500,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
      <div style={{fontSize:16,color:"#E6EDF3",marginBottom:12,fontWeight:700}}>📷 バーコードをスキャン</div>
      {err ? (
        <div style={{color:"#F85149",fontSize:13,marginBottom:12}}>{err}</div>
      ) : (
        <div style={{position:"relative"}}>
          <video ref={videoRef} style={{width:"min(360px,90vw)",borderRadius:8,display:"block"}} playsInline muted />
          <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:"70%",height:60,border:"2px solid #3FB950",borderRadius:4,boxShadow:"0 0 0 1000px rgba(0,0,0,.4)"}} />
        </div>
      )}
      {scanning && !err && <div style={{color:"#3FB950",fontSize:12,marginTop:10}}>バーコードをフレームに合わせてください</div>}
      <button style={{marginTop:20,background:"transparent",color:"#F85149",border:"1px solid rgba(248,81,73,.4)",borderRadius:6,padding:"10px 28px",cursor:"pointer",fontSize:14,fontWeight:700}} onClick={onClose}>
        キャンセル
      </button>
    </div>
  );
}

// ── メインアプリ ─────────────────────────────────────────────────
export default function App() {
  const [tab, setTab]           = useState("inventory");
  const [cats, setCats]         = useState(INIT_CATS);
  const [db, setDb]             = useState(INIT_DB);
  const [jan, setJan]           = useState("");
  const [loading, setLoading]   = useState(false);
  const [modal, setModal]       = useState(null);
  const [arQty, setArQty]       = useState(1);
  const [arCost, setArCost]     = useState("");
  const [arCat, setArCat]       = useState("");
  const [arSupplier, setArSupplier] = useState("");
  const [toasts, setToasts]     = useState([]);
  const [fCat, setFCat]         = useState("all");
  const [fTxt, setFTxt]         = useState("");
  const [catModal, setCatModal] = useState(false);
  const [newCat, setNewCat]     = useState({name:"",emoji:"📦",bg:"#1a2a3a",color:"#58A6FF"});
  const [editItem, setEditItem] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const ref = useRef(null);

  useEffect(() => { if(tab==="inventory" && ref.current) ref.current.focus(); }, [tab]);

  const addToast = useCallback((msg, type="info") => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, {id,msg,type}]);
    setTimeout(() => setToasts(t => t.filter(x => x.id!==id)), 3400);
  }, []);

  const processJan = useCallback((code) => {
    code = code.trim().replace(/\D/g,"");
    if(code.length < 8) { addToast("8〜13桁のJANコードを入力してください","err"); return; }
    const p = PRODUCTS[code];
    const product = p
      ? {jan:code, name:p.name, price:p.price, cost:0, brand:p.brand}
      : {jan:code, name:"商品 (JAN:"+code+")", price:0, cost:0, brand:"不明"};
    if(!p) addToast("内蔵DBに未登録です。商品名・価格を手入力してください","info");
    const existing = db.find(i => i.jan===code) || null;
    setModal({product, isNew:!existing, existing});
    setArQty(1);
    setArCost(String(product.cost||""));
    setArCat(existing ? existing.categoryId : "");
    setArSupplier(existing ? existing.supplier||"" : "");
    setJan("");
  }, [db, addToast]);

  const handleSearch = () => processJan(jan);

  const handleCameraDetect = useCallback((code) => {
    setShowCamera(false);
    addToast("スキャン成功: "+code,"ok");
    setTimeout(() => processJan(code), 300);
  }, [processJan, addToast]);

  const confirmAdd = () => {
    if(!modal) return;
    const cost = parseInt(arCost)||0;
    if(modal.isNew){
      const item = {id:Date.now(),jan:modal.product.jan,name:modal.product.name,price:modal.product.price,cost,qty:arQty,reorderPoint:5,categoryId:arCat,supplier:arSupplier,addedAt:new Date().toISOString().slice(0,10)};
      setDb(d => [item,...d]);
      addToast("新規登録 ("+arQty+"個)","ok");
    } else {
      const prev = modal.existing.qty;
      setDb(d => d.map(i => i.jan===modal.product.jan ? {...i,qty:i.qty+arQty,cost:cost||i.cost,supplier:arSupplier||i.supplier} : i));
      addToast("在庫+"+arQty+"個 (計"+(prev+arQty)+"個)","ok");
    }
    setModal(null);
    if(ref.current) ref.current.focus();
  };

  const saveEdit = (id, field, val) => {
    const isNum = ["price","cost","qty","reorderPoint"].includes(field);
    setDb(d => d.map(i => i.id!==id ? i : {...i,[field]:isNum?Number(val)||0:val}));
    setEditItem(null);
  };

  const addCat = () => {
    if(!newCat.name.trim()){addToast("名前を入力してください","err");return;}
    setCats(c => [...c,{id:"c"+Date.now(),...newCat}]);
    setNewCat({name:"",emoji:"📦",bg:"#1a2a3a",color:"#58A6FF"});
    setCatModal(false);
    addToast("カテゴリーを追加しました","ok");
  };

  const alerts  = useMemo(() => db.filter(i => i.qty<=(i.reorderPoint||0)), [db]);
  const totalV  = db.reduce((s,i) => s+i.price*i.qty, 0);
  const totalC  = db.reduce((s,i) => s+(i.cost||0)*i.qty, 0);
  const rows    = useMemo(() => db.filter(i => {
    if(fCat==="alert") return i.qty<=(i.reorderPoint||0);
    if(fCat==="")      return !i.categoryId;
    if(fCat!=="all")   return i.categoryId===fCat;
    return true;
  }).filter(i => {
    if(!fTxt) return true;
    const t = fTxt.toLowerCase();
    return i.name.toLowerCase().includes(t)||i.jan.includes(t);
  }), [db,fCat,fTxt]);

  const inpS  = {background:"#1C2128",border:"1px solid #30363D",borderRadius:6,color:"#E6EDF3",fontFamily:"system-ui,sans-serif",fontSize:13,padding:"8px 10px",outline:"none",width:"100%"};
  const btnP  = {background:"#1F6FEB",color:"#fff",border:"none",borderRadius:6,cursor:"pointer",fontWeight:700,fontSize:13,padding:"8px 14px"};
  const btnG  = {background:"transparent",color:"#8B949E",border:"1px solid #30363D",borderRadius:6,cursor:"pointer",fontWeight:600,fontSize:12,padding:"8px 12px"};
  const btnD  = {background:"transparent",color:"#F85149",border:"1px solid rgba(248,81,73,.3)",borderRadius:6,cursor:"pointer",fontSize:11,padding:"3px 8px"};
  const thS   = {padding:"9px 12px",textAlign:"left",fontSize:10,fontWeight:700,textTransform:"uppercase",color:"#484F58",borderBottom:"1px solid #30363D",whiteSpace:"nowrap"};
  const tdS   = {padding:"11px 12px",fontSize:12,borderBottom:"1px solid #30363D",verticalAlign:"middle"};
  const eInp  = {background:"#1C2128",border:"1px solid #58A6FF",borderRadius:4,color:"#E6EDF3",fontFamily:"monospace",fontSize:12,padding:"3px 6px",outline:"none"};

  function EditCell(item, field, display, width, mono) {
    const isNum = ["price","cost","qty","reorderPoint"].includes(field);
    if(editItem && editItem.id===item.id && editItem.field===field) {
      return <input autoFocus type={isNum?"number":"text"} defaultValue={item[field]}
        style={{...eInp,width:width||80}}
        onBlur={e => saveEdit(item.id,field,e.target.value)}
        onKeyDown={e => { if(e.key==="Enter")saveEdit(item.id,field,e.target.value); if(e.key==="Escape")setEditItem(null); }} />;
    }
    return <span style={{cursor:"pointer",fontFamily:mono?"monospace":"inherit"}}
      onDoubleClick={() => setEditItem({id:item.id,field})}
      title="ダブルクリックで編集">{display}</span>;
  }

  return (
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",background:"#0D1117",color:"#E6EDF3",fontFamily:"system-ui,sans-serif",fontSize:14}}>

      {/* TOPBAR */}
      <div style={{height:52,background:"#161B22",borderBottom:"1px solid #30363D",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 20px",position:"sticky",top:0,zIndex:300}}>
        <div style={{fontSize:18,fontWeight:800}}>Stock<span style={{color:"#58A6FF"}}>Master</span></div>
        <div style={{display:"flex",gap:16}}>
          <div style={{textAlign:"right"}}><div style={{fontFamily:"monospace",fontSize:14,fontWeight:600}}>{db.length}</div><div style={{fontSize:10,color:"#484F58"}}>SKU</div></div>
          <div style={{textAlign:"right"}}><div style={{fontFamily:"monospace",fontSize:14,fontWeight:600,color:"#58A6FF"}}>{fmtY(totalV)}</div><div style={{fontSize:10,color:"#484F58"}}>売価</div></div>
          <div style={{textAlign:"right"}}><div style={{fontFamily:"monospace",fontSize:14,fontWeight:600,color:"#3FB950"}}>{fmtY(totalV-totalC)}</div><div style={{fontSize:10,color:"#484F58"}}>含み益</div></div>
          {alerts.length>0&&<div style={{textAlign:"right"}}><div style={{fontFamily:"monospace",fontSize:14,fontWeight:600,color:"#F85149"}}>{alerts.length}</div><div style={{fontSize:10,color:"#484F58"}}>要発注</div></div>}
        </div>
      </div>

      {/* NAV */}
      <div style={{background:"#161B22",borderBottom:"1px solid #30363D",display:"flex",padding:"0 20px"}}>
        {[["inventory","📦 在庫管理"],["dashboard","📊 グラフ"],["categories","🗂 カテゴリー"]].map(it => (
          <div key={it[0]} style={{padding:"10px 14px",fontSize:13,fontWeight:500,color:tab===it[0]?"#58A6FF":"#8B949E",cursor:"pointer",borderBottom:tab===it[0]?"2px solid #58A6FF":"2px solid transparent"}} onClick={() => setTab(it[0])}>
            {it[1]}{it[0]==="inventory"&&alerts.length>0&&<span style={{marginLeft:5,background:"#F85149",color:"#fff",fontSize:9,padding:"1px 4px",borderRadius:9,fontWeight:700}}>{alerts.length}</span>}
          </div>
        ))}
      </div>

      {/* 在庫管理 */}
      {tab==="inventory"&&(
        <div style={{display:"grid",gridTemplateColumns:"300px 1fr",flex:1,minHeight:0}}>
          <div style={{background:"#161B22",borderRight:"1px solid #30363D",overflowY:"auto",padding:16,display:"flex",flexDirection:"column",gap:16}}>
            <div>
              <div style={{fontSize:10,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:"#484F58",marginBottom:8}}>JANコードスキャン</div>

              {/* カメラスキャンボタン */}
              <button style={{...btnP,width:"100%",marginBottom:8,fontSize:14,padding:"12px",background:"#238636"}} onClick={() => setShowCamera(true)}>
                📷 カメラでスキャン
              </button>

              <div style={{display:"flex",gap:8,marginBottom:8}}>
                <input ref={ref}
                  style={{background:"#1C2128",border:"1px solid #30363D",borderRadius:6,color:"#E6EDF3",fontFamily:"monospace",fontSize:14,padding:"8px 10px",outline:"none",flex:1,letterSpacing:2}}
                  type="text" inputMode="numeric" placeholder="手入力: 490XXXXXXXXXX"
                  value={jan}
                  onChange={e => setJan(e.target.value.replace(/\D/g,"").slice(0,13))}
                  onKeyDown={e => { if(e.key==="Enter"&&!loading) handleSearch(); }}
                  maxLength={13}
                />
                <button style={{...btnP,opacity:loading||!jan.trim()?0.4:1}} onClick={handleSearch} disabled={loading||!jan.trim()}>
                  {loading?"…":"検索"}
                </button>
              </div>
              <div style={{background:"rgba(88,166,255,.08)",border:"1px solid rgba(88,166,255,.2)",borderRadius:6,padding:"8px 10px",fontSize:11,color:"#58A6FF",lineHeight:1.7}}>
                💡 カメラボタンでiPadのカメラを起動してバーコードをスキャンできます
              </div>
            </div>
          </div>

          <div style={{overflowY:"auto",background:"#0D1117"}}>
            {alerts.length>0&&<div style={{margin:"12px 18px 0",background:"rgba(248,81,73,.1)",border:"1px solid rgba(248,81,73,.3)",borderRadius:8,padding:"10px 14px",color:"#F85149",fontSize:13}}>⚠️ <strong>{alerts.length}件</strong>が発注点以下です</div>}
            <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",padding:"12px 18px 0"}}>
              {[["all","すべて",db.length],["","未分類",db.filter(i=>!i.categoryId).length]].map(x => (
                <div key={x[0]} style={{display:"flex",alignItems:"center",gap:4,padding:"4px 12px",borderRadius:20,border:fCat===x[0]?"1px solid #1F6FEB":"1px solid #30363D",background:fCat===x[0]?"#1F6FEB":"#21262D",fontSize:12,fontWeight:500,color:fCat===x[0]?"#fff":"#8B949E",cursor:"pointer"}} onClick={() => setFCat(x[0])}>{x[1]}<span style={{fontSize:9,fontFamily:"monospace",opacity:.7,marginLeft:2}}>{x[2]}</span></div>
              ))}
              {alerts.length>0&&<div style={{display:"flex",alignItems:"center",gap:4,padding:"4px 12px",borderRadius:20,border:fCat==="alert"?"1px solid #F85149":"1px solid rgba(248,81,73,.4)",background:fCat==="alert"?"#F85149":"rgba(248,81,73,.1)",fontSize:12,fontWeight:500,color:fCat==="alert"?"#fff":"#F85149",cursor:"pointer"}} onClick={() => setFCat("alert")}>⚠ 要発注<span style={{fontSize:9,fontFamily:"monospace",opacity:.8,marginLeft:2}}>{alerts.length}</span></div>}
              {cats.map(cat => (
                <div key={cat.id} style={{display:"flex",alignItems:"center",gap:4,padding:"4px 12px",borderRadius:20,border:fCat===cat.id?"1px solid #1F6FEB":"1px solid #30363D",background:fCat===cat.id?"#1F6FEB":"#21262D",fontSize:12,fontWeight:500,color:fCat===cat.id?"#fff":"#8B949E",cursor:"pointer"}} onClick={() => setFCat(cat.id)}>{cat.emoji} {cat.name}<span style={{fontSize:9,fontFamily:"monospace",opacity:.7,marginLeft:2}}>{db.filter(i=>i.categoryId===cat.id).length}</span></div>
              ))}
            </div>
            <div style={{padding:"12px 18px 18px"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                <div style={{fontSize:15,fontWeight:700}}>商品マスタ一覧</div>
                <div style={{display:"flex",gap:8}}>
                  <input style={{background:"#21262D",border:"1px solid #30363D",borderRadius:6,color:"#E6EDF3",fontSize:12,padding:"7px 11px",outline:"none",width:160}} placeholder="商品名/JAN…" value={fTxt} onChange={e => setFTxt(e.target.value)}/>
                  <button style={{background:"rgba(63,185,80,.12)",color:"#3FB950",border:"1px solid rgba(63,185,80,.3)",borderRadius:6,cursor:"pointer",fontWeight:600,fontSize:12,padding:"7px 12px"}} onClick={() => {exportCSV(db,cats);addToast("CSV出力しました","ok");}}>⬇ CSV</button>
                </div>
              </div>
              <div style={{background:"#21262D",borderRadius:8,border:"1px solid #30363D",overflow:"hidden"}}>
                {rows.length===0
                  ?<div style={{padding:"50px 20px",textAlign:"center",color:"#484F58"}}><div style={{fontSize:40,marginBottom:8}}>📋</div>商品がありません</div>
                  :(
                    <div style={{overflowX:"auto"}}>
                      <table style={{width:"100%",borderCollapse:"collapse",minWidth:900}}>
                        <thead>
                          <tr style={{background:"#1C2128"}}>
                            {["JAN","商品名","カテゴリー","単価","仕入れ値","粗利率","在庫","発注点","仕入れ先","状態","登録日",""].map(h => <th key={h} style={thS}>{h}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map(item => {
                            const cat = cats.find(c=>c.id===item.categoryId);
                            const m   = calcM(item.price,item.cost);
                            const isAl= item.qty<=(item.reorderPoint||0);
                            return (
                              <tr key={item.id}>
                                <td style={{...tdS,fontFamily:"monospace",fontSize:10,color:"#484F58"}}>{item.jan}</td>
                                <td style={{...tdS,maxWidth:160}}>{EditCell(item,"name",item.name,140,false)}</td>
                                <td style={tdS}>
                                  {cat&&<span style={{display:"inline-flex",alignItems:"center",gap:3,padding:"2px 6px",borderRadius:4,fontSize:11,fontWeight:600,color:cat.color,background:cat.bg,marginRight:4}}>{cat.emoji} {cat.name}</span>}
                                  <select style={{background:"#1C2128",border:"1px solid #30363D",borderRadius:4,color:"#8B949E",fontSize:10,padding:"2px 4px",cursor:"pointer"}} value={item.categoryId||""} onChange={e => { const v=e.target.value; setDb(d=>d.map(i=>i.id===item.id?{...i,categoryId:v}:i)); }}>
                                    <option value="">未分類</option>
                                    {cats.map(c=><option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
                                  </select>
                                </td>
                                <td style={{...tdS,fontFamily:"monospace",color:"#58A6FF",fontWeight:600}}>{EditCell(item,"price",fmtY(item.price),80,true)}</td>
                                <td style={{...tdS,fontFamily:"monospace",color:"#8B949E"}}>{EditCell(item,"cost",item.cost?fmtY(item.cost):"—",80,true)}</td>
                                <td style={{...tdS,fontFamily:"monospace",fontWeight:600,color:mCol(m)}}>{m!==null?m+"%":"—"}</td>
                                <td style={{...tdS,fontFamily:"monospace",fontWeight:700}}>{EditCell(item,"qty",item.qty,60,true)}</td>
                                <td style={{...tdS,fontFamily:"monospace",color:"#484F58"}}>{EditCell(item,"reorderPoint",item.reorderPoint||0,60,true)}</td>
                                <td style={{...tdS,maxWidth:120}}>{EditCell(item,"supplier",item.supplier||"—",100,false)}</td>
                                <td style={tdS}>{item.qty===0?<span style={{background:"rgba(248,81,73,.12)",color:"#F85149",padding:"2px 6px",borderRadius:4,fontSize:10,fontWeight:700}}>在庫なし</span>:isAl?<span style={{background:"rgba(248,81,73,.12)",color:"#F85149",padding:"2px 6px",borderRadius:4,fontSize:10,fontWeight:700}}>⚠発注要</span>:item.qty<=5?<span style={{background:"rgba(210,153,34,.12)",color:"#D29922",padding:"2px 6px",borderRadius:4,fontSize:10,fontWeight:700}}>残りわずか</span>:<span style={{background:"rgba(63,185,80,.12)",color:"#3FB950",padding:"2px 6px",borderRadius:4,fontSize:10,fontWeight:700}}>在庫あり</span>}</td>
                                <td style={{...tdS,fontSize:11,color:"#484F58"}}>{item.addedAt}</td>
                                <td style={tdS}><button style={btnD} onClick={() => {setDb(d=>d.filter(i=>i.id!==item.id));addToast("削除しました","info");}}>削除</button></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
              </div>
              <div style={{marginTop:6,fontSize:11,color:"#484F58"}}>💡 商品名・単価・仕入れ値・在庫数・発注点・仕入れ先はダブルクリックで編集できます</div>
            </div>
          </div>
        </div>
      )}

      {/* グラフ */}
      {tab==="dashboard"&&(
        <div style={{padding:18,display:"flex",flexDirection:"column",gap:16}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
            {[{l:"売価評価額",v:fmtY(totalV),col:"#58A6FF"},{l:"原価評価額",v:fmtY(totalC),col:"#E6EDF3"},{l:"含み益",v:fmtY(totalV-totalC),col:"#3FB950"},{l:"要発注",v:alerts.length+"件",col:"#F85149"}].map(k => (
              <div key={k.l} style={{background:"#21262D",border:"1px solid #30363D",borderRadius:8,padding:16}}>
                <div style={{fontSize:10,textTransform:"uppercase",color:"#484F58",marginBottom:6}}>{k.l}</div>
                <div style={{fontFamily:"monospace",fontSize:20,fontWeight:600,color:k.col}}>{k.v}</div>
              </div>
            ))}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div style={{background:"#21262D",border:"1px solid #30363D",borderRadius:8,padding:16}}>
              <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>カテゴリー別 在庫評価額</div>
              {cats.map(cat => {
                const val = db.filter(i=>i.categoryId===cat.id).reduce((s,i)=>s+i.price*i.qty,0);
                if(!val) return null;
                return <div key={cat.id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}><div style={{width:90,fontSize:11,color:"#8B949E",textAlign:"right"}}>{cat.emoji} {cat.name}</div><div style={{flex:1,height:16,background:"#1C2128",borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:Math.min(100,val/totalV*100)+"%",background:cat.color,borderRadius:3}}></div></div><div style={{width:70,fontFamily:"monospace",fontSize:10,color:"#8B949E"}}>{fmtY(val)}</div></div>;
              })}
            </div>
            <div style={{background:"#21262D",border:"1px solid #30363D",borderRadius:8,padding:16}}>
              <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>商品別 粗利率ランキング</div>
              {db.filter(i=>i.cost).sort((a,b)=>calcM(b.price,b.cost)-calcM(a.price,a.cost)).slice(0,6).map(item => {
                const m = calcM(item.price,item.cost);
                return <div key={item.id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}><div style={{width:90,fontSize:10,color:"#8B949E",textAlign:"right"}}>{item.name.slice(0,9)}{item.name.length>9?"…":""}</div><div style={{flex:1,height:16,background:"#1C2128",borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:m+"%",background:mCol(m),borderRadius:3}}></div></div><div style={{width:36,fontFamily:"monospace",fontSize:10,color:mCol(m),fontWeight:700}}>{m}%</div></div>;
              })}
            </div>
          </div>
          {alerts.length>0&&(
            <div style={{background:"#21262D",border:"1px solid #30363D",borderRadius:8,padding:16}}>
              <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>⚠️ 発注アラート</div>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr>{["商品名","在庫","発注点","不足"].map(h=><th key={h} style={thS}>{h}</th>)}</tr></thead>
                <tbody>{alerts.map(item=>(
                  <tr key={item.id}>
                    <td style={tdS}>{item.name.slice(0,18)}{item.name.length>18?"…":""}</td>
                    <td style={{...tdS,fontFamily:"monospace",fontWeight:700,color:item.qty===0?"#F85149":"#D29922"}}>{item.qty}</td>
                    <td style={{...tdS,fontFamily:"monospace",color:"#484F58"}}>{item.reorderPoint||0}</td>
                    <td style={{...tdS,fontFamily:"monospace",fontWeight:700,color:"#F85149"}}>{Math.max(0,(item.reorderPoint||0)-item.qty)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* カテゴリー */}
      {tab==="categories"&&(
        <div style={{padding:18}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
            <div style={{fontSize:17,fontWeight:700}}>カテゴリー管理</div>
            <button style={btnP} onClick={() => setCatModal(true)}>+ カテゴリーを追加</button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))",gap:8}}>
            {cats.map(cat => (
              <div key={cat.id} style={{background:"#21262D",border:"1px solid #30363D",borderRadius:8,padding:12,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <div style={{width:34,height:34,borderRadius:7,background:cat.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>{cat.emoji}</div>
                  <div><div style={{fontWeight:600,fontSize:13}}>{cat.name}</div><div style={{fontSize:11,color:"#484F58"}}>{db.filter(i=>i.categoryId===cat.id).length} 商品</div></div>
                </div>
                <button style={btnD} onClick={() => {setCats(c=>c.filter(x=>x.id!==cat.id));addToast("削除しました","info");}}>削除</button>
              </div>
            ))}
            <div style={{background:"transparent",border:"1px dashed #30363D",borderRadius:8,padding:12,display:"flex",alignItems:"center",justifyContent:"center",gap:6,cursor:"pointer",color:"#484F58",fontSize:12,fontWeight:600}} onClick={() => setCatModal(true)}>+ 新しいカテゴリー</div>
          </div>
        </div>
      )}

      {/* カメラスキャナー */}
      {showCamera && <CameraScanner onDetected={handleCameraDetect} onClose={() => setShowCamera(false)} />}

      {/* 登録モーダル */}
      {modal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.65)",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={e=>{if(e.target===e.currentTarget)setModal(null);}}>
          <div style={{background:"#161B22",border:"1px solid #444C56",borderRadius:10,width:460,maxWidth:"96vw",boxShadow:"0 20px 60px rgba(0,0,0,.5)",maxHeight:"90vh",overflowY:"auto"}}>
            <div style={{padding:"16px 18px 12px",borderBottom:"1px solid #30363D",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,background:"#161B22"}}>
              <div style={{fontSize:14,fontWeight:700}}>{modal.isNew?"✨ 新規商品を登録":"📦 在庫を追加"}</div>
              <button style={{background:"transparent",border:"none",cursor:"pointer",color:"#8B949E",fontSize:16}} onClick={() => setModal(null)}>x</button>
            </div>
            <div style={{padding:"16px 18px"}}>
              <div style={{background:modal.isNew?"rgba(63,185,80,.12)":"rgba(88,166,255,.1)",borderRadius:7,padding:"9px 12px",fontSize:12,color:modal.isNew?"#3FB950":"#58A6FF",fontWeight:600,marginBottom:12}}>
                {modal.isNew?"🆕 未登録: 新規登録します":"🔄 登録済み (現在 "+modal.existing.qty+"個) → 在庫加算"}
              </div>
              <div style={{background:"#1C2128",borderRadius:7,padding:12,marginBottom:12,border:"1px solid #30363D"}}>
                <div style={{marginBottom:8}}>
                  <div style={{fontSize:11,color:"#8B949E",marginBottom:4}}>商品名</div>
                  <input style={inpS} type="text" value={modal.product.name} onChange={e=>{const v=e.target.value;setModal(m=>({...m,product:{...m.product,name:v}}));}}/>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  <div>
                    <div style={{fontSize:11,color:"#8B949E",marginBottom:4}}>単価（円）</div>
                    <input style={inpS} type="number" min="0" value={modal.product.price} onChange={e=>{const v=e.target.value;setModal(m=>({...m,product:{...m.product,price:Number(v)||0}}));}}/>
                  </div>
                  <div>
                    <div style={{fontSize:11,color:"#8B949E",marginBottom:4}}>JAN</div>
                    <div style={{fontFamily:"monospace",fontSize:12,color:"#484F58",padding:"9px 10px",background:"#0D1117",borderRadius:6,border:"1px solid #30363D"}}>{modal.product.jan}</div>
                  </div>
                </div>
              </div>
              {modal.isNew&&(
                <>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
                    <div>
                      <div style={{fontSize:11,color:"#8B949E",marginBottom:4}}>仕入れ値（円）</div>
                      <input style={inpS} type="number" min="0" placeholder="0" value={arCost} onChange={e=>setArCost(e.target.value)}/>
                      {arCost&&calcM(modal.product.price,Number(arCost))!==null&&<div style={{fontSize:10,color:"#484F58",marginTop:2}}>粗利率: <span style={{fontWeight:700,color:mCol(calcM(modal.product.price,Number(arCost)))}}>{calcM(modal.product.price,Number(arCost))}%</span></div>}
                    </div>
                    <div>
                      <div style={{fontSize:11,color:"#8B949E",marginBottom:4}}>カテゴリー</div>
                      <select style={inpS} value={arCat} onChange={e=>setArCat(e.target.value)}>
                        <option value="">未分類</option>
                        {cats.map(c=><option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{marginBottom:12}}>
                    <div style={{fontSize:11,color:"#8B949E",marginBottom:4}}>仕入れ先</div>
                    <input style={inpS} type="text" placeholder="例：○○商事" value={arSupplier} onChange={e=>setArSupplier(e.target.value)}/>
                  </div>
                </>
              )}
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"#1C2128",borderRadius:7,padding:"10px 14px",border:"1px solid #30363D"}}>
                <span style={{fontSize:12,color:"#8B949E"}}>入庫数量</span>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <button style={{width:30,height:30,border:"1px solid #444C56",borderRadius:7,background:"#2D333B",color:"#E6EDF3",cursor:"pointer",fontSize:17}} onClick={()=>setArQty(q=>Math.max(1,q-1))}>-</button>
                  <span style={{fontFamily:"monospace",fontSize:22,fontWeight:700,minWidth:40,textAlign:"center"}}>{arQty}</span>
                  <button style={{width:30,height:30,border:"1px solid #444C56",borderRadius:7,background:"#2D333B",color:"#E6EDF3",cursor:"pointer",fontSize:17}} onClick={()=>setArQty(q=>q+1)}>+</button>
                </div>
              </div>
            </div>
            <div style={{padding:"12px 18px",borderTop:"1px solid #30363D",display:"flex",justifyContent:"flex-end",gap:8}}>
              <button style={btnG} onClick={()=>setModal(null)}>キャンセル</button>
              <button style={btnP} onClick={confirmAdd}>{modal.isNew?"✨ 新規登録する":"📦 在庫を加算する"}</button>
            </div>
          </div>
        </div>
      )}

      {/* カテゴリーモーダル */}
      {catModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.65)",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={e=>{if(e.target===e.currentTarget)setCatModal(false);}}>
          <div style={{background:"#161B22",border:"1px solid #444C56",borderRadius:10,width:400,maxWidth:"95vw",boxShadow:"0 20px 60px rgba(0,0,0,.5)"}}>
            <div style={{padding:"16px 18px 12px",borderBottom:"1px solid #30363D",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{fontSize:14,fontWeight:700}}>カテゴリーを追加</div>
              <button style={{background:"transparent",border:"none",cursor:"pointer",color:"#8B949E",fontSize:16}} onClick={()=>setCatModal(false)}>x</button>
            </div>
            <div style={{padding:"16px 18px"}}>
              <div style={{marginBottom:12}}>
                <div style={{fontSize:11,color:"#8B949E",marginBottom:4}}>カテゴリー名</div>
                <input style={inpS} type="text" placeholder="例：食品・飲料" autoFocus value={newCat.name} onChange={e=>setNewCat(n=>({...n,name:e.target.value}))} onKeyDown={e=>{if(e.key==="Enter")addCat();}}/>
              </div>
              <div style={{marginBottom:12}}>
                <div style={{fontSize:11,color:"#8B949E",marginBottom:6}}>アイコン</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                  {EMOJIS.map(em=><span key={em} style={{fontSize:18,cursor:"pointer",padding:3,borderRadius:5,border:newCat.emoji===em?"1.5px solid #58A6FF":"1.5px solid transparent",background:newCat.emoji===em?"#1C2128":"transparent"}} onClick={()=>setNewCat(n=>({...n,emoji:em}))}>{em}</span>)}
                </div>
              </div>
              <div>
                <div style={{fontSize:11,color:"#8B949E",marginBottom:6}}>カラー</div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {PALETTES.map((p,i)=><div key={i} style={{width:24,height:24,borderRadius:5,cursor:"pointer",background:p.bg,border:newCat.bg===p.bg?"2px solid #E6EDF3":"2px solid transparent",display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setNewCat(n=>({...n,bg:p.bg,color:p.color}))}>{newCat.bg===p.bg&&<span style={{color:p.color,fontSize:11,fontWeight:700}}>✓</span>}</div>)}
                </div>
              </div>
            </div>
            <div style={{padding:"12px 18px",borderTop:"1px solid #30363D",display:"flex",justifyContent:"flex-end",gap:8}}>
              <button style={btnG} onClick={()=>setCatModal(false)}>キャンセル</button>
              <button style={btnP} onClick={addCat}>追加する</button>
            </div>
          </div>
        </div>
      )}

      {/* トースト */}
      <div style={{position:"fixed",bottom:18,right:18,display:"flex",flexDirection:"column",gap:7,zIndex:999}}>
        {toasts.map(t=>(
          <div key={t.id} style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",borderRadius:7,fontSize:12,fontWeight:500,background:"#2D333B",color:"#E6EDF3",borderLeft:"3px solid "+(t.type==="ok"?"#3FB950":t.type==="err"?"#F85149":"#58A6FF"),boxShadow:"0 6px 20px rgba(0,0,0,.4)",minWidth:200}}>
            {t.type==="ok"?"✓":t.type==="err"?"✕":"ℹ"} {t.msg}
          </div>
        ))}
      </div>
    </div>
  );
}
