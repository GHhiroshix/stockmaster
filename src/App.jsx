import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { supabase } from "./supabase";

// ── カテゴリー初期データ ──────────────────────────────
const CATS_INITIAL = [
  { id:"c1", name:"介護用品", emoji:"🏥", children:[
    { id:"c1-1", name:"排泄ケア", children:[
      {id:"c1-1-1",name:"紙おむつ（パンツ型）"},{id:"c1-1-2",name:"紙おむつ（テープ型）"},{id:"c1-1-3",name:"尿取りパッド"},{id:"c1-1-4",name:"排泄処理用品"},
    ]},
    { id:"c1-2", name:"移動・移乗", children:[
      {id:"c1-2-1",name:"車椅子"},{id:"c1-2-2",name:"歩行器・歩行補助"},{id:"c1-2-3",name:"杖・松葉杖"},{id:"c1-2-4",name:"移乗ボード"},
    ]},
    { id:"c1-3", name:"食事・嚥下", children:[{id:"c1-3-1",name:"介護食・嚥下食"},{id:"c1-3-2",name:"栄養補助食品"},{id:"c1-3-3",name:"食事補助用品"}]},
    { id:"c1-4", name:"入浴・清拭", children:[{id:"c1-4-1",name:"入浴補助用品"},{id:"c1-4-2",name:"清拭用品"},{id:"c1-4-3",name:"皮膚保護用品"}]},
    { id:"c1-5", name:"床ずれ防止", children:[{id:"c1-5-1",name:"床ずれ防止マット"},{id:"c1-5-2",name:"体位変換用品"}]},
  ]},
  { id:"c2", name:"衛生・医療", emoji:"💊", children:[
    {id:"c2-1",name:"感染対策",children:[{id:"c2-1-1",name:"マスク"},{id:"c2-1-2",name:"手袋・グローブ"},{id:"c2-1-3",name:"消毒液・除菌"}]},
    {id:"c2-2",name:"医療用品",children:[{id:"c2-2-1",name:"包帯・ガーゼ"},{id:"c2-2-2",name:"体温計・血圧計"},{id:"c2-2-3",name:"サポーター・コルセット"}]},
  ]},
  { id:"c3", name:"日用雑貨", emoji:"🧴", children:[
    {id:"c3-1",name:"洗濯・清掃",children:[{id:"c3-1-1",name:"洗濯洗剤"},{id:"c3-1-2",name:"掃除用品"},{id:"c3-1-3",name:"ゴミ袋・ポリ袋"}]},
    {id:"c3-2",name:"ボディケア",children:[{id:"c3-2-1",name:"シャンプー・リンス"},{id:"c3-2-2",name:"ボディソープ"},{id:"c3-2-3",name:"歯磨き用品"}]},
    {id:"c3-3",name:"キッチン用品",children:[{id:"c3-3-1",name:"調理器具"},{id:"c3-3-2",name:"食器・カトラリー"},{id:"c3-3-3",name:"キッチン消耗品"}]},
  ]},
  { id:"c4", name:"食料品・飲料", emoji:"🍱", children:[
    {id:"c4-1",name:"飲料",children:[{id:"c4-1-1",name:"お茶・水"},{id:"c4-1-2",name:"栄養ドリンク"},{id:"c4-1-3",name:"ジュース・炭酸"}]},
    {id:"c4-2",name:"食品",children:[{id:"c4-2-1",name:"レトルト・缶詰"},{id:"c4-2-2",name:"菓子・スナック"},{id:"c4-2-3",name:"調味料"}]},
  ]},
  { id:"c5", name:"家電・機器", emoji:"💻", children:[
    {id:"c5-1",name:"介護機器",children:[{id:"c5-1-1",name:"電動ベッド・マット"},{id:"c5-1-2",name:"リフト・昇降機"},{id:"c5-1-3",name:"見守り機器"}]},
    {id:"c5-2",name:"生活家電",children:[{id:"c5-2-1",name:"調理家電"},{id:"c5-2-2",name:"冷暖房機器"},{id:"c5-2-3",name:"その他家電"}]},
  ]},
];
const EMOJIS=["🏥","💊","🧴","🍱","💻","📦","🏠","🚗","👗","🎮","🍎","🔧","📚","💄","🎵","🏃"];
const PRODUCTS={"4901777317895":{name:"コカ・コーラ 500ml",price:180},"4902102114775":{name:"ポカリスエット 500ml",price:160},"4902430457286":{name:"アリエール 洗濯洗剤 詰替 900g",price:398}};

// ── ヘルパー関数 ──────────────────────────────────────
function findL1(cats,id){return cats.find(c=>c.id===id)||null;}
function findL2(cats,l1id,l2id){const l1=findL1(cats,l1id);return l1?(l1.children.find(c=>c.id===l2id)||null):null;}
function findL3(cats,l1id,l2id,l3id){const l2=findL2(cats,l1id,l2id);return l2?(l2.children.find(c=>c.id===l3id)||null):null;}
function fmtY(n){return "¥"+Number(n||0).toLocaleString();}
function calcM(p,c){if(!p||!c)return null;return Math.round((p-c)/p*100);}
function mCol(m){if(m===null)return "#666";if(m>=30)return "#3FB950";if(m>=10)return "#D29922";return "#F85149";}
function today(){return new Date().toISOString().slice(0,10);}
function dl(content,filename){const blob=new Blob([content],{type:"text/csv;charset=utf-8;"});Object.assign(document.createElement("a"),{href:URL.createObjectURL(blob),download:filename}).click();}

// DB変換関数
function prodFromDB(r){return{id:r.id,jan:r.jan,name:r.name,price:r.price,cost:r.cost,qty:r.qty,reorderPoint:r.reorder_point,catL1:r.cat_l1||"",catL2:r.cat_l2||"",catL3:r.cat_l3||"",maker:r.maker||"",supplier:r.supplier||"",addedAt:r.added_at};}
function prodToDB(i,cid){return{company_id:cid,jan:i.jan,name:i.name,price:i.price||0,cost:i.cost||0,qty:i.qty||0,reorder_point:i.reorderPoint||5,cat_l1:i.catL1||"",cat_l2:i.catL2||"",cat_l3:i.catL3||"",maker:i.maker||"",supplier:i.supplier||"",added_at:i.addedAt||today()};}
function incFromDB(r){return{id:r.id,date:r.date,jan:r.jan,name:r.name,qty:r.qty,cost:r.cost,totalCost:r.total_cost,maker:r.maker||"",supplier:r.supplier||"",note:r.note||""};}
function incToDB(r,cid){return{company_id:cid,date:r.date,jan:r.jan,name:r.name,qty:r.qty,cost:r.cost||0,total_cost:r.totalCost||0,maker:r.maker||"",supplier:r.supplier||"",note:r.note||""};}
function outFromDB(r){return{id:r.id,date:r.date,jan:r.jan,name:r.name,qty:r.qty,price:r.price,totalPrice:r.total_price,destination:r.destination||"",note:r.note||""};}
function outToDB(r,cid){return{company_id:cid,date:r.date,jan:r.jan,name:r.name,qty:r.qty,price:r.price||0,total_price:r.totalPrice||0,destination:r.destination||"",note:r.note||""};}

function exportCSV(db,cats){
  const hdr="JAN,商品名,大分類,中分類,小分類,メーカー,仕入れ先,単価,仕入れ値,粗利率,在庫数,発注点,登録日";
  const rows=db.map(i=>[i.jan,'"'+i.name+'"',findL1(cats,i.catL1)?.name||"",findL2(cats,i.catL1,i.catL2)?.name||"",findL3(cats,i.catL1,i.catL2,i.catL3)?.name||"",'"'+(i.maker||"")+'"','"'+(i.supplier||"")+'"',i.price,i.cost||0,calcM(i.price,i.cost)||"",i.qty,i.reorderPoint||0,i.addedAt].join(","));
  dl("\uFEFF"+[hdr,...rows].join("\n"),"stock.csv");
}
function exportInventoryCSV(db,cats){
  const hdr="JAN,商品名,大分類,中分類,小分類,メーカー,仕入れ先,単価,仕入れ値,帳簿在庫数,実在庫数,差異,備考";
  const rows=db.map(i=>[i.jan,'"'+i.name+'"',findL1(cats,i.catL1)?.name||"",findL2(cats,i.catL1,i.catL2)?.name||"",findL3(cats,i.catL1,i.catL2,i.catL3)?.name||"",'"'+(i.maker||"")+'"','"'+(i.supplier||"")+'"',i.price,i.cost||0,i.qty,"","",""].join(","));
  dl("\uFEFF"+[hdr,...rows].join("\n"),"inventory_count.csv");
}
function exportIncomingCSV(rows){const hdr="入庫日,JAN,商品名,入庫数量,仕入れ単価,仕入れ合計,メーカー,仕入れ先,備考";const r=rows.map(h=>[h.date,h.jan,'"'+h.name+'"',h.qty,h.cost,h.totalCost,'"'+(h.maker||"")+'"','"'+(h.supplier||"")+'"','"'+(h.note||"")+'"'].join(","));dl("\uFEFF"+[hdr,...r].join("\n"),"incoming.csv");}
function exportOutgoingCSV(rows){const hdr="出庫日,JAN,商品名,出庫数量,販売単価,合計売上,販売先,備考";const r=rows.map(o=>[o.date,o.jan,'"'+o.name+'"',o.qty,o.price,o.totalPrice,'"'+(o.destination||"")+'"','"'+(o.note||"")+'"'].join(","));dl("\uFEFF"+[hdr,...r].join("\n"),"outgoing.csv");}

// ── カメラスキャナー ──────────────────────────────────
function CameraScanner({onDetected,onClose}){
  const videoRef=useRef(null);const[err,setErr]=useState("");const[scanning,setScanning]=useState(false);
  useEffect(()=>{let controls=null;const reader=new BrowserMultiFormatReader();(async()=>{try{const devices=await BrowserMultiFormatReader.listVideoInputDevices();const back=devices.find(d=>/back|rear|environment/i.test(d.label))||devices[devices.length-1];setScanning(true);controls=await reader.decodeFromVideoDevice(back?.deviceId,videoRef.current,(result)=>{if(result){onDetected(result.getText());controls?.stop();}});}catch(e){setErr("カメラエラー: "+e.message);}})();return()=>{controls?.stop();};},[onDetected]);
  return(<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.95)",zIndex:500,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:20}}><div style={{fontSize:16,color:"#E6EDF3",marginBottom:16,fontWeight:700}}>📷 バーコードをスキャン</div>{err?<div style={{color:"#F85149",fontSize:13}}>{err}</div>:(<div style={{position:"relative"}}><video ref={videoRef} style={{width:"min(360px,90vw)",borderRadius:8,display:"block"}} playsInline muted/><div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:"70%",height:60,border:"2px solid #3FB950",borderRadius:4,boxShadow:"0 0 0 1000px rgba(0,0,0,.5)"}}/></div>)}{scanning&&!err&&<div style={{color:"#3FB950",fontSize:12,marginTop:10}}>バーコードをフレームに合わせてください</div>}<button style={{marginTop:20,background:"transparent",color:"#F85149",border:"1px solid rgba(248,81,73,.4)",borderRadius:6,padding:"10px 28px",cursor:"pointer",fontSize:14,fontWeight:700}} onClick={onClose}>キャンセル</button></div>);
}

