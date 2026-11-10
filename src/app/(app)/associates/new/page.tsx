import { PageHeader } from "@/components/layout/page-header";
import { requireAdmin } from "@/lib/auth/dal";
import { getHomeTimeZone } from "@/lib/settings";
import { otherTimeZones } from "@/lib/time-zones";
import { createAssociateAction } from "../actions";
import { AssociateForm } from "../associate-form";

export const metadata = { title: "Add associate" };

export default async function NewAssociatePage() {
  await requireAdmin();
  return (
    <>
      <PageHeader
        title="Add associate"
        description="Capabilities and PTO come next, on the associate's page."
      />
      <AssociateForm
        action={createAssociateAction}
        otherZones={otherTimeZones()}
        submitLabel="Add associate"
        cancelHref="/associates"
        initial={{
          name: "",
          email: "",
          title: "",
          timeZone: getHomeTimeZone(),
          canPm: false,
          canPayroll: true,
          targetLoad: "8",
          isDirectlyManaged: false,
        }}
      />
    </>
  );
}
