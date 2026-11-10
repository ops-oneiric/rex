import { CalendarCheck } from "lucide-react";
import { ComingSoon } from "@/components/layout/coming-soon";
import { PageHeader } from "@/components/layout/page-header";
import { requireAdmin } from "@/lib/auth/dal";

export const metadata = { title: "Cadence" };

export default async function Page() {
  await requireAdmin();
  return (
    <>
      <PageHeader title="Cadence" description="1:1 meetings with the associates you manage directly." />
      <ComingSoon
        phase={5}
        icon={<CalendarCheck />}
        title="1:1 notes and insights"
        points={[
        "Two inputs only: the meeting date and your notes",
        "Claude extracts action items, strengths, weak points, skills and morale",
        "Trend reports across meetings, with talking points for the next 1:1",
        ]}
      />
    </>
  );
}
