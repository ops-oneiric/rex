import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("glass p-6", className)} {...props} />;
}

export function CardHeader({
  title,
  description,
  icon,
  action,
}: {
  title: string;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex items-start gap-3">
      {icon && (
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-rex-100 text-rex-800 [&_svg]:size-[18px]">
          {icon}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <h2 className="text-base font-semibold text-rex-950">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-ink-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
