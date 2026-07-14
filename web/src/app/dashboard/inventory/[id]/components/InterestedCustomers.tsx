"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { User, Phone, CheckCircle2, FileText, Trash2, Edit2, Plus } from "lucide-react";
import { addCustomerInterest, removeCustomerInterest, updateCustomerInterest } from "@/app/dashboard/actions";
import { CustomerCarInterestItem } from "@/lib/data";

export function InterestedCustomers({ 
  inventoryId, 
  interests,
  allCustomers,
  allInventory
}: { 
  inventoryId: string; 
  interests: CustomerCarInterestItem[];
  allCustomers: { id: string; full_name: string; phone: string }[];
  allInventory?: { id: string; model: string; availability_status: string }[];
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Add form state
  const [customerId, setCustomerId] = useState("");
  const [interestLevel, setInterestLevel] = useState("high");
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(false);

  const handleAdd = async () => {
    if (!customerId) return alert("الرجاء اختيار العميل");
    setLoading(true);
    const res = await addCustomerInterest(inventoryId, customerId, interestLevel, notes);
    setLoading(false);
    if (res.error) {
      alert(res.error);
    } else {
      setIsAdding(false);
      setCustomerId("");
      setNotes("");
    }
  };

  const handleRemove = async (id: string) => {
    if (!confirm("هل أنت متأكد من إزالة هذا الاهتمام؟")) return;
    setLoading(true);
    const res = await removeCustomerInterest(id, inventoryId);
    setLoading(false);
    if (res.error) alert(res.error);
  };

  const handleUpdate = async (id: string) => {
    setLoading(true);
    const res = await updateCustomerInterest(id, inventoryId, interestLevel, notes);
    setLoading(false);
    if (res.error) {
      alert(res.error);
    } else {
      setEditingId(null);
    }
  };

  const startEdit = (interest: CustomerCarInterestItem) => {
    setEditingId(interest.id);
    setInterestLevel(interest.interest_level);
    setNotes(interest.notes || "");
  };

  const getLevelLabel = (level: string) => {
    switch (level) {
      case "high": return <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full">عالي جداً 🔥</span>;
      case "medium": return <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs rounded-full">متوسط 🟡</span>;
      case "low": return <span className="px-2 py-1 bg-slate-100 text-slate-700 text-xs rounded-full">منخفض ❄️</span>;
      default: return level;
    }
  };

  const router = useRouter();

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm mt-8">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 flex-wrap gap-4">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <User className="w-5 h-5 text-indigo-500" />
          العملاء المهتمين
          <span className="bg-slate-200 text-slate-700 text-xs px-2 py-0.5 rounded-full">{interests.length}</span>
        </h2>
        
        <div className="flex items-center gap-3">
          {allInventory && allInventory.length > 0 && (
            <select
              value={inventoryId}
              onChange={(e) => {
                const newId = e.target.value;
                if (newId !== inventoryId) {
                  router.push(`/dashboard/inventory/${newId}`);
                }
              }}
              className="bg-white border border-slate-300 rounded-lg text-sm px-3 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500/20 max-w-[200px] truncate"
            >
              {allInventory.map(inv => (
                <option key={inv.id} value={inv.id}>
                  {inv.model} ({inv.availability_status})
                </option>
              ))}
            </select>
          )}

          <button 
            onClick={() => setIsAdding(!isAdding)}
            className="flex items-center gap-1.5 bg-indigo-500 hover:bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            ربط عميل
          </button>
        </div>
      </div>

      {isAdding && (
        <div className="p-4 bg-indigo-50 border-b border-indigo-100 grid gap-4 grid-cols-1 md:grid-cols-4 items-end">
          <div className="md:col-span-1">
            <label className="block text-xs font-medium text-slate-600 mb-1">العميل</label>
            <select 
              value={customerId} 
              onChange={(e) => setCustomerId(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="">-- اختر عميل --</option>
              {allCustomers.map(c => (
                <option key={c.id} value={c.id}>{c.full_name} ({c.phone})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">مستوى الاهتمام</label>
            <select 
              value={interestLevel} 
              onChange={(e) => setInterestLevel(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="high">عالي جداً 🔥</option>
              <option value="medium">متوسط 🟡</option>
              <option value="low">منخفض ❄️</option>
            </select>
          </div>
          <div className="md:col-span-1">
            <label className="block text-xs font-medium text-slate-600 mb-1">ملاحظات (اختياري)</label>
            <input 
              type="text" 
              value={notes} 
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500/20"
              placeholder="مثال: ينتظر الموافقة على التمويل"
            />
          </div>
          <div>
            <button 
              onClick={handleAdd} 
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm px-4 py-2 transition-colors disabled:opacity-50"
            >
              {loading ? "جاري الحفظ..." : "حفظ الاهتمام"}
            </button>
          </div>
        </div>
      )}

      {interests.length === 0 ? (
        <div className="p-8 text-center text-slate-500 text-sm">
          لا يوجد عملاء مهتمين بهذه السيارة حالياً.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 font-medium">اسم العميل</th>
                <th className="px-4 py-3 font-medium">رقم الهاتف</th>
                <th className="px-4 py-3 font-medium">الاهتمام</th>
                <th className="px-4 py-3 font-medium">ملاحظات</th>
                <th className="px-4 py-3 font-medium text-left">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {interests.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-800">{item.customer_name}</td>
                  <td className="px-4 py-3 text-slate-600 dir-ltr text-right">{item.customer_phone}</td>
                  <td className="px-4 py-3">
                    {editingId === item.id ? (
                      <select 
                        value={interestLevel} 
                        onChange={(e) => setInterestLevel(e.target.value)}
                        className="bg-white border border-slate-300 rounded text-xs px-2 py-1 outline-none"
                      >
                        <option value="high">عالي جداً 🔥</option>
                        <option value="medium">متوسط 🟡</option>
                        <option value="low">منخفض ❄️</option>
                      </select>
                    ) : (
                      getLevelLabel(item.interest_level)
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600 text-xs">
                    {editingId === item.id ? (
                      <input 
                        type="text" 
                        value={notes} 
                        onChange={(e) => setNotes(e.target.value)}
                        className="bg-white border border-slate-300 rounded text-xs px-2 py-1 outline-none w-full min-w-[150px]"
                      />
                    ) : (
                      item.notes || "-"
                    )}
                  </td>
                  <td className="px-4 py-3 text-left">
                    <div className="flex items-center justify-end gap-2">
                      {item.id.startsWith("auto_") ? (
                        <span className="text-xs text-slate-400 italic">آلي (لا يمكن حذفه)</span>
                      ) : editingId === item.id ? (
                        <>
                          <button onClick={() => handleUpdate(item.id)} disabled={loading} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg">
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => setEditingId(null)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg">
                            إلغاء
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEdit(item)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleRemove(item.id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
