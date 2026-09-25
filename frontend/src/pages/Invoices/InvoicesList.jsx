import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { invoicesApi } from "../../api/invoices.api";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function businessStatus(inv) {
  const base = String(inv?.status || "").toUpperCase();
  if (base === "CANCELLED") return "CANCELLED";
  if (Number(inv?.due_total || 0) <= 0 && Number(inv?.grand_total || 0) > 0) return "PAID";
  if (Number(inv?.paid_total || 0) > 0 && Number(inv?.due_total || 0) > 0) return "PARTIAL";
  if (inv?.due_date && Number(inv?.due_total || 0) > 0 && new Date(inv.due_date) < new Date(todayISO())) return "OVERDUE";
  if (inv?.sent_at && Number(inv?.due_total || 0) > 0) return "SENT";
  return base || "DRAFT";
}

function StatusBadge({ invoice }) {
  const s = businessStatus(invoice);
  if (s === "FINAL")
    return (
      <span className="inline-flex items-center">
        <Badge className="rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
          FINAL
        </Badge>
      </span>
    );
  if (s === "CANCELLED")
    return (
      <span className="inline-flex items-center">
        <Badge className="rounded-full bg-red-100 text-red-700 hover:bg-red-100">
          CANCELLED
        </Badge>
      </span>
    );
  if (s === "PAID")
    return (
      <span className="inline-flex items-center">
        <Badge className="rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
          PAID
        </Badge>
      </span>
    );
  if (s === "PARTIAL")
    return (
      <span className="inline-flex items-center">
        <Badge className="rounded-full bg-amber-100 text-amber-700 hover:bg-amber-100">
          PARTIAL
        </Badge>
      </span>
    );
  if (s === "OVERDUE")
    return (
      <span className="inline-flex items-center">
        <Badge className="rounded-full bg-red-100 text-red-700 hover:bg-red-100">
          OVERDUE
        </Badge>
      </span>
    );
  return (
    <span className="inline-flex items-center">
      <Badge variant="secondary" className="rounded-full">
        {s}
      </Badge>
    </span>
  );
}

