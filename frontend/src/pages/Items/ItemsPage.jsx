import { useEffect, useState } from "react";
import { itemsApi } from "../../api/items.api";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const empty = {
  type: "SERVICE",
  name: "",
  sale_price: "",
  tax_percent: 18,
  hsn_sac: "",
  unit: "Nos",
};

export default function ItemsPage() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const res = await itemsApi.list();
    setRows(res.data || []);
  };

  useEffect(() => {
    load();
  }, []);

  const onChange = (e) =>
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return alert("Item name required");

    const payload = {
      ...form,
      sale_price: Number(form.sale_price || 0),
      tax_percent: Number(form.tax_percent || 0),
    };

    setSaving(true);
    try {
      if (editId) await itemsApi.update(editId, payload);
      else await itemsApi.create(payload);

      setForm(empty);
      setEditId(null);
      await load();
      alert(editId ? "Item updated ✅" : "Item added ✅");
    } catch (err) {
      alert(err?.response?.data?.error || err.message);
    } finally {
      setSaving(false);
    }
  };

  const onEdit = (i) => {
    setEditId(i.id);
    setForm({
      type: i.type || "SERVICE",
      name: i.name || "",
      sale_price: i.sale_price ?? "",
      tax_percent: i.tax_percent ?? 18,
      hsn_sac: i.hsn_sac || "",
      unit: i.unit || "Nos",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditId(null);
    setForm(empty);
  };

  const onDelete = async (id) => {
    if (!confirm("Delete item?")) return;
    await itemsApi.remove(id);
    load();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            Items (Products / Services)
          </h2>
          <p className="text-sm text-muted-foreground">
            Create your services/products with GST, HSN/SAC and unit
          </p>
        </div>

        <div className="text-sm text-muted-foreground">
          Total:{" "}
          <span className="font-medium text-foreground">{rows.length}</span>
        </div>
      </div>

      {/* Form */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">
            {editId ? "Edit Item" : "Add Item"}
          </CardTitle>
        </CardHeader>

        <CardContent>
          <form onSubmit={submit} className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Type</Label>
                <select
                  name="type"
                  value={form.type}
                  onChange={onChange}
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                >
                  <option value="SERVICE">Service</option>
                  <option value="PRODUCT">Product</option>
                </select>
              </div>

              <div className="grid gap-2">
                <Label>Item Name *</Label>
                <Input
                  name="name"
                  placeholder="e.g. Website Development"
                  value={form.name}
                  onChange={onChange}
                />
              </div>

              <div className="grid gap-2">
                <Label>Rate</Label>
                <Input
                  name="sale_price"
                  type="number"
                  placeholder="e.g. 5000"
                  value={form.sale_price}
                  onChange={onChange}
                />
              </div>

              <div className="grid gap-2">
                <Label>GST %</Label>
                <Input
                  name="tax_percent"
                  type="number"
                  placeholder="e.g. 18"
                  value={form.tax_percent}
                  onChange={onChange}
                />
              </div>

              <div className="grid gap-2">
                <Label>HSN / SAC</Label>
                <Input
                  name="hsn_sac"
                  placeholder="e.g. 998314"
                  value={form.hsn_sac}
                  onChange={onChange}
                />
              </div>

              <div className="grid gap-2">
                <Label>Unit</Label>
                <Input
                  name="unit"
                  placeholder="e.g. Nos / Hours"
                  value={form.unit}
                  onChange={onChange}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : editId ? "Update Item" : "Add Item"}
              </Button>

              {editId && (
                <Button type="button" variant="outline" onClick={cancelEdit}>
                  Cancel
                </Button>
              )}
            </div>

            <div className="text-xs text-muted-foreground">
              Tip: Add correct HSN/SAC for GST reporting.
            </div>
          </form>
        </CardContent>
      </Card>

      {/* List */}
      <Card className="rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Item List</CardTitle>
          <div className="text-sm text-muted-foreground">
            {rows.length ? "Manage items" : "No items yet"}
          </div>
        </CardHeader>

        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-3 pr-4">ID</th>
                  <th className="py-3 pr-4">Type</th>
                  <th className="py-3 pr-4">Name</th>
                  <th className="py-3 pr-4 text-right">Rate</th>
                  <th className="py-3 pr-4 text-right">GST%</th>
                  <th className="py-3 pr-4">HSN/SAC</th>
                  <th className="py-3 text-right">Actions</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((i) => (
                  <tr key={i.id} className="border-b hover:bg-muted/40">
                    <td className="py-3 pr-4">{i.id}</td>
                    <td className="py-3 pr-4">
                      <span className="rounded-full bg-muted px-2 py-1 text-xs">
                        {i.type}
                      </span>
                    </td>
                    <td className="py-3 pr-4 font-medium">{i.name}</td>
                    <td className="py-3 pr-4 text-right">{i.sale_price}</td>
                    <td className="py-3 pr-4 text-right">{i.tax_percent}</td>
                    <td className="py-3 pr-4">{i.hsn_sac || "—"}</td>
                    <td className="py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => onEdit(i)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => onDelete(i.id)}
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
                      No items found. Add your first item above ✅
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
