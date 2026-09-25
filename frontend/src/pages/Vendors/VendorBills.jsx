import { useEffect, useMemo, useState } from "react";
import { vendorsApi } from "../../api/vendors.api";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

function monthISO(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
}

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function Money({ value }) {
  const n = Number(value || 0);
  return <span>₹ {Number.isFinite(n) ? n.toLocaleString("en-IN") : value}</span>;
}

function StatusPill({ status }) {
  const s = String(status || "").toUpperCase();
  if (s === "PAID")
    return (
      <Badge className="rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
        PAID
      </Badge>
    );
  if (s === "FINAL")
    return (
      <Badge className="rounded-full bg-blue-100 text-blue-700 hover:bg-blue-100">
        FINAL
      </Badge>
    );
  return (
    <Badge variant="secondary" className="rounded-full">
      {s || "—"}
    </Badge>
  );
}

export default function VendorBills() {
  const [vendors, setVendors] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const [gen, setGen] = useState({
    vendor_id: "",
    bill_month: monthISO(),
    from_date: "",
    to_date: "",
  });

  const [pay, setPay] = useState({
    bill_id: "",
    paid_date: todayISO(),
    amount: "",
    mode: "UPI",
    reference_no: "",
    notes: "",
  });

  const totals = useMemo(() => {
    const subtotal = rows.reduce((s, r) => s + Number(r.subtotal || 0), 0);
    const paid = rows.reduce((s, r) => s + Number(r.paid_total || 0), 0);
    const due = rows.reduce((s, r) => s + Number(r.due_total || 0), 0);
    return { subtotal, paid, due };
  }, [rows]);

  const load = async () => {
    setLoading(true);
    try {
      const v = await vendorsApi.list();
      setVendors(v?.data || []);

      const b = await vendorsApi.billsList({});
      setRows(b?.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const generate = async (e) => {
    e.preventDefault();
    if (!gen.vendor_id) return alert("Select vendor");
    if (!gen.bill_month) return alert("Month required");
    if (!gen.from_date || !gen.to_date) return alert("From/To required");

    try {
      await vendorsApi.billGenerate({
        vendor_id: Number(gen.vendor_id),
        bill_month: gen.bill_month,
        from_date: gen.from_date,
        to_date: gen.to_date,
      });
      await load();
      alert("Bill generated ✅");
    } catch (err) {
      alert(err?.response?.data?.error || err.message);
    }
  };

  const payBill = async (e) => {
    e.preventDefault();
    if (!pay.bill_id) return alert("Select bill");
    if (!pay.amount) return alert("Amount required");

    try {
      await vendorsApi.billPay(pay.bill_id, {
        paid_date: pay.paid_date,
        amount: Number(pay.amount),
        mode: pay.mode,
        reference_no: pay.reference_no || null,
        notes: pay.notes || null,
      });

      setPay({
        bill_id: "",
        paid_date: todayISO(),
        amount: "",
        mode: "UPI",
        reference_no: "",
        notes: "",
      });

      await load();
      alert("Payment added ✅");
    } catch (err) {
      alert(err?.response?.data?.error || err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">Vendor Bills</h2>
          <div className="text-sm text-muted-foreground">
            Generate monthly bill from daily consumption + add payments
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="rounded-full">
            Total Due: <span className="ml-1 font-medium"><Money value={totals.due} /></span>
          </Badge>
          <Button variant="outline" onClick={load} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </div>

      {/* KPI mini cards */}
      <div className="grid gap-3 md:grid-cols-3">
        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <div className="text-sm text-muted-foreground">Subtotal</div>
            <div className="mt-1 text-2xl font-semibold">
              <Money value={totals.subtotal} />
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <div className="text-sm text-muted-foreground">Paid</div>
            <div className="mt-1 text-2xl font-semibold text-emerald-700">
              <Money value={totals.paid} />
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <div className="text-sm text-muted-foreground">Due</div>
            <div className="mt-1 text-2xl font-semibold text-rose-700">
              <Money value={totals.due} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Generate Bill */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Generate Bill</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={generate} className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="grid gap-2 md:col-span-2">
                <Label>Vendor</Label>
                <select
                  value={gen.vendor_id}
                  onChange={(e) => setGen((p) => ({ ...p, vendor_id: e.target.value }))}
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                >
                  <option value="">Select vendor</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-2">
                <Label>Bill Month (YYYY-MM)</Label>
                <Input
                  value={gen.bill_month}
                  onChange={(e) => setGen((p) => ({ ...p, bill_month: e.target.value }))}
                  placeholder="YYYY-MM"
                />
              </div>

              <div className="grid gap-2">
                <Label>From Date</Label>
                <Input
                  type="date"
                  value={gen.from_date}
                  onChange={(e) => setGen((p) => ({ ...p, from_date: e.target.value }))}
                />
              </div>

              <div className="grid gap-2">
                <Label>To Date</Label>
                <Input
                  type="date"
                  value={gen.to_date}
                  onChange={(e) => setGen((p) => ({ ...p, to_date: e.target.value }))}
                />
              </div>
            </div>

            <Button type="submit" disabled={loading}>
              Generate Bill
            </Button>

            <div className="text-xs text-muted-foreground">
              Tip: Date range consumption se subtotal auto calculate hoga.
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Add Payment */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Add Bill Payment</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={payBill} className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="grid gap-2 md:col-span-2">
                <Label>Select Bill</Label>
                <select
                  value={pay.bill_id}
                  onChange={(e) => setPay((p) => ({ ...p, bill_id: e.target.value }))}
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                >
                  <option value="">Select bill</option>
                  {rows.map((b) => (
                    <option key={b.id} value={b.id}>
                      #{b.id} • {b.vendor_name} • {b.bill_month} • Due: {b.due_total}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-2">
                <Label>Paid Date</Label>
                <Input
                  type="date"
                  value={pay.paid_date}
                  onChange={(e) => setPay((p) => ({ ...p, paid_date: e.target.value }))}
                />
              </div>

              <div className="grid gap-2">
                <Label>Amount</Label>
                <Input
                  type="number"
                  value={pay.amount}
                  onChange={(e) => setPay((p) => ({ ...p, amount: e.target.value }))}
                  placeholder="amount"
                />
              </div>

              <div className="grid gap-2">
                <Label>Mode</Label>
                <select
                  value={pay.mode}
                  onChange={(e) => setPay((p) => ({ ...p, mode: e.target.value }))}
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                >
                  <option value="CASH">CASH</option>
                  <option value="UPI">UPI</option>
                  <option value="BANK">BANK</option>
                  <option value="CARD">CARD</option>
                  <option value="OTHER">OTHER</option>
                </select>
              </div>

              <div className="grid gap-2 md:col-span-2">
                <Label>Reference No</Label>
                <Input
                  value={pay.reference_no}
                  onChange={(e) => setPay((p) => ({ ...p, reference_no: e.target.value }))}
                  placeholder="UTR/Txn"
                />
              </div>

              <div className="grid gap-2 md:col-span-2">
                <Label>Notes</Label>
                <Input
                  value={pay.notes}
                  onChange={(e) => setPay((p) => ({ ...p, notes: e.target.value }))}
                  placeholder="Optional"
                />
              </div>
            </div>

            <Button type="submit">Add Payment</Button>
          </form>
        </CardContent>
      </Card>

      {/* Bills List */}
      <Card className="rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Bills List</CardTitle>
          <Badge variant="secondary" className="rounded-full">
            {rows.length}
          </Badge>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-3 pr-4">ID</th>
                    <th className="py-3 pr-4">Vendor</th>
                    <th className="py-3 pr-4">Month</th>
                    <th className="py-3 pr-4 text-right">Subtotal</th>
                    <th className="py-3 pr-4 text-right">Paid</th>
                    <th className="py-3 pr-4 text-right">Due</th>
                    <th className="py-3 pr-4">Status</th>
                  </tr>
                </thead>

                <tbody>
                  {rows.map((b) => (
                    <tr key={b.id} className="border-b hover:bg-muted/40">
                      <td className="py-3 pr-4 font-medium">#{b.id}</td>
                      <td className="py-3 pr-4">{b.vendor_name}</td>
                      <td className="py-3 pr-4">{b.bill_month}</td>
                      <td className="py-3 pr-4 text-right">
                        <Money value={b.subtotal} />
                      </td>
                      <td className="py-3 pr-4 text-right text-emerald-700 font-medium">
                        <Money value={b.paid_total} />
                      </td>
                      <td className="py-3 pr-4 text-right text-rose-700 font-medium">
                        <Money value={b.due_total} />
                      </td>
                      <td className="py-3 pr-4">
                        <StatusPill status={b.status} />
                      </td>
                    </tr>
                  ))}

                  {rows.length === 0 && (
                    <tr>
                      <td colSpan="7" className="py-10 text-center text-muted-foreground">
                        No bills
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              <Separator className="my-4" />

              <div className="text-xs text-muted-foreground">
                Paid/ Due totals are calculated after payments.
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
