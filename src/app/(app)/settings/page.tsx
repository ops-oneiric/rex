import {
  CalendarCheck,
  CalendarDays,
  Gauge,
  Globe,
  KeyRound,
  ListChecks,
  Scale,
  ShieldCheck,
  Sigma,
  Sparkles,
  Waypoints,
} from "lucide-react";
import { CadenceForm } from "./cadence-form";
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
  getCadenceDays,
  getComplexityScale,
  getHomeTimeZone,
  getExtraNames,
  getRuleSettings,
  getWeightSettings,
  today,
} from "@/lib/settings";
import { aiUsageSince } from "@/lib/ai/usage";
import { PrivacyForm } from "./privacy-form";
import { otherTimeZones } from "@/lib/time-zones";
import { ApiKeyForm, ModelForm } from "./ai-forms";
import { CapabilityManager } from "./capability-manager";
import { ComplexityScaleForm } from "./complexity-form";
import { HolidayManager } from "./holiday-manager";
import { PasswordForm } from "./password-form";
import { TimeZoneForm } from "./time-zone-form";
import { WeightsForm } from "./weights-form";
import { RulesForm } from "./rules-form";

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
      {tab === "claude" && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <ClaudeTab />
          <ClaudeSideCards />
        </div>
      )}
      {tab === "capabilities" && <CapabilitiesTab />}
      {tab === "rules" && <RulesTab />}
    </>
  );
}

function GeneralTab() {
  const admin = getAdmin();
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="space-y-6">
        <Card>
          <CardHeader icon={<Globe />} title="Time zone" />
          <TimeZoneForm current={getHomeTimeZone()} otherZones={otherTimeZones()} />
        </Card>
        <Card>
          <CardHeader icon={<CalendarCheck />} title="1:1 rhythm" description="How often you expect to meet the associates you manage directly." />
          <CadenceForm days={getCadenceDays()} />
        </Card>
      </div>
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

function ClaudeSideCards() {
  const monthStart = new Date(`${today().slice(0, 7)}-01T00:00:00`);
  const all = aiUsageSince(monthStart);
  const usage = all.recommendations;
  const decided = usage.accepted + usage.modified + usage.rejected;
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader icon={<ShieldCheck />} title="Privacy" description="What is replaced before anything is sent to Claude." />
        <PrivacyForm names={getExtraNames()} />
      </Card>
      <Card>
        <CardHeader icon={<Gauge />} title="Usage this month" description="Estimated from token counts at list prices." />
        <dl className="grid grid-cols-[10rem_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-ink-muted">Recommendations</dt>
          <dd className="tabular">
            {usage.calls}
            {usage.failed > 0 && <span className="text-ink-muted"> ({usage.failed} failed)</span>}
          </dd>
          <dt className="text-ink-muted">1:1 analyses</dt>
          <dd className="tabular">{all.insights}</dd>
          <dt className="text-ink-muted">Escalation reviews</dt>
          <dd className="tabular">{all.escalations}</dd>
          <dt className="text-ink-muted">Trend reports</dt>
          <dd className="tabular">{all.trends}</dd>
          <dt className="text-ink-muted">Estimated cost</dt>
          <dd className="tabular">${all.totalCostUsd.toFixed(2)}</dd>
          <dt className="text-ink-muted">Team decisions</dt>
          <dd className="tabular">
            {decided === 0
              ? "None yet"
              : `${usage.accepted} accepted, ${usage.modified} with changes, ${usage.rejected} declined`}
          </dd>
        </dl>
      </Card>
    </div>
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
      <Card>
        <CardHeader
          icon={<Waypoints />}
          title="Assignment rules"
          description="The checks Rex runs on every candidate. Changes apply immediately to loads, flags and rankings."
        />
        <RulesForm current={getRuleSettings()} />
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
