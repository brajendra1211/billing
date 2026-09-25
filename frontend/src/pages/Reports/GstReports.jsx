import { useEffect, useState } from "react";
import { reportsApi } from "../../api/reports.api";
import { API_BASE_URL } from "../../api/axios";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function money(n) {
  return `₹ ${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function iso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function defaultMonth() {
  // GSTR-1 is usually filed for the previous month
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return iso(d).slice(0, 7);
}

function fyStart() {
  const d = new Date();
  const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `${y}-04-01`;
}

async function downloadFile(url, filename) {
  const token = localStorage.getItem("token");
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error || `Download failed (${res.status})`);
  }
  const blobUrl = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
}

function Stat({ label, value, sub }) {
  return (
    <div className="rounded-xl border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-semibold">{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

export default function GstReports() {
  const [month, setMonth] = useState(defaultMonth());
  const [gstr, setGstr] = useState(null);
  const [gLoading, setGLoading] = useState(false);

  const [range, setRange] = useState({ from: fyStart(), to: iso(new Date()) });
  const [pnl, setPnl] = useState(null);
  const [pLoading, setPLoading] = useState(false);

  const loadGstr = async () => {
    setGLoading(true);
    try {
      const res = await reportsApi.gstr1({ month });
      setGstr(res.data);
    } catch (e) {
      alert(e?.response?.data?.error || e.message);
    } finally {
      setGLoading(false);
    }
  };

  const loadPnl = async () => {
    setPLoading(true);
    try {
      const res = await reportsApi.pnl(range);
      setPnl(res.data);
    } catch (e) {
      alert(e?.response?.data?.error || e.message);
    } finally {
      setPLoading(false);
    }
  };

  useEffect(() => {
    loadGstr();
    loadPnl();
    // eslint-disable-next-line
  }, []);

  const s = gstr?.summary;

  return (
    <div className="w-full max-w-[1200px] mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">GST & Profit / Loss</h2>
        <div className="text-sm text-muted-foreground">GSTR-1 ka data CA ke liye Excel mein, aur mahine-wise munafa.</div>
      </div>

      {/* GSTR-1 */}
      <Card className="rounded-2xl">
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <CardTitle className="text-base">GSTR-1</CardTitle>
          <div className="flex flex-wrap items-end gap-2">
            <div className="grid gap-1">
              <Label className="text-xs">Month</Label>
              <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-44" />
            </div>
            <Button variant="outline" onClick={loadGstr} disabled={gLoading}>
              {gLoading ? "Loading..." : "Show"}
            </Button>
            <Button
              onClick={() =>
                downloadFile(`${API_BASE_URL}/api/reports/gstr1.xlsx?month=${month}`, `GSTR1_${month}.xlsx`).catch((e) =>
                  alert(e.message)
                )
              }
            >
              Download Excel
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!gstr ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : (
            <>
              <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
                <Stat label="Invoices (FINAL)" value={s.invoices} sub={`${s.credit_notes} credit note(s)`} />
                <Stat label="B2B taxable" value={money(s.b2b_taxable)} sub={`${gstr.b2b.length} row(s)`} />
                <Stat label="B2C taxable" value={money(s.b2cs_taxable + s.b2cl_taxable)} sub={`B2CL ${money(s.b2cl_taxable)}`} />
                <Stat label="Credit notes taxable" value={money(s.cdnr_taxable + s.cdnur_taxable)} sub="CDNR + CDNUR" />
                <Stat label="IGST (net)" value={money(s.igst)} />
                <Stat label="CGST (net)" value={money(s.cgst)} />
                <Stat label="SGST (net)" value={money(s.sgst)} />
                <Stat label="Total tax" value={money(s.igst + s.cgst + s.sgst)} />
              </div>

              {gstr.warnings.length > 0 ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 space-y-1">
                  <div className="font-medium">Filing se pehle check karein:</div>
                  <ul className="list-disc pl-5 space-y-1">
                    {gstr.warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                  Koi problem nahi mili.
                </div>
              )}

              <div className="text-xs text-muted-foreground">
                Excel mein sheets GST offline tool ke format mein hain: b2b, b2cl, b2cs, cdnr, cdnur, hsn(b2b), hsn(b2c), docs.
                Sirf FINAL invoices shaamil hain. File karne se pehle CA se verify karwa lein.
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* P&L */}
      <Card className="rounded-2xl">
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <CardTitle className="text-base">Profit & Loss</CardTitle>
          <div className="flex flex-wrap items-end gap-2">
            <div className="grid gap-1">
              <Label className="text-xs">From</Label>
              <Input type="date" value={range.from} onChange={(e) => setRange((p) => ({ ...p, from: e.target.value }))} />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">To</Label>
              <Input type="date" value={range.to} onChange={(e) => setRange((p) => ({ ...p, to: e.target.value }))} />
            </div>
            <Button variant="outline" onClick={loadPnl} disabled={pLoading}>
              {pLoading ? "Loading..." : "Show"}
            </Button>
            <Button
              onClick={() =>
                downloadFile(
                  `${API_BASE_URL}/api/reports/pnl.xlsx?from=${range.from}&to=${range.to}`,
                  `PnL_${range.from}_${range.to}.xlsx`
                ).catch((e) => alert(e.message))
              }
            >
              Download Excel
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!pnl ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : (
            <>
              <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
                <Stat label="Income" value={money(pnl.totals.income)} sub="Sales − credit notes (GST ke bina)" />
                <Stat label="Costs" value={money(pnl.totals.total_costs)} sub="Expenses + vendor bills + renewals" />
                <Stat
                  label="Net profit"
                  value={<span className={pnl.totals.net_profit < 0 ? "text-red-600" : "text-emerald-700"}>{money(pnl.totals.net_profit)}</span>}
                />
                <Stat
                  label="Margin"
                  value={pnl.totals.income > 0 ? `${((pnl.totals.net_profit / pnl.totals.income) * 100).toFixed(1)}%` : "—"}
                />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2 pr-3">Month</th>
                      <th className="py-2 pr-3 text-right">Income</th>
                      <th className="py-2 pr-3 text-right">Expenses</th>
                      <th className="py-2 pr-3 text-right">Vendor bills</th>
                      <th className="py-2 pr-3 text-right">Renewals</th>
                      <th className="py-2 text-right">Net profit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pnl.months.map((m) => (
                      <tr key={m.month} className="border-b">
                        <td className="py-2 pr-3">{m.month}</td>
                        <td className="py-2 pr-3 text-right">{money(m.income)}</td>
                        <td className="py-2 pr-3 text-right">{money(m.expenses)}</td>
                        <td className="py-2 pr-3 text-right">{money(m.vendor_bills)}</td>
                        <td className="py-2 pr-3 text-right">{money(m.renewal_costs)}</td>
                        <td className={`py-2 text-right font-medium ${m.net_profit < 0 ? "text-red-600" : ""}`}>{money(m.net_profit)}</td>
                      </tr>
                    ))}
                    {pnl.months.length === 0 && (
                      <tr>
                        <td colSpan="6" className="py-6 text-center text-muted-foreground">Is range mein koi data nahi</td>
                      </tr>
                    )}
                  </tbody>
                  {pnl.months.length > 0 && (
                    <tfoot>
                      <tr className="font-semibold">
                        <td className="py-2 pr-3">Total</td>
                        <td className="py-2 pr-3 text-right">{money(pnl.totals.income)}</td>
                        <td className="py-2 pr-3 text-right">{money(pnl.totals.expenses)}</td>
                        <td className="py-2 pr-3 text-right">{money(pnl.totals.vendor_bills)}</td>
                        <td className="py-2 pr-3 text-right">{money(pnl.totals.renewal_costs)}</td>
                        <td className="py-2 text-right">{money(pnl.totals.net_profit)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {pnl.expenses_by_category.length > 0 && (
                <div className="text-sm">
                  <div className="font-medium mb-1">Expenses by category</div>
                  <div className="flex flex-wrap gap-2">
                    {pnl.expenses_by_category.map((c) => (
                      <span key={c.category} className="rounded-full bg-muted px-3 py-1">
                        {c.category}: {money(c.amount)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="text-xs text-muted-foreground">{pnl.note}</div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
