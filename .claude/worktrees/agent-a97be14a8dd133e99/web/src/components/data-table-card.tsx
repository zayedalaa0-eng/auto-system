import { type ReactNode } from "react";

type DataTableCardProps = {
  title: string;
  description: string;
  columns: string[];
  children: ReactNode;
  emptyMessage: string;
  hasRows: boolean;
};

export function DataTableCard({
  title,
  description,
  columns,
  children,
  emptyMessage,
  hasRows,
}: DataTableCardProps) {
  return (
    <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
      <div className="border-b border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] px-6 py-5">
        <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-right">
          <thead className="bg-slate-950 text-sm text-slate-200">
            <tr>
              {columns.map((column) => (
                <th key={column} className="px-6 py-4 font-medium whitespace-nowrap">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
            {hasRows ? (
              children
            ) : (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-6 py-12 text-center text-sm text-slate-500"
                >
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
