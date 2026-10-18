import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { contrast, fallbackRules, rgbOf, samplePixels, type Rgb } from './color';
import { expect, test } from './fixtures';

const ROLES = ['--accent', '--accent-hover', '--accent-active', '--neutral-hover', '--neutral-active'] as const;
type Role = (typeof ROLES)[number];
const HUES = Array.from({ length: 360 }, (_, h) => h);
/** Per hue: one 4×4 px swatch per role in a row (20×4 px); 30 hues per line. */
const CELL = 4;
const PER_LINE = 30;
const SENTINEL = '123.456';

async function ready(page: Page) {
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Balance:/ })).toBeVisible();
}

/**
 * Paints every accent role at every hue and reads the rendered pixels, i.e. after the browser's gamut mapping.
 * The role values are the computed tokens of <html> with a sentinel hue (var() already substituted, @supports
 * branch already chosen); each hue's row re-declares them with its own hue, so the browser resolves them itself.
 */
async function renderedAccents(page: Page): Promise<Record<Role, Rgb>[]> {
  const ok = await page.evaluate(
    ({ roles, sentinel, cell, perLine }) => {
      const root = document.documentElement;
      root.style.setProperty('--accent-h', sentinel);
      const values = roles.map((role) => [role, getComputedStyle(root).getPropertyValue(role).trim()] as const);
      root.style.removeProperty('--accent-h');
      if (!values.every(([, v]) => v.includes(sentinel))) return values.map(([r, v]) => `${r}: ${v}`).join('; ');

      const strip = document.createElement('div');
      strip.dataset.testid = 'accent-strip';
      strip.style.cssText = `position:fixed;inset-block-start:0;inset-inline-start:0;z-index:2147483647;display:grid;grid-template-columns:repeat(${perLine},${cell * roles.length}px);direction:ltr`;
      for (let h = 0; h < 360; h++) {
        const row = document.createElement('div');
        row.style.cssText = `display:flex;${values.map(([role, v]) => `${role}:${v.replaceAll(sentinel, String(h))}`).join(';')}`;
        for (const role of roles) {
          const swatch = document.createElement('div');
          swatch.style.cssText = `inline-size:${cell}px;block-size:${cell}px;background:var(${role})`;
          row.append(swatch);
        }
        strip.append(row);
      }
      document.body.append(strip);
      return 'ok';
    },
    { roles: [...ROLES], sentinel: SENTINEL, cell: CELL, perLine: PER_LINE },
  );
  expect(ok, 'every accent role depends on --accent-h').toBe('ok');

  const strip = page.getByTestId('accent-strip');
  const points = HUES.flatMap((h) =>
    ROLES.map((_, i): [number, number] => [(h % PER_LINE) * CELL * ROLES.length + i * CELL + CELL / 2, Math.floor(h / PER_LINE) * CELL + CELL / 2]),
  );
  const pixels = await samplePixels(page, strip, points);
  await strip.evaluate((el) => {
    el.remove();
  });
  return HUES.map((h) => Object.fromEntries(ROLES.map((role, i) => [role, pixels[h * ROLES.length + i] ?? [0, 0, 0]])) as Record<Role, Rgb>);
}

async function fixedTokens(page: Page) {
  return page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    const get = (name: string) => cs.getPropertyValue(name).trim();
    return { bg: get('--bg'), surface: get('--surface'), fg: get('--fg'), fgMuted: get('--fg-muted'), accentFg: get('--accent-fg') };
  });
}

/** `pair@hue ratio` for every rendered pair below its minimum. */
function failures(rendered: Record<Role, Rgb>[], t: Awaited<ReturnType<typeof fixedTokens>>): string[] {
  const [bg, surface, fg, fgMuted, accentFg] = [rgbOf(t.bg), rgbOf(t.surface), rgbOf(t.fg), rgbOf(t.fgMuted), rgbOf(t.accentFg)];
  return rendered.flatMap((c, h) => {
    const pairs: [string, Rgb, Rgb, number][] = [
      ['accent-fg on accent', accentFg, c['--accent'], 4.5],
      ['accent-fg on accent-hover', accentFg, c['--accent-hover'], 4.5],
      ['accent-fg on accent-active', accentFg, c['--accent-active'], 4.5],
      ['accent on bg', c['--accent'], bg, 4.5],
      ['accent on surface', c['--accent'], surface, 4.5],
      ['accent on neutral-hover', c['--accent'], c['--neutral-hover'], 4.5],
      ['accent on neutral-active', c['--accent'], c['--neutral-active'], 4.5],
      ['fg on neutral-hover', fg, c['--neutral-hover'], 4.5],
      ['fg on neutral-active', fg, c['--neutral-active'], 4.5],
      ['fg-muted on neutral-hover', fgMuted, c['--neutral-hover'], 4.5],
      ['fg-muted on neutral-active', fgMuted, c['--neutral-active'], 4.5],
      ['chip accent vs neutral-hover', c['--accent'], c['--neutral-hover'], 3],
      ['chip accent-hover vs neutral-hover', c['--accent-hover'], c['--neutral-hover'], 3],
      ['chip accent-active vs neutral-active', c['--accent-active'], c['--neutral-active'], 3],
    ];
    return pairs.flatMap(([name, a, b, min]) => {
      const r = contrast(a, b);
      return r >= min ? [] : [`${name}@${h}: ${r.toFixed(2)}`];
    });
  });
}

