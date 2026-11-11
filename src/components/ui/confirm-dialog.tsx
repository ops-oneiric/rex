"use client";

import { useId, useRef, useState, useTransition } from "react";
import { AlertTriangle } from "lucide-react";
import { Button, type ButtonProps } from "./button";

/**
 * A button that opens a confirmation dialog before running a server action.
 * Uses the native <dialog> element, so focus trapping and Escape work out of the box.
 */
export function ConfirmDialog({
  trigger,
  triggerVariant = "danger",
  triggerSize = "md",
  title,
  description,
  confirmLabel,
  onConfirm,
}: {
  trigger: React.ReactNode;
  triggerVariant?: ButtonProps["variant"];
  triggerSize?: ButtonProps["size"];
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => Promise<unknown>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  return (
    <>
      <Button variant={triggerVariant} size={triggerSize} onClick={() => ref.current?.showModal()}>
        {trigger}
      </Button>
      <dialog
        ref={ref}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="glass m-auto w-[min(28rem,calc(100vw-2rem))] bg-white/90 p-0 text-ink backdrop:bg-rex-950/40 backdrop:backdrop-blur-sm"
        onClick={(e) => {
          if (e.target === ref.current) ref.current?.close();
        }}
      >
        <div className="p-6">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-red-50 text-red-700">
              <AlertTriangle className="size-[18px]" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 id={titleId} className="text-base font-semibold text-rex-950">
                {title}
              </h2>
              <div id={descriptionId} className="mt-1 text-sm text-ink-muted">
                {description}
              </div>
            </div>
          </div>
          {error && (
            <p role="alert" className="mt-4 rounded-xl bg-red-50/80 px-3.5 py-3 text-sm text-red-900 ring-1 ring-red-600/20 ring-inset">
              {error}
            </p>
          )}
          <div className="mt-6 flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setError(null);
                ref.current?.close();
              }}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const result = await onConfirm();
                  // Actions may refuse with { ok: false, message }: keep the dialog open and say why.
                  if (result && typeof result === "object" && "ok" in result && result.ok === false) {
                    setError(String((result as { message?: string }).message ?? "That could not be done."));
                    return;
                  }
                  setError(null);
                  ref.current?.close();
                })
              }
            >
              {pending ? "Working..." : confirmLabel}
            </Button>
          </div>
        </div>
      </dialog>
    </>
  );
}
