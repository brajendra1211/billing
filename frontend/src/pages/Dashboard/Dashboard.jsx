import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  FileText,
  IndianRupee,
  RefreshCw,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { reportsApi } from "../../api/reports.api";
import { renewalsApi } from "../../api/renewals.api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

function iso(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addDays(d, days) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function money(n) {
  const num = Number(n || 0);
  return `Rs. ${num.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function shortDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

function StatCard({ title, value, hint, icon, tone = "default" }) {
  const IconComponent = icon;
  const tones = {
    default: "bg-slate-50 text-slate-700",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
  };

  return (
    <Card className="rounded-lg">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm text-muted-foreground">{title}</div>
            <div className="mt-1 truncate text-2xl font-semibold">{value}</div>
            {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
          </div>
          <div className={`rounded-md p-2 ${tones[tone] || tones.default}`}>
            <IconComponent className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const today = useMemo(() => new Date(), []);
  const [data, setData] = useState(null);
  const [alerts, setAlerts] = useState({ due_soon: 0, overdue: 0 });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [range, setRange] = useState("TODAY");
  const [from, setFrom] = useState(iso(today));
  const [to, setTo] = useState(iso(today));

  useEffect(() => {
    const t = new Date();
    if (range === "TODAY") {
      setFrom(iso(t));
      setTo(iso(t));
    } else if (range === "7D") {
      setFrom(iso(addDays(t, -6)));
      setTo(iso(t));
    } else if (range === "MONTH") {
      setFrom(iso(startOfMonth(t)));
      setTo(iso(t));
    }
  }, [range]);

  const load = async (opts) => {
    setLoading(true);
    setErr("");
    try {
      const f = opts?.from ?? from;
      const t = opts?.to ?? to;

      const [dashRes, alertRes] = await Promise.all([
        reportsApi.dashboard({ from: f, to: t }),
        renewalsApi.alerts(),
      ]);

      setData(dashRes.data);
      setAlerts(alertRes?.data || { due_soon: 0, overdue: 0 });
    } catch (e) {
      setErr(e?.response?.data?.error || e?.response?.data?.message || "Failed to load dashboard");
      setData(null);
      setAlerts({ due_soon: 0, overdue: 0 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load({ from: iso(new Date()), to: iso(new Date()) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const s = data?.summary || {};
  const profit = data?.profit || {};
  const daily = (data?.daily || []).map((row) => ({
    ...row,
    label: shortDate(row.day),
    sales: Number(row.sales || 0),
  }));
  const topDueCustomers = data?.topDueCustomers || [];
  const dueAging = data?.dueAging || {};

  const salesTotal = Number(s.sales_total || 0);
  const paymentsReceived = Number(s.payments_received || 0);
  const dueTotal = Number(s.due_total || 0);
  const collectionRate = salesTotal > 0 ? Math.round((paymentsReceived / salesTotal) * 100) : 0;
  const taxTotal = Number(s.cgst_total || 0) + Number(s.sgst_total || 0) + Number(s.igst_total || 0);

  if (loading) return <div className="text-sm text-muted-foreground">Loading...</div>;
  if (err) return <div className="text-sm text-red-600">{err}</div>;
  if (!data) return <div className="text-sm text-muted-foreground">No data</div>;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Dashboard</h2>
          <div className="text-sm text-muted-foreground">
            {from} to {to}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/invoices/create">
              <FileText className="h-4 w-4" />
              New Invoice
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/reports">Reports</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/renewals">Renewals</Link>
          </Button>
        </div>
      </div>

      <Card className="rounded-lg">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="grid gap-1">
              <span className="text-xs font-medium text-muted-foreground">Range</span>
              <select
                value={range}
                onChange={(e) => setRange(e.target.value)}
                className="h-9 rounded-md border bg-background px-3 text-sm"
              >
                <option value="TODAY">Today</option>
                <option value="7D">Last 7 Days</option>
                <option value="MONTH">This Month</option>
                <option value="CUSTOM">Custom</option>
              </select>
            </div>

            <div className="grid gap-1">
              <span className="text-xs font-medium text-muted-foreground">From</span>
              <input
                type="date"
                value={from}
                disabled={range !== "CUSTOM"}
                onChange={(e) => setFrom(e.target.value)}
                className="h-9 rounded-md border bg-background px-3 text-sm disabled:opacity-60"
              />
            </div>

            <div className="grid gap-1">
              <span className="text-xs font-medium text-muted-foreground">To</span>
              <input
                type="date"
                value={to}
                disabled={range !== "CUSTOM"}
                onChange={(e) => setTo(e.target.value)}
                className="h-9 rounded-md border bg-background px-3 text-sm disabled:opacity-60"
              />
            </div>

            <Button onClick={() => load()} variant="secondary" className="ml-auto">
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Sales" value={money(s.sales_total)} hint={`${Number(s.invoices_final || 0)} final invoices`} icon={IndianRupee} tone="green" />
        <StatCard title="Received" value={money(s.payments_received)} hint={`${collectionRate}% of range sales`} icon={Wallet} tone="default" />
        <StatCard title="Outstanding" value={money(s.due_total)} hint={`All open dues. Draft ${money(s.draft_due_total)} | Final ${money(s.final_due_total)}`} icon={AlertTriangle} tone={dueTotal > 0 ? "red" : "green"} />
        <StatCard title="Gross Profit" value={money(profit.gross_profit)} hint={`Cost ${money(profit.total_cost)}`} icon={TrendingUp} tone="amber" />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <StatCard title="GST" value={money(taxTotal)} hint={`CGST ${money(s.cgst_total)} | SGST ${money(s.sgst_total)} | IGST ${money(s.igst_total)}`} icon={IndianRupee} />
        <StatCard title="Invoice Status" value={`D ${Number(s.invoices_draft || 0)} / F ${Number(s.invoices_final_all || 0)}`} hint={`Cancelled ${Number(s.invoices_cancelled || 0)}`} icon={FileText} />
        <StatCard title="Renewals" value={`${Number(alerts.due_soon || 0)} due soon`} hint={`${Number(alerts.overdue || 0)} overdue`} icon={CalendarDays} tone={alerts.overdue > 0 ? "red" : "amber"} />
      </div>

      <Card className="rounded-lg">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Due Aging</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 md:grid-cols-5">
            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">Not due</div>
              <div className="mt-1 font-semibold">{money(dueAging.not_due)}</div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">1-7 days</div>
              <div className="mt-1 font-semibold">{money(dueAging.d_1_7)}</div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">8-30 days</div>
              <div className="mt-1 font-semibold">{money(dueAging.d_8_30)}</div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">31-60 days</div>
              <div className="mt-1 font-semibold">{money(dueAging.d_31_60)}</div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">60+ days</div>
              <div className="mt-1 font-semibold text-red-600">{money(dueAging.d_60_plus)}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card className="rounded-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Daily Sales</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px] p-4 pt-0">
            {daily.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={daily} margin={{ left: 0, right: 12, top: 12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis tickLine={false} axisLine={false} fontSize={12} tickFormatter={(v) => `${Number(v) / 1000}k`} />
                  <Tooltip formatter={(value) => money(value)} labelFormatter={(label) => `Date: ${label}`} />
                  <Area type="monotone" dataKey="sales" stroke="#059669" fill="url(#salesFill)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No finalized sales in this range
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Top Due Customers</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="/reports">
                View
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {topDueCustomers.length ? (
              topDueCustomers.slice(0, 6).map((c) => (
                <div key={c.customer_id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{c.customer_name}</div>
                    <div className="text-xs text-muted-foreground">{c.invoice_count} invoice(s)</div>
                  </div>
                  <Badge variant="secondary" className="rounded-md">
                    {money(c.due_total)}
                  </Badge>
                </div>
              ))
            ) : (
              <div className="py-10 text-center text-sm text-muted-foreground">
                No due customers
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-lg">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary"><Link to="/customers">Customers</Link></Button>
            <Button asChild variant="secondary"><Link to="/items">Items</Link></Button>
            <Button asChild variant="secondary"><Link to="/invoices">Invoices</Link></Button>
            <Button asChild variant="secondary"><Link to="/renewals/create">Create Renewal</Link></Button>
            <Button asChild variant="outline"><Link to="/settings/company">Company Settings</Link></Button>
          </div>
          <Separator className="my-4" />
          <div className="flex flex-wrap gap-2">
            <Badge variant={alerts.overdue > 0 ? "destructive" : "secondary"} className="rounded-md">
              Overdue renewals: {Number(alerts.overdue || 0)}
            </Badge>
            <Badge variant="secondary" className="rounded-md">
              Due soon: {Number(alerts.due_soon || 0)}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
