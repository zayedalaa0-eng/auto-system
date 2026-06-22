"use client";

import { useEffect, useState, useCallback } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface TradeIn {
  id: string;
  model: string | null;
  color: string | null;
  production_year: number | null;
  mileage: number | null;
  chassis_no: string | null;
  inspection: string | null;
  specs: string | null;
  notes: string | null;
  status: string | null;
  price: number | null;
}

interface Customer {
  id: string;
  full_name: string | null;
  phone: string | null;
  branch_name: string | null;
  staff_name: string | null;
  staff_user_id: string | null;
  staff_chat_id: string | null;
}

interface Photo {
  url: string;
  category: string | null;
}

interface EvalCardData {
  trade: TradeIn;
  customer: Customer | null;
  photos: Photo[];
  viewer: { id: string; full_name: string };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const categoryLabel: Record<string, string> = {
  trade_photo: "صورة السيارة",
  trade_files_photos: "صور الملفات",
  trade_inspection: "فحص السيارة",
  trade_license: "الرخصة",
  trade_insurance: "التأمين",
};

function fmt(n: number | null | undefined) {
  if (n == null) return "—";
  return n.toLocaleString("en-US");
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function EvalCardPage() {
  const [data, setData] = useState<EvalCardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [price, setPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [activePhoto, setActivePhoto] = useState(0);

  // ─── Fetch params + data ─────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    const tg = window.Telegram?.WebApp;
    void tg; // used for ready/expand only

    // prefer query string (passed via url)
    const urlParams = new URLSearchParams(window.location.search);
    const chatId   = urlParams.get("chat_id") ?? null;
    const tradeId  = urlParams.get("trade_id")   ?? null;
    const custId   = urlParams.get("customer_id") ?? null;

    if (!chatId) { setError("لم يُعرَّف معرف المحادثة"); setLoading(false); return; }
    if (!tradeId && !custId) { setError("يجب تمرير trade_id أو customer_id"); setLoading(false); return; }

    const qs = new URLSearchParams({ chat_id: chatId });
    if (tradeId) qs.set("trade_id", tradeId);
    if (custId)  qs.set("customer_id", custId);

    try {
      const res = await fetch(`/api/bot-app/eval-card?${qs}`);
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "خطأ غير معروف"); setLoading(false); return; }
      setData(json as EvalCardData);
    } catch {
      setError("فشل تحميل البيانات");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    tg?.ready();
    tg?.expand();
    fetchData();
  }, [fetchData]);

  // ─── Submit price ────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!data) return;
    const numPrice = parseFloat(price.replace(/,/g, ""));
    if (!numPrice || numPrice <= 0) { setSubmitError("أدخل سعراً صحيحاً"); return; }

    setSubmitting(true);
    setSubmitError(null);

    const urlParams = new URLSearchParams(window.location.search);
    const chatId = urlParams.get("chat_id");

