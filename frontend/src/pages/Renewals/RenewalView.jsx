import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { renewalsApi } from "@/api/renewals.api";

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

function Money({ value }) {
  const n = Number(value || 0);
  return <span>₹ {Number.isFinite(n) ? n : value}</span>;
}

function daysDiff(a, b) {
  const da = new Date(a + "T00:00:00");
  const db = new Date(b + "T00:00:00");
  return Math.round((db - da) / (1000 * 60 * 60 * 24));
}

function StatusBadge({ dueDate }) {
  const t = todayISO();
  const diff = daysDiff(t, dueDate);

  if (diff < 0)
    return (
      <Badge className="rounded-full bg-red-100 text-red-700 hover:bg-red-100">
        OVERDUE
      </Badge>
    );

  if (diff <= 7)
    return (
      <Badge className="rounded-full bg-amber-100 text-amber-700 hover:bg-amber-100">
        DUE SOON
      </Badge>
    );

  return (
    <Badge variant="secondary" className="rounded-full">
      UPCOMING
    </Badge>
  );
}

export default function RenewalView() {
  const { id } = useParams();
  const [row, setRow] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creatingInvoice, setCreatingInvoice] = useState(false);

  const [payForm, setPayForm] = useState({
    paid_date: todayISO(),
    amount: "",
    mode: "UPI",
    reference_no: "",
    notes: "",
  });

  const load = async () => {
    setLoading(true);
    try {
      const r = await renewalsApi.get(id);
      setRow(r?.data || null);

      const p = await renewalsApi.payments(id);
      setPayments(p?.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, [id]);

  const onPayChange = (e) =>
    setPayForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const addPayment = async (e) => {
    e.preventDefault();
    if (!payForm.amount) return alert("Enter amount");

    try {
      await renewalsApi.addPayment(id, {
        paid_date: payForm.paid_date,
        amount: Number(payForm.amount),
        mode: payForm.mode,
        reference_no: payForm.reference_no || null,
        notes: payForm.notes || null,
      });

      setPayForm({
        paid_date: todayISO(),
        amount: "",
        mode: "UPI",
        reference_no: "",
        notes: "",
      });

      await load();
      alert("Payment added ✅ (Next due date updated)");
    } catch (err) {
      alert(err?.response?.data?.error || err.message);
    }
  };

  const createInvoice = async () => {
    if (!row?.customer_id) return alert("Customer missing in renewal");
    if (!confirm("Create invoice from this renewal?")) return;
    setCreatingInvoice(true);
    try {
      const res = await renewalsApi.createInvoice(id, {
        invoice_date: todayISO(),
        due_date: row.next_due_date || null,
      });
      const invoiceId = res?.data?.invoiceId;
      await load();
      alert("Invoice created from renewal");
      if (invoiceId) window.location.href = `/invoices/${invoiceId}`;
    } catch (err) {
      alert(err?.response?.data?.error || err.message);
    } finally {
      setCreatingInvoice(false);
    }
  };

  const totalPaid = useMemo(
    () => payments.reduce((s, p) => s + Number(p.amount || 0), 0),
    [payments]
  );

  if (loading) return <div className="text-sm text-muted-foreground">Loading...</div>;
  if (!row) return <div className="text-sm text-muted-foreground">Not found</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-semibold tracking-tight">
              Renewal: {row.name} <span className="text-muted-foreground">#{row.id}</span>
            </h2>
            <StatusBadge dueDate={row.next_due_date} />
          </div>

          <div className="text-sm text-muted-foreground">
            Customer:{" "}
            <span className="font-medium text-foreground">
              {row.customer_name || "—"}
            </span>
            {" • "}
            Type:{" "}
            <span className="font-medium text-foreground">
              {row.service_type || "OTHER"}
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={createInvoice} disabled={creatingInvoice || !row.customer_id}>
            {creatingInvoice ? "Creating..." : "Create Invoice"}
          </Button>
          <Link to="/renewals">
            <Button variant="outline">Back</Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <div className="text-sm text-muted-foreground">Amount</div>
            <div className="mt-1 text-2xl font-semibold">
              <Money value={row.amount} />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <div className="text-sm text-muted-foreground">Cycle</div>
            <div className="mt-1 text-2xl font-semibold">{row.cycle}</div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <div className="text-sm text-muted-foreground">Next Due Date</div>
            <div className="mt-1 text-2xl font-semibold">{row.next_due_date}</div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <div className="text-sm text-muted-foreground">Paid (history)</div>
            <div className="mt-1 text-2xl font-semibold text-emerald-700">
              ₹ {totalPaid}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Details */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 text-sm">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Service Ref</span>
                <span className="font-medium">{row.service_ref || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Provider</span>
                <span className="font-medium">{row.provider_name || row.vendor_name || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Start Date</span>
                <span className="font-medium">{row.start_date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Remind Before</span>
                <span className="font-medium">{row.remind_before_days} days</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Active</span>
                <span className="font-medium">{Number(row.is_active) === 1 ? "Yes" : "No"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Notes</span>
                <span className="font-medium">{row.notes || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last Paid Date</span>
                <span className="font-medium">{row.last_paid_date || "—"}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payments */}
      <div className="grid gap-3 lg:grid-cols-2">
        {/* Add payment */}
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">Add Payment</CardTitle>
          </CardHeader>

          <CardContent>
            <form onSubmit={addPayment} className="grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Paid Date</Label>
                  <Input
                    type="date"
                    name="paid_date"
                    value={payForm.paid_date}
                    onChange={onPayChange}
                  />
                </div>

                <div className="grid gap-2">
                  <Label>Amount</Label>
                  <Input
                    type="number"
                    name="amount"
                    value={payForm.amount}
                    onChange={onPayChange}
                    placeholder="e.g. 999"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Mode</Label>
                  <select
                    name="mode"
                    value={payForm.mode}
                    onChange={onPayChange}
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  >
                    <option value="CASH">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="BANK">Bank</option>
                    <option value="CARD">Card</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div className="grid gap-2">
                  <Label>Reference No</Label>
                  <Input
                    name="reference_no"
                    value={payForm.reference_no}
                    onChange={onPayChange}
                    placeholder="UTR/Txn"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Notes</Label>
                <Input
                  name="notes"
                  value={payForm.notes}
                  onChange={onPayChange}
                  placeholder="Optional"
                />
              </div>

              <Button type="submit">Add Payment</Button>

              <div className="text-xs text-muted-foreground">
                On payment, next due date will auto move to next cycle.
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Payments list */}
        <Card className="rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Payments</CardTitle>
            <Badge variant="secondary" className="rounded-full">
              {payments.length}
            </Badge>
          </CardHeader>

          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-3 pr-4">ID</th>
                    <th className="py-3 pr-4">Date</th>
                    <th className="py-3 pr-4 text-right">Amount</th>
                    <th className="py-3 pr-4">Mode</th>
                    <th className="py-3 pr-4">Ref</th>
                    <th className="py-3 pr-4">Notes</th>
                  </tr>
                </thead>

                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b hover:bg-muted/40">
                      <td className="py-3 pr-4">{p.id}</td>
                      <td className="py-3 pr-4">{p.paid_date}</td>
                      <td className="py-3 pr-4 text-right">{p.amount}</td>
                      <td className="py-3 pr-4">{p.mode || "—"}</td>
                      <td className="py-3 pr-4">{p.reference_no || "—"}</td>
                      <td className="py-3 pr-4">{p.notes || "—"}</td>
                    </tr>
                  ))}

                  {payments.length === 0 && (
                    <tr>
                      <td colSpan="6" className="py-10 text-center text-muted-foreground">
                        No payments yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <Separator className="my-4" />
            <div className="text-xs text-muted-foreground">
              Total paid: ₹ {totalPaid}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
