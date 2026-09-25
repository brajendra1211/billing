import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { renewalsApi } from "@/api/renewals.api";
import { customersApi } from "@/api/customers.api";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function RenewalCreate() {
  const nav = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    customer_id: "",
    name: "",
    service_type: "DOMAIN",
    service_ref: "",
    provider_name: "",
    amount: "",
    currency: "INR",
    cycle: "YEARLY",
    start_date: todayISO(),
    next_due_date: todayISO(),
    remind_before_days: 7,
    is_active: 1,
    notes: "",
  });

  const loadCustomers = async () => {
    try {
      const res = await customersApi.list({ limit: 200 });
      // your customersApi.list returns {ok:true,data:{rows:[]}} or {ok:true,data:[]}? depends
      const rows = res?.data?.rows || res?.data || [];
      setCustomers(rows);
    } catch {
      setCustomers([]);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const onChange = (e) =>
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return alert("Name required");
    if (!form.amount) return alert("Amount required");
    if (!form.next_due_date) return alert("Next due date required");

    setSaving(true);
    try {
      const payload = {
        ...form,
        customer_id: form.customer_id ? Number(form.customer_id) : null,
        amount: Number(form.amount),
        remind_before_days: Number(form.remind_before_days || 0),
        is_active: Number(form.is_active || 1),
      };
      const res = await renewalsApi.create(payload);
      const id = res?.id || res?.data?.id;
      alert("Renewal created ✅");
      nav(`/renewals/${id}`);
    } catch (err) {
      alert(err?.response?.data?.error || err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Create Renewal</h2>
          <div className="text-sm text-muted-foreground">
            Add Domain/Hosting/AMC/Software renewal
          </div>
        </div>
        <Button variant="outline" onClick={() => nav(-1)}>
          Back
        </Button>
      </div>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Renewal Details</CardTitle>
        </CardHeader>

        <CardContent>
          <form onSubmit={save} className="grid gap-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Customer</Label>
                <select
                  name="customer_id"
                  value={form.customer_id}
                  onChange={onChange}
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                >
                  <option value="">— Select customer —</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-2">
                <Label>Name</Label>
                <Input
                  name="name"
                  value={form.name}
                  onChange={onChange}
                  placeholder="e.g. Domain Renewal / AMC Renewal"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="grid gap-2">
                <Label>Type</Label>
                <select
                  name="service_type"
                  value={form.service_type}
                  onChange={onChange}
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                >
                  <option value="DOMAIN">DOMAIN</option>
                  <option value="HOSTING">HOSTING</option>
                  <option value="SERVER">SERVER</option>
                  <option value="SSL">SSL</option>
                  <option value="SOFTWARE">SOFTWARE</option>
                  <option value="AMC">AMC</option>
                  <option value="OTHER">OTHER</option>
                </select>
              </div>

              <div className="grid gap-2">
                <Label>Service Ref</Label>
                <Input
                  name="service_ref"
                  value={form.service_ref}
                  onChange={onChange}
                  placeholder="domain.com / license key / server name"
                />
              </div>

              <div className="grid gap-2">
                <Label>Provider</Label>
                <Input
                  name="provider_name"
                  value={form.provider_name}
                  onChange={onChange}
                  placeholder="GoDaddy / Hostinger / AWS"
                />
              </div>
            </div>

            <Separator />

            <div className="grid gap-4 md:grid-cols-4">
              <div className="grid gap-2">
                <Label>Amount</Label>
                <Input
                  type="number"
                  name="amount"
                  value={form.amount}
                  onChange={onChange}
                  placeholder="e.g. 999"
                />
              </div>

              <div className="grid gap-2">
                <Label>Currency</Label>
                <Input name="currency" value={form.currency} onChange={onChange} />
              </div>

              <div className="grid gap-2">
                <Label>Cycle</Label>
                <select
                  name="cycle"
                  value={form.cycle}
                  onChange={onChange}
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                >
                  <option value="MONTHLY">MONTHLY</option>
                  <option value="QUARTERLY">QUARTERLY</option>
                  <option value="HALF_YEARLY">HALF_YEARLY</option>
                  <option value="YEARLY">YEARLY</option>
                </select>
              </div>

              <div className="grid gap-2">
                <Label>Remind Before (days)</Label>
                <Input
                  type="number"
                  name="remind_before_days"
                  value={form.remind_before_days}
                  onChange={onChange}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  name="start_date"
                  value={form.start_date}
                  onChange={onChange}
                />
              </div>

              <div className="grid gap-2">
                <Label>Next Due Date</Label>
                <Input
                  type="date"
                  name="next_due_date"
                  value={form.next_due_date}
                  onChange={onChange}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Notes</Label>
              <Input
                name="notes"
                value={form.notes}
                onChange={onChange}
                placeholder="Optional"
              />
            </div>

            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Create Renewal"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
