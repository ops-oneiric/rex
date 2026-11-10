import { Building2 } from "lucide-react";
import { ComingSoon } from "@/components/layout/coming-soon";
import { PageHeader } from "@/components/layout/page-header";
import { requireAdmin } from "@/lib/auth/dal";

export const metadata = { title: "Clients" };

export default async function Page() {
  await requireAdmin();
  return (
    <>
      <PageHeader title="Clients" description="Prospects, implementations and service clients." />
      <ComingSoon
        phase={2}
        icon={<Building2 />}
        title="Client records and lifecycle"
        points={[
        "Company code, employee count, first input date, benefits start date, time zone, control count, payroll complexity, previous vendor and implementation type",
        "Lifecycle from prospect to implementation to service, with stage history",
        "Fast start flag when first input is under 20 business days from assignment",
        "Workload weight calculated for each client",
        ]}
      />
    </>
  );
}
