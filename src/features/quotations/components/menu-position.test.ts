import { describe, expect, it } from 'vitest';
import { menuPosition } from './menu-position';

describe('quotation menu placement', () => {
  it('stays inside viewport at left, right, and bottom edges', () => {
    const view = { width: 320, height: 500 }, menu = { width: 210, height: 190 };
    for (const anchor of [{ top: 50, bottom: 90, right: 70 }, { top: 50, bottom: 90, right: 315 }, { top: 460, bottom: 490, right: 310 }]) {
      const { left, top } = menuPosition(anchor, menu, view);
      expect(left).toBeGreaterThanOrEqual(12);
      expect(left + menu.width).toBeLessThanOrEqual(view.width - 12);
      expect(top).toBeGreaterThanOrEqual(12);
      expect(top + menu.height).toBeLessThanOrEqual(view.height - 12);
    }
  });
});
