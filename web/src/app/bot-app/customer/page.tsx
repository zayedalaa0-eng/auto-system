"use client";

import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";

/* ── Telegram WebApp type ─────────────────────────────────────────────────── */
type TelegramWebApp = {
  initDataUnsafe: { user?: { id?: number } };
  ready(): void; close(): void; expand(): void;
  themeParams: {
    bg_color?: string; text_color?: string; hint_color?: string;
    button_color?: string; button_text_color?: string;
    secondary_bg_color?: string;
  };
  colorScheme?: "light" | "dark";
};
declare global { interface Window { Telegram?: { WebApp: TelegramWebApp } } }

/* ── Types ────────────────────────────────────────────────────────────────── */
type Customer = {
  id: string; full_name: string; phone: string; nickname: string | null;
  address: string | null; status: string; operation_type: string | null;
  operation_type_code: string; requested_car: string | null;
  notes: string | null; next_follow_up_at: string | null;
  created_at: string; is_active: boolean; visit_count?: number;
  last_contact_at?: string | null;
  assigned_user_id: string | null; branch_id: string | null;
  cycle_number: number; parent_customer_id: string | null;
  metadata: Record<string, unknown> | null;
  whatsapp_prefix: string | null;
};
type TradeIn = {
  id: string; model: string; chassis_no: string | null; price: number | null;
  color: string | null; production_year: number | null; mileage: number | null;
  specs: string | null; inspection: string | null; license_expiry: string | null;
  notes: string | null; status: string; deal_type: string;
  metadata: Record<string, unknown> | null;
};
type Log = { id: string; action: string; details: string | null; actor_name: string; created_at: string };
type Attachment = { id: string; file_name: string | null; file_category: string | null; public_url: string | null; mime_type?: string | null; created_at: string };
type InventoryOption = { id: string; label: string; model: string; chassis_no: string | null };
type Branch = { id: string; name: string };
type AncestorCycle = { id: string; status: string; cycle_number: number; logs: Log[] };
type PageData = {
  customer: Customer; statuses: string[]; logs: Log[]; tradeIn: TradeIn | null;
  allTradeIns: TradeIn[]; ancestorCycles: AncestorCycle[];
  photos: Attachment[]; voiceNotes: Attachment[]; inventoryOptions: InventoryOption[];
  canEdit: boolean; isManager: boolean; isGeneralManager: boolean; branches: Branch[];
};

/* ── Default first status per op type (mirrors STATUS_BY_TYPE) ───────────── */
const DEFAULT_STATUS_BY_OPTYPE: Record<string,string> = {
  buyer:                  "جديد",
  buyer_tradein_pending:  "استبدال — تحت التقييم",
  sell_on_behalf:         "عرض سيارة للبيع",
};

/* ── Constants ────────────────────────────────────────────────────────────── */
const ACTION_ICONS: Record<string, string> = {
  customer_created: "✨", customer_updated: "📝", status_updated: "🔄",
  manual_reminder_created: "🔔", trade_in_saved: "🚗", trade_in_archived: "📦",
  sell_inventory_created: "🏷️", customer_reactivated: "♻️",
};
const ACTION_LABELS: Record<string, string> = {
  customer_created: "إنشاء ملف جديد", customer_updated: "تحديث ملف العميل",
  status_updated: "تحديث الحالة", manual_reminder_created: "إضافة تذكير",
  trade_in_saved: "حفظ سيارة العميل", trade_in_archived: "إيقاف سيارة العميل",
  sell_inventory_created: "إدخال سيارة برسم البيع", customer_reactivated: "تفعيل عملية جديدة",
};
const PAYMENT_METHODS = [
  { value: "كاش", label: "💵 كاش" },
  { value: "تقسيط بنكي", label: "🏦 تقسيط بنكي" },
  { value: "تأجير تمويلي", label: "📋 تأجير تمويلي" },
  { value: "شيكات", label: "📝 شيكات" },
  { value: "استبدال فقط", label: "🔄 استبدال فقط" },
  { value: "استبدال + كاش", label: "🔄 استبدال + كاش" },
  { value: "استبدال + تقسيط", label: "🔄 استبدال + تقسيط" },
];
const CLOSED_HINTS = [
  "تمت عملية البيع","شراء من قبل المعرض","رفض من قبل العميل",
  "رفض من قبل المعرض","تراجع العميل عن الاستبدال","سحب السيارة من البيع","إغلاق الملف",
];