function CategorySelect({cats,l1,l2,l3,onChange,inpS}){
  const l2opts=l1?(findL1(cats,l1)?.children||[]):[];const l3opts=l2?(findL2(cats,l1,l2)?.children||[]):[];
  return(<div style={{display:"flex",flexDirection:"column",gap:8}}><div><div style={{fontSize:11,color:"#8B949E",marginBottom:3}}>大分類</div><select style={inpS} value={l1||""} onChange={e=>onChange(e.target.value,"","")}><option value="">選択してください</option>{cats.map(c=><option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}</select></div><div><div style={{fontSize:11,color:"#8B949E",marginBottom:3}}>中分類</div><select style={inpS} value={l2||""} onChange={e=>onChange(l1,e.target.value,"")} disabled={!l1}><option value="">選択してください</option>{l2opts.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div><div><div style={{fontSize:11,color:"#8B949E",marginBottom:3}}>小分類</div><select style={inpS} value={l3||""} onChange={e=>onChange(l1,l2,e.target.value)} disabled={!l2}><option value="">選択してください</option>{l3opts.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div></div>);
}

function ItemCard({item,cats,onEdit,onDelete,isAdmin}){
  const m=calcM(item.price,item.cost);const isAl=item.qty<=(item.reorderPoint||0);const l1=findL1(cats,item.catL1);const l3=findL3(cats,item.catL1,item.catL2,item.catL3);
  const badge=item.qty===0?{text:"在庫なし",col:"#F85149",bg:"rgba(248,81,73,.12)"}:isAl?{text:"⚠発注要",col:"#F85149",bg:"rgba(248,81,73,.12)"}:item.qty<=5?{text:"残りわずか",col:"#D29922",bg:"rgba(210,153,34,.12)"}:{text:"在庫あり",col:"#3FB950",bg:"rgba(63,185,80,.12)"};
  return(<div style={{background:"#21262D",border:"1px solid #30363D",borderRadius:10,padding:14,marginBottom:10}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}><div style={{flex:1,minWidth:0,marginRight:8}}><div style={{fontWeight:600,fontSize:14,lineHeight:1.4,marginBottom:2}}>{item.name}</div><div style={{fontFamily:"monospace",fontSize:10,color:"#484F58"}}>{item.jan}</div></div><span style={{flexShrink:0,background:badge.bg,color:badge.col,padding:"3px 8px",borderRadius:6,fontSize:11,fontWeight:700}}>{badge.text}</span></div>{(l1||l3)&&<div style={{fontSize:11,color:"#8B949E",marginBottom:8}}>{l1&&<span>{l1.emoji} {l1.name}</span>}{l3&&<span style={{color:"#484F58"}}> › {l3.name}</span>}</div>}<div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:8}}><div style={{background:"#1C2128",borderRadius:6,padding:"8px 10px"}}><div style={{fontSize:9,color:"#484F58",marginBottom:3}}>単価</div><div style={{fontFamily:"monospace",fontWeight:700,color:"#58A6FF",fontSize:14}}>{fmtY(item.price)}</div></div><div style={{background:"#1C2128",borderRadius:6,padding:"8px 10px"}}><div style={{fontSize:9,color:"#484F58",marginBottom:3}}>在庫数</div><div style={{fontFamily:"monospace",fontWeight:700,fontSize:20}}>{item.qty}</div></div><div style={{background:"#1C2128",borderRadius:6,padding:"8px 10px"}}><div style={{fontSize:9,color:"#484F58",marginBottom:3}}>粗利率</div><div style={{fontFamily:"monospace",fontWeight:700,color:mCol(m),fontSize:14}}>{m!==null?m+"%":"—"}</div></div></div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,fontSize:11,color:"#8B949E",marginBottom:6}}><div>仕入れ値: <span style={{fontFamily:"monospace",color:"#E6EDF3"}}>{item.cost?fmtY(item.cost):"—"}</span></div><div>発注点: <span style={{fontFamily:"monospace",color:"#E6EDF3"}}>{item.reorderPoint||0}</span></div>{item.maker&&<div>メーカー: <span style={{color:"#E6EDF3"}}>{item.maker}</span></div>}{item.supplier&&<div>仕入れ先: <span style={{color:"#E6EDF3"}}>{item.supplier}</span></div>}</div><div style={{display:"flex",gap:8,marginTop:10}}><button style={{flex:1,background:"rgba(88,166,255,.1)",color:"#58A6FF",border:"1px solid rgba(88,166,255,.3)",borderRadius:6,cursor:"pointer",fontSize:13,padding:"8px 0",fontWeight:600}} onClick={()=>onEdit(item)}>✏ 編集</button>{isAdmin&&<button style={{background:"transparent",color:"#F85149",border:"1px solid rgba(248,81,73,.3)",borderRadius:6,cursor:"pointer",fontSize:13,padding:"8px 14px"}} onClick={()=>onDelete(item.id)}>削除</button>}</div></div>);
}