export default function InvoicesList() {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, pages: 1 });

  const [filters, setFilters] = useState({
    search: "",
    status: "",
    from: "",
    to: "",
    due_only: false,
  });

  const params = useMemo(() => {
    return {
      search: filters.search || undefined,
      status: filters.status || undefined,
      from: filters.from || undefined,
      to: filters.to || undefined,
      due_only: filters.due_only ? 1 : undefined,
      page: meta.page,
      limit: meta.limit,
    };
  }, [filters, meta.page, meta.limit]);

  const load = async () => {
    const res = await invoicesApi.list(params);
    const data = res.data;
    setRows(data.rows || []);
    setMeta((m) => ({
      ...m,
      page: data.page,
      limit: data.limit,
      total: data.total,
      pages: data.pages,
    }));
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line
  }, [params.search, params.status, params.from, params.to, params.due_only, params.page, params.limit]);

  const onFilterChange = (e) => {
    const { name, value, type, checked } = e.target;
    setMeta((m) => ({ ...m, page: 1 }));
    setFilters((p) => ({ ...p, [name]: type === "checkbox" ? checked : value }));
  };

  const reset = () => {
    setFilters({ search: "", status: "", from: "", to: "", due_only: false });
    setMeta((m) => ({ ...m, page: 1, limit: 20 }));
  };

  const setToday = () => {
    const t = todayISO();
    setMeta((m) => ({ ...m, page: 1 }));
    setFilters((p) => ({ ...p, from: t, to: t }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Invoices</h2>
          <p className="text-sm text-muted-foreground">
            Search, filter, and open invoices quickly
          </p>
        </div>

        <Link to="/invoices/create">
          <Button className="rounded-xl">Create Invoice</Button>
        </Link>
      </div>

      {/* Filters */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="grid gap-2 md:col-span-2">
              <Label>Search (Invoice No / Customer)</Label>
              <Input
                name="search"
                value={filters.search}
                onChange={onFilterChange}
                placeholder="e.g. UIS-2026 or customer name"
              />
            </div>

            <div className="grid gap-2">
              <Label>Status</Label>
              <select
                name="status"
                value={filters.status}
                onChange={onFilterChange}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="">All</option>
                <option value="DRAFT">DRAFT</option>
                <option value="FINAL">FINAL</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            </div>

            <div className="grid gap-2">
              <Label>Due only</Label>
              <label className="flex h-10 items-center gap-2 rounded-md border bg-background px-3 text-sm">
                <input
                  type="checkbox"
                  name="due_only"
                  checked={filters.due_only}
                  onChange={onFilterChange}
                />
                Show only due invoices
              </label>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <div className="grid gap-2">
              <Label>From</Label>
              <Input type="date" name="from" value={filters.from} onChange={onFilterChange} />
            </div>
            <div className="grid gap-2">
              <Label>To</Label>
              <Input type="date" name="to" value={filters.to} onChange={onFilterChange} />
            </div>

            <div className="flex items-end gap-2 md:col-span-2">
              <Button variant="secondary" type="button" onClick={setToday}>
                Today
              </Button>
              <Button variant="outline" type="button" onClick={reset}>
                Reset
              </Button>
            </div>
          </div>

          <Separator />
          <div className="text-sm text-muted-foreground">
            Total results: <span className="font-medium text-foreground">{meta.total}</span>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Invoice List</CardTitle>

          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Limit</span>
            <select
              className="h-9 rounded-md border bg-background px-2 text-sm"
              value={meta.limit}
              onChange={(e) =>
                setMeta((m) => ({ ...m, page: 1, limit: Number(e.target.value) }))
              }
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </CardHeader>

        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-3 pr-4">ID</th>
                  <th className="py-3 pr-4">Invoice No</th>
                  <th className="py-3 pr-4">Date</th>
                  <th className="py-3 pr-4">Customer</th>
                  <th className="py-3 pr-4">Status</th>
                  <th className="py-3 pr-4 text-right">Total</th>
                  <th className="py-3 pr-4 text-right">Paid</th>
                  <th className="py-3 pr-4 text-right">Due</th>
                  <th className="py-3 text-right">Action</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b hover:bg-muted/40">
                    <td className="py-3 pr-4">{r.id}</td>
                    <td className="py-3 pr-4 font-medium">
                      {r.invoice_no || <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="py-3 pr-4">{r.invoice_date}</td>
                    <td className="py-3 pr-4">{r.customer_name || r.customer_id}</td>
                    <td className="py-3 pr-4">
                      <StatusBadge invoice={r} />
                    </td>
                    <td className="py-3 pr-4 text-right">{r.grand_total}</td>
                    <td className="py-3 pr-4 text-right">{r.paid_total}</td>
                    <td className="py-3 pr-4 text-right">
                      <span
                        className={
                          Number(r.due_total) > 0
                            ? "font-semibold text-red-600"
                            : "text-emerald-700"
                        }
                      >
                        {r.due_total}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <Link to={`/invoices/${r.id}`}>
                        <Button size="sm" variant="secondary" className="rounded-xl">
                          View
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}

                {rows.length === 0 && (
                  <tr>
                    <td colSpan="9" className="py-10 text-center text-muted-foreground">
                      No invoices found ✅
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-muted-foreground">
              Page <span className="font-medium text-foreground">{meta.page}</span> /{" "}
              <span className="font-medium text-foreground">{meta.pages}</span>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={meta.page <= 1}
                onClick={() => setMeta((m) => ({ ...m, page: m.page - 1 }))}
              >
                Prev
              </Button>
              <Button
                variant="outline"
                disabled={meta.page >= meta.pages}
                onClick={() => setMeta((m) => ({ ...m, page: m.page + 1 }))}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
