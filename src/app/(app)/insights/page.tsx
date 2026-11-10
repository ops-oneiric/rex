import { LineChart } from "lucide-react";
import { ComingSoon } from "@/components/layout/coming-soon";
import { PageHeader } from "@/components/layout/page-header";
import { requireAdmin } from "@/lib/auth/dal";

export const metadata = { title: "Insights" };

export default async function Page() {
  await requireAdmin();
  return (
    <>
      <PageHeader title="Insights" description="Trends across capacity, assignments and escalations." />
      <ComingSoon
        phase={7}
        icon={<LineChart />}
        title="Charts and trends"
        points={[
        "Capacity over time and first input density by week",
        "Fast start rate and implementation durations",
        "Escalations by fault, category and month",
        ]}
      />
    </>
  );
}
