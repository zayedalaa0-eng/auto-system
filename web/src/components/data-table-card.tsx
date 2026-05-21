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
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-6 py-5">
        <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
        <p className="mt-1 text-sm text-slate-600">{description}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-right">
          <thead className="bg-slate-50 text-sm text-slate-500">
            <tr>
              {columns.map((column) => (
                <th key={column} className="px-6 py-4 font-medium">
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
