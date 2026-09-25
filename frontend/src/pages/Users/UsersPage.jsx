import { useEffect, useMemo, useState } from "react";
import { usersApi } from "../../api/users.api";
import { useAuth } from "../../context/AuthContext";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export default function UsersPage() {
  const { user } = useAuth();

  // ✅ Frontend guard
  if (String(user?.role || "").toUpperCase() !== "ADMIN") {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">Forbidden</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Only ADMIN can access Users management.
          </CardContent>
        </Card>
      </div>
    );
  }

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "STAFF" });

  // edit modal-like inline
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", role: "STAFF" });

  // reset password
  const [resetId, setResetId] = useState(null);
  const [newPass, setNewPass] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const res = await usersApi.list();
      setRows(res.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const create = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      await usersApi.create(form);
      setForm({ name: "", email: "", password: "", role: "STAFF" });
      await load();
      alert("User created ✅");
    } catch (err) {
      alert(err?.response?.data?.error || err.message);
    } finally {
      setCreating(false);
    }
  };

  const roleBadge = (role) => {
    if (role === "ADMIN") return <Badge className="bg-red-100 text-red-700">ADMIN</Badge>;
    if (role === "STAFF") return <Badge className="bg-blue-100 text-blue-700">STAFF</Badge>;
    return <Badge variant="secondary">VIEWER</Badge>;
  };

  const startEdit = (u) => {
    setEditId(u.id);
    setEditForm({ name: u.name || "", email: u.email || "", role: u.role || "STAFF" });
  };

  const saveEdit = async () => {
    try {
      await usersApi.update(editId, editForm);
      setEditId(null);
      await load();
      alert("User updated ✅");
    } catch (err) {
      alert(err?.response?.data?.error || err.message);
    }
  };

  const toggleActive = async (u) => {
    const next = u.is_active ? 0 : 1;
    const msg = next ? "Enable user?" : "Disable user? (login block ho jayega)";
    if (!confirm(msg)) return;

    try {
      await usersApi.setActive(u.id, next);
      await load();
    } catch (err) {
      alert(err?.response?.data?.error || err.message);
    }
  };

  const doResetPassword = async () => {
    if (!newPass || newPass.length < 6) return alert("Password min 6 chars");
    if (!confirm("Reset password? User ko new password dena hoga.")) return;

    try {
      await usersApi.resetPassword(resetId, newPass);
      setResetId(null);
      setNewPass("");
      alert("Password reset ✅");
    } catch (err) {
      alert(err?.response?.data?.error || err.message);
    }
  };

  const activeCount = useMemo(() => rows.filter((r) => r.is_active).length, [rows]);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Users</h2>
        <p className="text-sm text-muted-foreground">
          Create / edit role, disable/enable login, reset passwords (Admin only)
        </p>
      </div>

      {/* Create */}
      <Card className="rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Create New User</CardTitle>
          <Badge variant="secondary" className="rounded-full">
            Active: {activeCount}/{rows.length}
          </Badge>
        </CardHeader>

        <CardContent>
          <form onSubmit={create} className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label>Name</Label>
              <Input name="name" value={form.name} onChange={onChange} placeholder="Full name" required />
            </div>

            <div className="grid gap-2">
              <Label>Email</Label>
              <Input name="email" type="email" value={form.email} onChange={onChange} placeholder="user@email.com" required />
            </div>

            <div className="grid gap-2">
              <Label>Password</Label>
              <Input name="password" type="password" value={form.password} onChange={onChange} placeholder="Min 6 chars" required />
            </div>

            <div className="grid gap-2">
              <Label>Role</Label>
              <select
                name="role"
                value={form.role}
                onChange={onChange}
                className="h-10 rounded-md border bg-background px-3 text-sm"
              >
                <option value="STAFF">STAFF</option>
                <option value="VIEWER">VIEWER</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <Button type="submit" disabled={creating}>
                {creating ? "Creating..." : "Create User"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* List */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">User List</CardTitle>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading users...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-3 pr-3">ID</th>
                    <th className="py-3 pr-3">Name</th>
                    <th className="py-3 pr-3">Email</th>
                    <th className="py-3 pr-3">Role</th>
                    <th className="py-3 pr-3">Status</th>
                    <th className="py-3 pr-3">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {rows.map((u) => (
                    <tr key={u.id} className="border-b">
                      <td className="py-3 pr-3">{u.id}</td>

                      <td className="py-3 pr-3 font-medium">
                        {editId === u.id ? (
                          <Input
                            value={editForm.name}
                            onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                          />
                        ) : (
                          u.name
                        )}
                      </td>

                      <td className="py-3 pr-3">
                        {editId === u.id ? (
                          <Input
                            value={editForm.email}
                            onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
                          />
                        ) : (
                          u.email
                        )}
                      </td>

                      <td className="py-3 pr-3">
                        {editId === u.id ? (
                          <select
                            value={editForm.role}
                            onChange={(e) => setEditForm((p) => ({ ...p, role: e.target.value }))}
                            className="h-10 rounded-md border bg-background px-3 text-sm"
                          >
                            <option value="STAFF">STAFF</option>
                            <option value="VIEWER">VIEWER</option>
                            <option value="ADMIN">ADMIN</option>
                          </select>
                        ) : (
                          roleBadge(u.role)
                        )}
                      </td>

                      <td className="py-3 pr-3">
                        {u.is_active ? (
                          <Badge className="bg-green-100 text-green-700">ACTIVE</Badge>
                        ) : (
                          <Badge className="bg-gray-200 text-gray-700">DISABLED</Badge>
                        )}
                      </td>

                      <td className="py-3 pr-3">
                        <div className="flex flex-wrap gap-2">
                          {editId === u.id ? (
                            <>
                              <Button size="sm" onClick={saveEdit}>Save</Button>
                              <Button size="sm" variant="outline" onClick={() => setEditId(null)}>Cancel</Button>
                            </>
                          ) : (
                            <Button size="sm" variant="secondary" onClick={() => startEdit(u)}>
                              Edit
                            </Button>
                          )}

                          <Button
                            size="sm"
                            variant={u.is_active ? "destructive" : "outline"}
                            onClick={() => toggleActive(u)}
                          >
                            {u.is_active ? "Disable" : "Enable"}
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setResetId(u.id);
                              setNewPass("");
                            }}
                          >
                            Reset Password
                          </Button>
                        </div>

                        {/* Reset password inline box */}
                        {resetId === u.id && (
                          <div className="mt-3 rounded-xl border p-3">
                            <div className="text-xs text-muted-foreground mb-2">
                              New password for <b>{u.email}</b>
                            </div>
                            <div className="flex gap-2">
                              <Input
                                type="password"
                                value={newPass}
                                onChange={(e) => setNewPass(e.target.value)}
                                placeholder="New password (min 6)"
                              />
                              <Button onClick={doResetPassword}>Save</Button>
                              <Button variant="outline" onClick={() => setResetId(null)}>
                                Cancel
                              </Button>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}

                  {rows.length === 0 && (
                    <tr>
                      <td colSpan="6" className="py-6 text-center text-muted-foreground">
                        No users found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              <Separator className="my-4" />

              <div className="text-xs text-muted-foreground">
                Notes: Disabled user login नहीं कर पाएगा. Password reset करने के बाद user को new password दे दें.
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
