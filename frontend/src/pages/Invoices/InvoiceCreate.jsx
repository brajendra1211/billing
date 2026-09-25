import { useEffect, useMemo, useState } from "react";
import { customersApi } from "../../api/customers.api";
import { itemsApi } from "../../api/items.api";
import { invoicesApi } from "../../api/invoices.api";
import { useNavigate, Link } from "react-router-dom";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

import { Plus, Trash2 } from "lucide-react";

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
function n2(x) {
  const v = Number(x || 0);
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

function billableUnits(row) {
  const months = row.is_period_billing ? Number(row.billing_months || 1) : 1;
  return n2(Number(row.qty || 0) * months);
}

export default function InvoiceCreate() {
  const nav = useNavigate();

  const [customers, setCustomers] = useState([]);
  const [itemsMaster, setItemsMaster] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const [customerId, setCustomerId] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(todayISO());
  const [isInterstate, setIsInterstate] = useState(0);
  const [placeOfSupplyState, setPlaceOfSupplyState] = useState("");

  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");

  const [rows, setRows] = useState([
    { item_id: "", qty: 1, billing_months: 1, is_period_billing: false, rate: 0, discount_percent: 0, tax_percent: 18, description: "" },
  ]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const c = await customersApi.list();
        const i = await itemsApi.list();
        setCustomers(c.data || []);
        setItemsMaster(i.data || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const itemById = useMemo(() => {
    const map = new Map();
    for (const it of itemsMaster) map.set(it.id, it);
    return map;
  }, [itemsMaster]);

  const addRow = () => {
    setRows((p) => [
      ...p,
      { item_id: "", qty: 1, billing_months: 1, is_period_billing: false, rate: 0, discount_percent: 0, tax_percent: 18, description: "" },
    ]);
  };
  const removeRow = (idx) => setRows((p) => p.filter((_, i) => i !== idx));
  const updateRow = (idx, key, val) =>
    setRows((p) => p.map((r, i) => (i === idx ? { ...r, [key]: val } : r)));

  const onSelectItem = (idx, itemId) => {
    const idNum = Number(itemId);
    const master = itemById.get(idNum);
    updateRow(idx, "item_id", idNum);

    if (master) {
      updateRow(idx, "rate", Number(master.sale_price || 0));
      updateRow(idx, "tax_percent", Number(master.tax_percent ?? 18));
      updateRow(idx, "description", master.name);
    }
  };

  const totals = useMemo(() => {
    let subtotal = 0, discount_total = 0, taxable_total = 0;
    let cgst_total = 0, sgst_total = 0, igst_total = 0;

    const line = rows.map((r) => {
      const qty = Number(r.qty || 0);
      const billingMonths = r.is_period_billing ? Number(r.billing_months || 1) : 1;
      const rate = Number(r.rate || 0);
      const discP = Number(r.discount_percent || 0);
      const taxP = Number(r.tax_percent || 0);

      const base = n2(qty * rate * billingMonths);
      const disc = n2((base * discP) / 100);
      const taxable = n2(base - disc);

      let cgst = 0, sgst = 0, igst = 0;
      if (Number(isInterstate) === 1) {
        igst = n2((taxable * taxP) / 100);
      } else {
        const half = taxP / 2;
        cgst = n2((taxable * half) / 100);
        sgst = n2((taxable * half) / 100);
      }

      const total = n2(taxable + cgst + sgst + igst);

      subtotal = n2(subtotal + base);
      discount_total = n2(discount_total + disc);
      taxable_total = n2(taxable_total + taxable);
      cgst_total = n2(cgst_total + cgst);
      sgst_total = n2(sgst_total + sgst);
      igst_total = n2(igst_total + igst);

      return { base, disc, taxable, cgst, sgst, igst, total };
    });

    const grand_total = n2(taxable_total + cgst_total + sgst_total + igst_total);
    return { line, subtotal, discount_total, taxable_total, cgst_total, sgst_total, igst_total, grand_total };
  }, [rows, isInterstate]);

  const submit = async (e) => {
    e?.preventDefault?.();

    if (!customerId) return alert("Select customer");
    const validRows = rows.filter((r) => r.item_id);
    if (validRows.length === 0) return alert("Add at least 1 item");

    for (const r of validRows) {
      if (Number(r.qty || 0) <= 0) return alert("Qty must be > 0");
      if (r.is_period_billing && Number(r.billing_months || 0) <= 0) return alert("Billing months must be > 0");
      if (Number(r.rate || 0) < 0) return alert("Rate cannot be negative");
    }

    const payload = {
      customer_id: Number(customerId),
      invoice_date: invoiceDate,
      place_of_supply_state: placeOfSupplyState || null,
      is_interstate: Number(isInterstate),
      notes: notes || null,
      terms: terms || null,
      items: validRows.map((r) => ({
        item_id: Number(r.item_id),
        qty: Number(r.qty || 1),
        billing_months: r.is_period_billing ? Number(r.billing_months || 1) : 1,
        rate: Number(r.rate || 0),
        discount_percent: Number(r.discount_percent || 0),
        tax_percent: Number(r.tax_percent || 0),
        description: r.description || null,
      })),
    };

    setCreating(true);
    try {
      const res = await invoicesApi.create(payload);
      alert(`Invoice created ✅ (${res.invoiceNo || "OK"})`);
      nav(`/invoices/${res.invoiceId}`);
    } catch (err) {
      alert(err?.response?.data?.error || err.message);
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <div className="text-sm text-muted-foreground">Loading...</div>;

  return (
    <div className="w-full max-w-[1200px] mx-auto px-2 md:px-4 overflow-x-hidden space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">Create Invoice</h2>
          <div className="text-sm text-muted-foreground">
            Add items and create invoice with clean preview totals.
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link to="/invoices">
            <Button variant="outline">Back</Button>
          </Link>
          <Button onClick={submit} disabled={creating} className="rounded-xl">
            {creating ? "Creating..." : "Create Invoice"}
          </Button>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        {/* Left */}
        <div className="space-y-4">
          {/* Basic */}
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base">Basic Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="grid gap-2 md:col-span-2">
                  <Label>Customer *</Label>
                  <select
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  >
                    <option value="">-- select --</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} (#{c.id})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-2">
                  <Label>Invoice Date</Label>
                  <Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
                </div>

                <div className="grid gap-2">
                  <Label>Interstate?</Label>
                  <select
                    value={isInterstate}
                    onChange={(e) => setIsInterstate(e.target.value)}
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  >
                    <option value={0}>No (CGST+SGST)</option>
                    <option value={1}>Yes (IGST)</option>
                  </select>
                </div>

                <div className="grid gap-2 md:col-span-2">
                  <Label>Place of Supply (State)</Label>
                  <Input
                    value={placeOfSupplyState}
                    onChange={(e) => setPlaceOfSupplyState(e.target.value)}
                    placeholder="e.g. Madhya Pradesh"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Items (Improved layout - no table) */}
          <Card className="rounded-2xl">
            <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="text-base">Items</CardTitle>
                <div className="text-xs text-muted-foreground mt-1">
                  Tip: Regular invoice me Qty + Rate use karein. Mail/yearly billing ke liye Monthly billing enable karein.
                </div>
              </div>

              <Button variant="secondary" onClick={addRow} type="button" className="gap-2">
                <Plus className="h-4 w-4" />
                Add Row
              </Button>
            </CardHeader>

            <CardContent className="space-y-3">
              {rows.map((r, idx) => (
                <div key={idx} className="rounded-2xl border p-3 md:p-4 bg-background">
                  {/* Row Header */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="rounded-full">#{idx + 1}</Badge>
                      <div className="text-sm text-muted-foreground">
                        Line Total: <span className="font-semibold text-foreground">₹ {totals.line[idx]?.total ?? 0}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant={r.is_period_billing ? "secondary" : "outline"}
                        size="sm"
                        onClick={() => updateRow(idx, "is_period_billing", !r.is_period_billing)}
                      >
                        Monthly billing
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        disabled={rows.length === 1}
                        onClick={() => removeRow(idx)}
                        title="Remove row"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <Separator className="my-3" />

                  {/* Inputs grid */}
                  <div className="grid gap-3 md:grid-cols-12">
                    <div className="md:col-span-4 grid gap-2">
                      <Label>Item</Label>
                      <select
                        value={r.item_id || ""}
                        onChange={(e) => onSelectItem(idx, e.target.value)}
                        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                      >
                        <option value="">-- select --</option>
                        {itemsMaster.map((it) => (
                          <option key={it.id} value={it.id}>
                            {it.name} ({it.type})
                          </option>
                        ))}
                      </select>
                      {!r.item_id && <div className="text-xs text-muted-foreground">Select an item</div>}
                    </div>

                    <div className="md:col-span-5 grid gap-2">
                      <Label>Description</Label>
                      <Input
                        value={r.description || ""}
                        onChange={(e) => updateRow(idx, "description", e.target.value)}
                        placeholder="Description"
                      />
                    </div>

                    <div className="md:col-span-3 grid gap-2">
                      <Label>Qty</Label>
                      <Input
                        type="number"
                        value={r.qty}
                        onChange={(e) => updateRow(idx, "qty", e.target.value)}
                        min={1}
                      />
                    </div>

                    {r.is_period_billing && (
                      <div className="md:col-span-3 grid gap-2">
                        <Label>Months</Label>
                        <Input
                          type="number"
                          value={r.billing_months}
                          onChange={(e) => updateRow(idx, "billing_months", e.target.value)}
                          min={1}
                          step="1"
                        />
                      </div>
                    )}

                    <div className="md:col-span-3 grid gap-2">
                      <Label>Rate</Label>
                      <Input
                        type="number"
                        value={r.rate}
                        onChange={(e) => updateRow(idx, "rate", e.target.value)}
                        min={0}
                      />
                    </div>

                    <div className="md:col-span-3 grid gap-2">
                      <Label>Disc %</Label>
                      <Input
                        type="number"
                        value={r.discount_percent}
                        onChange={(e) => updateRow(idx, "discount_percent", e.target.value)}
                        min={0}
                        max={100}
                      />
                    </div>

                    <div className="md:col-span-3 grid gap-2">
                      <Label>GST %</Label>
                      <Input
                        type="number"
                        value={r.tax_percent}
                        onChange={(e) => updateRow(idx, "tax_percent", e.target.value)}
                        min={0}
                        max={100}
                      />
                    </div>

                    <div className="md:col-span-3 rounded-xl bg-muted p-3 text-sm">
                      {r.is_period_billing && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Billable</span>
                          <span className="font-medium">{billableUnits(r)}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Taxable</span>
                        <span className="font-medium">₹ {totals.line[idx]?.taxable ?? 0}</span>
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="text-muted-foreground">Discount</span>
                        <span className="font-medium">₹ {totals.line[idx]?.disc ?? 0}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={addRow} className="gap-2">
                  <Plus className="h-4 w-4" /> Add Row
                </Button>
                <Button type="button" onClick={submit} disabled={creating}>
                  {creating ? "Creating..." : "Create Invoice"}
                </Button>
              </div>

              <Separator />

              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Optional notes (will appear in invoice PDF)"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Terms</Label>
                  <Textarea
                    value={terms}
                    onChange={(e) => setTerms(e.target.value)}
                    placeholder="Optional terms & conditions"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: totals */}
        <div className="lg:sticky lg:top-20 h-fit">
          <Card className="rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Totals</CardTitle>
              <Badge variant="secondary" className="rounded-full">
                {Number(isInterstate) === 1 ? "IGST" : "CGST+SGST"}
              </Badge>
            </CardHeader>

            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">₹ {totals.subtotal}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Discount</span>
                <span className="font-medium">₹ {totals.discount_total}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Taxable</span>
                <span className="font-medium">₹ {totals.taxable_total}</span>
              </div>

              <Separator />

              <div className="flex justify-between">
                <span className="text-muted-foreground">CGST</span>
                <span className="font-medium">₹ {totals.cgst_total}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">SGST</span>
                <span className="font-medium">₹ {totals.sgst_total}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">IGST</span>
                <span className="font-medium">₹ {totals.igst_total}</span>
              </div>

              <Separator />

              <div className="flex justify-between text-base">
                <span className="font-semibold">Grand Total</span>
                <span className="font-semibold">₹ {totals.grand_total}</span>
              </div>

              <div className="rounded-xl bg-muted p-3 text-xs text-muted-foreground">
                Final totals backend calculate karega. Ye preview hai.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