    try {
      const res = await fetch("/api/bot-app/eval-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          trade_id: data.trade.id,
          customer_id: data.customer?.id,
          price: numPrice,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setSubmitError(json.error ?? "فشل الإرسال"); return; }
      setSubmitted(true);
      setTimeout(() => window.Telegram?.WebApp?.close(), 2000);
    } catch {
      setSubmitError("خطأ في الاتصال بالخادم");
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Render states ───────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-[#0f172a]">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-slate-400 text-sm">جاري التحميل…</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="flex items-center justify-center min-h-screen bg-[#0f172a] p-6">
      <div className="bg-red-900/30 border border-red-700 rounded-2xl p-6 text-center max-w-sm w-full">
        <div className="text-4xl mb-3">⚠️</div>
        <p className="text-red-300 font-semibold">{error}</p>
      </div>
    </div>
  );

  if (!data) return null;

  const { trade, customer, photos } = data;

  if (submitted) return (
    <div className="flex items-center justify-center min-h-screen bg-[#0f172a] p-6" dir="rtl">
      <div className="bg-green-900/30 border border-green-600 rounded-2xl p-8 text-center max-w-sm w-full">
        <div className="text-5xl mb-4">✅</div>
        <h2 className="text-green-300 text-xl font-bold mb-2">تم إرسال التقييم!</h2>
        <p className="text-slate-400 text-sm mb-6">سيُرسَل إشعار للموظف المعني فوراً</p>
        <button
          onClick={() => { try { window.Telegram?.WebApp?.close?.(); } catch { window.close(); } }}
          className="w-full bg-slate-800 text-white font-bold py-3 rounded-xl border border-slate-700 transition-all hover:bg-slate-700"
        >
          ✕ إغلاق
        </button>
      </div>
    </div>
  );

  // Already evaluated
  if (trade.price && trade.price > 0) return (
    <div className="flex items-center justify-center min-h-screen bg-[#0f172a] p-6">
      <div className="bg-yellow-900/20 border border-yellow-700 rounded-2xl p-8 text-center max-w-sm w-full">
        <div className="text-4xl mb-3">💰</div>
        <h2 className="text-yellow-300 text-lg font-bold mb-1">تم التقييم مسبقاً</h2>
        <p className="text-white text-2xl font-bold mt-3">{fmt(trade.price)} ₪</p>
        <p className="text-slate-400 text-xs mt-2">الحالة: {trade.status ?? "—"}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0f172a] text-white pb-32" dir="rtl">

      {/* ── Header ── */}
      <div className="bg-gradient-to-b from-slate-800 to-[#0f172a] px-4 pt-5 pb-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-2xl">🚗</span>
          <h1 className="text-lg font-bold text-white">بطاقة تقييم السيارة</h1>
        </div>
        <p className="text-slate-400 text-xs">المُقيِّم: {data.viewer.full_name}</p>
      </div>

      <div className="px-4 space-y-4">

        {/* ── Photo Gallery ── */}
        {photos.length > 0 && (
          <div className="rounded-2xl overflow-hidden bg-slate-800 border border-slate-700">
            <div className="relative aspect-video bg-black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photos[activePhoto].url}
                alt="صورة السيارة"
                className="w-full h-full object-contain"
              />
              {photos.length > 1 && (
                <>
                  <button
                    onClick={() => setActivePhoto((p) => (p - 1 + photos.length) % photos.length)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/60 rounded-full w-8 h-8 flex items-center justify-center text-white text-lg"
                  >›</button>
                  <button
                    onClick={() => setActivePhoto((p) => (p + 1) % photos.length)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 rounded-full w-8 h-8 flex items-center justify-center text-white text-lg"
                  >‹</button>
                </>
              )}
              <div className="absolute bottom-2 right-3 bg-black/60 text-xs text-white px-2 py-0.5 rounded-full">
                {categoryLabel[photos[activePhoto].category ?? ""] ?? photos[activePhoto].category ?? "صورة"}
              </div>
            </div>
            {/* Thumbnails */}
            {photos.length > 1 && (
              <div className="flex gap-1.5 p-2 overflow-x-auto">
                {photos.map((ph, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={i}
                    src={ph.url}
                    alt=""
                    onClick={() => setActivePhoto(i)}
                    className={`w-14 h-10 object-cover rounded cursor-pointer flex-shrink-0 border-2 transition-all ${i === activePhoto ? "border-blue-500" : "border-transparent opacity-60"}`}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {photos.length === 0 && (
          <div className="rounded-2xl bg-slate-800/50 border border-slate-700 border-dashed p-6 text-center">
            <div className="text-3xl mb-2">📷</div>
            <p className="text-slate-500 text-sm">لا توجد صور مرفقة</p>
          </div>
        )}

        {/* ── Car Details ── */}
        <div className="rounded-2xl bg-slate-800 border border-slate-700 overflow-hidden">
          <div className="bg-slate-700/50 px-4 py-2.5 flex items-center gap-2">
            <span className="text-base">🚘</span>
            <h2 className="text-sm font-bold text-slate-200">تفاصيل السيارة</h2>
          </div>
          <div className="p-4 grid grid-cols-2 gap-3">
            <DetailCell label="الموديل"         value={trade.model} />
            <DetailCell label="اللون"           value={trade.color} />
            <DetailCell label="سنة الصنع"       value={trade.production_year?.toString()} />
            <DetailCell label="عدد الكيلومترات" value={trade.mileage ? `${fmt(trade.mileage)} كم` : null} />
            <DetailCell label="رقم الشاصي"      value={trade.chassis_no} />
            <DetailCell label="حالة الفحص"      value={trade.inspection} />
            {trade.specs && (
              <div className="col-span-2">
                <DetailCell label="المواصفات" value={trade.specs} />
              </div>
            )}
            {trade.notes && (
              <div className="col-span-2">
                <DetailCell label="ملاحظات" value={trade.notes} />
              </div>
            )}
          </div>
        </div>

        {/* ── Customer Info ── */}
        {customer && (
          <div className="rounded-2xl bg-slate-800 border border-slate-700 overflow-hidden">
            <div className="bg-slate-700/50 px-4 py-2.5 flex items-center gap-2">
              <span className="text-base">👤</span>
              <h2 className="text-sm font-bold text-slate-200">بيانات العميل</h2>
            </div>
            <div className="p-4 grid grid-cols-2 gap-3">
              <DetailCell label="الاسم"   value={customer.full_name} />
              <DetailCell label="الهاتف"  value={customer.phone} />
              <DetailCell label="الفرع"   value={customer.branch_name} />
              <DetailCell label="الموظف المسؤول" value={customer.staff_name} />
            </div>
          </div>
        )}

        {/* ── Price Input ── */}
        <div className="rounded-2xl bg-gradient-to-br from-blue-900/40 to-slate-800 border border-blue-700/50 overflow-hidden">
          <div className="bg-blue-900/40 px-4 py-2.5 flex items-center gap-2">
            <span className="text-base">💰</span>
            <h2 className="text-sm font-bold text-blue-200">إرسال قيمة التقييم</h2>
          </div>
          <div className="p-4 space-y-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">أدخل قيمة التقييم بالشيقل</label>
              <div className="relative">
                <input
                  type="number"
                  inputMode="numeric"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="مثال: 45000"
                  className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-white text-lg font-bold placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
                />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₪</span>
              </div>
            </div>

            {submitError && (
              <p className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
                ⚠️ {submitError}
              </p>
            )}

            <button
              onClick={handleSubmit}
              disabled={submitting || !price}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold py-3.5 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>جاري الإرسال…</span>
                </>
              ) : (
                <>
                  <span>✍️</span>
                  <span>إرسال قيمة التقييم</span>
                </>
              )}
            </button>
            <p className="text-xs text-slate-500 text-center">
              سيُرسَل إشعار فوري للموظف بقيمة التقييم
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── Sub-component ────────────────────────────────────────────────────────────

function DetailCell({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs text-slate-500 mb-0.5">{label}</p>
      <p className="text-sm text-white font-medium">{value ?? "—"}</p>
    </div>
  );
}
