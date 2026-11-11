"use client";

import { useRouter } from "next/navigation";

/**
 * Makes a whole table row open a page, without the "stretched link" overlay trick: an
 * absolutely positioned overlay inside a <tr> escapes the row in browsers that don't treat
 * table rows as positioning containers (Safari), so every row's overlay covers the whole
 * table and clicks land on the last row. The row's main cell keeps a real <Link> for
 * keyboard and screen-reader users; this only adds mouse clicks anywhere else on the row.
 */
export function useRowLink() {
  const router = useRouter();
  return (href: string) => {
    const open = (e: React.MouseEvent, newTab: boolean) => {
      // Let links, buttons and form controls inside the row do their own thing.
      if ((e.target as HTMLElement).closest("a, button, input, select, textarea, label, summary")) return;
      // Don't navigate when the click ends a text selection.
      if (window.getSelection()?.toString()) return;
      if (newTab) window.open(href, "_blank", "noopener");
      else router.push(href);
    };
    return {
      onClick: (e: React.MouseEvent) => open(e, e.metaKey || e.ctrlKey),
      onAuxClick: (e: React.MouseEvent) => e.button === 1 && open(e, true),
    };
  };
}
