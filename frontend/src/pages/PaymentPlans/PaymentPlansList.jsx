import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { paymentPlansApi } from "../../api/paymentPlans.api";
import { money, fmtDate } from "./planUtils";
import MilestoneStatus from "./MilestoneStatus";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function PaymentPlansList() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await paymentPlansApi.list();
        setRows(res.data || []);
      } catch (e) {
        alert(e?.response?.data?.error || e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="w-full max-w-[1200px] mx-auto space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Payment Plans</h2>
          <div className="text-sm text-muted-foreground">
            Project ki payment installments (jaise 30% / 40% / 30%), demand letters aur milestone invoices.
          </div>
        </div>
        <Link to="/payment-plans/new">
          <Button>+ New Plan</Button>
        </Link>
      </div>

      <Card className="rounded-2xl">
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-3 px-4">Project</th>
                <th className="py-3 pr-4">Customer</th>
                <th className="py-3 pr-4 text-right">Value (incl. GST)</th>
                <th className="py-3 pr-4 text-right">Received</th>
                <th className="py-3 pr-4">Progress</th>
                <th className="py-3 pr-4">Next installment</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan="6" className="py-10 text-center text-muted-foreground">Loading...</td>
                </tr>
              )}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan="6" className="py-10 text-center text-muted-foreground">
                    Abhi koi plan nahi. "+ New Plan" se shuru karein.
                  </td>
                </tr>
              )}
              {rows.map((p) => {
                const s = p.summary;
                const pct = s.total_payable > 0 ? Math.min(100, Math.round((s.received / s.total_payable) * 100)) : 0;
                return (
                  <tr key={p.id} className="border-b hover:bg-muted/40">
                    <td className="py-3 px-4">
                      <Link className="font-medium underline-offset-2 hover:underline" to={`/payment-plans/${p.id}`}>
                        {p.title}
                      </Link>
                      {p.status === "CANCELLED" && (
                        <Badge className="ml-2 rounded-full bg-red-100 text-red-700 hover:bg-red-100">Cancelled</Badge>
                      )}
                      {s.completed && p.status !== "CANCELLED" && (
                        <Badge className="ml-2 rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Completed</Badge>
                      )}
                    </td>
                    <td className="py-3 pr-4">{p.customer_name}</td>
                    <td className="py-3 pr-4 text-right">{money(s.total_payable)}</td>
                    <td className="py-3 pr-4 text-right">{money(s.received)}</td>
                    <td className="py-3 pr-4 min-w-[140px]">
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-2 bg-emerald-500" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {s.milestones_paid}/{s.milestones_total} paid • {pct}%
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      {s.next_milestone ? (
                        <div className="flex flex-col gap-1">
                          <span>
                            {s.next_milestone.seq}. {s.next_milestone.title}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {fmtDate(s.next_milestone.due_date)} <MilestoneStatus status={s.next_milestone.status} />
                          </span>
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
