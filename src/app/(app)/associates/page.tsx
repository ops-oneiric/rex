import { Users } from "lucide-react";
import { ComingSoon } from "@/components/layout/coming-soon";
import { PageHeader } from "@/components/layout/page-header";
import { requireAdmin } from "@/lib/auth/dal";

export const metadata = { title: "Associates" };

export default async function Page() {
  await requireAdmin();
  return (
    <>
      <PageHeader title="Associates" description="Your roster, roles, capabilities, PTO and workload." />
      <ComingSoon
        phase={1}
        icon={<Users />}
        title="Associate roster"
        points={[
        "PM and payroll seat eligibility",
        "Capability tags with proficiency, plus free-text capability notes",
        "PTO calendar per associate",
        "Directly managed flag that controls who appears in Cadence",
        ]}
      />
    </>
  );
}
