import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { paymentPlansApi } from "../../api/paymentPlans.api";
import { customersApi } from "../../api/customers.api";
import { itemsApi } from "../../api/items.api";
import { money } from "./planUtils";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2 } from "lucide-react";

const TEMPLATES = [
  { label: "30 / 40 / 30", split: [["Advance", 30], ["Mid milestone", 40], ["On completion", 30]] },
  { label: "50 / 50", split: [["Advance", 50], ["On completion", 50]] },
  { label: "40 / 30 / 30", split: [["Advance", 40], ["Development", 30], ["Go-live", 30]] },
  { label: "25 × 4", split: [["Advance", 25], ["Design", 25], ["Development", 25], ["Go-live", 25]] },
  { label: "100% advance", split: [["Full payment", 100]] },
];

const emptyRow = () => ({ id: null, title: "", percent: "", amount: "", due_date: "", locked: false });

export default function PaymentPlanForm() {
  const { id } = useParams(); // present = edit
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [items, setItems] = useState([]);
  const [anyInvoiced, setAnyInvoiced] = useState(false);

  const [form, setForm] = useState({
    customer_id: "",
    title: "",
    description: "",
    item_id: "",
    total_amount: "",
    tax_percent: 18,
    split_mode: "PERCENT",
  });
  const [rows, setRows] = useState(TEMPLATES[0].split.map(([title, percent]) => ({ ...emptyRow(), title, percent })));

  useEffect(() => {
    (async () => {
      try {
        const [c, i] = await Promise.all([customersApi.list(), itemsApi.list()]);
        setCustomers(c.data || []);
        setItems((i.data || []).filter((x) => x.type === "SERVICE"));
        if (id) {
          const res = await paymentPlansApi.get(id);
          const { plan, milestones } = res.data;
          setForm({
            customer_id: plan.customer_id,
            title: plan.title,
            description: plan.description || "",
            item_id: plan.item_id || "",
            total_amount: Number(plan.total_amount),
            tax_percent: Number(plan.tax_percent),
            // edit with the stored amounts so re-saving never shifts an installment by rounding
            split_mode: "AMOUNT",
          });
          setRows(
            milestones.map((m) => ({
              id: m.id,
              title: m.title,
              percent: m.percent !== null ? Number(m.percent) : "",
              amount: Number(m.amount),
              due_date: m.due_date ? String(m.due_date).slice(0, 10) : "",
              locked: Boolean(m.invoice_id && m.inv_status !== "CANCELLED"),
            }))
          );
          setAnyInvoiced(milestones.some((m) => m.invoice_id && m.inv_status !== "CANCELLED"));
        }
      } catch (e) {
        alert(e?.response?.data?.error || e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const setRow = (idx, k, v) => setRows((p) => p.map((r, i) => (i === idx ? { ...r, [k]: v } : r)));

  const applyTemplate = (t) => {
    setForm((p) => ({ ...p, split_mode: "PERCENT" }));
    setRows(t.split.map(([title, percent]) => ({ ...emptyRow(), title, percent })));
  };

  const total = Number(form.total_amount || 0);
  const preview = useMemo(() => {
    if (form.split_mode === "PERCENT") {
      let used = 0;
      const amounts = rows.map((r, i) => {
        const a = i === rows.length - 1 ? total - used : Math.round(total * Number(r.percent || 0)) / 100;
        used += a;
        return Math.round(a * 100) / 100;
      });
      const sumPct = rows.reduce((s, r) => s + Number(r.percent || 0), 0);
      return { amounts, ok: Math.abs(sumPct - 100) < 0.01, msg: `Total ${Math.round(sumPct * 100) / 100}% (100% hona chahiye)` };
    }
    const sum = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
    return { amounts: rows.map((r) => Number(r.amount || 0)), ok: Math.abs(sum - total) < 0.01, msg: `Total ${money(sum)} (${money(total)} hona chahiye)` };
  }, [rows, form.split_mode, total]);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.customer_id) return alert("Customer chunein");
    if (!(total > 0)) return alert("Total amount dalein");
    if (!preview.ok) return alert(preview.msg);
    setSaving(true);
    try {
      const payload = {
        ...form,
        customer_id: Number(form.customer_id),
        item_id: form.item_id ? Number(form.item_id) : null,
        total_amount: total,
        tax_percent: Number(form.tax_percent),
        milestones: rows.map((r) => ({
          id: r.id || null,
          title: r.title,
          percent: form.split_mode === "PERCENT" ? Number(r.percent || 0) : null,
          amount: form.split_mode === "AMOUNT" ? Number(r.amount || 0) : null,
          due_date: r.due_date || null,
        })),
      };
      const res = id ? await paymentPlansApi.update(id, payload) : await paymentPlansApi.create(payload);
      nav(`/payment-plans/${res.data.id}`);
    } catch (err) {
      alert(err?.response?.data?.error || err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-sm text-muted-foreground">Loading...</div>;

  const tax = Math.round(total * Number(form.tax_percent || 0)) / 100;

  return (
    <form onSubmit={submit} className="w-full max-w-[1100px] mx-auto space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{id ? "Edit Payment Plan" : "New Payment Plan"}</h2>
          {anyInvoiced && (
            <div className="text-sm text-amber-700">
              Kuch milestones ka invoice ban chuka hai: ab sirf naam aur due dates badal sakte hain.
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Link to={id ? `/payment-plans/${id}` : "/payment-plans"}>
            <Button type="button" variant="outline">Cancel</Button>
          </Link>
          <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save Plan"}</Button>
        </div>
      </div>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Project</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label>Customer *</Label>
            <select
              value={form.customer_id}
              disabled={anyInvoiced}
              onChange={(e) => set("customer_id", e.target.value)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="">-- select --</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label>Project name *</Label>
            <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. E-commerce website + app" />
          </div>
          <div className="grid gap-2">
            <Label>Project value (GST ke bina) *</Label>
            <Input type="number" min={0} value={form.total_amount} disabled={anyInvoiced} onChange={(e) => set("total_amount", e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>GST %</Label>
            <Input type="number" min={0} max={100} value={form.tax_percent} disabled={anyInvoiced} onChange={(e) => set("tax_percent", e.target.value)} />
            <div className="text-xs text-muted-foreground">
              GST {money(tax)} • Total payable <b>{money(total + tax)}</b>
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Invoice item (HSN/SAC ke liye)</Label>
            <select
              value={form.item_id}
              onChange={(e) => set("item_id", e.target.value)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="">Auto ("Project Milestone")</option>
              {items.map((it) => (
                <option key={it.id} value={it.id}>{it.name}{it.hsn_sac ? ` (${it.hsn_sac})` : ""}</option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label>Description</Label>
            <Input value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Optional" />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <CardTitle className="text-base">Installments</CardTitle>
          {!anyInvoiced && (
            <div className="flex flex-wrap gap-2">
              {TEMPLATES.map((t) => (
                <Button key={t.label} type="button" size="sm" variant="outline" onClick={() => applyTemplate(t)}>
                  {t.label}
                </Button>
              ))}
              <select
                value={form.split_mode}
                onChange={(e) => set("split_mode", e.target.value)}
                className="h-9 rounded-md border bg-background px-2 text-sm"
              >
                <option value="PERCENT">% se</option>
                <option value="AMOUNT">Amount se</option>
              </select>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {rows.map((r, idx) => (
            <div key={r.id || `new-${idx}`} className="grid gap-2 rounded-xl border p-3 md:grid-cols-12 md:items-end">
              <div className="md:col-span-1 text-sm font-medium">#{idx + 1}</div>
              <div className="grid gap-1 md:col-span-4">
                <Label className="text-xs">Milestone</Label>
                <Input value={r.title} onChange={(e) => setRow(idx, "title", e.target.value)} placeholder="e.g. Design approval" />
              </div>
              <div className="grid gap-1 md:col-span-2">
                <Label className="text-xs">{form.split_mode === "PERCENT" ? "%" : "Amount"}</Label>
                {form.split_mode === "PERCENT" ? (
                  <Input type="number" min={0} max={100} step="0.01" value={r.percent} disabled={anyInvoiced} onChange={(e) => setRow(idx, "percent", e.target.value)} />
                ) : (
                  <Input type="number" min={0} value={r.amount} disabled={anyInvoiced} onChange={(e) => setRow(idx, "amount", e.target.value)} />
                )}
              </div>
              <div className="md:col-span-2 text-sm">
                <div className="text-xs text-muted-foreground">Amount + GST</div>
                <div className="font-medium">
                  {money((preview.amounts[idx] || 0) * (1 + Number(form.tax_percent || 0) / 100))}
                </div>
              </div>
              <div className="grid gap-1 md:col-span-2">
                <Label className="text-xs">Due date (khali = on completion)</Label>
                <Input type="date" value={r.due_date} disabled={r.locked} onChange={(e) => setRow(idx, "due_date", e.target.value)} />
              </div>
              <div className="md:col-span-1 flex md:justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={anyInvoiced || rows.length === 1}
                  onClick={() => setRows((p) => p.filter((_, i) => i !== idx))}
                  title="Remove"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}

          <div className="flex flex-wrap items-center gap-3">
            {!anyInvoiced && (
              <Button type="button" variant="secondary" size="sm" onClick={() => setRows((p) => [...p, emptyRow()])}>
                + Add installment
              </Button>
            )}
            <span className={`text-sm ${preview.ok ? "text-emerald-700" : "text-red-600"}`}>
              {preview.ok ? "✓ Total sahi hai" : preview.msg}
            </span>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
