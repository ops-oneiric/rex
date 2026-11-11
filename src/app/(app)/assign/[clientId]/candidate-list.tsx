"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";
import { Clock, History, UserCheck, UserMinus, UserPlus } from "lucide-react";
import { FlagList } from "@/components/assign/flags";
import { LoadBar } from "@/components/assign/load-bar";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldError, Label, Textarea } from "@/components/ui/input";
import type { Evaluation } from "@/lib/assignments/rules";
import type { Seat } from "@/lib/assignments/seats";
import { formatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { assignAction, unassignAction } from "../actions";

const LEVELS = ["None", "Learning", "Proficient", "Expert"];

type Props = {
  clientId: number;
  seat: Seat;
  seatName: string;
  current: { id: number; associateId: number; name: string; startDate: string } | null;
  candidates: Evaluation[];
  nextHref: string;
};

export function CandidateList({ clientId, seat, seatName, current, candidates, nextHref }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const eligible = candidates.filter((c) => c.status === "eligible");
  const knockedOut = candidates.filter((c) => c.status === "knocked_out");
  const ineligible = candidates.filter((c) => c.status === "ineligible");

  const doAssign = (associateId: number, overrideNote?: string) =>
    new Promise<string | null>((resolve) =>
      start(async () => {
        const result = await assignAction({ clientId, seat, associateId, overrideNote: overrideNote ?? null });
        if (!result.ok) {
          setError(result.message ?? "Could not assign.");
          resolve(result.message ?? "Could not assign.");
          return;
        }
        setError(null);
        resolve(null);
        router.push(nextHref);
      }),
    );

  return (
    <div className="space-y-6">
      {error && <Alert tone="error">{error}</Alert>}

      {current && (
        <Alert tone="info">
          <span className="font-medium">{current.name}</span> holds the {seatName} seat since {formatDate(current.startDate)}.
          Choosing someone else replaces them.{" "}
          <button
            type="button"
            disabled={pending}
            className="inline-flex items-center gap-1 font-medium underline"
            onClick={() =>
              start(async () => {
                const r = await unassignAction(current.id);
                if (!r.ok) setError(r.message ?? "Could not unassign.");
                router.refresh();
              })
            }
          >
            <UserMinus className="size-3.5" aria-hidden="true" />
            Unassign {current.name}
          </button>
        </Alert>
      )}

      <section aria-labelledby="eligible-heading">
        <h2 id="eligible-heading" className="mb-3 text-sm font-semibold text-rex-950">
          Ranked candidates for {seatName} <span className="font-normal text-ink-muted">({eligible.length})</span>
        </h2>
        {eligible.length === 0 ? (
          <Card>
            <p className="text-sm text-ink-muted">
              Nobody is fully eligible for this seat. Check the knocked-out and ineligible lists below.
            </p>
          </Card>
        ) : (
          <ol className="space-y-3">
            {eligible.map((c, i) => (
              <CandidateCard
                key={c.associateId}
                rank={i + 1}
                c={c}
                isCurrent={current?.associateId === c.associateId}
                action={
                  current?.associateId === c.associateId ? (
                    <Button variant="secondary" disabled>
                      <UserCheck aria-hidden="true" />
                      Assigned
                    </Button>
                  ) : (
                    <Button disabled={pending} onClick={() => doAssign(c.associateId)} aria-label={`Assign ${c.name}`}>
                      <UserPlus aria-hidden="true" />
                      {current ? "Replace with" : "Assign"}
                    </Button>
                  )
                }
              />
            ))}
          </ol>
        )}
      </section>

      {knockedOut.length > 0 && (
        <section aria-labelledby="knocked-heading">
          <h2 id="knocked-heading" className="mb-1 text-sm font-semibold text-rex-950">
            Knocked out by PTO <span className="font-normal text-ink-muted">({knockedOut.length})</span>
          </h2>
          <p className="mb-3 text-xs text-ink-muted">
            PTO near first input rules them out of payroll and hybrid seats. You can still assign them, with a reason on record.
          </p>
          <ol className="space-y-3">
            {knockedOut.map((c) => (
              <CandidateCard
                key={c.associateId}
                c={c}
                muted
                isCurrent={current?.associateId === c.associateId}
                action={
                  current?.associateId === c.associateId ? undefined : (
                    <OverrideButton name={c.name} disabled={pending} onConfirm={(note) => doAssign(c.associateId, note)} />
                  )
                }
              />
            ))}
          </ol>
        </section>
      )}

      {ineligible.length > 0 && (
        <details className="glass p-4">
          <summary className="cursor-pointer text-sm font-semibold text-rex-950 select-none">
            Not eligible ({ineligible.length})
          </summary>
          <ul className="mt-3 divide-y divide-rex-900/6">
            {ineligible.map((c) => (
              <li key={c.associateId} className="flex flex-wrap items-baseline justify-between gap-2 py-2 text-sm">
                <Link href={`/associates/${c.associateId}`} className="font-medium text-rex-950 hover:underline">
                  {c.name}
                </Link>
                <span className="text-xs text-ink-muted">{c.reasons.join(" · ")}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function CandidateCard({
  c,
  rank,
  muted,
  isCurrent,
  action,
}: {
  c: Evaluation;
  rank?: number;
  muted?: boolean;
  isCurrent?: boolean;
  action?: React.ReactNode;
}) {
  return (
    <li className={cn("glass p-5", isCurrent && "ring-2 ring-rex-500", muted && "bg-white/40")} aria-label={c.name}>
      <div className="flex flex-wrap items-start gap-4">
        {rank !== undefined && (
          <span className="tabular grid size-8 shrink-0 place-items-center rounded-xl bg-rex-900 text-sm font-semibold text-white">
            {rank}
          </span>
        )}
        <div className="min-w-0 flex-1 basis-60">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/associates/${c.associateId}`} className="text-base font-semibold text-rex-950 hover:underline">
              {c.name}
            </Link>
            {c.status === "eligible" && (
              <span
                className="tabular rounded-full bg-rex-100 px-2 py-0.5 text-xs font-semibold text-rex-800"
                title="Rules engine score out of 100"
              >
                Score {c.score}
              </span>
            )}
          </div>
          {c.reasons.length > 0 && <p className="mt-1 text-sm font-medium text-red-800">{c.reasons.join(" · ")}</p>}
          <FlagList flags={c.flags} className="mt-2" />
          <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink-muted">
            {c.needs.length > 0 && (
              <div className="flex flex-wrap items-center gap-1">
                <dt className="sr-only">Capability fit</dt>
                {c.needs.map((n) => (
                  <dd
                    key={n.name}
                    className={cn(
                      "rounded-full px-2 py-0.5 ring-1 ring-inset",
                      n.level === 3 ? "bg-rex-800 text-white ring-rex-800"
                      : n.level === 2 ? "bg-rex-100 text-rex-800 ring-rex-300/60"
                      : n.level === 1 ? "bg-white/60 text-ink-muted ring-rex-900/10"
                      : "bg-white/40 text-ink-muted/70 line-through ring-rex-900/10",
                    )}
                    title={`${n.name}: ${LEVELS[n.level]}`}
                  >
                    {n.name}
                  </dd>
                ))}
              </div>
            )}
            {c.timeZoneHours !== null && (
              <div className="flex items-center gap-1">
                <dt><Clock className="size-3.5" aria-label="Time zone" /></dt>
                <dd>{c.timeZoneHours === 0 ? "Same time zone" : `${c.timeZoneHours} h apart`}</dd>
              </div>
            )}
            <div className="flex items-center gap-1">
              <dt><History className="size-3.5" aria-label="Experience" /></dt>
              <dd>{c.experience === 0 ? "No similar accounts yet" : `${c.experience} similar account${c.experience === 1 ? "" : "s"}`}</dd>
            </div>
          </dl>
        </div>
        <div className="w-full sm:w-56">
          <LoadBar before={c.load.projected} after={c.loadAfter} target={c.targetLoad} band={c.bandAfter} />
          <p className="mt-1 text-xs text-ink-muted">
            {c.load.accounts} account{c.load.accounts === 1 ? "" : "s"}
            {c.load.holds > 0 && `, ${c.load.holds} hold${c.load.holds === 1 ? "" : "s"}`}
          </p>
        </div>
        {action && <div className="shrink-0 self-center">{action}</div>}
      </div>
    </li>
  );
}

function OverrideButton({
  name,
  disabled,
  onConfirm,
}: {
  name: string;
  disabled: boolean;
  onConfirm: (note: string) => Promise<string | null>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <Button variant="secondary" disabled={disabled} onClick={() => ref.current?.showModal()} aria-label={`Assign ${name} anyway`}>
        Assign anyway
      </Button>
      <dialog
        ref={ref}
        aria-labelledby={titleId}
        className="glass m-auto w-[min(30rem,calc(100vw-2rem))] bg-white/90 p-0 text-ink backdrop:bg-rex-950/40 backdrop:backdrop-blur-sm"
      >
        <form
          className="space-y-4 p-6"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!note.trim()) {
              setError("Give a short reason for the override.");
              return;
            }
            const problem = await onConfirm(note.trim());
            if (problem) setError(problem);
            else ref.current?.close();
          }}
        >
          <div>
            <h2 id={titleId} className="text-base font-semibold text-rex-950">Assign {name} despite PTO?</h2>
            <p className="mt-1 text-sm text-ink-muted">Their PTO falls near the first input. The reason is saved with the assignment.</p>
          </div>
          <div>
            <Label htmlFor={`${titleId}-note`}>Reason</Label>
            <Textarea
              id={`${titleId}-note`}
              rows={2}
              maxLength={300}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. PTO moved to the following week"
            />
            <FieldError message={error ?? undefined} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => ref.current?.close()}>Cancel</Button>
            <Button type="submit" disabled={disabled}>Assign anyway</Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
