import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarClock,
  Check,
  Circle,
  ListChecks,
  UserRoundPlus,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/dal";
import { getApiKeyStatus } from "@/lib/settings";
import { hasEncryptionKey } from "@/lib/crypto/secrets";

export const metadata = { title: "Dashboard" };

const stats = [
  { label: "Awaiting assignment", icon: UserRoundPlus },
  { label: "Active implementations", icon: Building2 },
  { label: "First inputs, next 30 days", icon: CalendarClock },
  { label: "Open escalations", icon: AlertTriangle },
];

export default async function DashboardPage() {
  await requireAdmin();
  const keyStatus = getApiKeyStatus();

  const checklist = [
    { done: true, label: "Admin account created", href: null },
    { done: hasEncryptionKey(), label: "Encryption key configured on the server", href: "/settings" },
    { done: keyStatus.configured, label: "Claude API key saved", href: "/settings" },
    { done: false, label: "Add your associates (Phase 1)", href: null },
    { done: false, label: "Add clients and prospects (Phase 2)", href: null },
  ];

  return (
    <>
      <PageHeader title="Dashboard" description="Your book of business at a glance." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ label, icon: Icon }) => (
          <Card key={label} className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-ink-muted">{label}</span>
              <Icon className="size-4 text-rex-500" aria-hidden="true" />
            </div>
            <p className="tabular mt-3 text-3xl font-semibold text-rex-950">0</p>
          </Card>
        ))}
      </div>

      <Card className="mt-6 max-w-2xl">
        <CardHeader
          icon={<ListChecks />}
          title="Getting started"
          description="Rex fills in as each phase is delivered."
        />
        <ul className="divide-y divide-rex-900/5">
          {checklist.map((item) => (
            <li key={item.label} className="flex items-center gap-3 py-2.5 text-sm">
              {item.done ? (
                <span className="grid size-5 place-items-center rounded-full bg-rex-900 text-white">
                  <Check className="size-3" aria-hidden="true" />
                </span>
              ) : (
                <Circle className="size-5 text-rex-300" aria-hidden="true" />
              )}
              <span className={item.done ? "text-ink-muted line-through decoration-rex-300" : "text-ink"}>
                {item.label}
              </span>
              <span className="sr-only">{item.done ? "(done)" : "(to do)"}</span>
              {!item.done && item.href && (
                <Link
                  href={item.href}
                  className="ml-auto inline-flex items-center gap-1 text-rex-700 hover:text-rex-900"
                >
                  Open <ArrowRight className="size-3.5" aria-hidden="true" />
                </Link>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