/* ── Helpers ──────────────────────────────────────────────────────────────── */
function isClosedStatus(s: string) { return CLOSED_HINTS.some(c => s.includes(c)); }
function needsPayment(s: string) { return s.includes("تمت عملية البيع") || s.includes("حجز"); }
// buyer فقط يحتاج ربط مخزون عند البيع/الحجز (sell_on_behalf لا يحتاجه)
function needsInventoryChassis(s: string, opCode: string) {
  return opCode !== "sell_on_behalf" && (s.includes("تمت عملية البيع") || s.includes("حجز"));
}
function shouldShowReactivate(c: Customer) {
  return !c.is_active || CLOSED_HINTS.some(h => (c.status ?? "").includes(h));
}
function isImage(name: string | null) {
  const n = (name ?? "").toLowerCase();
  return n.endsWith(".jpg") || n.endsWith(".jpeg") || n.endsWith(".png") || n.endsWith(".webp") || n.endsWith(".gif");
}
function isVoice(att: Attachment) {
  return att.file_category === "voice_note" || (att.mime_type?.startsWith("audio/") ?? false);
}
function fmtDate(iso: string) {
  const local = new Date(new Date(iso).getTime() + 3*60*60*1000);
  const d = String(local.getUTCDate()).padStart(2,"0");
  const m = String(local.getUTCMonth()+1).padStart(2,"0");
  const y = local.getUTCFullYear();
  const h = String(local.getUTCHours()).padStart(2,"0");
  const min = String(local.getUTCMinutes()).padStart(2,"0");
  return `${d}/${m}/${y} ${h}:${min}`;
}
function fmtDateShort(iso: string | null | undefined) {
  if (!iso) return null;
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2,"0")}/${String(d.getUTCMonth()+1).padStart(2,"0")}/${d.getUTCFullYear()}`;
}
function toDateInput(iso: string | null) { return iso ? iso.slice(0,10) : ""; }
function initials(name: string) {
  return name.trim().split(/\s+/).slice(0,2).map(w=>w[0]).join("").toUpperCase();
}
function opLabel(code: string) {
  if (code==="sell_on_behalf") return "بيع بالوكالة";
  if (code==="buyer_tradein_pending"||code==="buyer_tradein_evaluated") return "مشتري + استبدال";
  return "مشتري";
}
function translateAction(a: string) { return ACTION_LABELS[a] ?? a; }
function classifyLog(action: string): "status"|"followup"|"car"|"general" {
  if (action === "status_updated") return "status";
  if (action.includes("reminder")||action.includes("follow")) return "followup";
  if (action.includes("trade")||action.includes("inventory")) return "car";
  return "general";
}

/* ════════════════════════════════════════════════════════════════════════════
   Main Page
   ════════════════════════════════════════════════════════════════════════════ */
export default function CustomerPage() {
  const [chatId, setChatId]   = useState<string|null>(null);
  const [custId, setCustId]   = useState<string|null>(null);
  const [data,   setData]     = useState<PageData|null>(null);
  const [loading,setLoading]  = useState(true);
  const [error,  setError]    = useState<string|null>(null);
  const [tg,     setTg]       = useState<TelegramWebApp|null>(null);
  const [isDark, setIsDark]   = useState(false);

  /* edit state */
  const [selStatus,    setSelStatus]    = useState("");
  const [noteText,     setNoteText]     = useState("");
  const [followUp,     setFollowUp]     = useState("");
  const [reqCar,       setReqCar]       = useState("");
  const [selInventory, setSelInventory] = useState("");
  const [paymentMethod,setPaymentMethod]= useState("");

  /* trade-in edit state */
  const [tiOpen,        setTiOpen]        = useState(false);
  const [tiModel,       setTiModel]       = useState("");
  const [tiChassis,     setTiChassis]     = useState("");
  const [tiPrice,       setTiPrice]       = useState("");
  const [tiColor,       setTiColor]       = useState("");
  const [tiYear,        setTiYear]        = useState("");
  const [tiMileage,     setTiMileage]     = useState("");
  const [tiSpecs,       setTiSpecs]       = useState("");
  const [tiInspection,  setTiInspection]  = useState("");
  const [tiLicense,     setTiLicense]     = useState("");
  const [tiNotes,       setTiNotes]       = useState("");
  const [tiGear,        setTiGear]        = useState("اتوماتيك");
  const [tiFuel,        setTiFuel]        = useState("بنزين");
  const [tiEditMode,    setTiEditMode]    = useState(false);

  /* basic info edit modal */
  const [basicOpen,    setBasicOpen]    = useState(false);
  const [editName,       setEditName]       = useState("");
  const [editPhone,      setEditPhone]      = useState("");
  const [editNickname,   setEditNickname]   = useState("");
  const [editAddress,    setEditAddress]    = useState("");
  const [editWaPrefix,   setEditWaPrefix]   = useState("+970");

  /* history */
  const [showHistory,    setShowHistory]    = useState(false);
  const [historyFilter,  setHistoryFilter]  = useState<"all"|"status"|"followup"|"car"|"general">("all");
  const [historySearch,  setHistorySearch]  = useState("");

  /* attachments */
  const [showAttachments, setShowAttachments] = useState(false);
  const [albumIndex,      setAlbumIndex]      = useState(0);
  const [showAlbum,       setShowAlbum]       = useState(false);

  /* السيارة المطلوبة — وضع عرض/إغلاق */
  const [reqCarEditMode,   setReqCarEditMode]   = useState(false);
  // حقول التعديل (مطابق للويب)
  const [rcUseInventory,    setRcUseInventory]    = useState(false);
  const [rcUseCustom,       setRcUseCustom]       = useState(false);
  const [rcInventoryToAdd,  setRcInventoryToAdd]  = useState("");
  const [rcSelectedCars,    setRcSelectedCars]    = useState<InventoryOption[]>([]);
  const [rcNegotiations,    setRcNegotiations]    = useState<Record<string,string>>({});
  const [rcCustomType,      setRcCustomType]      = useState("");
  const [rcCustomYear,      setRcCustomYear]      = useState("");
  const [rcCustomNeg,       setRcCustomNeg]       = useState("");
  const [rcNegError,        setRcNegError]        = useState<string|null>(null);
  // للمدير العام: اختيار المعرض لعرض مخزونه
  const [rcBranchId,        setRcBranchId]        = useState("");
  const [rcBranchInventory, setRcBranchInventory] = useState<InventoryOption[]>([]);
  const [rcBranchLoading,   setRcBranchLoading]   = useState(false);

  /* نوع العملية */
  const [opEditMode,    setOpEditMode]    = useState(false);
  const [newOpCode,     setNewOpCode]     = useState("");
  const [opSaving,      setOpSaving]      = useState(false);

  /* دورة جديدة */
  const [showNewCycle,    setShowNewCycle]    = useState(false);
  const [newCycleOp,      setNewCycleOp]      = useState("buyer");
  const [newCycleSaving,  setNewCycleSaving]  = useState(false);
  const [newCycleError,   setNewCycleError]   = useState<string|null>(null);
  const [newCycleId,      setNewCycleId]      = useState<string|null>(null);

  /* تعديل استثنائي */
  const [allowEditClosed, setAllowEditClosed] = useState(false);

  /* دورات سابقة accordion */
  const [openAncestorIds, setOpenAncestorIds] = useState<Set<string>>(new Set());

  /* حقول إضافية */
  const [dealValue,          setDealValue]          = useState("");
  const [selTradeId,         setSelTradeId]          = useState("");
  const [countAsInteraction, setCountAsInteraction]  = useState(true);

  /* رفع صور السيارة */
  const [photoFiles,       setPhotoFiles]       = useState<File[]>([]);
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<string[]>([]);
  const [photoUploading,   setPhotoUploading]   = useState(false);
  const [photoUploadError, setPhotoUploadError] = useState<string|null>(null);
  const [photoUploadDone,  setPhotoUploadDone]  = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  /* save state */
  const [saving,     setSaving]         = useState(false);
  const [saveError,  setSaveError]      = useState<string|null>(null);
  const [saved,      setSaved]          = useState(false);
  const [opError,    setOpError]        = useState<string|null>(null);

  /* ── Init ────────────────────────────────────────────────────────────────── */
  useEffect(()=>{
    const app = window.Telegram?.WebApp;
    if(app){ app.ready(); app.expand(); setTg(app); setIsDark(app.colorScheme==="dark"); }
    const p = new URLSearchParams(window.location.search);
    const id   = p.get("id");
    const chat = p.get("chat_id") ?? String(app?.initDataUnsafe?.user?.id??"");
    setChatId(chat); setCustId(id);
  },[]);

  useEffect(()=>{
    if(!chatId||!custId) return;
    fetch(`/api/bot-app/customer?chat_id=${chatId}&id=${custId}`)
      .then(r=>r.json())
      .then(d=>{
        if(d.error){ setError(d.error); return; }
        setData(d);
        const c = d.customer as Customer;
        setSelStatus(c.status);
        setFollowUp(toDateInput(c.next_follow_up_at));
        setReqCar(c.requested_car??(""));
        setPaymentMethod((c.metadata?.payment_method as string|undefined)??"");
        const ti = d.tradeIn as TradeIn|null;
        if(ti){
          setTiModel(ti.model??"");
          setTiChassis(ti.chassis_no??"");
          setTiPrice(ti.price!=null?String(ti.price):"");
          setTiColor(ti.color??"");
          setTiYear(ti.production_year!=null?String(ti.production_year):"");
          setTiMileage(ti.mileage!=null?String(ti.mileage):"");
          setTiSpecs(ti.specs??"");
          setTiInspection(ti.inspection??"");
          setTiLicense(toDateInput(ti.license_expiry));
          setTiNotes(ti.notes??"");
          const tiMeta = ti.metadata as Record<string,unknown>|null;
          setTiGear((tiMeta?.gear as string|null) ?? "اتوماتيك");
          setTiFuel((tiMeta?.fuel as string|null) ?? "بنزين");
        }
        setNewOpCode(c.operation_type_code);
        setDealValue((c.metadata?.deal_value as string|undefined)??"");
        setSelTradeId(d.allTradeIns?.[0]?.id??"");
        setEditName(c.full_name);
        setEditPhone(c.phone);
        setEditNickname(c.nickname??"");
        setEditAddress(c.address??"");
        setEditWaPrefix(c.whatsapp_prefix??"+970");
      })
      .catch(()=>setError("تعذر تحميل بيانات العميل"))
      .finally(()=>setLoading(false));
  },[chatId,custId]);

  /* ── Theme ───────────────────────────────────────────────────────────────── */
  const tp      = tg?.themeParams??{};
  const bg      = tp.bg_color          ??(isDark?"#1c1c1e":"#f2f2f7");
  const cardBg  = tp.secondary_bg_color??(isDark?"#2c2c2e":"#ffffff");
  const text    = tp.text_color        ??(isDark?"#ffffff":"#000000");
  const hint    = tp.hint_color        ??(isDark?"#8e8e93":"#6b7280");
  const btnBg   = tp.button_color      ??"#2563eb";
  const btnTxt  = tp.button_text_color ??"#ffffff";
  const border  = isDark?"#3a3a3c":"#e5e7eb";
  const inputBg = isDark?"#3a3a3c":"#f9f9f9";
  const sky     = isDark?"#38bdf8":"#0ea5e9";
  const emerald = isDark?"#34d399":"#10b981";
  const amber   = isDark?"#fbbf24":"#d97706";
  const rose    = isDark?"#f87171":"#ef4444";

  const css = {
    input: { background:inputBg, color:text, border:`1.5px solid ${border}`, borderRadius:10,
      padding:"10px 13px", fontSize:15, fontFamily:"inherit", outline:"none", width:"100%",
      boxSizing:"border-box" as const, direction:"rtl" as const } as React.CSSProperties,
    label: { fontSize:12, fontWeight:600, color:hint, letterSpacing:"0.5px" } as React.CSSProperties,
    section: { background:cardBg, borderRadius:14, border:`1px solid ${border}`,
      overflow:"hidden", marginBottom:10 } as React.CSSProperties,
    sectionHead: { padding:"12px 16px", fontSize:13, fontWeight:700, color:hint,
      borderBottom:`1px solid ${border}` } as React.CSSProperties,
    body: { padding:"14px 16px", display:"flex", flexDirection:"column" as const, gap:10 } as React.CSSProperties,
  };

  /* ── Voice notes × logs matching ──────────────────────────────────────────── */
  const voiceByLogId = useMemo(()=>{
    if(!data) return new Map<string, Attachment[]>();
    const map = new Map<string, Attachment[]>();
    for(const att of data.voiceNotes){
      const attMs = new Date(att.created_at).getTime();
      let closestId: string|null = null;
      let minDiff = Infinity;
      for(const log of data.logs){
        const diff = Math.abs(new Date(log.created_at).getTime()-attMs);
        if(diff<minDiff){ minDiff=diff; closestId=log.id; }
      }
      if(closestId && minDiff<=10*60*1000){
        const existing = map.get(closestId)??[];
        map.set(closestId, [...existing, att]);
      }
    }
    return map;
  },[data]);

  /* ── Filtered logs ─────────────────────────────────────────────────────────── */
  const filteredLogs = useMemo(()=>{
    if(!data) return [];
    const q = historySearch.trim().toLowerCase();
    return data.logs.filter(log=>{
      if(historyFilter!=="all" && classifyLog(log.action)!==historyFilter) return false;
      if(!q) return true;
      return `${translateAction(log.action)} ${log.details??""} ${log.actor_name}`.toLowerCase().includes(q);
    });
  },[data, historyFilter, historySearch]);

  /* ── Image attachments ─────────────────────────────────────────────────────── */
  const imgAttachments = useMemo(()=>
    (data?.photos??[]).filter(a=>a.public_url && isImage(a.file_name)),
  [data]);
  const fileAttachments = useMemo(()=>
    (data?.photos??[]).filter(a=>!isImage(a.file_name)),
  [data]);

  /* ── Save profile ──────────────────────────────────────────────────────────── */
  async function handleSave(){
    if(!data||!chatId||!custId) return;
    setSaving(true); setSaveError(null);
    const c = data.customer;
    const opCode = c.operation_type_code;
    const hasTrade = opCode==="buyer_tradein_pending"||opCode==="sell_on_behalf";
    const isBuyer  = opCode==="buyer"||opCode==="buyer_tradein_pending";

    const body: Record<string,unknown> = {
      chat_id:chatId, customer_id:custId,
      status:selStatus,
      note:noteText||undefined,
      next_follow_up_at: isClosedStatus(selStatus)?null:(followUp||null),
      count_as_interaction: countAsInteraction,
      ...(allowEditClosed?{allow_exceptional_edit:true}:{}),
    };
    if(needsInventoryChassis(selStatus,opCode)&&selInventory) body.inventory_id=selInventory;
    if(needsPayment(selStatus)){
      if(paymentMethod) body.payment_method=paymentMethod;
      if(dealValue) body.deal_value=Number(dealValue);
    }
    if(opCode==="sell_on_behalf"&&data.allTradeIns.length>1&&selTradeId) body.selected_trade_in_id=selTradeId;

    if(hasTrade&&tiModel.trim()){
      body.trade_in = {
        id:data.tradeIn?.id??null,
        model:tiModel.trim(),
        chassis_no:tiChassis.trim()||null,
        price:tiPrice?Number(tiPrice):null,
        color:tiColor.trim()||null,
        production_year:tiYear?Number(tiYear):null,
        mileage:tiMileage?Number(tiMileage):null,
        specs:tiSpecs.trim()||null,
        inspection:tiInspection.trim()||null,
        license_expiry:tiLicense||null,
        notes:tiNotes.trim()||null,
        gear:tiGear||null,
        fuel:tiFuel||null,
      };
    }

    const res = await fetch("/api/bot-app/update-customer",{
      method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body),
    });
    const json = await res.json();
    if(!res.ok){ setSaveError(json.error??"حدث خطأ"); setSaving(false); return; }
    setSaved(true); setSaving(false);
  }

  /* ── Save basic info ────────────────────────────────────────────────────────── */
  async function handleSaveBasic(){
    if(!chatId||!custId) return;
    setSaveError(null);
    const res = await fetch("/api/bot-app/update-customer",{
      method:"POST", headers:{"Content-Type":"application/json"},
      body:JSON.stringify({ chat_id:chatId, customer_id:custId,
        full_name:editName, phone:editPhone, nickname:editNickname||null, address:editAddress||null, whatsapp_prefix:editWaPrefix }),
    });
    const json = await res.json();
    if(!res.ok){ setSaveError(json.error??"حدث خطأ"); return; }
    setBasicOpen(false);
    setData(prev=>prev?{...prev,
      customer:{...prev.customer,full_name:editName,phone:editPhone,
        nickname:editNickname||null,address:editAddress||null}
    }:prev);
  }

  /* ── Close → notify bot to show main menu ─────────────────────────────────── */
  function closeToMenu(){
    if(!tg) return;
    try{ (tg as any).sendData(JSON.stringify({action:"close"})); }catch{ tg.close(); }
  }

  /* ── Save operation type ──────────────────────────────────────────────────── */
  async function handleSaveOpType(){
    if(!chatId||!custId||!newOpCode) return;
    setOpSaving(true); setOpError(null);

    // 1. حفظ نوع العملية + الحالة الافتراضية للنوع الجديد معاً (كما في الويب)
    const defaultStatus = DEFAULT_STATUS_BY_OPTYPE[newOpCode] ?? "جديد";
    const res = await fetch("/api/bot-app/update-customer",{
      method:"POST", headers:{"Content-Type":"application/json"},
      body:JSON.stringify({ chat_id:chatId, customer_id:custId, operation_type:newOpCode, status:defaultStatus }),
    });
    const json = await res.json();
    if(!res.ok){ setOpError(json.error??"حدث خطأ"); setOpSaving(false); return; }

    // 2. إعادة جلب البيانات الكاملة → قائمة الحالات الجديدة + بطاقة محدثة
    const dataRes = await fetch(`/api/bot-app/customer?chat_id=${chatId}&id=${custId}`);
    const newData = await dataRes.json();
    if(!newData.error){
      setData(newData);
      // إعادة تعيين حقول التعديل بناءً على نوع العملية الجديد (كما في الويب)
      const newStatuses: string[] = newData.statuses ?? [];
      setSelStatus(newStatuses[0] ?? "");
      setNoteText("");
      setFollowUp("");
      setSelInventory("");
      setPaymentMethod("");
      const newC = newData.customer as Customer;
      setReqCar(newC.requested_car ?? "");
      setNewOpCode(newC.operation_type_code);
    }
    setOpEditMode(false); setOpSaving(false);
  }

  /* ── New cycle ─────────────────────────────────────────────────────────────── */
  async function handleNewCycle(){
    if(!chatId||!custId) return;
    setNewCycleSaving(true); setNewCycleError(null);
    const res = await fetch("/api/bot-app/new-cycle",{
      method:"POST", headers:{"Content-Type":"application/json"},
      body:JSON.stringify({ chat_id:chatId, customer_id:custId, operation_type:newCycleOp }),
    });
    const json = await res.json();
    if(!res.ok){ setNewCycleError(json.error??"حدث خطأ"); setNewCycleSaving(false); return; }
    setNewCycleSaving(false);
    setNewCycleId(json.id ?? null);
  }

  /* ── Convert operation type ─────────────────────────────────────────────── */
  async function handleConvert(action: "to_tradein"|"to_sell_on_behalf"){
    if(!chatId||!custId) return;
    setSaving(true); setSaveError(null);
    const res = await fetch("/api/bot-app/update-customer",{
      method:"POST", headers:{"Content-Type":"application/json"},
      body:JSON.stringify({ chat_id:chatId, customer_id:custId, convert_action:action }),
    });
    const json = await res.json();
    if(!res.ok){ setSaveError(json.error??"حدث خطأ"); setSaving(false); return; }
    // إعادة تحميل كامل للبيانات
    const dataRes = await fetch(`/api/bot-app/customer?chat_id=${chatId}&id=${custId}`);
    const newData = await dataRes.json();
    if(!newData.error){
      setData(newData);
      const newC = newData.customer as Customer;
      setSelStatus(newC.status);
      setNewOpCode(newC.operation_type_code);
    }
    setSaving(false);
  }

  /* ── Photo upload ───────────────────────────────────────────────────────── */
  function onPhotoFilesSelected(e: React.ChangeEvent<HTMLInputElement>){
    const files = Array.from(e.target.files ?? []);
    if(!files.length) return;
    // revoke old previews
    photoPreviewUrls.forEach(u=>URL.revokeObjectURL(u));
    setPhotoFiles(files);
    setPhotoPreviewUrls(files.map(f=>URL.createObjectURL(f)));
    setPhotoUploadError(null);
    setPhotoUploadDone(false);
    // reset input so same file can be re-selected
    if(photoInputRef.current) photoInputRef.current.value="";
  }

  async function handlePhotoUpload(){
    if(!chatId||!custId||!photoFiles.length) return;
    setPhotoUploading(true); setPhotoUploadError(null); setPhotoUploadDone(false);
    try{
      const fd = new FormData();
      fd.append("chat_id", chatId);
      fd.append("customer_id", custId);
      fd.append("category", "trade_photo");
      photoFiles.forEach(f=>fd.append("files", f));
      const res = await fetch("/api/bot-app/upload-attachment",{ method:"POST", body:fd });
      const json = await res.json();
      if(!res.ok||!json.ok){ setPhotoUploadError(json.error??"فشل الرفع"); return; }
      // Success — refresh data to show new photos
      const dataRes = await fetch(`/api/bot-app/customer?chat_id=${chatId}&id=${custId}`);
      const newData = await dataRes.json();
      if(!newData.error) setData(newData);
      // clear selected files
      photoPreviewUrls.forEach(u=>URL.revokeObjectURL(u));
      setPhotoFiles([]); setPhotoPreviewUrls([]);
      setPhotoUploadDone(true);
      setTimeout(()=>setPhotoUploadDone(false), 3000);
    }catch{
      setPhotoUploadError("تعذر رفع الصور");
    }finally{
      setPhotoUploading(false);
    }
  }

  /* ── Loading / Error ─────────────────────────────────────────────────────── */
  if(loading) return(
    <div style={{minHeight:"100vh",background:bg,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{color:hint,fontSize:16}}>جاري التحميل...</div>
    </div>
  );
  if(error||!data) return(
    <div style={{minHeight:"100vh",background:bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12}}>
      <div style={{fontSize:40}}>⚠️</div>
      <div style={{color:text,fontSize:16}}>{error??"لم يتم العثور على العميل"}</div>
      <button onClick={closeToMenu} style={{padding:"10px 24px",borderRadius:10,border:"none",background:btnBg,color:btnTxt,fontSize:15,cursor:"pointer"}}>🏠 القائمة</button>
    </div>
  );

  /* ── Success ─────────────────────────────────────────────────────────────── */
  if(saved) return(
    <div style={{minHeight:"100dvh",background:bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"24px 20px",fontFamily:"system-ui,sans-serif",direction:"rtl"}}>
      <div style={{background:cardBg,borderRadius:20,padding:"28px 24px",textAlign:"center",width:"100%",maxWidth:360,boxShadow:"0 4px 24px rgba(0,0,0,0.08)"}}>
        <div style={{fontSize:56,marginBottom:10}}>✅</div>
        <div style={{fontSize:18,fontWeight:700,color:text,marginBottom:6}}>تم الحفظ بنجاح!</div>
        <div style={{fontSize:13,color:hint,marginBottom:24}}>تم تحديث بيانات العميل</div>
        <button onClick={()=>{ setSaved(false); window.location.reload(); }}
          style={{width:"100%",padding:"13px",borderRadius:12,border:"none",background:btnBg,color:btnTxt,fontSize:15,fontWeight:700,cursor:"pointer",marginBottom:10}}>
          🔄 رؤية التحديثات
        </button>
        <button onClick={()=>{ window.Telegram?.WebApp?.close?.(); }}
          style={{width:"100%",padding:"10px",borderRadius:12,border:"none",background:"transparent",color:hint,fontSize:13,cursor:"pointer"}}>
          ✕ إغلاق
        </button>
      </div>
    </div>
  );

  const c = data.customer;
  const opCode         = c.operation_type_code;
  const hasTrade       = opCode==="buyer_tradein_pending"||opCode==="sell_on_behalf";
  const isBuyer        = opCode==="buyer"||opCode==="buyer_tradein_pending";
  const isClosed       = shouldShowReactivate(c);               // matches web: !is_active OR closed status
  const isSoldComplete = !c.is_active && (c.status??"").includes("تمت عملية البيع");
  const canEdit        = data.canEdit && (!isClosed || allowEditClosed);
  const cycleIndex     = c.cycle_number ?? 1;
  const linkedInventoryId      = typeof c.metadata?.selected_inventory_id==="string" ? c.metadata.selected_inventory_id as string : null;
  const linkedInventoryChassis = typeof c.metadata?.selected_inventory_chassis==="string" ? c.metadata.selected_inventory_chassis as string : null;

  // آخر انتقال حالة
  const lastStatusLog = [...data.logs].find(l=>l.action==="status_updated");

  return(
    <div style={{minHeight:"100vh",background:bg,color:text,fontFamily:"system-ui,sans-serif",direction:"rtl",paddingBottom:canEdit?160:110}}>

      {/* ════ هيدر العميل ═════════════════════════════════════════════════════ */}
      <div style={{background:cardBg,padding:"16px 16px 14px",borderBottom:`1px solid ${border}`,position:"sticky",top:0,zIndex:10}}>
        <div style={{display:"flex",alignItems:"flex-start",gap:14}}>
          {/* أفاتار */}
          <div style={{
            width:52,height:52,borderRadius:"50%",flexShrink:0,
            background:`linear-gradient(135deg,${btnBg}cc,${btnBg}66)`,
            display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:"1.1rem",fontWeight:700,color:"#fff",
          }}>{initials(c.full_name)}</div>

          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
              <span style={{fontSize:"1.1rem",fontWeight:700}}>{c.full_name}</span>
              {c.nickname&&<span style={{fontSize:"0.82rem",fontWeight:600,color:"#93c5fd"}}>{c.nickname}</span>}
              {/* حالة مغلق */}
              {isClosed&&<span style={{fontSize:"0.72rem",fontWeight:700,background:"#fef2f2",color:"#b91c1c",borderRadius:99,padding:"2px 8px",border:"1px solid #fca5a5"}}>🔒 مغلق</span>}
            </div>
            {/* رقم الهاتف + العنوان + واتس آب */}
            <div style={{fontSize:"0.82rem",color:hint,marginTop:2,display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
              <a href={`https://wa.me/${(c.whatsapp_prefix??"+970").replace(/\D/g,"")}${c.phone.replace(/\D/g,"")}`}
                target="_blank" rel="noreferrer"
                style={{fontFamily:"monospace",color:"#16a34a",fontWeight:600,textDecoration:"none"}}>
                📱 {c.phone}
              </a>
              {c.address&&<span>· {c.address}</span>}
            </div>
            {/* قيمة الصفقة وطريقة الدفع */}
            {(()=>{
              const dv = c.metadata?.deal_value as number|null|undefined;
              const pm = c.metadata?.payment_method as string|null|undefined;
              if(!dv && !pm) return null;
              return (
                <div style={{fontSize:"0.78rem",color:hint,marginTop:3,display:"flex",gap:8,flexWrap:"wrap"}}>
                  {!!dv&&<span style={{color:emerald,fontWeight:700}}>💰 {Number(dv).toLocaleString("en-US")} ₪</span>}
                  {!!pm&&<span>💳 {pm}</span>}
                </div>
              );
            })()}
            {/* بادجات */}
            <div style={{display:"flex",gap:6,marginTop:6,flexWrap:"wrap",alignItems:"center"}}>
              <span style={{padding:"2px 10px",borderRadius:99,fontSize:"0.72rem",fontWeight:700,
                background:`${getStatusColor(c.status)}22`,color:getStatusColor(c.status),
                border:`1px solid ${getStatusColor(c.status)}44`}}>
                {c.status}
              </span>
              <span style={{padding:"2px 10px",borderRadius:99,fontSize:"0.72rem",fontWeight:600,
                background:isDark?"#3a3a3c":"#f3f4f6",color:hint}}>
                {opLabel(opCode)}
              </span>
              <span style={{padding:"2px 10px",borderRadius:99,fontSize:"0.72rem",fontWeight:700,
                background:isClosed?(isDark?"#3f1f1f":"#fef2f2"):(isDark?"#1a2f1a":"#f0fdf4"),
                color:isClosed?rose:emerald,border:`1px solid ${isClosed?rose+"44":emerald+"44"}`}}>
                {isClosed?"دورة مغلقة":"دورة نشطة"} #{cycleIndex}
              </span>
            </div>
            {/* إحصاءات */}
            <div style={{display:"flex",gap:8,marginTop:5,flexWrap:"wrap",fontSize:"0.75rem",color:hint}}>
              <span>تفاعلات: <strong style={{color:text}}>{c.visit_count??data.logs.length}</strong></span>
              <span>·</span>
              <span>مرفقات: <strong style={{color:text}}>{imgAttachments.length}</strong> صور</span>
              {c.last_contact_at&&<><span>·</span><span>آخر تواصل: {fmtDateShort(c.last_contact_at)}</span></>}
              {c.next_follow_up_at&&!isClosed&&(
                <span style={{background:`${sky}22`,color:sky,borderRadius:99,padding:"1px 8px",fontWeight:700}}>
                  📅 {fmtDateShort(c.next_follow_up_at)}
                </span>
              )}
            </div>
          </div>

          {/* أزرار الهيدر */}
          {canEdit&&(
            <div style={{flexShrink:0}}>
              <button onClick={()=>setBasicOpen(true)} style={{
                background:"transparent",border:`1px solid ${border}`,borderRadius:8,
                padding:"5px 9px",color:hint,fontSize:11,cursor:"pointer",
              }}>✏️</button>
            </div>
          )}
        </div>
      </div>

      <div style={{padding:"10px 10px 0"}}>

        {/* ════ السجل التاريخي ══════════════════════════════════════════════════ */}
        <div style={css.section}>
          <button
            onClick={()=>setShowHistory(h=>!h)}
            style={{width:"100%",background:"none",border:"none",padding:"13px 16px",
              display:"flex",justifyContent:"space-between",alignItems:"center",
              color:hint,fontSize:13,fontWeight:700,cursor:"pointer",textAlign:"right" as const}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{color:sky}}>🕐</span>
              السجل التاريخي
              <span style={{background:isDark?"#3a3a3c":"#f1f5f9",color:hint,
                borderRadius:99,padding:"1px 8px",fontSize:11,fontWeight:700}}>
                {data.logs.length}
              </span>
            </div>
            <span>{showHistory?"▲":"▼"}</span>
          </button>

          {/* آخر انتقال حالة */}
          {lastStatusLog&&!showHistory&&(
            <div style={{margin:"0 12px 12px",background:isDark?"#1e3a5f":"#eff6ff",
              borderRadius:10,padding:"9px 13px",fontSize:12,color:isDark?"#93c5fd":"#1d4ed8",
              border:`1px solid ${isDark?"#1e40af":"#bfdbfe"}`}}>
              <strong>آخر حالة:</strong> {lastStatusLog.details??""} · <strong>بواسطة:</strong> {lastStatusLog.actor_name} · {fmtDateShort(lastStatusLog.created_at)}
            </div>
          )}

          {showHistory&&(
            <div style={{borderTop:`1px solid ${border}`,padding:"12px 12px"}}>
              {/* فلتر + بحث */}
              <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
                <select value={historyFilter} onChange={e=>setHistoryFilter(e.target.value as typeof historyFilter)}
                  style={{...css.input,flex:"1 1 130px",padding:"8px 10px",fontSize:13}}>
                  <option value="all">كل الأحداث</option>
                  <option value="status">الحالات</option>
                  <option value="followup">المتابعات</option>
                  <option value="car">السيارة</option>
                  <option value="general">عام</option>
                </select>
                <input value={historySearch} onChange={e=>setHistorySearch(e.target.value)}
                  placeholder="ابحث في السجل..." style={{...css.input,flex:"2 1 180px",padding:"8px 10px",fontSize:13}} />
              </div>

              {/* إدخالات السجل */}
              {filteredLogs.length===0
                ? <p style={{textAlign:"center",color:hint,fontSize:13,padding:"12px 0"}}>لا توجد نتائج</p>
                : filteredLogs.map((log)=>{
                  const voices = voiceByLogId.get(log.id)??[];
                  const icon = ACTION_ICONS[log.action]??"📌";
                  return(
                    <div key={log.id} style={{display:"flex",gap:10,marginBottom:14,
                      paddingBottom:14,borderBottom:`1px solid ${border}`}}>
                      {/* نقطة زمنية */}
                      <div style={{flexShrink:0,display:"flex",flexDirection:"column",alignItems:"center",gap:0}}>
                        <div style={{width:32,height:32,borderRadius:"50%",
                          background:isDark?"#3a3a3c":"#f1f5f9",
                          display:"flex",alignItems:"center",justifyContent:"center",
                          fontSize:16}}>{icon}</div>
                        <div style={{width:1,flex:1,background:border,marginTop:4}}/>
                      </div>
                      {/* محتوى */}
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:4,marginBottom:3}}>
                          <span style={{fontWeight:700,fontSize:13,color:text}}>{translateAction(log.action)}</span>
                          <span style={{fontSize:11,color:hint}}>{fmtDate(log.created_at)}</span>
                        </div>
                        <div style={{fontSize:12,color:hint,marginBottom:2}}>بواسطة: {log.actor_name}</div>
                        {log.details&&(
                          <div style={{
                            display:"block",
                            marginTop:6,
                            padding:"6px 10px",
                            fontSize:13,
                            fontWeight:500,
                            color:isDark?"#93c5fd":"#1e40af",
                            lineHeight:1.65,
                            whiteSpace:"pre-wrap",
                            wordBreak:"break-word",
                            background:isDark?"rgba(59,130,246,0.1)":"#eff6ff",
                            borderRight:`3px solid ${isDark?"#3b82f6":"#3b82f6"}`,
                            borderRadius:"0 6px 6px 0",
                          }}>{log.details}</div>
                        )}

                        {/* التسجيلات الصوتية المرتبطة */}
                        {voices.length>0&&(
                          <div style={{marginTop:8,display:"flex",flexDirection:"column",gap:8}}>
                            {voices.map(att=>{
                              const isNeg = (att.file_name??"").includes("تفاوض");
                              return(
                                <div key={att.id} style={{
                                  borderRadius:10,padding:"9px 12px",
                                  background:isNeg?(isDark?"#422006":"#fffbeb"):(isDark?"#0c2340":"#eff6ff"),
                                  border:`1px solid ${isNeg?(isDark?"#92400e":"#fde68a"):(isDark?"#1e40af":"#bfdbfe")}`,
                                }}>
                                  <div style={{fontSize:12,fontWeight:700,
                                    color:isNeg?(isDark?"#fbbf24":"#92400e"):(isDark?"#93c5fd":"#1d4ed8"),
                                    marginBottom:6}}>
                                    {isNeg?"🚗":"🎤"} {att.file_name&&!att.file_name.startsWith("voice-note-")?att.file_name:"تسجيل صوتي"}
                                  </div>
                                  {att.public_url
                                    ?<audio controls src={att.public_url} style={{width:"100%",height:36}}/>
                                    :<span style={{fontSize:12,color:rose}}>⚠️ رابط التشغيل غير متاح</span>}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              }

              {/* ── الدورات السابقة accordion ── */}
              {data.ancestorCycles.length>0&&(
                <div style={{marginTop:12,borderTop:`1px solid ${border}`,paddingTop:10}}>
                  <div style={{fontSize:12,fontWeight:700,color:hint,marginBottom:8}}>
                    📚 الدورات السابقة ({data.ancestorCycles.length})
                  </div>
                  {data.ancestorCycles.map(cycle=>{
                    const isOpen = openAncestorIds.has(cycle.id);
                    return(
                      <div key={cycle.id} style={{marginBottom:6,borderRadius:10,border:`1px solid ${border}`,overflow:"hidden"}}>
                        <button onClick={()=>setOpenAncestorIds(prev=>{
                          const next = new Set(prev);
                          isOpen?next.delete(cycle.id):next.add(cycle.id);
                          return next;
                        })} style={{width:"100%",padding:"9px 12px",background:isDark?"#2c2c2e":"#f8fafc",
                          border:"none",display:"flex",justifyContent:"space-between",alignItems:"center",
                          cursor:"pointer",color:text,fontSize:12}}>
                          <div style={{display:"flex",gap:8,alignItems:"center"}}>
                            <span style={{fontWeight:700,color:hint}}>الدورة #{cycle.cycle_number}</span>
                            <span style={{color:getStatusColor(cycle.status),fontSize:11}}>{cycle.status}</span>
                            <span style={{color:hint,fontSize:11}}>{cycle.logs.length} حدث</span>
                          </div>
                          <span style={{color:hint}}>{isOpen?"▲":"▼"}</span>
                        </button>
                        {isOpen&&cycle.logs.map(log=>(
                          <div key={log.id} style={{padding:"8px 12px",borderTop:`1px solid ${border}`,
                            display:"flex",gap:8,alignItems:"flex-start"}}>
                            <span style={{fontSize:14}}>{ACTION_ICONS[log.action]??"📌"}</span>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{display:"flex",justifyContent:"space-between",gap:4}}>
                                <span style={{fontSize:12,fontWeight:700,color:text}}>{translateAction(log.action)}</span>
                                <span style={{fontSize:10,color:hint,flexShrink:0}}>{fmtDateShort(log.created_at)}</span>
                              </div>
                              {log.details&&(
                                <div style={{
                                  display:"block",marginTop:4,padding:"4px 8px",
                                  fontSize:11,fontWeight:500,
                                  color:isDark?"#93c5fd":"#1e40af",
                                  lineHeight:1.6,whiteSpace:"pre-wrap",wordBreak:"break-word",
                                  background:isDark?"rgba(59,130,246,0.1)":"#eff6ff",
                                  borderRight:"2px solid #3b82f6",borderRadius:"0 4px 4px 0",
                                }}>{log.details}</div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ════ نوع العملية ══════════════════════════════════════════════════════ */}
        <div style={css.section}>
          <div style={{...css.sectionHead,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span>🔄 نوع العملية</span>
              <span style={{fontSize:12,fontWeight:400,color:hint}}>{opLabel(opCode)}</span>
            </div>
            {opCode==="sell_on_behalf"
              ? <span style={{fontSize:11,color:hint,fontStyle:"italic"}}>مقفل — بيع بالوكالة</span>
              : !isClosed&&data.canEdit&&(
                  <button onClick={()=>{setOpEditMode(m=>!m);if(opEditMode)setNewOpCode(opCode);}} style={{
                    padding:"3px 10px",borderRadius:8,border:`1px solid ${border}`,
                    background:"transparent",color:hint,fontSize:11,cursor:"pointer",
                  }}>{opEditMode?"إغلاق التعديل":"تعديل"}</button>
                )
            }
          </div>
          {opEditMode&&opCode!=="sell_on_behalf"&&(
            <div style={css.body}>
              <select value={newOpCode} onChange={e=>setNewOpCode(e.target.value)}
                style={{...css.input}}>
                <option value="buyer">مشتري</option>
                <option value="buyer_tradein_pending">مشتري + استبدال</option>
              </select>
              {/* شريط جودة البيانات — مطابق للويب */}
              {(()=>{
                const checks = [
                  {label:"السيارة المطلوبة", ok: newOpCode==="sell_on_behalf"||Boolean(c.requested_car?.trim())},
                  {label:"بيانات سيارة العميل", ok: newOpCode==="buyer"||Boolean(data.tradeIn?.model?.trim())},
                  {label:"رقم الشاصي", ok: newOpCode==="buyer"||Boolean(data.tradeIn?.chassis_no?.trim())},
                  {label:"تاريخ الرخصة", ok: newOpCode==="buyer"||Boolean(data.tradeIn?.license_expiry?.trim())},
                  {label:"صور مرفقة", ok: newOpCode==="buyer"||data.photos.length>0},
                ];
                const pct = Math.round(checks.filter(x=>x.ok).length/checks.length*100);
                const missing = checks.filter(x=>!x.ok).map(x=>x.label);
                const barColor = pct>=80?emerald:pct>=50?amber:rose;
                return(
                  <div style={{borderRadius:10,border:`1px solid ${border}`,background:isDark?"#2c2c2e":"#f8fafc",padding:"10px 12px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:12,fontWeight:700,marginBottom:6}}>
                      <span style={{color:text}}>اكتمال البيانات</span>
                      <span style={{color:barColor}}>{pct}%</span>
                    </div>
                    <div style={{height:6,borderRadius:99,background:isDark?"#3a3a3c":"#e2e8f0",overflow:"hidden"}}>
                      <div style={{height:"100%",borderRadius:99,background:barColor,width:`${pct}%`,transition:"width 0.3s"}}/>
                    </div>
                    {missing.length>0
                      ?<div style={{fontSize:11,color:rose,marginTop:5,fontWeight:600}}>النواقص: {missing.join("، ")}</div>
                      :<div style={{fontSize:11,color:emerald,marginTop:5,fontWeight:600}}>البيانات مكتملة ✓</div>
                    }
                  </div>
                );
              })()}
              {opError&&<div style={{color:rose,fontSize:12}}>⚠️ {opError}</div>}
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>{setOpEditMode(false);setNewOpCode(opCode);}} style={{
                  flex:1,padding:"10px",borderRadius:10,border:`1px solid ${border}`,
                  background:"transparent",color:text,fontSize:14,cursor:"pointer",
                }}>إلغاء</button>
                <button onClick={handleSaveOpType} disabled={opSaving||newOpCode===opCode} style={{
                  flex:2,padding:"10px",borderRadius:10,border:"none",
                  background:(opSaving||newOpCode===opCode)?hint:btnBg,
                  color:btnTxt,fontSize:14,fontWeight:700,
                  cursor:(opSaving||newOpCode===opCode)?"not-allowed":"pointer",
                }}>{opSaving?"جاري الحفظ...":"💾 حفظ"}</button>
              </div>
            </div>
          )}
        </div>

        {/* ════ ربط المخزون (إذا وُجد) ═════════════════════════════════════════ */}
        {(linkedInventoryId||linkedInventoryChassis)&&(
          <div style={css.section}>
            <div style={{...css.sectionHead,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span>🏷️ ربط المخزون</span>
            </div>
            <div style={{padding:"10px 16px",display:"flex",flexDirection:"column",gap:4,fontSize:13}}>
              {linkedInventoryId&&<span><strong style={{color:hint}}>رقم المخزون: </strong><span style={{fontFamily:"monospace"}}>{linkedInventoryId}</span></span>}
              {linkedInventoryChassis&&<span><strong style={{color:hint}}>الشاصي: </strong><span style={{fontFamily:"monospace"}}>{linkedInventoryChassis}</span></span>}
            </div>
          </div>
        )}

        {/* ════ بانر الملف المغلق / الدورة الجديدة ════════════════════════════ */}
        {isClosed&&!showNewCycle&&!newCycleId&&(
          <div style={{...css.section,border:`1px solid ${rose}44`}}>
            <div style={{padding:"14px 16px",display:"flex",flexDirection:"column",gap:10}}>
              <div style={{fontSize:14,color:rose,fontWeight:700,display:"flex",alignItems:"center",gap:8}}>
                🔒 هذا الملف مغلق
                <span style={{fontSize:12,fontWeight:400,color:hint}}>— {c.status}</span>
              </div>
              {data.isManager&&(
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  <button onClick={()=>setShowNewCycle(true)} style={{
                    padding:"9px 14px",borderRadius:10,border:`1px solid ${amber}44`,
                    background:`${amber}22`,color:amber,fontSize:13,fontWeight:700,cursor:"pointer",
                  }}>♻️ فتح دورة جديدة</button>
                  {isSoldComplete&&!allowEditClosed&&(
                    <button onClick={()=>setAllowEditClosed(true)} style={{
                      padding:"9px 14px",borderRadius:10,border:`1px solid ${rose}44`,
                      background:`${rose}11`,color:rose,fontSize:13,fontWeight:700,cursor:"pointer",
                    }}>⚠️ تعديل استثنائي</button>
                  )}
                  {!isSoldComplete&&!allowEditClosed&&(
                    <button onClick={()=>setAllowEditClosed(true)} style={{
                      padding:"9px 14px",borderRadius:10,border:`1px solid ${hint}44`,
                      background:"transparent",color:hint,fontSize:13,cursor:"pointer",
                    }}>✏️ تعديل الملف</button>
                  )}
                </div>
              )}
              {allowEditClosed&&(
                <div style={{background:`${rose}11`,borderRadius:10,padding:"8px 12px",border:`1px solid ${rose}33`,fontSize:12,color:rose}}>
                  ⚠️ وضع التعديل الاستثنائي — التعديلات ستُسجَّل في السجل
                </div>
              )}
            </div>
          </div>
        )}
        {showNewCycle&&!newCycleId&&(
          <div style={{...css.section,border:`1px solid ${amber}44`}}>
            <div style={{padding:"14px 16px",display:"flex",flexDirection:"column",gap:10}}>
              <div style={{fontSize:13,fontWeight:700,color:amber}}>♻️ فتح دورة جديدة</div>
              <div style={{display:"flex",flexDirection:"column",gap:5}}>
                <span style={{...css.label}}>نوع العملية</span>
                <select value={newCycleOp} onChange={e=>setNewCycleOp(e.target.value)} style={css.input}>
                  <option value="buyer">مشتري</option>
                  <option value="buyer_tradein_pending">مشتري + استبدال</option>
                  <option value="sell_on_behalf">بيع بالوكالة</option>
                </select>
              </div>
              {newCycleError&&<div style={{color:rose,fontSize:12}}>⚠️ {newCycleError}</div>}
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>setShowNewCycle(false)} style={{flex:1,padding:"10px",borderRadius:10,border:`1px solid ${border}`,background:"transparent",color:text,fontSize:14,cursor:"pointer"}}>إلغاء</button>
                <button onClick={handleNewCycle} disabled={newCycleSaving} style={{flex:2,padding:"10px",borderRadius:10,border:"none",background:newCycleSaving?hint:amber,color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer"}}>
                  {newCycleSaving?"جاري الفتح...":"✅ تأكيد فتح الدورة"}
                </button>
              </div>
            </div>
          </div>
        )}
        {newCycleId&&(
          <div style={{...css.section,border:`1px solid ${emerald}44`}}>
            <div style={{padding:"16px",display:"flex",flexDirection:"column",gap:10,alignItems:"center",textAlign:"center" as const}}>
              <div style={{fontSize:32}}>✅</div>
              <div style={{fontSize:14,fontWeight:700,color:emerald}}>تم فتح دورة جديدة بنجاح!</div>
              <button onClick={()=>{const p=new URLSearchParams(window.location.search);window.location.href=`/bot-app/customer?id=${newCycleId}&chat_id=${p.get("chat_id")??""}`;}}
                style={{padding:"11px 20px",borderRadius:12,border:"none",background:btnBg,color:btnTxt,fontSize:14,fontWeight:700,cursor:"pointer"}}>
                فتح بطاقة الدورة الجديدة →
              </button>
            </div>
          </div>
        )}

        {/* ════ سيارة العميل (استبدال/بالوكالة) ════════════════════════════════ */}
        {hasTrade&&(
          <div style={css.section}>
            <button onClick={()=>setTiOpen(v=>!v)}
              style={{width:"100%",background:"none",border:"none",padding:"13px 16px",
                display:"flex",justifyContent:"space-between",alignItems:"center",
                color:hint,fontSize:13,fontWeight:700,cursor:"pointer",textAlign:"right" as const}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{color:sky}}>🚗</span>
                سيارة العميل
                {data.tradeIn&&<span style={{fontSize:12,fontWeight:400,color:hint}}>— {data.tradeIn.model}</span>}
              </div>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                {canEdit&&(
                  <button
                    onClick={e=>{e.stopPropagation();setTiEditMode(m=>!m);setTiOpen(true);}}
                    style={{padding:"3px 10px",borderRadius:8,border:`1px solid ${border}`,
                      background:"transparent",color:hint,fontSize:11,cursor:"pointer"}}>
                    {tiEditMode?"✓ حفظ التعديلات":"✏️ تعديل"}
                  </button>
                )}
                <span>{tiOpen?"▲":"▼"}</span>
              </div>
            </button>

            {tiOpen&&(
              <div style={{borderTop:`1px solid ${border}`}}>
                {/* عرض بيانات السيارة */}
                {data.tradeIn&&!tiEditMode&&(
                  <div style={{padding:"12px 16px"}}>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px 16px"}}>
                      {[
                        {label:"النوع",val:tiModel},
                        {label:"الشاصي",val:tiChassis,mono:true},
                        {label:"اللون",val:tiColor},
                        {label:"السنة",val:tiYear},
                        {label:"السعر (₪)",val:tiPrice?Number(tiPrice).toLocaleString("ar"):null},
                        {label:"الممشى (كم)",val:tiMileage?Number(tiMileage).toLocaleString("ar"):null},
                        {label:"ناقل الحركة",val:(data.tradeIn?.metadata as Record<string,unknown>|null)?.gear as string|null ?? null},
                        {label:"نوع الوقود",val:(data.tradeIn?.metadata as Record<string,unknown>|null)?.fuel as string|null ?? null},
                        {label:"المواصفات",val:tiSpecs},
                        {label:"الفحص",val:tiInspection},
                        {label:"الرخصة",val:tiLicense?tiLicense.slice(0,10):null},
                      ].map(({label,val,mono})=>val?(
                        <div key={label}>
                          <div style={{fontSize:11,color:hint,marginBottom:2}}>{label}</div>
                          <div style={{fontSize:13,fontWeight:600,color:text,fontFamily:mono?"monospace":undefined}}>{val}</div>
                        </div>
                      ):null)}
                    </div>
                    {data.tradeIn.status&&(
                      <div style={{marginTop:10,fontSize:12,fontWeight:700,color:isDark?"#818cf8":"#4f46e5",
                        background:isDark?"#1e1b4b":"#eef2ff",borderRadius:99,padding:"3px 10px",width:"fit-content"}}>
                        {data.tradeIn.status}
                      </div>
                    )}
                    {tiNotes&&<div style={{marginTop:10,fontSize:12,color:hint,lineHeight:1.5}}>{tiNotes}</div>}
                  </div>
                )}

                {/* نموذج تعديل السيارة */}
                {(tiEditMode||!data.tradeIn)&&canEdit&&(
                  <div style={css.body}>
                    <div style={{display:"flex",flexDirection:"column",gap:6}}>
                      <span style={css.label}>نوع السيارة / الموديل *</span>
                      <input value={tiModel} onChange={e=>setTiModel(e.target.value)} placeholder="تويوتا كامري 2022" style={css.input}/>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                      {[
                        {lbl:"رقم الشاصي",val:tiChassis,set:setTiChassis,type:"text"},
                        {lbl:"اللون",val:tiColor,set:setTiColor,type:"text"},
                        {lbl:"سنة الإنتاج",val:tiYear,set:setTiYear,type:"number"},
                        {lbl:"السعر (₪)",val:tiPrice,set:setTiPrice,type:"number"},
                        {lbl:"الممشى (كم)",val:tiMileage,set:setTiMileage,type:"number"},
                        {lbl:"انتهاء الرخصة",val:tiLicense,set:setTiLicense,type:"date"},
                      ].map(({lbl,val,set,type})=>(
                        <div key={lbl} style={{display:"flex",flexDirection:"column",gap:5}}>
                          <span style={css.label}>{lbl}</span>
                          <input type={type} value={val} onChange={e=>set(e.target.value)} style={css.input}/>
                        </div>
                      ))}
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                      <div style={{display:"flex",flexDirection:"column",gap:5}}>
                        <span style={css.label}>ناقل الحركة</span>
                        <select value={tiGear} onChange={e=>setTiGear(e.target.value)} style={css.input}>
                          <option value="اتوماتيك">اتوماتيك</option>
                          <option value="يدوي">يدوي</option>
                        </select>
                      </div>
                      <div style={{display:"flex",flexDirection:"column",gap:5}}>
                        <span style={css.label}>نوع الوقود</span>
                        <select value={tiFuel} onChange={e=>setTiFuel(e.target.value)} style={css.input}>
                          <option value="بنزين">بنزين</option>
                          <option value="ديزل">ديزل</option>
                          <option value="هايبرد">هايبرد</option>
                          <option value="كهربائية بالكامل">كهربائية بالكامل</option>
                          <option value="بلك أن">بلك أن</option>
                        </select>
                      </div>
                    </div>
                    {[
                      {lbl:"المواصفات",val:tiSpecs,set:setTiSpecs},
                      {lbl:"الفحص",val:tiInspection,set:setTiInspection},
                    ].map(({lbl,val,set})=>(
                      <div key={lbl} style={{display:"flex",flexDirection:"column",gap:5}}>
                        <span style={css.label}>{lbl}</span>
                        <input value={val} onChange={e=>set(e.target.value)} style={css.input}/>
                      </div>
                    ))}
                    <div style={{display:"flex",flexDirection:"column",gap:5}}>
                      <span style={css.label}>ملاحظات السيارة</span>
                      <textarea value={tiNotes} onChange={e=>setTiNotes(e.target.value)} rows={2}
                        style={{...css.input,resize:"none" as const}}/>
                    </div>
                  </div>
                )}

                {/* ── رفع صور السيارة ── */}
                {canEdit&&(
                  <div style={{padding:"10px 16px 14px",borderTop:`1px solid ${border}`}}>
                    {/* hidden file input */}
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      style={{display:"none"}}
                      onChange={onPhotoFilesSelected}
                    />

                    {/* اختيار صور */}
                    {!photoFiles.length&&(
                      <button
                        onClick={()=>photoInputRef.current?.click()}
                        style={{width:"100%",padding:"10px",borderRadius:10,
                          border:`1.5px dashed ${border}`,background:"transparent",
                          color:sky,fontSize:13,fontWeight:600,cursor:"pointer",
                          display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
                        📷 إضافة صور للسيارة
                      </button>
                    )}

                    {/* معاينة الصور المختارة */}
                    {photoFiles.length>0&&(
                      <div>
                        <div style={{fontSize:12,color:hint,marginBottom:8,fontWeight:600}}>
                          {photoFiles.length} صورة مختارة
                        </div>
                        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6,marginBottom:10}}>
                          {photoPreviewUrls.map((url,i)=>(
                            <div key={i} style={{position:"relative",aspectRatio:"1",borderRadius:8,overflow:"hidden",border:`1px solid ${border}`}}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                              <button
                                onClick={()=>{
                                  const newFiles = photoFiles.filter((_,fi)=>fi!==i);
                                  URL.revokeObjectURL(url);
                                  const newUrls = photoPreviewUrls.filter((_,ui)=>ui!==i);
                                  setPhotoFiles(newFiles);
                                  setPhotoPreviewUrls(newUrls);
                                }}
                                style={{position:"absolute",top:3,left:3,width:20,height:20,
                                  borderRadius:10,border:"none",background:"rgba(0,0,0,0.55)",
                                  color:"#fff",fontSize:12,cursor:"pointer",display:"flex",
                                  alignItems:"center",justifyContent:"center",lineHeight:1}}>
                                ✕
                              </button>
                            </div>
                          ))}
                          {/* زر إضافة المزيد */}
                          <button
                            onClick={()=>photoInputRef.current?.click()}
                            style={{aspectRatio:"1",borderRadius:8,border:`1.5px dashed ${border}`,
                              background:"transparent",color:hint,fontSize:20,cursor:"pointer",
                              display:"flex",alignItems:"center",justifyContent:"center"}}>
                            +
                          </button>
                        </div>

                        {photoUploadError&&(
                          <div style={{fontSize:12,color:rose,marginBottom:8}}>{photoUploadError}</div>
                        )}

                        <div style={{display:"flex",gap:8}}>
                          <button
                            onClick={handlePhotoUpload}
                            disabled={photoUploading}
                            style={{flex:1,padding:"10px",borderRadius:10,border:"none",
                              background:photoUploading?"#93c5fd":btnBg,color:btnTxt,
                              fontSize:13,fontWeight:700,cursor:photoUploading?"default":"pointer"}}>
                            {photoUploading?"⏳ جاري الرفع...":"☁️ رفع الصور"}
                          </button>
                          <button
                            onClick={()=>{
                              photoPreviewUrls.forEach(u=>URL.revokeObjectURL(u));
                              setPhotoFiles([]); setPhotoPreviewUrls([]);
                              setPhotoUploadError(null);
                            }}
                            style={{padding:"10px 14px",borderRadius:10,border:`1px solid ${border}`,
                              background:"transparent",color:hint,fontSize:13,cursor:"pointer"}}>
                            إلغاء
                          </button>
                        </div>
                      </div>
                    )}

                    {photoUploadDone&&!photoFiles.length&&(
                      <div style={{textAlign:"center",fontSize:13,color:emerald,fontWeight:600,marginTop:6}}>
                        ✅ تم رفع الصور بنجاح
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── مجلد الصور — دائماً مرئي داخل قسم سيارة العميل ── */}
            <AttachmentsSection
              imgs={imgAttachments} files={fileAttachments}
              albumIndex={albumIndex} showAlbum={showAlbum}
              setAlbumIndex={setAlbumIndex} setShowAlbum={setShowAlbum}
              show={showAttachments} toggle={()=>setShowAttachments(a=>!a)}
              border={border} cardBg={cardBg} text={text} hint={hint} isDark={isDark} sky={sky}
            />
          </div>
        )}

        {/* ════ السيارة المطلوبة ════════════════════════════════════════════════ */}
        {isBuyer&&(()=>{
          /* مخزون المعرض المتاح: للمدير العام من rcBranchInventory، للبقية من data.inventoryOptions */
          const activeInv: InventoryOption[] = data.isGeneralManager ? rcBranchInventory : data.inventoryOptions;

          function addRcCar(){
            if(!rcInventoryToAdd) return;
            const item = activeInv.find(o=>o.id===rcInventoryToAdd);
            if(!item) return;
            setRcSelectedCars(prev=>prev.some(p=>p.id===item.id)?prev:[...prev,item]);
            setRcInventoryToAdd("");
          }

          function removeRcCar(id: string){
            setRcSelectedCars(prev=>prev.filter(p=>p.id!==id));
            setRcNegotiations(prev=>{ const n={...prev}; delete n[id]; return n; });
          }

          async function saveRcCar(){
            if(!chatId||!custId) return;
            // التحقق من التفاوض
            const missingNeg = rcSelectedCars.filter(c=>!(rcNegotiations[c.id]??"").trim());
            if(missingNeg.length){
              setRcNegError(`يرجى إدخال تفاصيل التفاوض لـ: ${missingNeg.map(c=>c.model).join(" / ")}`);
              return;
            }
            if(rcUseCustom && rcCustomType.trim() && !rcCustomNeg.trim()){
              setRcNegError("يرجى إدخال تفاصيل التفاوض للطلب الخاص");
              return;
            }
            setRcNegError(null);
            // بناء نص السيارة المطلوبة — نحفظ اسم الموديل فقط بدون شاصي/سعر
            const carNames: string[] = [
              ...rcSelectedCars.map(c=>c.model),
              ...(rcUseCustom&&rcCustomType.trim()
                ? [`${rcCustomType.trim()}${rcCustomYear.trim()?` ${rcCustomYear.trim()}`:""}`]
                : []),
            ];
            const finalCar = carNames.join(" | ");
            // بناء ملاحظات التفاوض
            const negParts: string[] = [
              ...rcSelectedCars.map(c=>`🚗 ${c.label}\n${(rcNegotiations[c.id]??"").trim()||"(بدون تفاصيل تفاوض)"}`),
              ...(rcUseCustom&&rcCustomType.trim()
                ? [`🚗 (طلب خاص) ${rcCustomType.trim()}\n${rcCustomNeg.trim()||"(بدون تفاصيل تفاوض)"}`]
                : []),
            ];
            const negText = negParts.join("\n\n");

            setSaving(true); setSaveError(null);
            const res = await fetch("/api/bot-app/update-customer",{
              method:"POST", headers:{"Content-Type":"application/json"},
              body:JSON.stringify({
                chat_id:chatId, customer_id:custId,
                requested_car:finalCar,
                ...(negText?{note:negText}:{}),
                count_as_interaction:false,
              }),
            });
            const json = await res.json();
            setSaving(false);
            if(!res.ok){ setSaveError(json.error??"حدث خطأ"); return; }
            setReqCar(finalCar);
            setReqCarEditMode(false);
            setRcSelectedCars([]); setRcNegotiations({}); setRcInventoryToAdd("");
            setRcCustomType(""); setRcCustomYear(""); setRcCustomNeg(""); setRcNegError(null);
            setRcBranchId(""); setRcBranchInventory([]);
            setData(prev=>prev?{...prev,customer:{...prev.customer,requested_car:finalCar||null}}:prev);
          }

          return(
            <div style={css.section}>
              {/* رأس القسم */}
              <div style={{...css.sectionHead,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span>🚗 السيارة المطلوبة للعميل</span>
                  {!reqCarEditMode&&c.requested_car&&(
                    <span style={{fontSize:12,fontWeight:400,color:hint,maxWidth:"50%",
                      overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>
                      {c.requested_car}
                    </span>
                  )}
                </div>
                {canEdit&&(
                  <button
                    onClick={()=>{
                      setReqCarEditMode(m=>!m);
                      if(!reqCarEditMode){
                        // إعادة تعيين الحقول عند الفتح
                        setRcUseInventory(false); setRcUseCustom(false);
                        setRcSelectedCars([]); setRcNegotiations({});
                        setRcInventoryToAdd(""); setRcCustomType(""); setRcCustomYear(""); setRcCustomNeg("");
                        setRcNegError(null); setRcBranchId(""); setRcBranchInventory([]);
                      }
                    }}
                    style={{padding:"3px 10px",borderRadius:8,border:`1px solid ${border}`,
                      background:"transparent",color:hint,fontSize:11,cursor:"pointer"}}>
                    {reqCarEditMode?"إغلاق":"✏️ تعديل"}
                  </button>
                )}
              </div>

              {/* وضع العرض */}
              {!reqCarEditMode&&(
                <div style={{padding:"10px 16px 14px"}}>
                  {c.requested_car
                    ? <div style={{fontSize:13,color:text,lineHeight:1.7}}>
                        {c.requested_car.split(" | ").map((car,i)=>(
                          <div key={i} style={{padding:"6px 10px",marginBottom:4,borderRadius:8,
                            background:`${sky}11`,border:`1px solid ${sky}33`,color:text,fontWeight:600,fontSize:13}}>
                            ✔ {car}
                          </div>
                        ))}
                      </div>
                    : <div style={{fontSize:13,color:hint}}>لم تُحدَّد بعد</div>
                  }
                </div>
              )}

              {/* وضع التعديل */}
              {reqCarEditMode&&canEdit&&(
                <div style={{padding:"12px 16px",borderTop:`1px solid ${border}`,display:"flex",flexDirection:"column",gap:14}}>

                  {/* ملخص السيارات المختارة */}
                  {(rcSelectedCars.length>0||(rcUseCustom&&rcCustomType.trim()))&&(
                    <div style={{padding:"8px 12px",borderRadius:10,background:`${sky}11`,border:`1px solid ${sky}33`,fontSize:13,color:sky,fontWeight:600}}>
                      {[
                        ...rcSelectedCars.map(c=>c.label),
                        ...(rcUseCustom&&rcCustomType.trim()?[`(طلب خاص) ${rcCustomType.trim()}${rcCustomYear.trim()?` - ${rcCustomYear.trim()}`:""}`]:[]),
                      ].join(" | ")||"بدون سيارات محددة"}
                    </div>
                  )}

                  {/* للمدير العام: اختيار المعرض */}
                  {data.isGeneralManager&&(
                    <div style={{padding:"10px 12px",borderRadius:10,border:`1.5px solid ${amber}44`,
                      background:isDark?"#2a2000":"#fffbeb"}}>
                      <div style={{fontSize:12,color:amber,fontWeight:700,marginBottom:6}}>🏢 اختر المعرض لعرض سياراته</div>
                      <select
                        value={rcBranchId}
                        onChange={async e=>{
                          const bid = e.target.value;
                          setRcBranchId(bid);
                          setRcBranchInventory([]);
                          setRcInventoryToAdd("");
                          if(!bid) return;
                          setRcBranchLoading(true);
                          try{
                            const r = await fetch(`/api/bot-app/inventory-by-branch?chat_id=${chatId}&branch_id=${bid}`);
                            const j = await r.json();
                            if(j.ok) setRcBranchInventory(j.inventory??[]);
                          }finally{ setRcBranchLoading(false); }
                        }}
                        style={css.input}
                      >
                        <option value="">— اختر المعرض —</option>
                        {data.branches.map(b=>(
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                      {rcBranchLoading&&<div style={{fontSize:12,color:hint,marginTop:6}}>⏳ جاري تحميل المخزون...</div>}
                    </div>
                  )}

                  {/* ── خيار 1: من المخزون ── */}
                  <div style={{background:isDark?"#1e293b":"#f8fafc",borderRadius:10,padding:"10px 12px",border:`1px solid ${border}`}}>
                    <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",marginBottom: rcUseInventory?10:0}}>
                      <input type="checkbox" checked={rcUseInventory}
                        onChange={e=>{ setRcUseInventory(e.target.checked); setRcInventoryToAdd(""); }}
                        style={{width:16,height:16,accentColor:btnBg}}/>
                      <span style={{fontSize:13,fontWeight:600,color:text}}>اختيار سيارة مطلوبة من المخزون المتوفر</span>
                    </label>

                    {rcUseInventory&&(
                      <div style={{display:"flex",flexDirection:"column",gap:8}}>
                        {/* إذا GM ولم يختر معرض */}
                        {data.isGeneralManager&&!rcBranchId?(
                          <div style={{fontSize:13,color:amber,fontStyle:"italic"}}>اختر المعرض أولاً لعرض السيارات المتاحة</div>
                        ):(
                          <>
                            <div style={{display:"flex",gap:8}}>
                              <select value={rcInventoryToAdd} onChange={e=>setRcInventoryToAdd(e.target.value)} style={{...css.input,flex:1}}>
                                <option value="">اختر من المخزون</option>
                                {activeInv.map(o=>(
                                  <option key={o.id} value={o.id}>{o.label}</option>
                                ))}
                              </select>
                              <button
                                onClick={addRcCar}
                                disabled={!rcInventoryToAdd}
                                style={{padding:"9px 14px",borderRadius:10,border:"none",
                                  background:rcInventoryToAdd?btnBg:hint,color:btnTxt,
                                  fontSize:13,fontWeight:700,cursor:rcInventoryToAdd?"pointer":"default",whiteSpace:"nowrap" as const}}>
                                إضافة
                              </button>
                            </div>
                            {activeInv.length===0&&!rcBranchLoading&&(
                              <div style={{fontSize:12,color:hint,fontStyle:"italic"}}>لا توجد سيارات متوفرة حالياً</div>
                            )}
                          </>
                        )}

                        {/* السيارات المضافة */}
                        {rcSelectedCars.length>0&&(
                          <div style={{display:"flex",flexDirection:"column",gap:4}}>
                            {rcSelectedCars.map(car=>(
                              <div key={car.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                                borderRadius:8,border:`1px solid ${border}`,padding:"7px 10px",
                                background:isDark?"#2c2c2e":"#f9fafb",fontSize:13,color:sky}}>
                                <span>✔ {car.label}</span>
                                <button onClick={()=>removeRcCar(car.id)}
                                  style={{border:"none",background:"transparent",color:rose,fontSize:16,cursor:"pointer",fontWeight:700,lineHeight:1}}>
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* ── خيار 2: طلب خاص ── */}
                  <div style={{background:isDark?"#1e293b":"#f8fafc",borderRadius:10,padding:"10px 12px",border:`1px solid ${border}`}}>
                    <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",marginBottom: rcUseCustom?10:0}}>
                      <input type="checkbox" checked={rcUseCustom}
                        onChange={e=>{ setRcUseCustom(e.target.checked); if(!e.target.checked){setRcCustomType("");setRcCustomYear("");setRcCustomNeg("");} }}
                        style={{width:16,height:16,accentColor:btnBg}}/>
                      <span style={{fontSize:13,fontWeight:600,color:text}}>إدخال سيارة غير متوفرة حالياً (طلب خاص)</span>
                    </label>

                    {rcUseCustom&&(
                      <div style={{display:"flex",gap:8}}>
                        <input value={rcCustomType} onChange={e=>setRcCustomType(e.target.value)}
                          placeholder="نوع السيارة (مثال: كيا بيكانتو)" style={{...css.input,flex:2}}/>
                        <input value={rcCustomYear} onChange={e=>setRcCustomYear(e.target.value)}
                          type="number" placeholder="الموديل (سنة)" style={{...css.input,flex:1}}/>
                      </div>
                    )}
                  </div>

                  {/* ── تفاصيل التفاوض ── */}
                  {(rcSelectedCars.length>0||(rcUseCustom&&rcCustomType.trim()))&&(
                    <div style={{display:"flex",flexDirection:"column",gap:10}}>
                      <div style={{fontSize:12,fontWeight:700,color:hint,letterSpacing:"0.5px"}}>
                        تفاصيل التفاوض لكل سيارة
                        <span style={{color:rose,marginRight:4,fontWeight:400,fontSize:11}}>(إجباري)</span>
                      </div>

                      {rcSelectedCars.map(car=>(
                        <div key={car.id} style={{borderRadius:10,border:`1.5px solid ${border}`,overflow:"hidden"}}>
                          <div style={{padding:"6px 12px",background:isDark?"#1e3a5f":"#eff6ff",
                            fontSize:12,fontWeight:700,color:sky}}>
                            التفاوض على: {car.label}
                          </div>
                          <textarea
                            value={rcNegotiations[car.id]??""}
                            onChange={e=>{ setRcNegotiations(prev=>({...prev,[car.id]:e.target.value})); setRcNegError(null); }}
                            rows={2} placeholder="السعر المقترح، الملاحظات..."
                            style={{...css.input,borderRadius:0,border:"none",borderTop:`1px solid ${border}`,resize:"none" as const}}
                          />
                        </div>
                      ))}

                      {rcUseCustom&&rcCustomType.trim()&&(
                        <div style={{borderRadius:10,border:`1.5px solid ${amber}55`,overflow:"hidden"}}>
                          <div style={{padding:"6px 12px",background:isDark?"#3a2a00":"#fffbeb",
                            fontSize:12,fontWeight:700,color:amber}}>
                            التفاوض على: (طلب خاص) {rcCustomType}{rcCustomYear.trim()?` - موديل ${rcCustomYear}`:""}
                          </div>
                          <textarea
                            value={rcCustomNeg}
                            onChange={e=>{ setRcCustomNeg(e.target.value); setRcNegError(null); }}
                            rows={2} placeholder="تفاصيل التفاوض للطلب الخاص..."
                            style={{...css.input,borderRadius:0,border:"none",borderTop:`1px solid ${border}`,resize:"none" as const}}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* خطأ التفاوض */}
                  {rcNegError&&(
                    <div style={{borderRadius:8,border:`1px solid ${rose}55`,background:isDark?"#3b0a0a":"#fff1f2",
                      padding:"8px 12px",fontSize:12,color:rose,fontWeight:600}}>
                      ⚠️ {rcNegError}
                    </div>
                  )}

                  {/* تسجيل صوتي للتفاوض */}
                  {(rcSelectedCars.length>0||(rcUseCustom&&rcCustomType.trim()))&&(
                    <VoiceRecorder
                      chatId={chatId} custId={custId}
                      label="تسجيل تفاصيل التفاوض صوتياً"
                      hint={hint} border={border} cardBg={cardBg} text={text} isDark={isDark}
                      btnBg={amber} btnTxt="#fff" emerald={emerald} rose={rose} amber={amber}
                      onUploaded={async () => {
                        const r = await fetch(`/api/bot-app/customer?chat_id=${chatId}&id=${custId}`);
                        const d = await r.json();
                        if (!d.error) setData(d);
                      }}
                    />
                  )}

                  {/* أزرار الحفظ */}
                  <div style={{display:"flex",gap:8}}>
                    <button
                      onClick={()=>{
                        setReqCarEditMode(false);
                        setRcSelectedCars([]); setRcNegotiations({}); setRcInventoryToAdd("");
                        setRcCustomType(""); setRcCustomYear(""); setRcCustomNeg(""); setRcNegError(null);
                        setRcBranchId(""); setRcBranchInventory([]);
                      }}
                      style={{flex:1,padding:"10px",borderRadius:10,border:`1px solid ${border}`,
                        background:"transparent",color:text,fontSize:13,cursor:"pointer"}}>
                      إلغاء
                    </button>
                    <button
                      onClick={saveRcCar}
                      disabled={saving||(!rcSelectedCars.length&&!(rcUseCustom&&rcCustomType.trim()))}
                      style={{flex:2,padding:"10px",borderRadius:10,border:"none",
                        background:(saving||(!rcSelectedCars.length&&!(rcUseCustom&&rcCustomType.trim())))?hint:btnBg,
                        color:btnTxt,fontSize:13,fontWeight:700,cursor:"pointer"}}>
                      {saving?"جاري الحفظ...":"💾 حفظ السيارة المطلوبة"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* ════ الملاحظات الموجودة ══════════════════════════════════════════════ */}
        {c.notes&&(
          <div style={css.section}>
            <div style={css.sectionHead}>📋 الملاحظات المحفوظة</div>
            <div style={{padding:"12px 16px",fontSize:13,color:text,lineHeight:1.6,whiteSpace:"pre-wrap",wordBreak:"break-word"}}>
              {c.notes}
            </div>
          </div>
        )}

        {/* ════ منطقة التحديث ════════════════════════════════════════════════════ */}
        {canEdit&&(
          <>
            {/* الحالة */}
            <div style={{...css.section,border:`2px solid ${btnBg}44`}}>
              <div style={{...css.sectionHead,background:`${btnBg}11`,color:btnBg,fontWeight:800}}>
                💬 إضافة تحديث جديد
              </div>
              <div style={css.body}>
                {/* الحالة */}
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  <span style={css.label}>📌 تغيير الحالة</span>
                  <select value={selStatus} onChange={e=>{
                    const v = e.target.value;
                    if(v==="__convert_to_tradein__"){ handleConvert("to_tradein"); return; }
                    if(v==="__convert_to_sell_on_behalf__"){ handleConvert("to_sell_on_behalf"); return; }
                    setSelStatus(v);
                  }} style={css.input}>
                    {data.statuses.map(s=><option key={s} value={s}>{s}</option>)}
                    {/* خيارات التحويل */}
                    {opCode==="sell_on_behalf"&&(
                      <option value="__convert_to_tradein__">🔄 تحويل إلى مشتري + استبدال</option>
                    )}
                    {opCode==="buyer_tradein_pending"&&(
                      <option value="__convert_to_sell_on_behalf__">🔄 تحويل إلى بيع بالوكالة</option>
                    )}
                  </select>
                </div>

                {/* اختيار سيارة من المخزون */}
                {needsInventoryChassis(selStatus,opCode)&&data.inventoryOptions.length>0&&(
                  <div style={{display:"flex",flexDirection:"column",gap:6}}>
                    <span style={css.label}>🚗 اختيار سيارة من المخزون</span>
                    <select value={selInventory} onChange={e=>setSelInventory(e.target.value)} style={css.input}>
                      <option value="">— اختر سيارة —</option>
                      {data.inventoryOptions.map(o=><option key={o.id} value={o.id}>{o.label}</option>)}
                    </select>
                  </div>
                )}

                {/* اختيار سيارة البيع بالوكالة (إذا أكثر من سيارة) */}
                {opCode==="sell_on_behalf"&&data.allTradeIns.length>1&&(
                  <div style={{display:"flex",flexDirection:"column",gap:6}}>
                    <span style={css.label}>🚗 سيارة البيع بالوكالة</span>
                    <select value={selTradeId} onChange={e=>setSelTradeId(e.target.value)} style={css.input}>
                      {data.allTradeIns.map(t=>(
                        <option key={t.id} value={t.id}>{t.model}{t.chassis_no?` — ${t.chassis_no}`:""}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* طريقة الدفع + قيمة الصفقة */}
                {needsPayment(selStatus)&&(
                  <>
                    <div style={{display:"flex",flexDirection:"column",gap:6}}>
                      <span style={css.label}>💳 طريقة الدفع</span>
                      <select value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value)} style={css.input}>
                        <option value="">— اختر طريقة الدفع —</option>
                        {PAYMENT_METHODS.map(m=><option key={m.value} value={m.value}>{m.label}</option>)}
                      </select>
                    </div>
                    <div style={{display:"flex",flexDirection:"column",gap:6}}>
                      <span style={css.label}>💰 قيمة الصفقة (₪)</span>
                      <input type="number" value={dealValue} onChange={e=>setDealValue(e.target.value)}
                        placeholder="0" style={css.input}/>
                    </div>
                  </>
                )}

                {/* الملاحظة */}
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  <span style={css.label}>📝 ملاحظة جديدة (تُضاف للسجل)</span>
                  <textarea value={noteText} onChange={e=>setNoteText(e.target.value)}
                    placeholder="اكتب التفاصيل والملاحظات..." rows={3}
                    style={{...css.input,resize:"none" as const}}/>
                </div>

                {/* تسجيل صوتي للملاحظة */}
                <VoiceRecorder
                  chatId={chatId} custId={custId}
                  label="تسجيل ملاحظة صوتية"
                  hint={hint} border={border} cardBg={cardBg} text={text} isDark={isDark}
                  btnBg={btnBg} btnTxt={btnTxt} emerald={emerald} rose={rose} amber={amber}
                  onUploaded={async () => {
                    // تحديث السجل بعد الرفع
                    const r = await fetch(`/api/bot-app/customer?chat_id=${chatId}&id=${custId}`);
                    const d = await r.json();
                    if (!d.error) setData(d);
                  }}
                />

                {/* احتساب تفاعل */}
                <label style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",padding:"8px 10px",
                  borderRadius:10,border:`1px solid ${border}`,background:isDark?"#2c2c2e":"#f8fafc"}}>
                  <input type="checkbox" checked={countAsInteraction}
                    onChange={e=>setCountAsInteraction(e.target.checked)}
                    style={{width:18,height:18,cursor:"pointer"}}/>
                  <div>
                    <div style={{fontSize:13,fontWeight:600,color:text}}>احتساب كتفاعل مع العميل</div>
                    <div style={{fontSize:11,color:hint}}>يزيد عدد مرات التواصل في سجل العميل</div>
                  </div>
                </label>

                {/* موعد المتابعة */}
                {!isClosedStatus(selStatus)&&(
                  <div style={{display:"flex",flexDirection:"column",gap:6}}>
                    <span style={css.label}>📅 موعد المتابعة التالي</span>
                    <input type="date" value={followUp} onChange={e=>setFollowUp(e.target.value)} style={{...css.input, colorScheme: "light"}} />
                  </div>
                )}

              </div>
            </div>
          </>
        )}

        {!canEdit&&!isClosed&&(
          <div style={{...css.section}}>
            <div style={{padding:"14px 16px",fontSize:14,color:hint,textAlign:"center"}}>
              👁 عرض فقط — هذا العميل غير مُعيَّن لك
            </div>
          </div>
        )}

      </div>{/* end padding div */}

      {/* ════ شريط الأزرار السفلي ══════════════════════════════════════════════ */}
      <div style={{
        position:"fixed",bottom:0,left:0,right:0,
        background:cardBg,borderTop:`1px solid ${border}`,
        padding:"10px 12px",display:"flex",gap:8,zIndex:20,
      }}>
        {saveError&&(
          <div style={{position:"absolute",bottom:"100%",left:12,right:12,
            background:"#fef2f2",color:"#dc2626",border:"1px solid #fca5a5",
            borderRadius:10,padding:"8px 12px",fontSize:13,marginBottom:4}}>
            ⚠️ {saveError}
          </div>
        )}
        <button onClick={()=>{ window.Telegram?.WebApp?.close?.(); }} style={{
          flex:1,padding:"13px",borderRadius:12,border:`1px solid ${border}`,
          background:"transparent",color:text,fontSize:15,fontWeight:600,cursor:"pointer",
        }}>✕ إغلاق</button>
        {canEdit&&(
          <button onClick={handleSave} disabled={saving} style={{
            flex:2,padding:"13px",borderRadius:12,border:"none",
            background:saving?hint:btnBg,
            color:btnTxt,fontSize:15,fontWeight:700,cursor:saving?"not-allowed":"pointer",
          }}>
            {saving?"جاري الحفظ...":"💾 حفظ التغييرات"}
          </button>
        )}
      </div>

      {/* ════ Modal: تعديل المعلومات الأساسية ══════════════════════════════════ */}
      {basicOpen&&(
        <div style={{
          position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",
          display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:100,
        }} onClick={e=>{if(e.target===e.currentTarget)setBasicOpen(false)}}>
          <div style={{background:cardBg,borderRadius:"20px 20px 0 0",padding:"20px 16px 32px",width:"100%",maxWidth:600}}>
            <div style={{fontSize:16,fontWeight:700,color:text,marginBottom:16}}>✏️ تعديل المعلومات الأساسية</div>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {[
                {lbl:"الاسم الكامل",val:editName,set:setEditName,ph:""},
                {lbl:"الكنية / اللقب",val:editNickname,set:setEditNickname,ph:"اختياري"},
                {lbl:"رقم الهاتف",val:editPhone,set:setEditPhone,ph:""},
                {lbl:"المدينة / العنوان",val:editAddress,set:setEditAddress,ph:"اختياري"},
              ].map(({lbl,val,set,ph})=>(
                <div key={lbl} style={{display:"flex",flexDirection:"column",gap:6}}>
                  <span style={css.label}>{lbl}</span>
                  <input value={val} onChange={e=>set(e.target.value)} placeholder={ph} style={css.input}/>
                </div>
              ))}
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                <span style={css.label}>مقدمة الواتس آب</span>
                <select value={editWaPrefix} onChange={e=>setEditWaPrefix(e.target.value)} style={css.input}>
                  <option value="+970">🇵🇸 +970</option>
                  <option value="+972">🇮🇱 +972</option>
                  <option value="+962">🇯🇴 +962</option>
                  <option value="+966">🇸🇦 +966</option>
                  <option value="+971">🇦🇪 +971</option>
                  <option value="+20">🇪🇬 +20</option>
                  <option value="+1">🇺🇸 +1</option>
                  <option value="+44">🇬🇧 +44</option>
                </select>
              </div>
              {saveError&&<div style={{color:"#dc2626",fontSize:13}}>⚠️ {saveError}</div>}
              <div style={{display:"flex",gap:8,marginTop:4}}>
                <button onClick={()=>setBasicOpen(false)} style={{
                  flex:1,padding:"12px",borderRadius:10,border:`1px solid ${border}`,
                  background:"transparent",color:text,fontSize:14,fontWeight:600,cursor:"pointer",
                }}>إلغاء</button>
                <button onClick={handleSaveBasic} style={{
                  flex:2,padding:"12px",borderRadius:10,border:"none",
                  background:btnBg,color:btnTxt,fontSize:14,fontWeight:700,cursor:"pointer",
                }}>حفظ</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════ مشاهد الألبوم ══════════════════════════════════════════════════════ */}
      {showAlbum&&imgAttachments.length>0&&(
        <AlbumModal
          images={imgAttachments}
          index={albumIndex}
          onClose={()=>setShowAlbum(false)}
          onPrev={()=>setAlbumIndex(i=>(i-1+imgAttachments.length)%imgAttachments.length)}
          onNext={()=>setAlbumIndex(i=>(i+1)%imgAttachments.length)}
          cardBg={cardBg} border={border} hint={hint}
        />
      )}

    </div>
  );
}

/* ════ Voice Recorder ════════════════════════════════════════════════════════ */
function VoiceRecorder({
  chatId, custId, label = "تسجيل صوتي",
  hint: hintColor, border, cardBg, text, isDark, btnBg, btnTxt, emerald, rose, amber,
  onUploaded,
}: {
  chatId: string | null; custId: string | null;
  label?: string;
  hint: string; border: string; cardBg: string; text: string; isDark: boolean;
  btnBg: string; btnTxt: string; emerald: string; rose: string; amber: string;
  onUploaded?: () => void;
}) {
  const [state, setState] = useState<"idle" | "recording" | "preview" | "uploading" | "done" | "error">("idle");
  const [seconds, setSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const blobRef   = useRef<Blob | null>(null);
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/ogg";
      const mr = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        blobRef.current = blob;
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setState("preview");
        stream.getTracks().forEach(t => t.stop());
      };
      mr.start(200);
      mediaRef.current = mr;
      setSeconds(0);
      setState("recording");
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    } catch {
      setErrMsg("تعذّر الوصول للميكروفون. تأكد من منح الإذن.");
      setState("error");
    }
  }

  function stopRecording() {
    clearTimer();
    mediaRef.current?.stop();
  }

  function cancelPreview() {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null); blobRef.current = null;
    setSeconds(0); setState("idle");
  }

  async function uploadRecording() {
    if (!chatId || !custId || !blobRef.current) return;
    setState("uploading");
    try {
      const ext = blobRef.current.type.includes("webm") ? "webm" : "ogg";
      const fileName = `voice-note-miniapp-${Date.now()}.${ext}`;
      const fd = new FormData();
      fd.append("chat_id", chatId);
      fd.append("customer_id", custId);
      fd.append("category", "voice_note");
      fd.append("files", blobRef.current, fileName);

      const res = await fetch("/api/bot-app/upload-attachment", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok || !json.ok) { setErrMsg(json.error ?? "فشل رفع التسجيل"); setState("error"); return; }

      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setAudioUrl(null); blobRef.current = null;
      setState("done");
      onUploaded?.();
      setTimeout(() => setState("idle"), 3000);
    } catch {
      setErrMsg("خطأ في الاتصال بالخادم"); setState("error");
    }
  }

  useEffect(() => () => { clearTimer(); if (audioUrl) URL.revokeObjectURL(audioUrl); }, [clearTimer, audioUrl]);

  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div style={{
      borderRadius: 12, border: `1.5px solid ${
        state === "recording" ? rose + "88" :
        state === "preview"   ? amber + "88" :
        state === "done"      ? emerald + "88" : border
      }`,
      background: isDark ? "#1e1e1e" : "#f8fafc",
      overflow: "hidden",
    }}>
      {/* رأس */}
      <div style={{
        padding: "9px 14px",
        background: state === "recording" ? (isDark ? "#3b0a0a" : "#fff1f2") :
                    state === "preview"   ? (isDark ? "#3a2a00" : "#fffbeb") :
                    state === "done"      ? (isDark ? "#0a3b1a" : "#f0fdf4") :
                    isDark ? "#2c2c2e" : "#f1f5f9",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700 }}>
          <span>{state === "recording" ? "🔴" : state === "done" ? "✅" : "🎤"}</span>
          <span style={{ color: state === "recording" ? rose : state === "done" ? emerald : text }}>
            {state === "idle"      ? label :
             state === "recording" ? `جاري التسجيل… ${fmtTime(seconds)}` :
             state === "preview"   ? `معاينة — ${fmtTime(seconds)}` :
             state === "uploading" ? "جاري الرفع…" :
             state === "done"      ? "✅ تم الحفظ في السجل!" : ""}
          </span>
        </div>
        {state === "recording" && (
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: rose, animation: "pulse 1s infinite" }} />
        )}
      </div>

      {/* محتوى */}
      <div style={{ padding: "10px 14px 12px" }}>
        {(state === "idle" || state === "error") && (
          <>
            <button
              onClick={() => { setErrMsg(null); startRecording(); }}
              style={{
                width: "100%", padding: "10px", borderRadius: 10, border: "none",
                background: btnBg, color: btnTxt, fontSize: 13, fontWeight: 700,
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}>
              🎤 {label}
            </button>
            {errMsg && <div style={{ marginTop: 7, fontSize: 12, color: rose }}>{errMsg}</div>}
          </>
        )}

        {state === "recording" && (
          <button
            onClick={stopRecording}
            style={{
              width: "100%", padding: "10px", borderRadius: 10, border: "none",
              background: rose, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}>
            ⏹ إيقاف التسجيل
          </button>
        )}

        {state === "preview" && audioUrl && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <audio controls src={audioUrl} style={{ width: "100%", height: 36 }} />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={cancelPreview} style={{
                flex: 1, padding: "9px", borderRadius: 10, border: `1px solid ${border}`,
                background: "transparent", color: text, fontSize: 13, cursor: "pointer",
              }}>🗑 حذف</button>
              <button onClick={uploadRecording} style={{
                flex: 2, padding: "9px", borderRadius: 10, border: "none",
                background: emerald, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
              }}>☁️ حفظ في السجل</button>
            </div>
          </div>
        )}

        {state === "uploading" && (
          <div style={{ textAlign: "center", fontSize: 13, color: hintColor, padding: "6px 0" }}>
            ⏳ جاري الحفظ...
          </div>
        )}
      </div>
    </div>
  );
}

/* ════ Attachments Section ════════════════════════════════════════════════════ */
function AttachmentsSection({
  imgs, files, albumIndex, showAlbum, setAlbumIndex, setShowAlbum,
  show, toggle, border, cardBg, text, hint, isDark, sky, standalone=false,
}:{
  imgs: Attachment[]; files: Attachment[]; albumIndex:number; showAlbum:boolean;
  setAlbumIndex:(n:number)=>void; setShowAlbum:(b:boolean)=>void;
  show:boolean; toggle:()=>void;
  border:string; cardBg:string; text:string; hint:string; isDark:boolean; sky:string;
  standalone?: boolean;
}){
  const total = imgs.length + files.length;
  const wrapper: React.CSSProperties = standalone
    ? {background:cardBg,borderRadius:14,border:`1px solid ${border}`,overflow:"hidden",marginBottom:10}
    : {borderTop:`1px solid ${border}`};

  return(
    <div style={wrapper}>
      <button onClick={toggle} style={{
        width:"100%",background:"none",border:"none",padding:"12px 16px",
        display:"flex",justifyContent:"space-between",alignItems:"center",
        color:hint,fontSize:13,fontWeight:700,cursor:"pointer",textAlign:"right" as const}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span>📂</span>
          المرفقات
          <span style={{background:isDark?"#3a3a3c":"#f1f5f9",color:hint,
            borderRadius:99,padding:"1px 7px",fontSize:11,fontWeight:700}}>{total}</span>
        </div>
        <span>{show?"▲":"▼"}</span>
      </button>

      {show&&(
        <div style={{padding:"0 12px 14px"}}>
          {total===0&&(
            <p style={{textAlign:"center",color:hint,fontSize:13,padding:"12px 0"}}>لا توجد مرفقات</p>
          )}
          {imgs.length>0&&(
            <>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6,marginBottom:8}}>
                {imgs.map((att,idx)=>(
                  <button key={att.id} type="button"
                    onClick={()=>{setAlbumIndex(idx);setShowAlbum(true);}}
                    style={{background:"none",border:"none",padding:0,cursor:"pointer",borderRadius:8,overflow:"hidden"}}>
                    <img src={att.public_url??""} alt={att.file_name??"صورة"}
                      style={{width:"100%",aspectRatio:"1",objectFit:"cover",borderRadius:8,border:`1px solid ${border}`}}/>
                  </button>
                ))}
              </div>
              <button onClick={()=>{setAlbumIndex(0);setShowAlbum(true);}} style={{
                padding:"8px 16px",borderRadius:8,border:`1px solid ${border}`,
                background:"transparent",color:sky,fontSize:13,fontWeight:600,cursor:"pointer",
              }}>عرض الألبوم الكامل ({imgs.length})</button>
            </>
          )}
          {files.length>0&&(
            <div style={{marginTop:8,display:"flex",flexDirection:"column",gap:6}}>
              {files.map(att=>(
                <a key={att.id} href={att.public_url??"#"} target="_blank" rel="noreferrer"
                  style={{display:"flex",alignItems:"center",gap:8,padding:"9px 12px",borderRadius:10,
                    border:`1px solid ${border}`,color:sky,fontSize:13,textDecoration:"none"}}>
                  📎 {att.file_name??"ملف"}
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ════ Album Modal ════════════════════════════════════════════════════════════ */
function AlbumModal({images,index,onClose,onPrev,onNext,cardBg,border,hint}:{
  images:Attachment[]; index:number; onClose:()=>void;
  onPrev:()=>void; onNext:()=>void;
  cardBg:string; border:string; hint:string;
}){
  const att = images[index];
  return(
    <div style={{
      position:"fixed",inset:0,background:"rgba(0,0,0,0.92)",
      display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
      zIndex:200,padding:16,
    }}>
      <div style={{position:"absolute",top:16,right:16,display:"flex",gap:8}}>
        <span style={{color:"#fff",fontSize:13,opacity:0.7}}>{index+1} / {images.length}</span>
        <button onClick={onClose} style={{background:"rgba(255,255,255,0.15)",border:"none",borderRadius:8,
          color:"#fff",fontSize:18,padding:"4px 10px",cursor:"pointer"}}>✕</button>
      </div>
      <img src={att.public_url??""} alt={att.file_name??"صورة"}
        style={{maxWidth:"100%",maxHeight:"70vh",borderRadius:12,objectFit:"contain"}}/>
      <div style={{color:"rgba(255,255,255,0.6)",fontSize:12,marginTop:8}}>{att.file_name??""}</div>
      {images.length>1&&(
        <div style={{display:"flex",gap:12,marginTop:16}}>
          <button onClick={onPrev} style={{padding:"10px 24px",borderRadius:10,border:"none",
            background:"rgba(255,255,255,0.15)",color:"#fff",fontSize:15,cursor:"pointer"}}>→</button>
          <button onClick={onNext} style={{padding:"10px 24px",borderRadius:10,border:"none",
            background:"rgba(255,255,255,0.15)",color:"#fff",fontSize:15,cursor:"pointer"}}>←</button>
        </div>
      )}
    </div>
  );
}

/* ════ Status Color ═══════════════════════════════════════════════════════════ */
function getStatusColor(status: string): string {
  if(status.includes("تمت عملية البيع")||status.includes("للعميل")) return "#22c55e";
  if(status.includes("حجز")) return "#a855f7";
  if(status.includes("جديد")) return "#3b82f6";
  if(status.includes("تواصل")) return "#6366f1";
  if(status.includes("معاينة")) return "#8b5cf6";
  if(status.includes("عرض سعر")||status.includes("عرض سيارة")) return "#f97316";
  if(status.includes("استبدال")) return "#f97316";
  if(status.includes("رفض")) return "#ef4444";
  if(status.includes("مغلق")||status.includes("إغلاق")||status.includes("سحب")||status.includes("تراجع")) return "#6b7280";
  return "#6366f1";
}
