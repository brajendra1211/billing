import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { renewalsApi } from "@/api/renewals.api";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

function daysDiff(a, b) {
  // a,b: yyyy-mm-dd
  const da = new Date(a + "T00:00:00");
  const db = new Date(b + "T00:00:00");
  return Math.round((db - da) / (1000 * 60 * 60 * 24));
}

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function StatusPill({ dueDate }) {
  const t = todayISO();
  const diff = daysDiff(t, dueDate); // due - today

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

export default function RenewalsList() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState({
    search: "",
    status: "", // "", "DUE_SOON", "OVERDUE"
  });

  const load = async () => {
    setLoading(true);
    try {
      const res = await renewalsApi.list({
        search: q.search || undefined,
        status: q.status || undefined,
      });
      setRows(res?.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, [q.status]);

  const filtered = useMemo(() => {
    const s = (q.search || "").trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => {
      const t = `${r.name} ${r.service_ref || ""} ${r.customer_name || ""}`.toLowerCase();
      return t.includes(s);
    });
  }, [rows, q.search]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">Renewals</h2>
          <div className="text-sm text-muted-foreground">
            Domain • Hosting • AMC • Software • SSL renewals tracking
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link to="/renewals/create">
            <Button>Create Renewal</Button>
          </Link>
          <Button variant="outline" onClick={load}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="rounded-2xl">
        <CardContent className="p-5">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="grid gap-2">
              <div className="text-sm text-muted-foreground">Search</div>
              <Input
                value={q.search}
                onChange={(e) => setQ((p) => ({ ...p, search: e.target.value }))}
                placeholder="customer / domain / service"
                onKeyDown={(e) => e.key === "Enter" && load()}
              />
            </div>

            <div className="grid gap-2">
              <div className="text-sm text-muted-foreground">Status</div>
              <select
                value={q.status}
                onChange={(e) => setQ((p) => ({ ...p, status: e.target.value }))}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="">All</option>
                <option value="DUE_SOON">Due Soon</option>
                <option value="OVERDUE">Overdue</option>
              </select>
            </div>

            <div className="flex items-end gap-2">
              <Button variant="secondary" onClick={load}>
                Apply
              </Button>
              <Button
                variant="outline"
                onClick={() => setQ({ search: "", status: "" })}
              >
                Reset
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* List */}
      <Card className="rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Renewal List</CardTitle>
          <Badge variant="secondary" className="rounded-full">
            {filtered.length}
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
                    <th className="py-3 pr-4">Name</th>
                    <th className="py-3 pr-4">Customer</th>
                    <th className="py-3 pr-4">Type</th>
                    <th className="py-3 pr-4">Ref</th>
                    <th className="py-3 pr-4">Due Date</th>
                    <th className="py-3 pr-4 text-right">Amount</th>
                    <th className="py-3 pr-4">Status</th>
                    <th className="py-3 text-right">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id} className="border-b hover:bg-muted/40">
                      <td className="py-3 pr-4">{r.id}</td>
                      <td className="py-3 pr-4 font-medium">{r.name}</td>
                      <td className="py-3 pr-4">{r.customer_name || "—"}</td>
                      <td className="py-3 pr-4">
                        <Badge variant="secondary" className="rounded-full">
                          {r.service_type || "OTHER"}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4">{r.service_ref || "—"}</td>
                      <td className="py-3 pr-4">{r.next_due_date}</td>
                      <td className="py-3 pr-4 text-right">
                        ₹ {Number(r.amount || 0)}
                      </td>
                      <td className="py-3 pr-4">
                        <StatusPill dueDate={r.next_due_date} />
                      </td>
                      <td className="py-3 text-right">
                        <Link to={`/renewals/${r.id}`}>
                          <Button size="sm" variant="secondary">
                            View
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}

                  {filtered.length === 0 && (
                    <tr>
                      <td
                        colSpan="9"
                        className="py-10 text-center text-muted-foreground"
                      >
                        No renewals
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          <Separator className="my-4" />
          <div className="text-xs text-muted-foreground">
            Tip: Due Soon means due date within ~7 days (can be improved using remind_before_days).
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
