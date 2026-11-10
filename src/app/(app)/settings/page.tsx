import { Globe, KeyRound, ListChecks, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Card, CardHeader } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/dal";
import { getAdmin } from "@/lib/auth/admin";
import { MODELS } from "@/lib/ai/models";
import { hasEncryptionKey } from "@/lib/crypto/secrets";
import { getAiModel, getApiKeyStatus, getHomeTimeZone } from "@/lib/settings";
import { listCapabilities } from "@/lib/associates/data";
import { otherTimeZones } from "@/lib/time-zones";
import { CapabilityManager } from "./capability-manager";
import { TimeZoneForm } from "./time-zone-form";
import { ApiKeyForm, ModelForm } from "./ai-forms";
import { PasswordForm } from "./password-form";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requireAdmin();
  const keyStatus = getApiKeyStatus();
  const encryptionReady = hasEncryptionKey();
  const admin = getAdmin();

  return (
    <>
      <PageHeader
        title="Settings"
        description="Claude connection, your account, time zone and the capability list. Assignment rules arrive in Phase 3."
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
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
          <ModelForm
            current={getAiModel()}
            models={MODELS.map((m) => ({ id: m.id, label: m.label, note: m.note }))}
          />
        </Card>

        <Card>
          <CardHeader
            icon={<KeyRound />}
            title="Account"
            description={`Signed in as ${admin?.username ?? "admin"}. Changing the password signs out other browsers.`}
          />
          <PasswordForm />
        </Card>

        <Card>
          <CardHeader icon={<Globe />} title="General" />
          <TimeZoneForm current={getHomeTimeZone()} otherZones={otherTimeZones()} />
        </Card>

        <Card id="capabilities" className="scroll-mt-6 lg:col-span-2">
          <CardHeader
            icon={<ListChecks />}
            title="Capabilities"
            description="The skills you rate associates on. Renaming one updates it everywhere."
          />
          <CapabilityManager
            capabilities={listCapabilities().map(({ id, name, description, usedBy }) => ({ id, name, description, usedBy }))}
          />
        </Card>
      </div>
    </>
  );
}
