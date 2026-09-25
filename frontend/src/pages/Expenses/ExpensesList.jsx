import { useEffect, useMemo, useState } from "react";
import { expensesApi } from "../../api/expenses.api";

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
  return <span>₹ {Number.isFinite(n) ? n.toLocaleString("en-IN") : value}</span>;
}

export default function ExpensesList() {
  const [cats, setCats] = useState([]);
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState({
    from: "",
    to: "",
    category_id: "",
    search: "",
    page: 1,
    limit: 20,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    category_id: "",
    expense_date: todayISO(),
    amount: "",
    payment_mode: "CASH",
    vendor_name: "",
    reference_no: "",
    notes: "",
  });

  const totalShown = useMemo(
    () => rows.reduce((s, r) => s + Number(r.amount || 0), 0),
    [rows]
  );

  const load = async () => {
    setLoading(true);
    try {
      const catRes = await expensesApi.categoriesList();
      setCats(catRes?.data || []);

      const res = await expensesApi.list(q);
      setRows(res?.data?.rows || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, [q.page]);

  const onQ = (e) => setQ((p) => ({ ...p, [e.target.name]: e.target.value, page: 1 }));
  const onF = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const apply = async () => {
    setQ((p) => ({ ...p, page: 1 }));
    await load();
  };

  const addExpense = async (e) => {
    e.preventDefault();
    if (!form.category_id) return alert("Select category");
    if (!form.amount) return alert("Enter amount");

    setSaving(true);
    try {
      await expensesApi.create({
        category_id: Number(form.category_id),
        expense_date: form.expense_date,
        amount: Number(form.amount),
        payment_mode: form.payment_mode,
        vendor_name: form.vendor_name || null,
        reference_no: form.reference_no || null,
        notes: form.notes || null,
      });

      setForm((p) => ({ ...p, amount: "", vendor_name: "", reference_no: "", notes: "" }));
      await load();
      alert("Expense added ✅");
    } catch (err) {
      alert(err?.response?.data?.error || err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">Expenses</h2>
          <div className="text-sm text-muted-foreground">
            Daily expenses entry + filters (category/vendor/reference)
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="rounded-full">
            Showing: <span className="ml-1 font-medium">{rows.length}</span>
          </Badge>
          <Badge variant="secondary" className="rounded-full">
            Total: <span className="ml-1 font-medium"><Money value={totalShown} /></span>
          </Badge>

          <Button variant="outline" onClick={load} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-5">
          <div className="grid gap-2">
            <Label>From</Label>
            <Input type="date" name="from" value={q.from} onChange={onQ} />
          </div>

          <div className="grid gap-2">
            <Label>To</Label>
            <Input type="date" name="to" value={q.to} onChange={onQ} />
          </div>

          <div className="grid gap-2">
            <Label>Category</Label>
            <select
              name="category_id"
              value={q.category_id}
              onChange={onQ}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="">All</option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-2 md:col-span-2">
            <Label>Search</Label>
            <Input
              name="search"
              value={q.search}
              onChange={onQ}
              placeholder="vendor / notes / ref"
            />
          </div>

          <div className="md:col-span-5 flex items-center gap-2">
            <Button onClick={apply}>Apply</Button>
            <Button
              variant="outline"
              onClick={() => {
                setQ((p) => ({
                  ...p,
                  from: "",
                  to: "",
                  category_id: "",
                  search: "",
                  page: 1,
                }));
                setTimeout(load, 0);
              }}
            >
              Reset
            </Button>

            <div className="ml-auto flex items-center gap-2">
              <Button
                variant="outline"
                disabled={q.page <= 1 || loading}
                onClick={() => setQ((p) => ({ ...p, page: Math.max(1, Number(p.page) - 1) }))}
              >
                Prev
              </Button>
              <Badge variant="secondary" className="rounded-full">
                Page: <span className="ml-1 font-medium">{q.page}</span>
              </Badge>
              <Button
                variant="outline"
                disabled={loading || rows.length < Number(q.limit || 20)}
                onClick={() => setQ((p) => ({ ...p, page: Number(p.page) + 1 }))}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add Expense */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Add Expense</CardTitle>
        </CardHeader>

        <CardContent>
          <form onSubmit={addExpense} className="grid gap-5">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="grid gap-2">
                <Label>Category</Label>
                <select
                  name="category_id"
                  value={form.category_id}
                  onChange={onF}
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                >
                  <option value="">Select</option>
                  {cats.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-2">
                <Label>Date</Label>
                <Input type="date" name="expense_date" value={form.expense_date} onChange={onF} />
              </div>

              <div className="grid gap-2">
                <Label>Amount</Label>
                <Input type="number" name="amount" value={form.amount} onChange={onF} />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="grid gap-2">
                <Label>Mode</Label>
                <select
                  name="payment_mode"
                  value={form.payment_mode}
                  onChange={onF}
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                >
                  <option value="CASH">CASH</option>
                  <option value="UPI">UPI</option>
                  <option value="BANK">BANK</option>
                  <option value="CARD">CARD</option>
                  <option value="OTHER">OTHER</option>
                </select>
              </div>

              <div className="grid gap-2">
                <Label>Vendor</Label>
                <Input name="vendor_name" value={form.vendor_name} onChange={onF} />
              </div>

              <div className="grid gap-2">
                <Label>Reference</Label>
                <Input name="reference_no" value={form.reference_no} onChange={onF} />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Notes</Label>
              <Input name="notes" value={form.notes} onChange={onF} placeholder="Optional" />
            </div>

            <div className="flex items-center gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save Expense"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() =>
                  setForm((p) => ({ ...p, amount: "", vendor_name: "", reference_no: "", notes: "" }))
                }
              >
                Clear
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* List */}
      <Card className="rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Expenses List</CardTitle>
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
                    <th className="py-3 pr-4">Date</th>
                    <th className="py-3 pr-4">Category</th>
                    <th className="py-3 pr-4">Vendor</th>
                    <th className="py-3 pr-4">Mode</th>
                    <th className="py-3 pr-4 text-right">Amount</th>
                    <th className="py-3 pr-4">Ref</th>
                    <th className="py-3">Notes</th>
                  </tr>
                </thead>

                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b hover:bg-muted/40">
                      <td className="py-3 pr-4 font-medium">#{r.id}</td>
                      <td className="py-3 pr-4">{r.expense_date}</td>
                      <td className="py-3 pr-4">{r.category_name || r.category_id}</td>
                      <td className="py-3 pr-4">{r.vendor_name || "—"}</td>
                      <td className="py-3 pr-4">{r.payment_mode}</td>
                      <td className="py-3 pr-4 text-right font-medium">
                        <Money value={r.amount} />
                      </td>
                      <td className="py-3 pr-4">{r.reference_no || "—"}</td>
                      <td className="py-3">{r.notes || "—"}</td>
                    </tr>
                  ))}

                  {rows.length === 0 && (
                    <tr>
                      <td colSpan="8" className="py-10 text-center text-muted-foreground">
                        No expenses
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              <Separator className="my-4" />
              <div className="text-xs text-muted-foreground">
                Tip: Filters Apply karke month-wise expense tracking easy ho jayega.
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
