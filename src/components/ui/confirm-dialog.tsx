"use client";

import { useId, useRef, useTransition } from "react";
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
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => ref.current?.close()} disabled={pending}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  await onConfirm();
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
