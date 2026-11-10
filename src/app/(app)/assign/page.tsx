import { UserRoundPlus } from "lucide-react";
import { ComingSoon } from "@/components/layout/coming-soon";
import { PageHeader } from "@/components/layout/page-header";
import { requireAdmin } from "@/lib/auth/dal";

export const metadata = { title: "Assign" };

export default async function Page() {
  await requireAdmin();
  return (
    <>
      <PageHeader title="Assign" description="Fill each seat of a client's support model with the right associate." />
      <ComingSoon
        phase={4}
        icon={<UserRoundPlus />}
        title="Team recommendations"
        points={[
        "Hybrid, Traditional and PM model seats",
        "PTO knock-outs, first input collisions and capacity checked by the rules engine",
        "Claude ranks eligible teams and explains its choice; you accept, swap or override",
        "Manual assignment arrives first, in Phase 3",
        ]}
      />
    </>
  );
}
