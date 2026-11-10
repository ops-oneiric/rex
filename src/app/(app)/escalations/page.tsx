import { AlertTriangle } from "lucide-react";
import { ComingSoon } from "@/components/layout/coming-soon";
import { PageHeader } from "@/components/layout/page-header";
import { requireAdmin } from "@/lib/auth/dal";

export const metadata = { title: "Escalations" };

export default async function Page() {
  await requireAdmin();
  return (
    <>
      <PageHeader title="Escalations" description="Escalation log, fault alignment and trends." />
      <ComingSoon
        phase={6}
        icon={<AlertTriangle />}
        title="Escalation tracking"
        points={[
        "Two inputs only: the date and the details",
        "Client and associate references coded before anything is sent to Claude",
        "Claude proposes category, severity, fault and root cause for you to confirm",
        "Trends by fault, category, associate and client over time",
        ]}
      />
    </>
  );
}
