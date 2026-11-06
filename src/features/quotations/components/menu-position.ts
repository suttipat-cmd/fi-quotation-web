export function menuPosition(anchor: { top: number; bottom: number; right: number }, menu: { width: number; height: number }, viewport: { width: number; height: number }) {
  const margin = 12;
  const left = Math.max(margin, Math.min(anchor.right - menu.width, viewport.width - menu.width - margin));
  const below = anchor.bottom + 8;
  const top = below + menu.height > viewport.height - margin
    ? Math.max(margin, anchor.top - menu.height - 8)
    : below;
  return { left, top: Math.max(margin, Math.min(top, viewport.height - menu.height - margin)) };
}
