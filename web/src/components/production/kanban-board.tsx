"use client";

import { useState, useTransition } from "react";
import { updateOrderStatusAction } from "@/app/dashboard/production/orders/actions";
import { Factory, Calendar, Settings2, CheckCircle2, Clock } from "lucide-react";
import { formatCurrency } from "@/lib/format";

type Order = {
  id: string;
  item_code: string;
  quantity: number;
  status: string;
  created_at: string;
  erp_items?: { original_name: string; approved_name?: string } | null;
  erp_sales_orders?: { customer_id: string } | null;
};

const COLUMNS = [
  { id: "planned", label: "مخطط (في الانتظار)", icon: Clock, color: "text-slate-500", bg: "bg-slate-100", border: "border-slate-300" },
  { id: "in_progress", label: "قيد التنفيذ", icon: Settings2, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200" },
  { id: "QA", label: "فحص الجودة", icon: Factory, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" },
  { id: "finished", label: "منتهي وجاهز", icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200" }
];

export function KanbanBoard({ initialOrders }: { initialOrders: Order[] }) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [isPending, startTransition] = useTransition();

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    // Optimistic Update
    const previousOrders = [...orders];
    setOrders(orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o));

    startTransition(async () => {
      const res = await updateOrderStatusAction(orderId, newStatus);
      if (!res.success) {
        // Revert on failure
        setOrders(previousOrders);
        alert("حدث خطأ أثناء تحديث الحالة. يرجى المحاولة مرة أخرى.");
      }
    });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start w-full min-h-[600px] pb-10">
      {COLUMNS.map((col) => {
        const columnOrders = orders.filter((o) => o.status === col.id);

        return (
          <div key={col.id} className={`rounded-2xl border ${col.border} ${col.bg} p-3 min-h-[400px] flex flex-col`}>
            <div className="flex items-center justify-between mb-4 px-1">
              <div className="flex items-center gap-2">
                <col.icon className={`h-5 w-5 ${col.color}`} />
                <h3 className={`font-bold text-sm ${col.color}`}>{col.label}</h3>
              </div>
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-bold shadow-sm">
                {columnOrders.length}
              </span>
            </div>

            <div className="flex-1 flex flex-col gap-3">
              {columnOrders.map((order) => (
                <div key={order.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-mono font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                      #{order.id.slice(0, 6)}
                    </span>
                    <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                      الكمية: {order.quantity}
                    </span>
                  </div>
                  
                  <h4 className="font-bold text-slate-800 text-sm mb-1 line-clamp-2">
                    {order.erp_items?.approved_name || order.erp_items?.original_name || order.item_code}
                  </h4>
                  
                  <div className="flex items-center gap-1 text-xs text-slate-500 mb-4">
                    <Calendar className="h-3.5 w-3.5" />
                    {new Date(order.created_at).toLocaleDateString("ar-SA")}
                  </div>

                  {/* Dropdown لتحريك الطلب بدلاً من السحب والإفلات لتبسيط الاستخدام على الجوال */}
                  <select 
                    value={order.status}
                    onChange={(e) => handleStatusChange(order.id, e.target.value)}
                    disabled={isPending}
                    className="w-full text-xs font-bold border border-slate-200 bg-slate-50 text-slate-700 rounded-lg px-2 py-1.5 outline-none focus:border-indigo-500 disabled:opacity-50"
                  >
                    {COLUMNS.map(c => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>
              ))}

              {columnOrders.length === 0 && (
                <div className="flex-1 flex items-center justify-center border-2 border-dashed border-slate-300/50 rounded-xl">
                  <span className="text-xs text-slate-400 font-medium">لا توجد طلبات هنا</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
