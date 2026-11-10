import { CalendarDays, Globe, KeyRound, ListChecks, Scale, Sigma, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Card, CardHeader } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { listCapabilities } from "@/lib/associates/data";
import { getAdmin } from "@/lib/auth/admin";
import { requireAdmin } from "@/lib/auth/dal";
import { MODELS } from "@/lib/ai/models";
import { hasEncryptionKey } from "@/lib/crypto/secrets";
import { listHolidays } from "@/lib/holidays";
import {
  getAiModel,
  getApiKeyStatus,
  getComplexityScale,
  getHomeTimeZone,
  getWeightSettings,
  today,
} from "@/lib/settings";
import { otherTimeZones } from "@/lib/time-zones";
import { ApiKeyForm, ModelForm } from "./ai-forms";
import { CapabilityManager } from "./capability-manager";
import { ComplexityScaleForm } from "./complexity-form";
import { HolidayManager } from "./holiday-manager";
import { PasswordForm } from "./password-form";
import { TimeZoneForm } from "./time-zone-form";
import { WeightsForm } from "./weights-form";

export const metadata = { title: "Settings" };

const TABS = [
  { id: "general", label: "General" },
  { id: "claude", label: "Claude" },
  { id: "capabilities", label: "Capabilities" },
  { id: "rules", label: "Clients and rules" },
] as const;
type Tab = (typeof TABS)[number]["id"];

export default async function SettingsPage({ searchParams }: PageProps<"/settings">) {
  await requireAdmin();
  const requested = (await searchParams).tab;
  const tab: Tab = TABS.some((t) => t.id === requested) ? (requested as Tab) : "general";

  return (
    <>
      <PageHeader title="Settings" description="Your account, the Claude connection, capabilities and the rules behind workload and dates." />
      <Tabs
        label="Settings sections"
        active={tab}
        items={TABS.map((t) => ({ id: t.id, label: t.label, href: t.id === "general" ? "/settings" : `/settings?tab=${t.id}` }))}
      />
      {tab === "general" && <GeneralTab />}
      {tab === "claude" && <ClaudeTab />}
      {tab === "capabilities" && <CapabilitiesTab />}
      {tab === "rules" && <RulesTab />}
    </>
  );
}

function GeneralTab() {
  const admin = getAdmin();
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader icon={<Globe />} title="Time zone" />
        <TimeZoneForm current={getHomeTimeZone()} otherZones={otherTimeZones()} />
      </Card>
      <Card>
        <CardHeader
          icon={<KeyRound />}
          title="Account"
          description={`Signed in as ${admin?.username ?? "admin"}. Changing the password signs out other browsers.`}
        />
        <PasswordForm />
      </Card>
    </div>
  );
}

function ClaudeTab() {
  const keyStatus = getApiKeyStatus();
  const encryptionReady = hasEncryptionKey();
  return (
    <Card className="max-w-2xl">
      <CardHeader
        icon={<Sparkles />}
        title="Claude API"
        description="Rex uses Claude for team recommendations, 1:1 insights and escalation analysis."
      />
      {!encryptionReady && (
        <Alert tone="error" className="mb-4">
          REX_ENCRYPTION_KEY is missing or invalid on the server, so the API key cannot be stored. Set it
          (openssl rand -base64 32) and restart Rex.
        </Alert>
      )}
      <ApiKeyForm
        status={
          keyStatus.configured
            ? { configured: true, last4: keyStatus.last4, updatedAt: keyStatus.updatedAt.toISOString() }
            : { configured: false }
        }
        disabled={!encryptionReady}
      />
      <div className="my-6 border-t border-rex-900/8" />
      <ModelForm current={getAiModel()} models={MODELS.map((m) => ({ id: m.id, label: m.label, note: m.note }))} />
    </Card>
  );
}

function CapabilitiesTab() {
  return (
    <Card id="capabilities">
      <CardHeader
        icon={<ListChecks />}
        title="Capabilities"
        description="The skills you rate associates on. Renaming one updates it everywhere."
      />
      <CapabilityManager
        capabilities={listCapabilities().map(({ id, name, description, usedBy }) => ({ id, name, description, usedBy }))}
      />
    </Card>
  );
}

function RulesTab() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          icon={<Scale />}
          title="Workload weights"
          description="How much each client adds to an associate's load. A typical account is about 1.0; aim for 5 to 10 per associate."
        />
        <WeightsForm current={getWeightSettings()} />
      </Card>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader icon={<Sigma />} title="Payroll complexity scale" description="Shown when you rate a client's complexity." />
          <ComplexityScaleForm scale={getComplexityScale()} />
        </Card>
        <Card>
          <CardHeader
            icon={<CalendarDays />}
            title="Holidays"
            description="Excluded from business-day counts, such as fast starts and days to first input."
          />
          <HolidayManager
            holidays={listHolidays().map(({ date, name }) => ({ date, name }))}
            thisYear={Number(today().slice(0, 4))}
          />
        </Card>
      </div>
    </div>
  );
}
