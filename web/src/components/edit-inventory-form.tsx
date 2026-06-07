"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CAR_MAKES } from "@/lib/suggestions";

type Branch = { id: string; name: string };
type Car = {
  id: string; model: string; production_year: number | null;
  color: string | null; price: number | null; chassis_no: string | null;
  mileage: number | null; gearbox: string | null; fuel_type: string | null;
  condition_label: string | null; deal_type: string | null;
  availability_status: string; specs: string | null; inspection: string | null;
  notes: string | null; owner_name: string | null; branch_id: string | null;
};

const DEAL_TYPES    = ["شراء", "استبدال", "برسم البيع"];
const CONDITIONS    = ["مستعملة", "جديدة", "شبه جديدة"];
const GEARBOX_OPTS  = ["اتوماتيك", "يدوي"];
const FUEL_OPTS     = ["بنزين", "سولار", "هايبرد", "كهربائية بالكامل", "بلك أن"];
const STATUS_OPTS   = ["متوفرة", "محجوزة", "مباعة", "مسحوبة من المعرض"];

export function EditInventoryForm({ car, branches }: { car: Car; branches: Branch[] }) {
  const router = useRouter();
  const [model,      setModel]      = useState(car.model);
  const [year,       setYear]       = useState(car.production_year ? String(car.production_year) : "");
  const [color,      setColor]      = useState(car.color ?? "");
  const [price,      setPrice]      = useState(car.price ? String(car.price) : "");
  const [chassis,    setChassis]    = useState(car.chassis_no ?? "");
  const [mileage,    setMileage]    = useState(car.mileage ? String(car.mileage) : "");
  const [gearbox,    setGearbox]    = useState(car.gearbox ?? "اتوماتيك");
  const [fuel,       setFuel]       = useState(car.fuel_type ?? "بنزين");
  const [condition,  setCondition]  = useState(car.condition_label ?? "مستعملة");
  const [dealType,   setDealType]   = useState(car.deal_type ?? "شراء");
  const [status,     setStatus]     = useState(car.availability_status);
  const [ownerName,  setOwnerName]  = useState(car.owner_name ?? "");
  const [specs,      setSpecs]      = useState(car.specs ?? "");
  const [inspection, setInspection] = useState(car.inspection ?? "");
  const [notes,      setNotes]      = useState(car.notes ?? "");

  const [saving,   setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const consign = dealType === "برسم البيع";
  const isValid = model.trim() && chassis.trim() && (!consign || ownerName.trim());

  async function handleDelete() {
    setDeleting(true); setError(null);
    const res = await fetch("/api/inventory/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: car.id }),
    });
    const json = await res.json();
    setDeleting(false);
    if (!res.ok) { setError(json.error ?? "تعذر الحذف"); setConfirmDel(false); return; }
    router.push("/dashboard/inventory");
    router.refresh();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    setSaving(true); setError(null);
    const res = await fetch("/api/inventory/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: car.id, model: model.trim(),
        production_year: year ? Number(year) : null,
        color: color || null, price: price ? Number(price) : null,
        chassis_no: chassis || null, mileage: mileage ? Number(mileage) : null,
        gearbox, fuel_type: fuel, condition_label: condition,
        deal_type: dealType, availability_status: status,
        owner_name: ownerName || null,
        specs: specs || null, inspection: inspection || null, notes: notes || null,
      }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) { setError(json.error ?? "حدث خطأ"); return; }
    router.push("/dashboard/inventory");
    router.refresh();
  }

  const lbl = "block text-xs font-semibold text-slate-500 mb-1";
  const inp = "legacy-input w-full";

  return (
    <form onSubmit={handleSubmit} className="legacy-card flex flex-col gap-5">
      {error && <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm font-semibold text-rose-700">⚠️ {error}</div>}

      <div>
        <label className={lbl}>نوع الصفقة</label>
        <div className="flex flex-wrap gap-2">
          {DEAL_TYPES.map(d => (
            <button key={d} type="button" onClick={() => setDealType(d)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold border transition ${dealType === d ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"}`}>
              {d}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={lbl}>نوع السيارة *</label>
          <input value={model} onChange={e => setModel(e.target.value)} className={inp} list="edit-cars-list" autoComplete="off" required />
          <datalist id="edit-cars-list">{CAR_MAKES.map(c => <option key={c} value={c} />)}</datalist>
        </div>
        <div><label className={lbl}>سنة الصنع</label><input type="number" value={year} onChange={e => setYear(e.target.value)} className={inp} /></div>
        <div><label className={lbl}>السعر (₪)</label><input type="number" value={price} onChange={e => setPrice(e.target.value)} className={inp} /></div>
        <div>
          <label className={lbl}>رقم الشاصي *</label>
          <input value={chassis} onChange={e => setChassis(e.target.value)} className={`${inp}${!chassis.trim() ? " border-rose-300" : ""}`} dir="ltr" required />
        </div>
        <div><label className={lbl}>اللون</label><input value={color} onChange={e => setColor(e.target.value)} className={inp} /></div>
        <div><label className={lbl}>العداد (كم)</label><input type="number" value={mileage} onChange={e => setMileage(e.target.value)} className={inp} /></div>
        <div>
          <label className={lbl}>المالك {consign && <span className="text-rose-500">*</span>}</label>
          <input value={ownerName} onChange={e => setOwnerName(e.target.value)} className={`${inp}${consign && !ownerName.trim() ? " border-rose-300" : ""}`} placeholder={consign ? "مطلوب" : "اختياري"} />
        </div>
        <div><label className={lbl}>الحالة</label><select value={condition} onChange={e => setCondition(e.target.value)} className={inp}>{CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
        <div><label className={lbl}>التوفر</label><select value={status} onChange={e => setStatus(e.target.value)} className={inp}>{STATUS_OPTS.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
        <div><label className={lbl}>ناقل الحركة</label><select value={gearbox} onChange={e => setGearbox(e.target.value)} className={inp}>{GEARBOX_OPTS.map(g => <option key={g} value={g}>{g}</option>)}</select></div>
        <div><label className={lbl}>نوع الوقود</label><select value={fuel} onChange={e => setFuel(e.target.value)} className={inp}>{FUEL_OPTS.map(f => <option key={f} value={f}>{f}</option>)}</select></div>
        <div className="sm:col-span-2"><label className={lbl}>المواصفات</label><input value={specs} onChange={e => setSpecs(e.target.value)} className={inp} /></div>
        <div className="sm:col-span-2"><label className={lbl}>الفحص</label><input value={inspection} onChange={e => setInspection(e.target.value)} className={inp} /></div>
        <div className="sm:col-span-2"><label className={lbl}>ملاحظات</label><textarea value={notes} onChange={e => setNotes(e.target.value)} className={inp} rows={2} /></div>
      </div>

      <div className="flex gap-3 pt-1">
        <button type="button" onClick={() => router.push("/dashboard/inventory")} className="legacy-btn border flex-1">إلغاء</button>
        <button type="submit" disabled={saving || !isValid} className="legacy-btn legacy-btn-primary flex-[2]">
          {saving ? "⏳ جاري الحفظ..." : "💾 حفظ التعديلات"}
        </button>
      </div>

      {/* زر الحذف */}
      <div className="border-t border-slate-200 pt-4 mt-2">
        {!confirmDel ? (
          <button type="button" onClick={() => setConfirmDel(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 w-full justify-center">
            🗑 حذف هذه السيارة نهائياً
          </button>
        ) : (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 flex flex-col gap-3">
            <p className="text-sm font-bold text-rose-800 text-center">
              ⚠️ هل أنت متأكد من حذف <strong>{car.model}</strong> نهائياً؟ لا يمكن التراجع.
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setConfirmDel(false)}
                className="legacy-btn border flex-1">إلغاء</button>
              <button type="button" onClick={handleDelete} disabled={deleting}
                className="flex-[2] rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-rose-700 transition disabled:opacity-60">
                {deleting ? "⏳ جاري الحذف..." : "🗑 تأكيد الحذف"}
              </button>
            </div>
          </div>
        )}
      </div>
    </form>
  );
}
