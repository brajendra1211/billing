import { Badge } from "@/components/ui/badge";

const STATUS = {
  PAID: ["Paid", "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"],
  PART_PAID: ["Part paid", "bg-sky-100 text-sky-700 hover:bg-sky-100"],
  INVOICED: ["Invoiced", "bg-indigo-100 text-indigo-700 hover:bg-indigo-100"],
  OVERDUE: ["Overdue", "bg-red-100 text-red-700 hover:bg-red-100"],
  DEMANDED: ["Requested", "bg-amber-100 text-amber-800 hover:bg-amber-100"],
  PENDING: ["Upcoming", "bg-slate-100 text-slate-700 hover:bg-slate-100"],
};

export default function MilestoneStatus({ status }) {
  const [label, cls] = STATUS[status] || [status, ""];
  return <Badge className={`rounded-full ${cls}`}>{label}</Badge>;
}