for (const scheme of ['light', 'dark'] as const) {
  test(`${scheme}: every hue 0–359, rendered pixels (native and without oklch(from …)): text ≥ 4.5:1, chips ≥ 3:1`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    await page.goto('/');
    await ready(page);
    const tokens = await fixedTokens(page);

    const native = await renderedAccents(page);
    // The hue really varies: hue 0 and hue 180 render differently.
    expect(native[0]?.['--accent']).not.toEqual(native[180]?.['--accent']);
    expect(failures(native, tokens), 'native').toEqual([]);

    await page.addStyleTag({ content: fallbackRules('color: oklch(from') });
    expect(failures(await renderedAccents(page), tokens), 'no oklch(from …)').toEqual([]);
  });
}

const settings = (page: Page) => page.getByRole('banner').getByRole('button', { name: 'Settings' });
const slider = (page: Page) => page.getByRole('slider', { name: 'Accent hue' });
const languageSelect = (page: Page) => page.getByRole('combobox', { name: 'Language' });
const hueVar = (page: Page) => page.evaluate(() => document.documentElement.style.getPropertyValue('--accent-h'));
const depositBg = (page: Page) =>
  page.getByRole('banner').getByRole('button', { name: 'Deposit', exact: true }).evaluate((el) => getComputedStyle(el).backgroundColor);

test('slider by keyboard recolors the accent, persists across a reload (applied before render), Reset restores', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  const before = await depositBg(page);

  await settings(page).click();
  await expect(languageSelect(page)).toBeFocused(); // focus order: Language → hue slider → Reset
  await page.keyboard.press('Tab');
  await expect(slider(page)).toBeFocused();
  await expect(slider(page)).toHaveAttribute('aria-valuetext', '292°');
  await page.keyboard.press('ArrowRight');
  expect(await hueVar(page)).toBe('293');
  await page.keyboard.press('Home');
  await expect(slider(page)).toHaveAttribute('aria-valuetext', '0°');
  expect(await hueVar(page)).toBe('0');
  await page.keyboard.press('End');
  expect(await hueVar(page)).toBe('359');
  expect(await depositBg(page)).not.toBe(before);
  const recolored = await depositBg(page);

  // The boot script sets --accent-h before any stylesheet is inserted: the first paint already has the hue.
  await page.addInitScript(() => {
    const w = window as { firstHue?: string };
    const observer = new MutationObserver(() => {
      if (!document.querySelector('link[rel="stylesheet"], style')) return;
      w.firstHue = document.documentElement.style.getPropertyValue('--accent-h');
      observer.disconnect();
    });
    observer.observe(document, { childList: true, subtree: true });
  });
  await page.reload();
  await ready(page);
  expect(await page.evaluate(() => (window as { firstHue?: string }).firstHue)).toBe('359');
  expect(await depositBg(page)).toBe(recolored);

  await settings(page).click();
  await expect(slider(page)).toHaveValue('359');
  await page.getByRole('button', { name: 'Reset accent' }).click();
  expect(await hueVar(page)).toBe('');
  expect(await depositBg(page)).toBe(before);
  await expect(slider(page)).toHaveValue('292');
});

test('settings panel: Esc and a click on empty header space return focus to the toggle; Tab out closes it', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  const panel = page.getByRole('region', { name: 'Settings' });

  await settings(page).click();
  await expect(panel).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(settings(page)).toBeFocused();

  await page.keyboard.press('Enter');
  await expect(languageSelect(page)).toBeFocused();
  // Empty header space: nothing focusable there (text in <main> would focus <main tabindex=-1> instead).
  const header = await page.getByRole('banner').boundingBox();
  await page.mouse.click((header?.width ?? 0) / 2, (header?.y ?? 0) + 4);
  await expect(panel).toBeHidden();
  await expect(settings(page)).toBeFocused();

  await page.keyboard.press('Enter');
  await expect(languageSelect(page)).toBeFocused();
  await page.keyboard.press('Tab'); // Language → slider
  await expect(slider(page)).toBeFocused();
  await page.keyboard.press('Tab'); // slider → Reset
  await expect(page.getByRole('button', { name: 'Reset accent' })).toBeFocused();
  await page.keyboard.press('Tab'); // leaves the panel
  await expect(panel).toBeHidden();
  await expect(settings(page)).toHaveAttribute('aria-expanded', 'false');
});

const AXE_HUES = [0, 60, 120, 180, 240, 300];

for (const scheme of ['light', 'dark'] as const) {
  test(`${scheme}: axe at hues ${AXE_HUES.join(', ')} (settings panel open)`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    await page.goto('/');
    await ready(page);
    await settings(page).click();
    await expect(languageSelect(page)).toBeFocused();
    const results: string[] = [];
    for (const hue of AXE_HUES) {
      await page.evaluate((h) => {
        document.documentElement.style.setProperty('--accent-h', String(h));
      }, hue);
      const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
      results.push(...violations.map((v) => `hue ${hue} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`));
    }
    expect(results).toEqual([]);
  });
}
