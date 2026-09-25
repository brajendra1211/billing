import { useEffect, useState } from "react";
import { customersApi } from "../../api/customers.api";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const empty = {
  name: "",
  contact_person: "",
  phone: "",
  email: "",
  gstin: "",
  billing_state: "",
  billing_city: "",
  billing_pincode: "",
  billing_address_line1: "",
};

export default function CustomersPage() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const res = await customersApi.list();
    setRows(res.data || []);
  };

  useEffect(() => {
    load();
  }, []);

  const onChange = (e) =>
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return alert("Customer name required");

    setSaving(true);
    try {
      if (editId) await customersApi.update(editId, form);
      else await customersApi.create(form);

      setForm(empty);
      setEditId(null);
      await load();
      alert(editId ? "Customer updated ✅" : "Customer added ✅");
    } catch (err) {
      alert(err?.response?.data?.error || err.message);
    } finally {
      setSaving(false);
    }
  };

  const onEdit = (c) => {
    setEditId(c.id);
    setForm({
      name: c.name || "",
      contact_person: c.contact_person || "",
      phone: c.phone || "",
      email: c.email || "",
      gstin: c.gstin || "",
      billing_state: c.billing_state || "",
      billing_city: c.billing_city || "",
      billing_pincode: c.billing_pincode || "",
      billing_address_line1: c.billing_address_line1 || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onPortal = async (c) => {
    try {
      const res = await customersApi.portalLink(c.id);
      const { url, public_url_configured } = res.data;
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        // clipboard may be blocked; the prompt below still lets the user copy
      }
      const note = public_url_configured
        ? "Link copy ho gaya. Customer ko bhejein:"
        : "Note: PUBLIC_APP_URL set nahi hai, ye link sirf is computer pe chalega. Link:";
      prompt(`${c.name} - ${note}`, url);
    } catch (err) {
      alert(err?.response?.data?.error || err.message);
    }
  };

  const onDelete = async (id) => {
    if (!confirm("Delete customer?")) return;
    await customersApi.remove(id);
    load();
  };

  const cancelEdit = () => {
    setEditId(null);
    setForm(empty);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Customers</h2>
          <p className="text-sm text-muted-foreground">
            Add, edit and manage your customers
          </p>
        </div>

        <div className="text-sm text-muted-foreground">
          Total: <span className="font-medium text-foreground">{rows.length}</span>
        </div>
      </div>

      {/* Form Card */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">
            {editId ? "Edit Customer" : "Add Customer"}
          </CardTitle>
        </CardHeader>

        <CardContent>
          <form onSubmit={submit} className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Customer Name *</Label>
                <Input
                  name="name"
                  placeholder="e.g. ABC Traders"
                  value={form.name}
                  onChange={onChange}
                />
              </div>

              <div className="grid gap-2">
                <Label>Contact Person</Label>
                <Input
                  name="contact_person"
                  placeholder="e.g. Rahul"
                  value={form.contact_person}
                  onChange={onChange}
                />
              </div>

              <div className="grid gap-2">
                <Label>Phone</Label>
                <Input
                  name="phone"
                  placeholder="e.g. 9876543210"
                  value={form.phone}
                  onChange={onChange}
                />
              </div>

              <div className="grid gap-2">
                <Label>Email</Label>
                <Input
                  name="email"
                  placeholder="e.g. customer@email.com"
                  value={form.email}
                  onChange={onChange}
                />
              </div>

              <div className="grid gap-2">
                <Label>GSTIN</Label>
                <Input
                  name="gstin"
                  placeholder="e.g. 09ABCDE1234F1Z5"
                  value={form.gstin}
                  onChange={onChange}
                />
              </div>

              <div className="grid gap-2">
                <Label>State</Label>
                <Input
                  name="billing_state"
                  placeholder="e.g. Uttar Pradesh"
                  value={form.billing_state}
                  onChange={onChange}
                />
              </div>

              <div className="grid gap-2">
                <Label>City</Label>
                <Input
                  name="billing_city"
                  placeholder="e.g. Noida"
                  value={form.billing_city}
                  onChange={onChange}
                />
              </div>

              <div className="grid gap-2">
                <Label>Pincode</Label>
                <Input
                  name="billing_pincode"
                  placeholder="e.g. 201301"
                  value={form.billing_pincode}
                  onChange={onChange}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Address</Label>
              <Input
                name="billing_address_line1"
                placeholder="House no, street, area..."
                value={form.billing_address_line1}
                onChange={onChange}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : editId ? "Update Customer" : "Add Customer"}
              </Button>

              {editId && (
                <Button type="button" variant="outline" onClick={cancelEdit}>
                  Cancel
                </Button>
              )}
            </div>

            <div className="text-xs text-muted-foreground">
              Tip: GSTIN and billing state help for GST invoices.
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Table Card */}
      <Card className="rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Customer List</CardTitle>
          <div className="text-sm text-muted-foreground">
            {rows.length ? "Manage records" : "No customers yet"}
          </div>
        </CardHeader>

        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-3 pr-4">ID</th>
                  <th className="py-3 pr-4">Name</th>
                  <th className="py-3 pr-4">Phone</th>
                  <th className="py-3 pr-4">Email</th>
                  <th className="py-3 pr-4">GSTIN</th>
                  <th className="py-3 pr-4">State</th>
                  <th className="py-3 text-right">Actions</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className="border-b hover:bg-muted/40">
                    <td className="py-3 pr-4">{c.id}</td>
                    <td className="py-3 pr-4 font-medium">{c.name}</td>
                    <td className="py-3 pr-4">{c.phone || "—"}</td>
                    <td className="py-3 pr-4">{c.email || "—"}</td>
                    <td className="py-3 pr-4">{c.gstin || "—"}</td>
                    <td className="py-3 pr-4">{c.billing_state || "—"}</td>
                    <td className="py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => onPortal(c)} title="Customer portal link">
                          Portal
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => onEdit(c)}>
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => onDelete(c.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}

                {rows.length === 0 && (
                  <tr>
                    <td colSpan="7" className="py-10 text-center text-muted-foreground">
                      No customers found. Add your first customer above ✅
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
