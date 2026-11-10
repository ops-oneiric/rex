import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { getAssociate } from "@/lib/associates/data";
import { requireAdmin } from "@/lib/auth/dal";
import { otherTimeZones } from "@/lib/time-zones";
import { updateAssociateAction } from "../../actions";
import { AssociateForm } from "../../associate-form";

export const metadata = { title: "Edit associate" };

export default async function EditAssociatePage({ params }: PageProps<"/associates/[id]/edit">) {
  await requireAdmin();
  const associate = getAssociate(Number((await params).id));
  if (!associate) notFound();

  return (
    <>
      <PageHeader title={`Edit ${associate.name}`} />
      <AssociateForm
        action={updateAssociateAction.bind(null, associate.id)}
        otherZones={otherTimeZones()}
        submitLabel="Save changes"
        cancelHref={`/associates/${associate.id}`}
        initial={{
          name: associate.name,
          email: associate.email ?? "",
          title: associate.title ?? "",
          timeZone: associate.timeZone,
          canPm: associate.canPm,
          canPayroll: associate.canPayroll,
          targetLoad: String(associate.targetLoad),
          isDirectlyManaged: associate.isDirectlyManaged,
        }}
      />
    </>
  );
}