export default function App(){
  // ── Auth状態 ─────────────────────────────────────────
  const[session,setSession]=useState(null);
  const[profile,setProfile]=useState(null); // {id,name,email,role,company_id}
  const[authLoading,setAuthLoading]=useState(true);
  const[authMode,setAuthMode]=useState("login"); // login | register-admin | register-staff
  const[authForm,setAuthForm]=useState({companyName:"",companyCode:"",userName:"",email:"",password:""});
  const[authError,setAuthError]=useState("");
  const[authBusy,setAuthBusy]=useState(false);
  const[staffList,setStaffList]=useState([]);

  // ── アプリ状態 ────────────────────────────────────────
  const[tab,setTab]=useState("scan");
  const[cats,setCats]=useState(CATS_INITIAL);
  const[db,setDb]=useState([]);
  const[incoming,setIncoming]=useState([]);
  const[outgoing,setOutgoing]=useState([]);
  const[dataLoading,setDataLoading]=useState(false);
  const[jan,setJan]=useState("");const[loading,setLoading]=useState(false);
  const[modal,setModal]=useState(null);
  const[arMode,setArMode]=useState("incoming");
  const[arQty,setArQty]=useState(1);
  const[arCost,setArCost]=useState("");
  const[arL1,setArL1]=useState("");const[arL2,setArL2]=useState("");const[arL3,setArL3]=useState("");
  const[arMaker,setArMaker]=useState("");const[arSupplier,setArSupplier]=useState("");
  const[arSellPrice,setArSellPrice]=useState("");const[arDestination,setArDestination]=useState("");
  const[editModal,setEditModal]=useState(null);
  const[incomingModal,setIncomingModal]=useState(null);
  const[outgoingModal,setOutgoingModal]=useState(null);
  const[toasts,setToasts]=useState([]);
  const[fCat,setFCat]=useState("all");const[fTxt,setFTxt]=useState("");
  const[fInTxt,setFInTxt]=useState("");const[fInFrom,setFInFrom]=useState("");const[fInTo,setFInTo]=useState("");
  const[fOutTxt,setFOutTxt]=useState("");const[fOutFrom,setFOutFrom]=useState("");const[fOutTo,setFOutTo]=useState("");
  const[editItem,setEditItem]=useState(null);const[showCamera,setShowCamera]=useState(false);
  const[isMobile,setIsMobile]=useState(window.innerWidth<1024);
  const[addCatModal,setAddCatModal]=useState(null);const[newCatName,setNewCatName]=useState("");const[newCatEmoji,setNewCatEmoji]=useState("📦");
  const janRef=useRef(null);

  const isAdmin=profile?.role==="admin";

  // ── 初期化 ────────────────────────────────────────────
  useEffect(()=>{
    supabase.auth.getSession().then(({data:{session}})=>{
      setSession(session);
      if(session) loadProfile(session.user.id);
      else setAuthLoading(false);
    });
    const{data:{subscription}}=supabase.auth.onAuthStateChange((_,session)=>{
      setSession(session);
      if(!session){setProfile(null);setDb([]);setIncoming([]);setOutgoing([]);setCats(CATS_INITIAL);setAuthLoading(false);}
    });
    const h=()=>setIsMobile(window.innerWidth<1024);window.addEventListener("resize",h);
    return()=>{subscription.unsubscribe();window.removeEventListener("resize",h);};
  },[]);

  async function loadProfile(userId){
    const{data}=await supabase.from("profiles").select("*").eq("id",userId).single();
    if(data){setProfile(data);await loadData(data.company_id);}
    setAuthLoading(false);
  }

  async function loadData(companyId){
    setDataLoading(true);
    const[prods,inc,out,catsRow]=await Promise.all([
      supabase.from("products").select("*").eq("company_id",companyId).order("created_at",{ascending:false}),
      supabase.from("incoming").select("*").eq("company_id",companyId).order("date",{ascending:false}),
      supabase.from("outgoing").select("*").eq("company_id",companyId).order("date",{ascending:false}),
      supabase.from("categories").select("data").eq("id",companyId+":cats").maybeSingle(),
    ]);
    if(prods.data) setDb(prods.data.map(prodFromDB));
    if(inc.data) setIncoming(inc.data.map(incFromDB));
    if(out.data) setOutgoing(out.data.map(outFromDB));
    if(catsRow.data?.data) setCats(catsRow.data.data);
    setDataLoading(false);
  }

  async function loadStaff(companyId){
    const{data}=await supabase.from("profiles").select("*").eq("company_id",companyId).order("created_at");
    if(data) setStaffList(data);
  }

  // ── 認証 ──────────────────────────────────────────────
  async function handleLogin(){
    setAuthBusy(true);setAuthError("");
    const{error}=await supabase.auth.signInWithPassword({email:authForm.email,password:authForm.password});
    if(error)setAuthError("メールアドレスまたはパスワードが違います");
    setAuthBusy(false);
  }

  async function handleRegisterAdmin(){
    if(!authForm.companyName.trim()||!authForm.userName.trim()||!authForm.email.trim()||!authForm.password.trim()){setAuthError("すべての項目を入力してください");return;}
    if(authForm.password.length<6){setAuthError("パスワードは6文字以上にしてください");return;}
    setAuthBusy(true);setAuthError("");
    // 1. Supabase Auth ユーザー作成
    const{data:authData,error:authErr}=await supabase.auth.signUp({email:authForm.email,password:authForm.password});
    if(authErr){setAuthError(authErr.message);setAuthBusy(false);return;}
    const userId=authData.user.id;
    // 2. 会社作成
    const{data:company,error:compErr}=await supabase.from("companies").insert({name:authForm.companyName}).select().single();
    if(compErr){setAuthError("会社の作成に失敗しました");setAuthBusy(false);return;}
    // 3. プロフィール作成（管理者）
    const{error:profErr}=await supabase.from("profiles").insert({id:userId,company_id:company.id,name:authForm.userName,email:authForm.email,role:"admin"});
    if(profErr){setAuthError("プロフィールの作成に失敗しました");setAuthBusy(false);return;}
    setAuthBusy(false);
  }

  async function handleRegisterStaff(){
    if(!authForm.companyCode.trim()||!authForm.userName.trim()||!authForm.email.trim()||!authForm.password.trim()){setAuthError("すべての項目を入力してください");return;}
    if(authForm.password.length<6){setAuthError("パスワードは6文字以上にしてください");return;}
    setAuthBusy(true);setAuthError("");
    // 会社コード確認
    const{data:company}=await supabase.from("companies").select("id").eq("id",authForm.companyCode.trim()).single();
    if(!company){setAuthError("会社コードが見つかりません。管理者に確認してください");setAuthBusy(false);return;}
    // Auth ユーザー作成
    const{data:authData,error:authErr}=await supabase.auth.signUp({email:authForm.email,password:authForm.password});
    if(authErr){setAuthError(authErr.message);setAuthBusy(false);return;}
    const userId=authData.user.id;
    // プロフィール作成（スタッフ）
    const{error:profErr}=await supabase.from("profiles").insert({id:userId,company_id:company.id,name:authForm.userName,email:authForm.email,role:"staff"});
    if(profErr){setAuthError("プロフィールの作成に失敗しました");setAuthBusy(false);return;}
    setAuthBusy(false);
  }

  async function handleLogout(){
    await supabase.auth.signOut();
    setProfile(null);setDb([]);setIncoming([]);setOutgoing([]);setCats(CATS_INITIAL);setTab("scan");
  }

  // ── カテゴリー変更時に自動保存 ─────────────────────────
  const catsRef=useRef(cats);
  useEffect(()=>{catsRef.current=cats;},[cats]);
  useEffect(()=>{
    if(!profile)return;
    const timer=setTimeout(async()=>{
      await supabase.from("categories").upsert({id:profile.company_id+":cats",company_id:profile.company_id,data:catsRef.current});
    },1000);
    return()=>clearTimeout(timer);
  },[cats,profile]);

  // ── スキャン処理 ──────────────────────────────────────
  const addToast=useCallback((msg,type="info")=>{const id=Date.now()+Math.random();setToasts(t=>[...t,{id,msg,type}]);setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)),3400);},[]);

  function openScanModal(product,existing){
    setModal({product,isNew:!existing,existing});setArMode("incoming");setArQty(1);
    setArCost(String(existing?.cost||""));setArL1(existing?.catL1||"");setArL2(existing?.catL2||"");setArL3(existing?.catL3||"");
    setArMaker(existing?.maker||"");setArSupplier(existing?.supplier||"");setArSellPrice(String(product.price||""));setArDestination("");
  }

  const processJan=useCallback(async(code)=>{
    code=code.trim().replace(/\D/g,"");
    if(code.length<8){addToast("8〜13桁のJANコードを入力してください","err");return;}
    const local=PRODUCTS[code];
    if(local){const existing=db.find(i=>i.jan===code)||null;openScanModal({jan:code,name:local.name,price:local.price,cost:0},existing);setJan("");return;}
    setLoading(true);addToast("商品情報を検索中…","info");
    try{
      const res=await fetch("/api/search?jan="+encodeURIComponent(code));const data=await res.json();
      const product=res.ok&&data.name?{jan:code,name:data.name,price:data.price||0,cost:0}:{jan:code,name:"商品 (JAN:"+code+")",price:0,cost:0};
      if(res.ok&&data.name)addToast("商品情報を取得しました","ok");else addToast("商品が見つかりません。手入力してください","info");
      openScanModal(product,db.find(i=>i.jan===code)||null);setJan("");
    }catch(e){openScanModal({jan:code,name:"商品 (JAN:"+code+")",price:0,cost:0},db.find(i=>i.jan===code)||null);setJan("");addToast("通信エラー。手入力してください","err");}
    setLoading(false);
  },[db,addToast]);

  const handleCameraDetect=useCallback((code)=>{setShowCamera(false);addToast("スキャン成功: "+code,"ok");setTimeout(()=>processJan(code),300);},[processJan,addToast]);

  async function confirmScan(){
    if(!modal||!profile)return;const{product,isNew,existing}=modal;
    if(arMode==="incoming"){
      const cost=parseInt(arCost)||0;
      if(isNew){
        const{data,error}=await supabase.from("products").insert(prodToDB({...product,cost,qty:arQty,reorderPoint:5,catL1:arL1,catL2:arL2,catL3:arL3,maker:arMaker,supplier:arSupplier,addedAt:today()},profile.company_id)).select().single();
        if(error){addToast("エラーが発生しました","err");return;}
        setDb(d=>[prodFromDB(data),...d]);addToast("新規登録＋入庫 ("+arQty+"個)","ok");
      }else{
        const newQty=existing.qty+arQty;
        const{error}=await supabase.from("products").update({qty:newQty,cost:cost||existing.cost||0,cat_l1:arL1||existing.catL1,cat_l2:arL2||existing.catL2,cat_l3:arL3||existing.catL3,maker:arMaker||existing.maker,supplier:arSupplier||existing.supplier}).eq("id",existing.id);
        if(error){addToast("エラーが発生しました","err");return;}
        setDb(d=>d.map(i=>i.id===existing.id?{...i,qty:newQty,cost:cost||i.cost,catL1:arL1||i.catL1,catL2:arL2||i.catL2,catL3:arL3||i.catL3,maker:arMaker||i.maker,supplier:arSupplier||i.supplier}:i));
        addToast("入庫 +"+arQty+"個 (計"+newQty+"個)","ok");
      }
      const c=cost||existing?.cost||0;
      if(c>0){const{data}=await supabase.from("incoming").insert(incToDB({date:today(),jan:product.jan,name:product.name,qty:arQty,cost:c,totalCost:arQty*c,maker:arMaker||existing?.maker||"",supplier:arSupplier||existing?.supplier||"",note:""},profile.company_id)).select().single();if(data)setIncoming(h=>[incFromDB(data),...h]);}
    }else{
      if(!existing){addToast("未登録商品は出庫できません","err");return;}
      const sp=parseInt(arSellPrice)||existing.price||0;
      if(existing.qty<arQty){if(!window.confirm("在庫が不足しています（現在"+existing.qty+"個）。このまま出庫しますか？"))return;}
      const{error}=await supabase.from("products").update({qty:Math.max(0,existing.qty-arQty)}).eq("id",existing.id);
      if(error){addToast("エラーが発生しました","err");return;}
      setDb(d=>d.map(i=>i.id===existing.id?{...i,qty:Math.max(0,i.qty-arQty)}:i));
      const{data}=await supabase.from("outgoing").insert(outToDB({date:today(),jan:product.jan,name:product.name,qty:arQty,price:sp,totalPrice:arQty*sp,destination:arDestination,note:""},profile.company_id)).select().single();
      if(data)setOutgoing(o=>[outFromDB(data),...o]);
      addToast("出庫 -"+arQty+"個","ok");
    }
    setModal(null);
  }

  // カテゴリー管理
  function openAddCat(level,l1id,l2id){setAddCatModal({level,l1id:l1id||null,l2id:l2id||null});setNewCatName("");setNewCatEmoji("📦");}
  function confirmAddCat(){if(!newCatName.trim()){addToast("名前を入力してください","err");return;}const id="c"+Date.now();const{level,l1id,l2id}=addCatModal;if(level===1)setCats(c=>[...c,{id,name:newCatName,emoji:newCatEmoji,children:[]}]);else if(level===2)setCats(c=>c.map(l1=>l1.id!==l1id?l1:{...l1,children:[...l1.children,{id,name:newCatName,children:[]}]}));else setCats(c=>c.map(l1=>l1.id!==l1id?l1:{...l1,children:l1.children.map(l2=>l2.id!==l2id?l2:{...l2,children:[...l2.children,{id,name:newCatName}]})}));setAddCatModal(null);addToast("カテゴリーを追加しました","ok");}
  function delL1(l1id){if(!window.confirm("削除しますか？"))return;setCats(c=>c.filter(l=>l.id!==l1id));}
  function delL2(l1id,l2id){if(!window.confirm("削除しますか？"))return;setCats(c=>c.map(l1=>l1.id!==l1id?l1:{...l1,children:l1.children.filter(l=>l.id!==l2id)}));}
  function delL3(l1id,l2id,l3id){if(!window.confirm("削除しますか？"))return;setCats(c=>c.map(l1=>l1.id!==l1id?l1:{...l1,children:l1.children.map(l2=>l2.id!==l2id?l2:{...l2,children:l2.children.filter(l=>l.id!==l3id)})}));}

  // 入庫手動追加
  async function confirmAddIncoming(){
    if(!incomingModal||!profile)return;if(!incomingModal.name.trim()){addToast("商品名を入力してください","err");return;}
    const rec={...incomingModal,totalCost:(incomingModal.qty||0)*(incomingModal.cost||0)};
    const{data,error}=await supabase.from("incoming").insert(incToDB(rec,profile.company_id)).select().single();
    if(error){addToast("エラーが発生しました","err");return;}
    setIncoming(h=>[incFromDB(data),...h]);
    if(incomingModal.jan){const{data:prod}=await supabase.from("products").select("qty").eq("company_id",profile.company_id).eq("jan",incomingModal.jan).single();if(prod){const newQty=prod.qty+(incomingModal.qty||0);await supabase.from("products").update({qty:newQty}).eq("company_id",profile.company_id).eq("jan",incomingModal.jan);setDb(d=>d.map(i=>i.jan===incomingModal.jan?{...i,qty:newQty}:i));}}
    setIncomingModal(null);addToast("入庫履歴を追加（在庫+"+incomingModal.qty+"個）","ok");
  }

  // 出庫手動追加
  async function confirmAddOutgoing(){
    if(!outgoingModal||!profile)return;if(!outgoingModal.name.trim()){addToast("商品名を入力してください","err");return;}if(!outgoingModal.qty||outgoingModal.qty<1){addToast("出庫数量を入力してください","err");return;}
    const item=db.find(i=>i.jan===outgoingModal.jan);
    if(item&&item.qty<outgoingModal.qty){if(!window.confirm("在庫が不足しています（現在"+item.qty+"個）。このまま出庫しますか？"))return;}
    if(item){const newQty=Math.max(0,item.qty-outgoingModal.qty);await supabase.from("products").update({qty:newQty}).eq("id",item.id);setDb(d=>d.map(i=>i.id===item.id?{...i,qty:newQty}:i));}
    const rec={date:outgoingModal.date,jan:outgoingModal.jan,name:outgoingModal.name,qty:outgoingModal.qty,price:outgoingModal.price,totalPrice:outgoingModal.qty*outgoingModal.price,destination:outgoingModal.destination,note:outgoingModal.note};
    const{data,error}=await supabase.from("outgoing").insert(outToDB(rec,profile.company_id)).select().single();
    if(error){addToast("エラーが発生しました","err");return;}
    setOutgoing(o=>[outFromDB(data),...o]);setOutgoingModal(null);addToast("出庫を記録（在庫-"+outgoingModal.qty+"個）","ok");
  }

  async function saveEditModal(){
    if(!editModal||!profile)return;
    const{error}=await supabase.from("products").update(prodToDB(editModal,profile.company_id)).eq("id",editModal.id);
    if(error){addToast("エラーが発生しました","err");return;}
    setDb(d=>d.map(i=>i.id===editModal.id?editModal:i));setEditModal(null);addToast("保存しました","ok");
  }

  async function saveEdit(id,field,val){
    const isNum=["price","cost","qty","reorderPoint"].includes(field);
    const numVal=isNum?Number(val)||0:val;
    const colMap={price:"price",cost:"cost",qty:"qty",reorderPoint:"reorder_point",name:"name",jan:"jan",maker:"maker",supplier:"supplier"};
    await supabase.from("products").update({[colMap[field]||field]:numVal}).eq("id",id);
    setDb(d=>d.map(i=>i.id!==id?i:{...i,[field]:numVal}));setEditItem(null);
  }

  async function deleteProduct(id){
    await supabase.from("products").delete().eq("id",id);
    setDb(d=>d.filter(i=>i.id!==id));addToast("削除しました","info");
  }
  async function deleteIncoming(h){
    await supabase.from("incoming").delete().eq("id",h.id);
    if(h.jan){const ex=db.find(i=>i.jan===h.jan);if(ex){const newQty=Math.max(0,ex.qty-(h.qty||0));await supabase.from("products").update({qty:newQty}).eq("id",ex.id);setDb(d=>d.map(i=>i.id===ex.id?{...i,qty:newQty}:i));}}
    setIncoming(s=>s.filter(x=>x.id!==h.id));addToast("削除しました","info");
  }
  async function deleteOutgoing(o){
    await supabase.from("outgoing").delete().eq("id",o.id);
    if(o.jan){const ex=db.find(i=>i.jan===o.jan);if(ex){const newQty=ex.qty+(o.qty||0);await supabase.from("products").update({qty:newQty}).eq("id",ex.id);setDb(d=>d.map(i=>i.id===ex.id?{...i,qty:newQty}:i));}}
    setOutgoing(s=>s.filter(x=>x.id!==o.id));addToast("削除しました","info");
  }

  // 計算
  const alerts=useMemo(()=>db.filter(i=>i.qty<=(i.reorderPoint||0)),[db]);
  const totalV=db.reduce((s,i)=>s+i.price*i.qty,0);
  const totalC=db.reduce((s,i)=>s+(i.cost||0)*i.qty,0);
  const rows=useMemo(()=>db.filter(i=>{if(fCat==="alert")return i.qty<=(i.reorderPoint||0);if(fCat==="")return !i.catL1;if(fCat!=="all")return i.catL1===fCat;return true;}).filter(i=>{if(!fTxt)return true;const t=fTxt.toLowerCase();return i.name.toLowerCase().includes(t)||i.jan.includes(t)||(i.maker||"").toLowerCase().includes(t);}),[db,fCat,fTxt]);
  const inRows=useMemo(()=>incoming.filter(h=>{if(fInFrom&&h.date<fInFrom)return false;if(fInTo&&h.date>fInTo)return false;if(fInTxt){const t=fInTxt.toLowerCase();if(!h.name.toLowerCase().includes(t)&&!h.jan.includes(t)&&!(h.supplier||"").toLowerCase().includes(t))return false;}return true;}),[incoming,fInTxt,fInFrom,fInTo]);
  const outRows=useMemo(()=>outgoing.filter(o=>{if(fOutFrom&&o.date<fOutFrom)return false;if(fOutTo&&o.date>fOutTo)return false;if(fOutTxt){const t=fOutTxt.toLowerCase();if(!o.name.toLowerCase().includes(t)&&!o.jan.includes(t)&&!(o.destination||"").toLowerCase().includes(t))return false;}return true;}),[outgoing,fOutTxt,fOutFrom,fOutTo]);
  const recentActivity=useMemo(()=>[...incoming.map(h=>({...h,type:"in"})),...outgoing.map(o=>({...o,type:"out"}))].sort((a,b)=>b.date.localeCompare(a.date)||b.id-a.id).slice(0,8),[incoming,outgoing]);

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
    if(editItem&&editItem.id===item.id&&editItem.field===field){return<input autoFocus type={isNum?"number":"text"} defaultValue={item[field]} style={{...eInp,width:width||80}} onBlur={e=>saveEdit(item.id,field,e.target.value)} onKeyDown={e=>{if(e.key==="Enter")saveEdit(item.id,field,e.target.value);if(e.key==="Escape")setEditItem(null);}}/>;}
    return<span style={{cursor:"pointer",fontFamily:mono?"monospace":"inherit"}} onDoubleClick={()=>setEditItem({id:item.id,field})} title="ダブルクリックで編集">{display}</span>;
  }
  function FilterBar({from,setFrom,to,setTo,txt,setTxt,placeholder}){
    return(<div style={{background:"#161B22",borderBottom:"1px solid #30363D",padding:12}}><div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}><input style={{...inpS,width:130}} type="date" value={from} onChange={e=>setFrom(e.target.value)}/><span style={{color:"#484F58",fontSize:12}}>〜</span><input style={{...inpS,width:130}} type="date" value={to} onChange={e=>setTo(e.target.value)}/><input style={{...inpS,flex:1,minWidth:120}} type="text" placeholder={placeholder} value={txt} onChange={e=>setTxt(e.target.value)}/>{(from||to||txt)&&<button style={btnG} onClick={()=>{setFrom("");setTo("");setTxt("");}}>クリア</button>}</div></div>);
  }

  // ── ローディング中 ────────────────────────────────────
  if(authLoading){return(<div style={{minHeight:"100vh",background:"#0D1117",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16}}><div style={{fontSize:32}}>📦</div><div style={{color:"#8B949E",fontSize:14}}>読み込み中…</div></div>);}

  // ── 認証画面 ──────────────────────────────────────────
  if(!session||!profile){
    return(
      <div style={{minHeight:"100vh",background:"#0D1117",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
        <div style={{width:"100%",maxWidth:400}}>
          <div style={{textAlign:"center",marginBottom:32}}>
            <div style={{fontSize:48,marginBottom:8}}>📦</div>
            <div style={{fontSize:28,fontWeight:800,color:"#E6EDF3"}}>Stock<span style={{color:"#58A6FF"}}>Master</span></div>
            <div style={{fontSize:13,color:"#484F58",marginTop:4}}>在庫管理システム</div>
          </div>

          {/* タブ切り替え */}
          <div style={{display:"flex",background:"#161B22",borderRadius:8,padding:4,marginBottom:20,border:"1px solid #30363D"}}>
            {[["login","ログイン"],["register-admin","新規登録（管理者）"],["register-staff","スタッフとして参加"]].map(([m,l])=>(
              <button key={m} style={{flex:1,padding:"8px 4px",borderRadius:6,border:"none",cursor:"pointer",fontSize:11,fontWeight:600,background:authMode===m?"#1F6FEB":"transparent",color:authMode===m?"#fff":"#8B949E",transition:"all .15s"}} onClick={()=>{setAuthMode(m);setAuthError("");}}>
                {l}
              </button>
            ))}
          </div>

          <div style={{background:"#161B22",borderRadius:10,border:"1px solid #30363D",padding:20,display:"flex",flexDirection:"column",gap:12}}>
            {authMode==="register-admin"&&(
              <div><div style={{fontSize:11,color:"#8B949E",marginBottom:4}}>会社名・店舗名</div><input style={inpS} type="text" placeholder="例：清水商店" value={authForm.companyName} onChange={e=>setAuthForm(f=>({...f,companyName:e.target.value}))}/></div>
            )}
            {authMode==="register-staff"&&(
              <div><div style={{fontSize:11,color:"#8B949E",marginBottom:4}}>会社コード（管理者から入手）</div><input style={inpS} type="text" placeholder="管理者から共有されたコード" value={authForm.companyCode} onChange={e=>setAuthForm(f=>({...f,companyCode:e.target.value}))}/></div>
            )}
            {authMode!=="login"&&(
              <div><div style={{fontSize:11,color:"#8B949E",marginBottom:4}}>氏名</div><input style={inpS} type="text" placeholder="例：清水 寛" value={authForm.userName} onChange={e=>setAuthForm(f=>({...f,userName:e.target.value}))}/></div>
            )}
            <div><div style={{fontSize:11,color:"#8B949E",marginBottom:4}}>メールアドレス</div><input style={inpS} type="email" placeholder="example@email.com" value={authForm.email} onChange={e=>setAuthForm(f=>({...f,email:e.target.value}))}/></div>
            <div><div style={{fontSize:11,color:"#8B949E",marginBottom:4}}>パスワード{authMode!=="login"&&<span style={{color:"#484F58"}}> (6文字以上)</span>}</div><input style={inpS} type="password" placeholder="パスワード" value={authForm.password} onChange={e=>setAuthForm(f=>({...f,password:e.target.value}))} onKeyDown={e=>{if(e.key==="Enter"&&!authBusy){if(authMode==="login")handleLogin();else if(authMode==="register-admin")handleRegisterAdmin();else handleRegisterStaff();}}}/></div>
            {authError&&<div style={{background:"rgba(248,81,73,.1)",border:"1px solid rgba(248,81,73,.3)",borderRadius:6,padding:"8px 12px",fontSize:12,color:"#F85149"}}>{authError}</div>}
            {authMode==="register-admin"&&<div style={{background:"rgba(88,166,255,.1)",border:"1px solid rgba(88,166,255,.2)",borderRadius:6,padding:"8px 12px",fontSize:11,color:"#58A6FF"}}>登録後に「会社コード」が発行されます。スタッフへ共有するとチームで使えます。</div>}
            <button style={{...btnP,padding:"12px",fontSize:14,opacity:authBusy?0.6:1}} onClick={()=>{if(authMode==="login")handleLogin();else if(authMode==="register-admin")handleRegisterAdmin();else handleRegisterStaff();}} disabled={authBusy}>
              {authBusy?"処理中…":authMode==="login"?"ログイン":authMode==="register-admin"?"管理者として登録":"スタッフとして参加"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── データ読み込み中 ──────────────────────────────────
  if(dataLoading){return(<div style={{minHeight:"100vh",background:"#0D1117",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16}}><div style={{fontSize:32}}>📦</div><div style={{color:"#8B949E",fontSize:14}}>データを読み込み中…</div></div>);}

  return(
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",background:"#0D1117",color:"#E6EDF3",fontFamily:"system-ui,sans-serif",fontSize:14}}>

      {/* TOPBAR */}
      <div style={{height:52,background:"#161B22",borderBottom:"1px solid #30363D",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 16px",position:"sticky",top:0,zIndex:300}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{fontSize:18,fontWeight:800}}>Stock<span style={{color:"#58A6FF"}}>Master</span></div>
          <span style={{fontSize:10,color:isAdmin?"#3FB950":"#58A6FF",background:"#21262D",border:"1px solid #30363D",padding:"2px 6px",borderRadius:4}}>{isAdmin?"👑 管理者":"👤 スタッフ"}</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{textAlign:"right"}}><div style={{fontFamily:"monospace",fontSize:13,fontWeight:600}}>{db.length}</div><div style={{fontSize:9,color:"#484F58"}}>SKU</div></div>
          <div style={{textAlign:"right"}}><div style={{fontFamily:"monospace",fontSize:13,fontWeight:600,color:"#58A6FF"}}>{fmtY(totalV)}</div><div style={{fontSize:9,color:"#484F58"}}>売価</div></div>
          {alerts.length>0&&<div style={{textAlign:"right"}}><div style={{fontFamily:"monospace",fontSize:13,fontWeight:600,color:"#F85149"}}>{alerts.length}</div><div style={{fontSize:9,color:"#484F58"}}>要発注</div></div>}
          <span style={{fontSize:11,color:"#8B949E"}}>{profile.name}</span>
          <button style={{background:"transparent",border:"1px solid #30363D",borderRadius:4,cursor:"pointer",color:"#484F58",fontSize:10,padding:"3px 8px"}} onClick={handleLogout}>ログアウト</button>
        </div>
      </div>

      {/* NAV */}
      <div style={{background:"#161B22",borderBottom:"1px solid #30363D",display:"flex",padding:"0 8px",overflowX:"auto"}}>
        {[
          ["scan","📷 スキャン"],
          ["inventory","📦 在庫一覧"],
          ["incoming","📥 入庫履歴"],
          ["outgoing","📤 出庫履歴"],
          ...(isAdmin?[["dashboard","📊 分析"],["categories","🗂 カテゴリ登録"],["staff","👥 スタッフ管理"]]:[]),
        ].map(it=>(
          <div key={it[0]} style={{flexShrink:0,padding:"10px 12px",fontSize:13,fontWeight:500,color:tab===it[0]?"#58A6FF":"#8B949E",cursor:"pointer",borderBottom:tab===it[0]?"2px solid #58A6FF":"2px solid transparent"}} onClick={()=>{setTab(it[0]);if(it[0]==="staff")loadStaff(profile.company_id);}}>
            {it[1]}{it[0]==="inventory"&&alerts.length>0&&<span style={{marginLeft:4,background:"#F85149",color:"#fff",fontSize:9,padding:"1px 4px",borderRadius:9,fontWeight:700}}>{alerts.length}</span>}
          </div>
        ))}
      </div>

      {/* スキャンタブ */}
      {tab==="scan"&&(
        <div style={{display:"flex",flexDirection:"column",flex:1,padding:20,gap:16,maxWidth:520,margin:"0 auto",width:"100%"}}>
          <button style={{background:"#238636",border:"none",borderRadius:16,cursor:"pointer",padding:"32px 20px",display:"flex",flexDirection:"column",alignItems:"center",gap:12,width:"100%",boxShadow:"0 4px 24px rgba(35,134,54,.3)"}} onClick={()=>setShowCamera(true)}>
            <span style={{fontSize:56}}>📷</span>
            <span style={{fontSize:18,fontWeight:800,color:"#fff"}}>バーコードをスキャン</span>
            <span style={{fontSize:12,color:"rgba(255,255,255,.7)"}}>カメラを起動してJANコードを読み取ります</span>
          </button>
          <div style={{background:"#161B22",borderRadius:10,border:"1px solid #30363D",padding:14}}>
            <div style={{fontSize:12,color:"#8B949E",marginBottom:8,fontWeight:600}}>JANコード手入力</div>
            <div style={{display:"flex",gap:8}}>
              <input ref={janRef} style={{background:"#1C2128",border:"1px solid #30363D",borderRadius:6,color:"#E6EDF3",fontFamily:"monospace",fontSize:16,padding:"10px 12px",outline:"none",flex:1,letterSpacing:2}} type="text" inputMode="numeric" placeholder="490XXXXXXXXXX" value={jan} onChange={e=>setJan(e.target.value.replace(/\D/g,"").slice(0,13))} onKeyDown={e=>{if(e.key==="Enter"&&!loading)processJan(jan);}} maxLength={13}/>
              <button style={{...btnP,fontSize:15,padding:"10px 20px",opacity:loading||!jan.trim()?0.4:1}} onClick={()=>processJan(jan)} disabled={loading||!jan.trim()}>{loading?"…":"検索"}</button>
            </div>
          </div>
          <div style={{background:"#161B22",borderRadius:10,border:"1px solid #30363D",padding:14}}>
            <div style={{fontSize:12,color:"#8B949E",marginBottom:10,fontWeight:600}}>最近の入出庫</div>
            {recentActivity.length===0?<div style={{textAlign:"center",color:"#484F58",fontSize:12,padding:"16px 0"}}>まだ記録がありません</div>:recentActivity.map(r=>(
              <div key={r.type+r.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid #21262D"}}>
                <span style={{fontSize:16,flexShrink:0}}>{r.type==="in"?"📥":"📤"}</span>
                <div style={{flex:1,minWidth:0}}><div style={{fontSize:12,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.name}</div><div style={{fontSize:10,color:"#484F58"}}>{r.date}</div></div>
                <div style={{textAlign:"right",flexShrink:0}}><div style={{fontFamily:"monospace",fontWeight:700,color:r.type==="in"?"#3FB950":"#F85149",fontSize:13}}>{r.type==="in"?"+":"-"}{r.qty}個</div><div style={{fontFamily:"monospace",fontSize:10,color:"#484F58"}}>{r.type==="in"?fmtY(r.totalCost):fmtY(r.totalPrice)}</div></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 在庫一覧タブ */}
      {tab==="inventory"&&(
        <div style={{display:"flex",flexDirection:"column",flex:1,minHeight:0}}>
          {alerts.length>0&&<div style={{margin:"10px 16px 0",background:"rgba(248,81,73,.1)",border:"1px solid rgba(248,81,73,.3)",borderRadius:8,padding:"8px 12px",color:"#F85149",fontSize:13}}>⚠️ <strong>{alerts.length}件</strong>が発注点以下です</div>}
          <div style={{display:"flex",alignItems:"center",gap:6,overflowX:"auto",padding:"10px 16px 4px"}}>
            {[["all","すべて",db.length],["","未分類",db.filter(i=>!i.catL1).length]].map(x=><div key={x[0]} style={{flexShrink:0,padding:"5px 12px",borderRadius:20,border:fCat===x[0]?"1px solid #1F6FEB":"1px solid #30363D",background:fCat===x[0]?"#1F6FEB":"#21262D",fontSize:12,fontWeight:500,color:fCat===x[0]?"#fff":"#8B949E",cursor:"pointer"}} onClick={()=>setFCat(x[0])}>{x[1]} <span style={{fontSize:9,opacity:.7}}>{x[2]}</span></div>)}
            {alerts.length>0&&<div style={{flexShrink:0,padding:"5px 12px",borderRadius:20,border:fCat==="alert"?"1px solid #F85149":"1px solid rgba(248,81,73,.4)",background:fCat==="alert"?"#F85149":"rgba(248,81,73,.1)",fontSize:12,fontWeight:500,color:fCat==="alert"?"#fff":"#F85149",cursor:"pointer"}} onClick={()=>setFCat("alert")}>⚠ 要発注 <span style={{fontSize:9,opacity:.8}}>{alerts.length}</span></div>}
            {cats.map(cat=><div key={cat.id} style={{flexShrink:0,padding:"5px 12px",borderRadius:20,border:fCat===cat.id?"1px solid #1F6FEB":"1px solid #30363D",background:fCat===cat.id?"#1F6FEB":"#21262D",fontSize:12,fontWeight:500,color:fCat===cat.id?"#fff":"#8B949E",cursor:"pointer"}} onClick={()=>setFCat(cat.id)}>{cat.emoji} {cat.name} <span style={{fontSize:9,opacity:.7}}>{db.filter(i=>i.catL1===cat.id).length}</span></div>)}
          </div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 16px 6px"}}>
            <div style={{fontSize:14,fontWeight:700}}>商品マスタ <span style={{fontSize:12,color:"#484F58",fontWeight:400}}>({rows.length}件)</span></div>
            <div style={{display:"flex",gap:6}}>
              <input style={{background:"#21262D",border:"1px solid #30363D",borderRadius:6,color:"#E6EDF3",fontSize:12,padding:"6px 10px",outline:"none",width:120}} placeholder="商品名/JAN…" value={fTxt} onChange={e=>setFTxt(e.target.value)}/>
              <button style={{background:"rgba(63,185,80,.12)",color:"#3FB950",border:"1px solid rgba(63,185,80,.3)",borderRadius:6,cursor:"pointer",fontWeight:600,fontSize:12,padding:"6px 10px"}} onClick={()=>{exportCSV(db,cats);addToast("CSV出力","ok");}}>⬇ CSV</button>
              {isAdmin&&<button style={{background:"rgba(210,153,34,.12)",color:"#D29922",border:"1px solid rgba(210,153,34,.3)",borderRadius:6,cursor:"pointer",fontWeight:600,fontSize:12,padding:"6px 10px"}} onClick={()=>{exportInventoryCSV(db,cats);addToast("棚卸しCSV","ok");}}>📋 棚卸し</button>}
            </div>
          </div>
          {isMobile?(
            <div style={{padding:"0 16px 20px",flex:1,overflowY:"auto"}}>
              {rows.length===0?<div style={{padding:"40px 20px",textAlign:"center",color:"#484F58"}}><div style={{fontSize:40}}>📋</div>商品がありません</div>:rows.map(item=><ItemCard key={item.id} item={item} cats={cats} isAdmin={isAdmin} onEdit={setEditModal} onDelete={deleteProduct}/>)}
            </div>
          ):(
            <div style={{flex:1,overflow:"auto",padding:"0 16px 20px"}}>
              {rows.length===0?<div style={{padding:"40px 20px",textAlign:"center",color:"#484F58"}}><div style={{fontSize:40}}>📋</div>商品がありません</div>:(
                <div style={{background:"#21262D",borderRadius:8,border:"1px solid #30363D",overflow:"hidden",marginTop:4}}>
                  <table style={{width:"100%",borderCollapse:"collapse",minWidth:1000}}>
                    <thead><tr style={{background:"#1C2128"}}>{["JAN","商品名","大分類","小分類","メーカー","仕入れ先","単価","仕入れ値","粗利率","在庫","発注点","状態","登録日",...(isAdmin?[""]:[])] .map(h=><th key={h} style={thS}>{h}</th>)}</tr></thead>
                    <tbody>{rows.map(item=>{const m=calcM(item.price,item.cost);const isAl=item.qty<=(item.reorderPoint||0);const l1=findL1(cats,item.catL1);const l3=findL3(cats,item.catL1,item.catL2,item.catL3);return(
                      <tr key={item.id}>
                        <td style={{...tdS,fontFamily:"monospace",fontSize:10,color:"#484F58"}}>{EditCell(item,"jan",item.jan,110,true)}</td>
                        <td style={{...tdS,maxWidth:150}}>{EditCell(item,"name",item.name,130,false)}</td>
                        <td style={tdS}>{l1?<span style={{fontSize:11,fontWeight:600}}>{l1.emoji} {l1.name}</span>:<span style={{color:"#484F58",fontSize:11}}>—</span>}</td>
                        <td style={{...tdS,fontSize:11,color:"#8B949E"}}>{l3?l3.name:"—"}</td>
                        <td style={tdS}>{EditCell(item,"maker",item.maker||"—",90,false)}</td>
                        <td style={tdS}>{EditCell(item,"supplier",item.supplier||"—",90,false)}</td>
                        <td style={{...tdS,fontFamily:"monospace",color:"#58A6FF",fontWeight:600}}>{EditCell(item,"price",fmtY(item.price),80,true)}</td>
                        <td style={{...tdS,fontFamily:"monospace",color:"#8B949E"}}>{EditCell(item,"cost",item.cost?fmtY(item.cost):"—",80,true)}</td>
                        <td style={{...tdS,fontFamily:"monospace",fontWeight:600,color:mCol(m)}}>{m!==null?m+"%":"—"}</td>
                        <td style={{...tdS,fontFamily:"monospace",fontWeight:700}}>{EditCell(item,"qty",item.qty,60,true)}</td>
                        <td style={{...tdS,fontFamily:"monospace",color:"#484F58"}}>{EditCell(item,"reorderPoint",item.reorderPoint||0,60,true)}</td>
                        <td style={tdS}>{item.qty===0?<span style={{background:"rgba(248,81,73,.12)",color:"#F85149",padding:"2px 6px",borderRadius:4,fontSize:10,fontWeight:700}}>在庫なし</span>:isAl?<span style={{background:"rgba(248,81,73,.12)",color:"#F85149",padding:"2px 6px",borderRadius:4,fontSize:10,fontWeight:700}}>⚠発注要</span>:item.qty<=5?<span style={{background:"rgba(210,153,34,.12)",color:"#D29922",padding:"2px 6px",borderRadius:4,fontSize:10,fontWeight:700}}>残りわずか</span>:<span style={{background:"rgba(63,185,80,.12)",color:"#3FB950",padding:"2px 6px",borderRadius:4,fontSize:10,fontWeight:700}}>在庫あり</span>}</td>
                        <td style={{...tdS,fontSize:10,color:"#484F58"}}>{item.addedAt}</td>
                        {isAdmin&&<td style={tdS}><button style={btnD} onClick={()=>deleteProduct(item.id)}>削除</button></td>}
                      </tr>
                    );})}</tbody>
                  </table>
                </div>
              )}
              {rows.length>0&&<div style={{marginTop:6,fontSize:11,color:"#484F58"}}>💡 各セルをダブルクリックで編集できます</div>}
            </div>
          )}
        </div>
      )}

      {/* 入庫履歴タブ */}
      {tab==="incoming"&&(
        <div style={{display:"flex",flexDirection:"column",flex:1,minHeight:0}}>
          <FilterBar from={fInFrom} setFrom={setFInFrom} to={fInTo} setTo={setFInTo} txt={fInTxt} setTxt={setFInTxt} placeholder="商品名/JAN/仕入れ先…"/>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 16px 6px"}}>
            <div style={{fontSize:14,fontWeight:700}}>📥 入庫履歴 <span style={{fontSize:12,color:"#484F58",fontWeight:400}}>({inRows.length}件 / <span style={{color:"#3FB950",fontWeight:600}}>{fmtY(inRows.reduce((s,h)=>s+h.totalCost,0))}</span>)</span></div>
            <div style={{display:"flex",gap:6}}>
              <button style={{...btnP,background:"#238636"}} onClick={()=>setIncomingModal({date:today(),jan:"",name:"",qty:1,cost:0,totalCost:0,maker:"",supplier:"",note:""})}>+ 手動追加</button>
              <button style={{background:"rgba(63,185,80,.12)",color:"#3FB950",border:"1px solid rgba(63,185,80,.3)",borderRadius:6,cursor:"pointer",fontWeight:600,fontSize:12,padding:"6px 10px"}} onClick={()=>{exportIncomingCSV(inRows);addToast("CSV出力","ok");}}>⬇ CSV</button>
            </div>
          </div>
          <div style={{flex:1,overflow:"auto",padding:"0 16px 20px"}}>
            {inRows.length===0?<div style={{padding:"40px 20px",textAlign:"center",color:"#484F58"}}><div style={{fontSize:40}}>📥</div>入庫履歴がありません</div>:(
              <div style={{background:"#21262D",borderRadius:8,border:"1px solid #30363D",overflow:"hidden",marginTop:4}}>
                <table style={{width:"100%",borderCollapse:"collapse",minWidth:700}}>
                  <thead><tr style={{background:"#1C2128"}}>{["入庫日","商品名","JAN","入庫数","仕入れ単価","仕入れ合計","メーカー","仕入れ先","備考",""].map(h=><th key={h} style={thS}>{h}</th>)}</tr></thead>
                  <tbody>{inRows.map(h=>(
                    <tr key={h.id}>
                      <td style={{...tdS,fontFamily:"monospace",color:"#3FB950",fontWeight:600}}>{h.date}</td>
                      <td style={{...tdS,maxWidth:160}}>{h.name}</td>
                      <td style={{...tdS,fontFamily:"monospace",fontSize:10,color:"#484F58"}}>{h.jan}</td>
                      <td style={{...tdS,fontFamily:"monospace",fontWeight:700,textAlign:"right"}}>{h.qty}</td>
                      <td style={{...tdS,fontFamily:"monospace",color:"#8B949E",textAlign:"right"}}>{fmtY(h.cost)}</td>
                      <td style={{...tdS,fontFamily:"monospace",fontWeight:700,color:"#3FB950",textAlign:"right"}}>{fmtY(h.totalCost)}</td>
                      <td style={{...tdS,color:"#8B949E"}}>{h.maker||"—"}</td>
                      <td style={{...tdS,color:"#8B949E"}}>{h.supplier||"—"}</td>
                      <td style={{...tdS,color:"#484F58"}}>{h.note||"—"}</td>
                      <td style={tdS}><button style={btnD} onClick={()=>deleteIncoming(h)}>削除</button></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 出庫履歴タブ */}
      {tab==="outgoing"&&(
        <div style={{display:"flex",flexDirection:"column",flex:1,minHeight:0}}>
          <FilterBar from={fOutFrom} setFrom={setFOutFrom} to={fOutTo} setTo={setFOutTo} txt={fOutTxt} setTxt={setFOutTxt} placeholder="商品名/JAN/販売先…"/>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 16px 6px"}}>
            <div style={{fontSize:14,fontWeight:700}}>📤 出庫履歴 <span style={{fontSize:12,color:"#484F58",fontWeight:400}}>({outRows.length}件 / <span style={{color:"#58A6FF",fontWeight:600}}>{fmtY(outRows.reduce((s,o)=>s+o.totalPrice,0))}</span>)</span></div>
            <div style={{display:"flex",gap:6}}>
              <button style={{...btnP,background:"#8B5CF6"}} onClick={()=>setOutgoingModal({date:today(),jan:"",name:"",qty:1,price:0,totalPrice:0,destination:"",note:""})}>+ 手動追加</button>
              <button style={{background:"rgba(88,166,255,.12)",color:"#58A6FF",border:"1px solid rgba(88,166,255,.3)",borderRadius:6,cursor:"pointer",fontWeight:600,fontSize:12,padding:"6px 10px"}} onClick={()=>{exportOutgoingCSV(outRows);addToast("CSV出力","ok");}}>⬇ CSV</button>
            </div>
          </div>
          <div style={{flex:1,overflow:"auto",padding:"0 16px 20px"}}>
            {outRows.length===0?<div style={{padding:"40px 20px",textAlign:"center",color:"#484F58"}}><div style={{fontSize:40}}>📤</div>出庫履歴がありません</div>:(
              <div style={{background:"#21262D",borderRadius:8,border:"1px solid #30363D",overflow:"hidden",marginTop:4}}>
                <table style={{width:"100%",borderCollapse:"collapse",minWidth:700}}>
                  <thead><tr style={{background:"#1C2128"}}>{["出庫日","商品名","JAN","出庫数","販売単価","合計売上","販売先","備考",""].map(h=><th key={h} style={thS}>{h}</th>)}</tr></thead>
                  <tbody>{outRows.map(o=>(
                    <tr key={o.id}>
                      <td style={{...tdS,fontFamily:"monospace",color:"#8B5CF6",fontWeight:600}}>{o.date}</td>
                      <td style={{...tdS,maxWidth:160}}>{o.name}</td>
                      <td style={{...tdS,fontFamily:"monospace",fontSize:10,color:"#484F58"}}>{o.jan}</td>
                      <td style={{...tdS,fontFamily:"monospace",fontWeight:700,textAlign:"right"}}>{o.qty}</td>
                      <td style={{...tdS,fontFamily:"monospace",color:"#8B949E",textAlign:"right"}}>{fmtY(o.price)}</td>
                      <td style={{...tdS,fontFamily:"monospace",fontWeight:700,color:"#58A6FF",textAlign:"right"}}>{fmtY(o.totalPrice)}</td>
                      <td style={{...tdS,color:"#8B949E"}}>{o.destination||"—"}</td>
                      <td style={{...tdS,color:"#484F58"}}>{o.note||"—"}</td>
                      <td style={tdS}><button style={btnD} onClick={()=>deleteOutgoing(o)}>削除</button></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 分析タブ（管理者のみ） */}
      {tab==="dashboard"&&isAdmin&&(
        <div style={{padding:16,display:"flex",flexDirection:"column",gap:14}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10}}>
            {[{l:"売価評価額",v:fmtY(totalV),col:"#58A6FF"},{l:"原価評価額",v:fmtY(totalC),col:"#E6EDF3"},{l:"含み益",v:fmtY(totalV-totalC),col:"#3FB950"},{l:"要発注",v:alerts.length+"件",col:"#F85149"}].map(k=>(
              <div key={k.l} style={{background:"#21262D",border:"1px solid #30363D",borderRadius:8,padding:14}}><div style={{fontSize:10,textTransform:"uppercase",color:"#484F58",marginBottom:4}}>{k.l}</div><div style={{fontFamily:"monospace",fontSize:20,fontWeight:600,color:k.col}}>{k.v}</div></div>
            ))}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div style={{background:"#21262D",border:"1px solid #30363D",borderRadius:8,padding:14}}><div style={{fontSize:11,color:"#484F58",marginBottom:4}}>今月の入庫合計</div><div style={{fontFamily:"monospace",fontSize:18,fontWeight:600,color:"#3FB950"}}>{fmtY(incoming.filter(h=>h.date.slice(0,7)===today().slice(0,7)).reduce((s,h)=>s+h.totalCost,0))}</div></div>
            <div style={{background:"#21262D",border:"1px solid #30363D",borderRadius:8,padding:14}}><div style={{fontSize:11,color:"#484F58",marginBottom:4}}>今月の出庫合計売上</div><div style={{fontFamily:"monospace",fontSize:18,fontWeight:600,color:"#58A6FF"}}>{fmtY(outgoing.filter(o=>o.date.slice(0,7)===today().slice(0,7)).reduce((s,o)=>s+o.totalPrice,0))}</div></div>
          </div>
          <div style={{background:"#21262D",border:"1px solid #30363D",borderRadius:8,padding:16}}><div style={{fontSize:13,fontWeight:700,marginBottom:12}}>大分類別 在庫評価額</div>{totalV>0?cats.map(cat=>{const val=db.filter(i=>i.catL1===cat.id).reduce((s,i)=>s+i.price*i.qty,0);if(!val)return null;return<div key={cat.id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}><div style={{width:90,fontSize:11,color:"#8B949E",textAlign:"right"}}>{cat.emoji} {cat.name}</div><div style={{flex:1,height:16,background:"#1C2128",borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:Math.min(100,val/totalV*100)+"%",background:"#58A6FF",borderRadius:3}}/></div><div style={{width:70,fontFamily:"monospace",fontSize:10,color:"#8B949E"}}>{fmtY(val)}</div></div>;}):(<div style={{color:"#484F58",fontSize:12}}>在庫データがありません</div>)}</div>
          {alerts.length>0&&<div style={{background:"#21262D",border:"1px solid #30363D",borderRadius:8,padding:16}}><div style={{fontSize:13,fontWeight:700,marginBottom:12}}>⚠️ 発注アラート</div>{alerts.map(item=><div key={item.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid #30363D",fontSize:12}}><div>{item.name.slice(0,20)}{item.name.length>20?"…":""}</div><div style={{display:"flex",gap:12,fontFamily:"monospace",fontSize:11}}><span style={{color:"#F85149",fontWeight:700}}>在庫:{item.qty}</span><span style={{color:"#484F58"}}>発注点:{item.reorderPoint||0}</span></div></div>)}</div>}
        </div>
      )}

      {/* カテゴリ登録タブ（管理者のみ） */}
      {tab==="categories"&&isAdmin&&(
        <div style={{padding:16}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}><div style={{fontSize:16,fontWeight:700}}>カテゴリ登録</div><button style={btnP} onClick={()=>openAddCat(1)}>+ 大分類を追加</button></div>
          {cats.map(l1=>(
            <div key={l1.id} style={{background:"#21262D",border:"1px solid #30363D",borderRadius:8,padding:14,marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:22}}>{l1.emoji}</span><div><div style={{fontWeight:700,fontSize:15}}>{l1.name}</div><div style={{fontSize:11,color:"#484F58"}}>{db.filter(i=>i.catL1===l1.id).length} 商品</div></div></div>
                <div style={{display:"flex",gap:6}}><button style={btnS} onClick={()=>openAddCat(2,l1.id)}>+ 中分類</button><button style={btnD} onClick={()=>delL1(l1.id)}>削除</button></div>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>{l1.children.map(l2=>(
                <div key={l2.id} style={{background:"#1C2128",borderRadius:6,padding:"10px 12px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}><div style={{fontSize:13,fontWeight:600}}>{l2.name}</div><div style={{display:"flex",gap:6}}><button style={btnS} onClick={()=>openAddCat(3,l1.id,l2.id)}>+ 小分類</button><button style={btnD} onClick={()=>delL2(l1.id,l2.id)}>削除</button></div></div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6}}>{l2.children.map(l3=><div key={l3.id} style={{display:"flex",alignItems:"center",gap:4,background:"#0D1117",border:"1px solid #30363D",borderRadius:4,padding:"3px 8px"}}><span style={{fontSize:11,color:"#8B949E"}}>{l3.name}</span><span style={{fontSize:10,color:"#484F58"}}>({db.filter(i=>i.catL3===l3.id).length})</span><button style={{background:"transparent",border:"none",cursor:"pointer",color:"#F85149",fontSize:12,padding:"0 2px"}} onClick={()=>delL3(l1.id,l2.id,l3.id)}>×</button></div>)}</div>
                </div>
              ))}</div>
            </div>
          ))}
        </div>
      )}

      {/* スタッフ管理タブ（管理者のみ） */}
      {tab==="staff"&&isAdmin&&(
        <div style={{padding:16}}>
          <div style={{fontSize:16,fontWeight:700,marginBottom:14}}>👥 スタッフ管理</div>
          <div style={{background:"#21262D",border:"1px solid #30363D",borderRadius:8,padding:16,marginBottom:16}}>
            <div style={{fontSize:13,fontWeight:600,marginBottom:6}}>会社コード（スタッフへ共有）</div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{fontFamily:"monospace",fontSize:13,color:"#58A6FF",background:"#1C2128",padding:"8px 12px",borderRadius:6,flex:1,border:"1px solid #30363D",wordBreak:"break-all"}}>{profile.company_id}</div>
              <button style={btnS} onClick={()=>{navigator.clipboard.writeText(profile.company_id);addToast("コピーしました","ok");}}>コピー</button>
            </div>
            <div style={{fontSize:11,color:"#484F58",marginTop:6}}>スタッフがアプリ登録時にこのコードを入力すると同じ会社として参加できます</div>
          </div>
          <div style={{fontSize:13,fontWeight:600,marginBottom:10}}>メンバー一覧</div>
          {staffList.map(s=>(
            <div key={s.id} style={{background:"#21262D",border:"1px solid #30363D",borderRadius:8,padding:14,marginBottom:8,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div>
                <div style={{fontWeight:600}}>{s.name}</div>
                <div style={{fontSize:11,color:"#484F58"}}>{s.email}</div>
              </div>
              <span style={{background:s.role==="admin"?"rgba(63,185,80,.12)":"rgba(88,166,255,.12)",color:s.role==="admin"?"#3FB950":"#58A6FF",padding:"3px 10px",borderRadius:6,fontSize:12,fontWeight:600}}>{s.role==="admin"?"👑 管理者":"👤 スタッフ"}</span>
            </div>
          ))}
        </div>
      )}

      {showCamera&&<CameraScanner onDetected={handleCameraDetect} onClose={()=>setShowCamera(false)}/>}

      {/* スキャンモーダル */}
      {modal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.75)",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={e=>{if(e.target===e.currentTarget)setModal(null);}}>
          <div style={{background:"#161B22",border:"1px solid #444C56",borderRadius:12,width:"100%",maxWidth:480,boxShadow:"0 20px 60px rgba(0,0,0,.6)",maxHeight:"92vh",overflowY:"auto"}}>
            <div style={{padding:"14px 16px",borderBottom:"1px solid #30363D",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,background:"#161B22"}}>
              <div><div style={{fontSize:14,fontWeight:700}}>{modal.product.name.slice(0,24)}{modal.product.name.length>24?"…":""}</div><div style={{fontFamily:"monospace",fontSize:10,color:"#484F58",marginTop:2}}>{modal.product.jan}</div></div>
              <button style={{background:"transparent",border:"none",cursor:"pointer",color:"#8B949E",fontSize:20}} onClick={()=>setModal(null)}>×</button>
            </div>
            <div style={{padding:"12px 16px",background:"#1C2128",borderBottom:"1px solid #30363D"}}>
              {modal.existing?(<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}><span style={{fontSize:12,color:"#8B949E"}}>現在庫</span><span style={{fontFamily:"monospace",fontSize:24,fontWeight:700,color:modal.existing.qty<=0?"#F85149":modal.existing.qty<=5?"#D29922":"#3FB950"}}>{modal.existing.qty}<span style={{fontSize:12,fontWeight:400,color:"#8B949E",marginLeft:4}}>個</span></span></div>):(<div style={{background:"rgba(63,185,80,.1)",border:"1px solid rgba(63,185,80,.3)",borderRadius:6,padding:"6px 10px",fontSize:11,color:"#3FB950",marginBottom:10}}>🆕 未登録商品 — 入庫で新規登録されます</div>)}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                <button style={{padding:"10px 0",borderRadius:8,border:"none",cursor:"pointer",fontWeight:700,fontSize:14,background:arMode==="incoming"?"#238636":"#21262D",color:arMode==="incoming"?"#fff":"#8B949E"}} onClick={()=>setArMode("incoming")}>📥 入庫</button>
                <button style={{padding:"10px 0",borderRadius:8,border:"none",cursor:modal.isNew?"not-allowed":"pointer",fontWeight:700,fontSize:14,background:arMode==="outgoing"&&!modal.isNew?"#8B5CF6":"#21262D",color:arMode==="outgoing"&&!modal.isNew?"#fff":modal.isNew?"#484F58":"#8B949E"}} onClick={()=>!modal.isNew&&setArMode("outgoing")} disabled={modal.isNew}>{modal.isNew?"📤 出庫（登録後）":"📤 出庫"}</button>
              </div>
            </div>
            <div style={{padding:"14px 16px"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"#1C2128",borderRadius:8,padding:"12px 16px",marginBottom:14,border:"1px solid #30363D"}}>
                <span style={{fontSize:13,color:"#8B949E",fontWeight:600}}>{arMode==="incoming"?"入庫数量":"出庫数量"}</span>
                <div style={{display:"flex",alignItems:"center",gap:14}}>
                  <button style={{width:36,height:36,border:"1px solid #444C56",borderRadius:8,background:"#2D333B",color:"#E6EDF3",cursor:"pointer",fontSize:20,fontWeight:700}} onClick={()=>setArQty(q=>Math.max(1,q-1))}>−</button>
                  <span style={{fontFamily:"monospace",fontSize:28,fontWeight:700,minWidth:48,textAlign:"center"}}>{arQty}</span>
                  <button style={{width:36,height:36,border:"1px solid #444C56",borderRadius:8,background:"#2D333B",color:"#E6EDF3",cursor:"pointer",fontSize:20,fontWeight:700}} onClick={()=>setArQty(q=>q+1)}>＋</button>
                </div>
              </div>
              {arMode==="incoming"&&(<div style={{display:"flex",flexDirection:"column",gap:10}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  <div><div style={{fontSize:11,color:"#8B949E",marginBottom:4}}>販売単価（円）</div><input style={inpS} type="number" min="0" value={modal.product.price} onChange={e=>{const v=e.target.value;setModal(m=>({...m,product:{...m.product,price:Number(v)||0}}));}}/></div>
                  <div><div style={{fontSize:11,color:"#8B949E",marginBottom:4}}>仕入れ値（円）</div><input style={inpS} type="number" min="0" placeholder="0" value={arCost} onChange={e=>setArCost(e.target.value)}/></div>
                </div>
                {arCost&&calcM(modal.product.price,Number(arCost))!==null&&<div style={{fontSize:11,color:"#484F58",textAlign:"right"}}>粗利率: <span style={{fontWeight:700,color:mCol(calcM(modal.product.price,Number(arCost)))}}>{calcM(modal.product.price,Number(arCost))}%</span></div>}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  <div><div style={{fontSize:11,color:"#8B949E",marginBottom:4}}>メーカー</div><input style={inpS} type="text" placeholder="例：ユニ・チャーム" value={arMaker} onChange={e=>setArMaker(e.target.value)}/></div>
                  <div><div style={{fontSize:11,color:"#8B949E",marginBottom:4}}>仕入れ先</div><input style={inpS} type="text" placeholder="例：〇〇商事" value={arSupplier} onChange={e=>setArSupplier(e.target.value)}/></div>
                </div>
                {modal.isNew&&<CategorySelect cats={cats} l1={arL1} l2={arL2} l3={arL3} onChange={(l1,l2,l3)=>{setArL1(l1);setArL2(l2);setArL3(l3);}} inpS={inpS}/>}
              </div>)}
              {arMode==="outgoing"&&!modal.isNew&&(<div style={{display:"flex",flexDirection:"column",gap:10}}>
                {modal.existing&&modal.existing.qty<arQty&&<div style={{background:"rgba(248,81,73,.1)",border:"1px solid rgba(248,81,73,.3)",borderRadius:6,padding:"8px 10px",fontSize:12,color:"#F85149"}}>⚠ 在庫不足（現在{modal.existing.qty}個）</div>}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  <div><div style={{fontSize:11,color:"#8B949E",marginBottom:4}}>販売単価（円）</div><input style={inpS} type="number" min="0" value={arSellPrice} onChange={e=>setArSellPrice(e.target.value)}/></div>
                  <div style={{display:"flex",alignItems:"flex-end",paddingBottom:2}}><div style={{fontSize:12,color:"#8B949E"}}>合計: <span style={{fontFamily:"monospace",fontWeight:700,color:"#58A6FF",fontSize:14}}>{fmtY((parseInt(arSellPrice)||0)*arQty)}</span></div></div>
                </div>
                <div><div style={{fontSize:11,color:"#8B949E",marginBottom:4}}>販売先・出荷先</div><input style={inpS} type="text" placeholder="例：〇〇施設、Amazon等" value={arDestination} onChange={e=>setArDestination(e.target.value)}/></div>
              </div>)}
            </div>
            <div style={{padding:"12px 16px",borderTop:"1px solid #30363D",display:"flex",justifyContent:"flex-end",gap:8}}>
              <button style={btnG} onClick={()=>setModal(null)}>キャンセル</button>
              <button style={{...btnP,background:arMode==="incoming"?"#238636":"#8B5CF6",minWidth:140}} onClick={confirmScan}>{arMode==="incoming"?(modal.isNew?"✨ 新規登録＋入庫":"📥 入庫する ("+arQty+"個)"):"📤 出庫する ("+arQty+"個)"}</button>
            </div>
          </div>
        </div>
      )}

      {/* 編集モーダル */}
      {editModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={e=>{if(e.target===e.currentTarget)setEditModal(null);}}>
          <div style={{background:"#161B22",border:"1px solid #444C56",borderRadius:10,width:"100%",maxWidth:480,boxShadow:"0 20px 60px rgba(0,0,0,.5)",maxHeight:"90vh",overflowY:"auto"}}>
            <div style={{padding:"14px 16px",borderBottom:"1px solid #30363D",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,background:"#161B22"}}><div style={{fontSize:14,fontWeight:700}}>✏ 商品を編集</div><button style={{background:"transparent",border:"none",cursor:"pointer",color:"#8B949E",fontSize:18}} onClick={()=>setEditModal(null)}>×</button></div>
            <div style={{padding:"14px 16px",display:"flex",flexDirection:"column",gap:10}}>
              <div><div style={{fontSize:11,color:"#8B949E",marginBottom:4}}>JANコード</div><input style={inpS} type="text" value={editModal.jan||""} onChange={e=>setEditModal(m=>({...m,jan:e.target.value.replace(/\D/g,"").slice(0,13)}))}/></div>
              <div><div style={{fontSize:11,color:"#8B949E",marginBottom:4}}>商品名</div><input style={inpS} type="text" value={editModal.name} onChange={e=>setEditModal(m=>({...m,name:e.target.value}))}/></div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}><div><div style={{fontSize:11,color:"#8B949E",marginBottom:4}}>単価（円）</div><input style={inpS} type="number" min="0" value={editModal.price} onChange={e=>setEditModal(m=>({...m,price:Number(e.target.value)||0}))}/></div><div><div style={{fontSize:11,color:"#8B949E",marginBottom:4}}>仕入れ値（円）</div><input style={inpS} type="number" min="0" value={editModal.cost||""} onChange={e=>setEditModal(m=>({...m,cost:Number(e.target.value)||0}))}/></div></div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}><div><div style={{fontSize:11,color:"#8B949E",marginBottom:4}}>在庫数</div><input style={inpS} type="number" min="0" value={editModal.qty} onChange={e=>setEditModal(m=>({...m,qty:Number(e.target.value)||0}))}/></div><div><div style={{fontSize:11,color:"#8B949E",marginBottom:4}}>発注点</div><input style={inpS} type="number" min="0" value={editModal.reorderPoint||0} onChange={e=>setEditModal(m=>({...m,reorderPoint:Number(e.target.value)||0}))}/></div></div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}><div><div style={{fontSize:11,color:"#8B949E",marginBottom:4}}>メーカー</div><input style={inpS} type="text" value={editModal.maker||""} onChange={e=>setEditModal(m=>({...m,maker:e.target.value}))}/></div><div><div style={{fontSize:11,color:"#8B949E",marginBottom:4}}>仕入れ先</div><input style={inpS} type="text" value={editModal.supplier||""} onChange={e=>setEditModal(m=>({...m,supplier:e.target.value}))}/></div></div>
              <CategorySelect cats={cats} l1={editModal.catL1||""} l2={editModal.catL2||""} l3={editModal.catL3||""} onChange={(l1,l2,l3)=>setEditModal(m=>({...m,catL1:l1,catL2:l2,catL3:l3}))} inpS={inpS}/>
            </div>
            <div style={{padding:"12px 16px",borderTop:"1px solid #30363D",display:"flex",justifyContent:"flex-end",gap:8}}><button style={btnG} onClick={()=>setEditModal(null)}>キャンセル</button><button style={btnP} onClick={saveEditModal}>💾 保存する</button></div>
          </div>
        </div>
      )}

      {/* 入庫手動追加モーダル */}
      {incomingModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={e=>{if(e.target===e.currentTarget)setIncomingModal(null);}}>
          <div style={{background:"#161B22",border:"1px solid #444C56",borderRadius:10,width:"100%",maxWidth:480,boxShadow:"0 20px 60px rgba(0,0,0,.5)",maxHeight:"90vh",overflowY:"auto"}}>
            <div style={{padding:"14px 16px",borderBottom:"1px solid #30363D",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,background:"#161B22"}}><div style={{fontSize:14,fontWeight:700}}>📥 入庫履歴を手動追加</div><button style={{background:"transparent",border:"none",cursor:"pointer",color:"#8B949E",fontSize:18}} onClick={()=>setIncomingModal(null)}>×</button></div>
            <div style={{padding:"14px 16px",display:"flex",flexDirection:"column",gap:10}}>
              <div><div style={{fontSize:11,color:"#8B949E",marginBottom:4}}>入庫日</div><input style={inpS} type="date" value={incomingModal.date} onChange={e=>setIncomingModal(m=>({...m,date:e.target.value}))}/></div>
              <div><div style={{fontSize:11,color:"#8B949E",marginBottom:4}}>商品名</div><input style={inpS} type="text" placeholder="商品名を入力" value={incomingModal.name} onChange={e=>setIncomingModal(m=>({...m,name:e.target.value}))}/><select style={{...inpS,marginTop:4,fontSize:11}} onChange={e=>{const item=db.find(i=>i.id===Number(e.target.value));if(item)setIncomingModal(m=>({...m,jan:item.jan,name:item.name,cost:item.cost||0,maker:item.maker||"",supplier:item.supplier||"",totalCost:(m.qty||1)*(item.cost||0)}));}}><option value="">← 商品マスタから選択</option>{db.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}</select></div>
              <div><div style={{fontSize:11,color:"#8B949E",marginBottom:4}}>JANコード</div><input style={inpS} type="text" value={incomingModal.jan} onChange={e=>setIncomingModal(m=>({...m,jan:e.target.value}))}/></div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}><div><div style={{fontSize:11,color:"#8B949E",marginBottom:4}}>入庫数量</div><input style={inpS} type="number" min="1" value={incomingModal.qty} onChange={e=>setIncomingModal(m=>({...m,qty:Number(e.target.value)||1,totalCost:(Number(e.target.value)||1)*(m.cost||0)}))}/></div><div><div style={{fontSize:11,color:"#8B949E",marginBottom:4}}>仕入れ単価（円）</div><input style={inpS} type="number" min="0" value={incomingModal.cost} onChange={e=>setIncomingModal(m=>({...m,cost:Number(e.target.value)||0,totalCost:(m.qty||1)*(Number(e.target.value)||0)}))}/></div></div>
              <div style={{background:"#1C2128",borderRadius:6,padding:"8px 12px",fontSize:12}}>仕入れ合計: <span style={{fontFamily:"monospace",fontWeight:700,color:"#3FB950",fontSize:14}}>{fmtY(incomingModal.totalCost)}</span></div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}><div><div style={{fontSize:11,color:"#8B949E",marginBottom:4}}>メーカー</div><input style={inpS} type="text" value={incomingModal.maker} onChange={e=>setIncomingModal(m=>({...m,maker:e.target.value}))}/></div><div><div style={{fontSize:11,color:"#8B949E",marginBottom:4}}>仕入れ先</div><input style={inpS} type="text" value={incomingModal.supplier} onChange={e=>setIncomingModal(m=>({...m,supplier:e.target.value}))}/></div></div>
              <div><div style={{fontSize:11,color:"#8B949E",marginBottom:4}}>備考</div><input style={inpS} type="text" value={incomingModal.note} onChange={e=>setIncomingModal(m=>({...m,note:e.target.value}))}/></div>
            </div>
            <div style={{padding:"12px 16px",borderTop:"1px solid #30363D",display:"flex",justifyContent:"flex-end",gap:8}}><button style={btnG} onClick={()=>setIncomingModal(null)}>キャンセル</button><button style={btnP} onClick={confirmAddIncoming}>追加する</button></div>
          </div>
        </div>
      )}

      {/* 出庫手動追加モーダル */}
      {outgoingModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={e=>{if(e.target===e.currentTarget)setOutgoingModal(null);}}>
          <div style={{background:"#161B22",border:"1px solid #444C56",borderRadius:10,width:"100%",maxWidth:480,boxShadow:"0 20px 60px rgba(0,0,0,.5)",maxHeight:"90vh",overflowY:"auto"}}>
            <div style={{padding:"14px 16px",borderBottom:"1px solid #30363D",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,background:"#161B22"}}><div style={{fontSize:14,fontWeight:700}}>📤 出庫履歴を手動追加</div><button style={{background:"transparent",border:"none",cursor:"pointer",color:"#8B949E",fontSize:18}} onClick={()=>setOutgoingModal(null)}>×</button></div>
            <div style={{padding:"14px 16px",display:"flex",flexDirection:"column",gap:10}}>
              <div><div style={{fontSize:11,color:"#8B949E",marginBottom:4}}>出庫日</div><input style={inpS} type="date" value={outgoingModal.date} onChange={e=>setOutgoingModal(m=>({...m,date:e.target.value}))}/></div>
              <div><div style={{fontSize:11,color:"#8B949E",marginBottom:4}}>商品</div><select style={inpS} onChange={e=>{const item=db.find(i=>i.id===Number(e.target.value));if(item)setOutgoingModal(m=>({...m,jan:item.jan,name:item.name,price:item.price||0,totalPrice:(m.qty||1)*(item.price||0)}));}}><option value="">商品マスタから選択</option>{db.map(i=><option key={i.id} value={i.id}>{i.name}（在庫: {i.qty}個）</option>)}</select></div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}><div><div style={{fontSize:11,color:"#8B949E",marginBottom:4}}>出庫数量</div><input style={inpS} type="number" min="1" value={outgoingModal.qty} onChange={e=>setOutgoingModal(m=>({...m,qty:Number(e.target.value)||1,totalPrice:(Number(e.target.value)||1)*(m.price||0)}))}/></div><div><div style={{fontSize:11,color:"#8B949E",marginBottom:4}}>販売単価（円）</div><input style={inpS} type="number" min="0" value={outgoingModal.price} onChange={e=>setOutgoingModal(m=>({...m,price:Number(e.target.value)||0,totalPrice:(m.qty||1)*(Number(e.target.value)||0)}))}/></div></div>
              <div style={{background:"#1C2128",borderRadius:6,padding:"8px 12px",fontSize:12}}>合計売上: <span style={{fontFamily:"monospace",fontWeight:700,color:"#58A6FF",fontSize:14}}>{fmtY(outgoingModal.totalPrice)}</span></div>
              <div><div style={{fontSize:11,color:"#8B949E",marginBottom:4}}>販売先・出荷先</div><input style={inpS} type="text" value={outgoingModal.destination} onChange={e=>setOutgoingModal(m=>({...m,destination:e.target.value}))}/></div>
              <div><div style={{fontSize:11,color:"#8B949E",marginBottom:4}}>備考</div><input style={inpS} type="text" value={outgoingModal.note} onChange={e=>setOutgoingModal(m=>({...m,note:e.target.value}))}/></div>
            </div>
            <div style={{padding:"12px 16px",borderTop:"1px solid #30363D",display:"flex",justifyContent:"flex-end",gap:8}}><button style={btnG} onClick={()=>setOutgoingModal(null)}>キャンセル</button><button style={{...btnP,background:"#8B5CF6"}} onClick={confirmAddOutgoing}>📤 出庫を記録する</button></div>
          </div>
        </div>
      )}

      {/* カテゴリー追加モーダル */}
      {addCatModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={e=>{if(e.target===e.currentTarget)setAddCatModal(null);}}>
          <div style={{background:"#161B22",border:"1px solid #444C56",borderRadius:10,width:"100%",maxWidth:380,boxShadow:"0 20px 60px rgba(0,0,0,.5)"}}>
            <div style={{padding:"14px 16px",borderBottom:"1px solid #30363D",display:"flex",alignItems:"center",justifyContent:"space-between"}}><div style={{fontSize:14,fontWeight:700}}>{addCatModal.level===1?"大分類を追加":addCatModal.level===2?"中分類を追加":"小分類を追加"}</div><button style={{background:"transparent",border:"none",cursor:"pointer",color:"#8B949E",fontSize:18}} onClick={()=>setAddCatModal(null)}>×</button></div>
            <div style={{padding:"14px 16px"}}><div style={{marginBottom:12}}><div style={{fontSize:11,color:"#8B949E",marginBottom:4}}>名前</div><input style={inpS} autoFocus type="text" value={newCatName} onChange={e=>setNewCatName(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")confirmAddCat();}}/></div>{addCatModal.level===1&&<div><div style={{fontSize:11,color:"#8B949E",marginBottom:6}}>アイコン</div><div style={{display:"flex",flexWrap:"wrap",gap:6}}>{EMOJIS.map(em=><span key={em} style={{fontSize:22,cursor:"pointer",padding:4,borderRadius:6,border:newCatEmoji===em?"2px solid #58A6FF":"2px solid transparent",background:newCatEmoji===em?"#1C2128":"transparent"}} onClick={()=>setNewCatEmoji(em)}>{em}</span>)}</div></div>}</div>
            <div style={{padding:"12px 16px",borderTop:"1px solid #30363D",display:"flex",justifyContent:"flex-end",gap:8}}><button style={btnG} onClick={()=>setAddCatModal(null)}>キャンセル</button><button style={btnP} onClick={confirmAddCat}>追加する</button></div>
          </div>
        </div>
      )}

      {/* トースト */}
      <div style={{position:"fixed",bottom:18,right:16,display:"flex",flexDirection:"column",gap:7,zIndex:999}}>
        {toasts.map(t=><div key={t.id} style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",borderRadius:7,fontSize:12,fontWeight:500,background:"#2D333B",color:"#E6EDF3",borderLeft:"3px solid "+(t.type==="ok"?"#3FB950":t.type==="err"?"#F85149":"#58A6FF"),boxShadow:"0 6px 20px rgba(0,0,0,.4)",minWidth:180}}>{t.type==="ok"?"✓":t.type==="err"?"✕":"ℹ"} {t.msg}</div>)}
      </div>
    </div>
  );
}
