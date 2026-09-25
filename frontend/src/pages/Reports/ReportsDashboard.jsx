import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { reportsApi } from "../../api/reports.api";
import { API_BASE_URL } from "../../api/axios";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

function iso(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
function todayRange() {
  const d = new Date();
  const t = iso(d);
  return { from: t, to: t };
}
function lastNDaysRange(n) {
  const toD = new Date();
  const fromD = new Date();
  fromD.setDate(fromD.getDate() - n);
  return { from: iso(fromD), to: iso(toD) };
}
function thisMonthRange() {
  const d = new Date();
  const from = new Date(d.getFullYear(), d.getMonth(), 1);
  const to = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return { from: iso(from), to: iso(to) };
}
function lastMonthRange() {
  const d = new Date();
  const from = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  const to = new Date(d.getFullYear(), d.getMonth(), 0);
  return { from: iso(from), to: iso(to) };
}

async function downloadFile(url, filename) {
  const token = localStorage.getItem("token");
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    alert(`Download failed: ${res.status}\n${txt}`);
    return;
  }
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function StatCard({ title, value, sub }) {
  return (
    <Card className="rounded-2xl">
      <CardContent className="p-5">
        <div className="text-sm text-muted-foreground">{title}</div>
        <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
        {sub ? <div className="mt-2 text-xs text-muted-foreground">{sub}</div> : null}
      </CardContent>
    </Card>
  );
}

export default function ReportsDashboard() {
  const [filters, setFilters] = useState(() => lastNDaysRange(30));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // drill-down
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [custLoading, setCustLoading] = useState(false);
  const [custData, setCustData] = useState(null);
  const [ledgerData, setLedgerData] = useState(null);

  // all customers dropdown
  const [allCustomers, setAllCustomers] = useState([]);
  const [custSearch, setCustSearch] = useState("");
  const [custListLoading, setCustListLoading] = useState(false);

  const load = async (range = filters) => {
    setLoading(true);
    try {
      const res = await reportsApi.dashboard(range);
      setData(res.data);
    } finally {
      setLoading(false);
    }
  };

  const loadCustomers = async (search = "") => {
    setCustListLoading(true);
    try {
      const res = await reportsApi.customers({ search });
      setAllCustomers(res.data || []);
    } finally {
      setCustListLoading(false);
    }
  };

  useEffect(() => {
    load(filters);
    loadCustomers("");
    // eslint-disable-next-line
  }, []);

  const apply = async (e) => {
    e.preventDefault();
    await load(filters);
  };

  const setQuick = async (range) => {
    setFilters(range);
    await load(range);
  };

  const loadCustomer = async (customerId) => {
    if (!customerId) {
      setCustData(null);
      setLedgerData(null);
      return;
    }
    setCustLoading(true);
    try {
      const [res, ledger] = await Promise.all([
        reportsApi.customer(customerId, { limit: 20 }),
        reportsApi.ledger(customerId, { limit: 200 }),
      ]);
      setCustData(res.data);
      setLedgerData(ledger.data);
    } finally {
      setCustLoading(false);
    }
  };

  const exportExcel = async () => {
    const url = `${API_BASE_URL}/api/reports/dashboard.xlsx?from=${filters.from}&to=${filters.to}`;
    await downloadFile(url, `dashboard_${filters.from}_to_${filters.to}.xlsx`);
  };

  const exportPdf = async () => {
    const url = `${API_BASE_URL}/api/reports/dashboard.pdf?from=${filters.from}&to=${filters.to}`;
    await downloadFile(url, `dashboard_${filters.from}_to_${filters.to}.pdf`);
  };

  if (loading) return <div className="text-sm text-muted-foreground">Loading...</div>;
  if (!data) return <div className="text-sm text-muted-foreground">No data</div>;

  const s = data.summary;
  const p = data.profit || { gross_sales: 0, total_cost: 0, gross_profit: 0 };
  const aging = data.dueAging || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Reports Dashboard</h2>
          <div className="mt-1 text-sm text-muted-foreground">
            Range: <span className="font-medium text-foreground">{data.range.from}</span> →{" "}
            <span className="font-medium text-foreground">{data.range.to}</span>
          </div>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <form onSubmit={apply} className="flex flex-wrap items-end gap-3">
            <div className="grid gap-1">
              <Label>From</Label>
              <Input
                type="date"
                value={filters.from}
                onChange={(e) => setFilters((p) => ({ ...p, from: e.target.value }))}
                className="w-[180px]"
              />
            </div>
            <div className="grid gap-1">
              <Label>To</Label>
              <Input
                type="date"
                value={filters.to}
                onChange={(e) => setFilters((p) => ({ ...p, to: e.target.value }))}
                className="w-[180px]"
              />
            </div>
            <Button type="submit">Apply</Button>
          </form>

          <div className="flex gap-2">
            <Button variant="outline" onClick={exportExcel}>
              Export Excel
            </Button>
            <Button variant="outline" onClick={exportPdf}>
              Export PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Quick buttons */}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => setQuick(todayRange())}>
          Today
        </Button>
        <Button variant="secondary" onClick={() => setQuick(thisMonthRange())}>
          This Month
        </Button>
        <Button variant="secondary" onClick={() => setQuick(lastMonthRange())}>
          Last Month
        </Button>
        <Button variant="secondary" onClick={() => setQuick(lastNDaysRange(30))}>
          Last 30 Days
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
        <StatCard title="Sales (FINAL)" value={`₹ ${s.sales_total}`} />
        <StatCard title="Payments Received" value={`₹ ${s.payments_received}`} />
        <StatCard
          title="Total Due"
          value={`₹ ${s.due_total}`}
          sub={`Draft: ₹ ${s.draft_due_total || 0} • Final: ₹ ${s.final_due_total || 0}`}
        />
        <StatCard
          title="Gross Profit"
          value={`₹ ${p.gross_profit}`}
          sub={`Sales: ₹ ${p.gross_sales} • Cost: ₹ ${p.total_cost}`}
        />
        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <div className="text-sm text-muted-foreground">Invoices</div>
            <div className="mt-2 space-y-1 text-sm">
              <div>
                <Badge variant="secondary">DRAFT</Badge>{" "}
                <span className="font-medium">{s.invoices_draft}</span>
              </div>
              <div>
                <Badge className="rounded-full" variant="secondary">
                  FINAL
                </Badge>{" "}
                <span className="font-medium">{s.invoices_final_all}</span>
              </div>
              <div>
                <Badge variant="secondary">CANCELLED</Badge>{" "}
                <span className="font-medium">{s.invoices_cancelled}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* GST cards */}
      <div className="grid gap-3 md:grid-cols-3">
        <StatCard title="CGST" value={`₹ ${s.cgst_total}`} />
        <StatCard title="SGST" value={`₹ ${s.sgst_total}`} />
        <StatCard title="IGST" value={`₹ ${s.igst_total}`} />
      </div>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Due Aging</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-5">
            <StatCard title="Not Due" value={`₹ ${aging.not_due || 0}`} />
            <StatCard title="1-7 Days" value={`₹ ${aging.d_1_7 || 0}`} />
            <StatCard title="8-30 Days" value={`₹ ${aging.d_8_30 || 0}`} />
            <StatCard title="31-60 Days" value={`₹ ${aging.d_31_60 || 0}`} />
            <StatCard title="60+ Days" value={`₹ ${aging.d_60_plus || 0}`} />
          </div>
        </CardContent>
      </Card>

      {/* Chart */}
      <Card className="rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Daily Sales (FINAL)</CardTitle>
          <div className="text-sm text-muted-foreground">
            Points: <span className="font-medium text-foreground">{(data.daily || []).length}</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[280px] w-full">
            <ResponsiveContainer>
              <LineChart data={data.daily || []}>
                <CartesianGrid />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="sales" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <Separator className="my-4" />

          <details>
            <summary className="cursor-pointer text-sm text-muted-foreground">
              View table
            </summary>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-4">Date</th>
                    <th className="py-2 text-right">Sales</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.daily || []).map((r) => (
                    <tr key={r.day} className="border-b">
                      <td className="py-2 pr-4">{r.day}</td>
                      <td className="py-2 text-right">₹ {r.sales}</td>
                    </tr>
                  ))}
                  {(data.daily || []).length === 0 && (
                    <tr>
                      <td colSpan="2" className="py-6 text-center text-muted-foreground">
                        No sales in selected range
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </details>
        </CardContent>
      </Card>

      {/* Due list + Drilldown */}
      <div className="grid gap-3 lg:grid-cols-2">
        {/* Top Due */}
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">Top Due Customers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-4">Customer</th>
                    <th className="py-2 text-right">Due</th>
                    <th className="py-2 text-right">Invoices</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.topDueCustomers || []).map((r) => (
                    <tr key={r.customer_id} className="border-b">
                      <td className="py-2 pr-4">{r.customer_name}</td>
                      <td className="py-2 text-right">₹ {r.due_total}</td>
                      <td className="py-2 text-right">{r.invoice_count}</td>
                    </tr>
                  ))}
                  {(data.topDueCustomers || []).length === 0 && (
                    <tr>
                      <td colSpan="3" className="py-6 text-center text-muted-foreground">
                        No outstanding dues ✅
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Drilldown */}
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">Customer Drill-down</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={custSearch}
                onChange={(e) => setCustSearch(e.target.value)}
                placeholder="Search customer..."
              />
              <Button
                variant="secondary"
                onClick={() => loadCustomers(custSearch)}
                disabled={custListLoading}
              >
                {custListLoading ? "..." : "Search"}
              </Button>
            </div>

            <div className="grid gap-1">
              <Label>Select Customer (All)</Label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={selectedCustomerId}
                onChange={async (e) => {
                  const id = e.target.value;
                  setSelectedCustomerId(id);
                  await loadCustomer(id);
                }}
              >
                <option value="">-- select --</option>
                {allCustomers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {selectedCustomerId && (
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedCustomerId("");
                  setCustData(null);
                  setLedgerData(null);
                }}
              >
                Clear
              </Button>
            )}

            {custLoading && <div className="text-sm text-muted-foreground">Loading customer...</div>}

            {!custLoading && selectedCustomerId && custData && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Card className="rounded-xl">
                    <CardContent className="p-4">
                      <div className="text-xs text-muted-foreground">Outstanding Due</div>
                      <div className="mt-1 text-xl font-semibold">₹ {custData.total_due}</div>
                    </CardContent>
                  </Card>
                  <Card className="rounded-xl">
                    <CardContent className="p-4">
                      <div className="text-xs text-muted-foreground">Open invoices</div>
                      <div className="mt-1 text-xl font-semibold">{custData.invoices_count}</div>
                    </CardContent>
                  </Card>
                </div>

                <div>
                  <div className="mb-2 text-sm font-medium">Customer Ledger</div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="py-2 pr-4">Date</th>
                          <th className="py-2 pr-4">Type</th>
                          <th className="py-2 pr-4">Invoice</th>
                          <th className="py-2 text-right">Debit</th>
                          <th className="py-2 text-right">Credit</th>
                          <th className="py-2 text-right">Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(ledgerData?.ledger || []).slice(-10).reverse().map((entry, idx) => (
                          <tr key={`${entry.type}-${entry.invoice_id}-${idx}`} className="border-b">
                            <td className="py-2 pr-4">{entry.entry_date}</td>
                            <td className="py-2 pr-4">{entry.type}</td>
                            <td className="py-2 pr-4">{entry.invoice_no || "—"}</td>
                            <td className="py-2 text-right">{entry.debit}</td>
                            <td className="py-2 text-right">{entry.credit}</td>
                            <td className="py-2 text-right font-medium">{entry.balance}</td>
                          </tr>
                        ))}
                        {(ledgerData?.ledger || []).length === 0 && (
                          <tr>
                            <td colSpan="6" className="py-6 text-center text-muted-foreground">
                              No ledger entries
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-sm font-medium">Recent invoices</div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="py-2 pr-4">Invoice</th>
                          <th className="py-2 pr-4">Date</th>
                          <th className="py-2 text-right">Total</th>
                          <th className="py-2 text-right">Due</th>
                          <th className="py-2">Open</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(custData.invoices || []).map((inv) => (
                          <tr key={inv.id} className="border-b">
                            <td className="py-2 pr-4">{inv.invoice_no || "—"}</td>
                            <td className="py-2 pr-4">{inv.invoice_date}</td>
                            <td className="py-2 text-right">{inv.grand_total}</td>
                            <td className="py-2 text-right">{inv.due_total}</td>
                            <td className="py-2">
                              <Link to={`/invoices/${inv.id}`}>
                                <Button size="sm" variant="secondary">
                                  View
                                </Button>
                              </Link>
                            </td>
                          </tr>
                        ))}
                        {(custData.invoices || []).length === 0 && (
                          <tr>
                            <td colSpan="5" className="py-6 text-center text-muted-foreground">
                              No invoices
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {!selectedCustomerId && (
              <div className="text-sm text-muted-foreground">
                Select a customer to see outstanding + last invoices.
              </div>
            )}

            <div className="text-xs text-muted-foreground">
              Tip: Profit depends on <b>items.cost_price</b>. If cost is 0, profit will be high.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
