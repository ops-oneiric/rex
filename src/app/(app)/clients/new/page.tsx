import { PageHeader } from "@/components/layout/page-header";
import { requireAdmin } from "@/lib/auth/dal";
import { getHomeTimeZone } from "@/lib/settings";
import { createClientAction } from "../actions";
import { ClientForm } from "../client-form";
import { clientFormContext } from "../form-context";

export const metadata = { title: "Add client" };

export default async function NewClientPage({ searchParams }: PageProps<"/clients/new">) {
  await requireAdmin();
  const { stage } = await searchParams;
  return (
    <>
      <PageHeader
        title="Add client"
        description="Prospects can be saved with only a code or name. Implementation clients need every required field."
      />
      <ClientForm
        {...clientFormContext()}
        action={createClientAction}
        submitLabel="Add client"
        cancelHref="/clients"
        initial={{
          companyCode: "",
          displayName: "",
          implementationType: "",
          supportModel: "",
          employeeCount: "",
          firstInputDate: "",
          benefitsStartDate: "",
          timeZone: getHomeTimeZone(),
          controlCount: "1",
          payrollComplexity: "",
          previousVendor: "",
          notes: "",
          ...(stage === "IMPLEMENTATION" ? { lifecycleStage: "IMPLEMENTATION" } : {}),
        }}
      />
    </>
  );
}
