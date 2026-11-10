import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { requireAdmin } from "@/lib/auth/dal";
import { clientLabel } from "@/lib/clients/constants";
import { getClient } from "@/lib/clients/data";
import { updateClientAction } from "../../actions";
import { ClientForm } from "../../client-form";
import { clientFormContext } from "../../form-context";

export const metadata = { title: "Edit client" };

export default async function EditClientPage({ params }: PageProps<"/clients/[id]/edit">) {
  await requireAdmin();
  const client = getClient(Number((await params).id));
  if (!client) notFound();
  const s = (v: string | number | null) => (v === null ? "" : String(v));

  return (
    <>
      <PageHeader title={`Edit ${clientLabel(client)}`} />
      <ClientForm
        {...clientFormContext()}
        action={updateClientAction.bind(null, client.id)}
        stage={client.lifecycleStage}
        submitLabel="Save changes"
        cancelHref={`/clients/${client.id}`}
        initial={{
          companyCode: s(client.companyCode),
          displayName: s(client.displayName),
          implementationType: s(client.implementationType),
          supportModel: s(client.supportModel),
          employeeCount: s(client.employeeCount),
          firstInputDate: s(client.firstInputDate),
          benefitsStartDate: s(client.benefitsStartDate),
          timeZone: s(client.timeZone),
          controlCount: s(client.controlCount),
          payrollComplexity: s(client.payrollComplexity),
          previousVendor: s(client.previousVendor),
          notes: client.notes,
        }}
      />
    </>
  );
}
