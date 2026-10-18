import AxeBuilder from '@axe-core/playwright';
import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures';

/** Every test starts in ru through the stored choice, the way a returning visitor would. */
async function openRu(page: Page, path = '/') {
  await page.addInitScript(() => {
    localStorage.setItem('lobby.locale', 'ru');
  });
  await page.goto(path);
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Баланс:/ })).toBeVisible();
}

/**
 * Layout problems inside a region: horizontal page scroll, a box whose text overflows it (clipped or spilling),
 * a control outside the viewport, a control smaller than 24×24, a select narrower than its longest option.
 */
function layoutProblems(region: Locator) {
  return region.evaluate((root) => {
    const problems: string[] = [];
    const viewport = document.documentElement.clientWidth;
    if (document.documentElement.scrollWidth > viewport) problems.push(`page scrolls: ${document.documentElement.scrollWidth}px`);
    const label = (el: Element) => `${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') ?? el.textContent).trim().slice(0, 30)}"`;
    const boxes = root.querySelectorAll<HTMLElement>('button, a, label, select, input, h1, h2, h3, p, dt, dd, li, legend');
    /** Inside a horizontal scroller (the promo track) a box may sit off-screen by design. */
    const inScroller = (el: Element) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        if (/auto|scroll/.test(getComputedStyle(p).overflowX)) return true;
      }
      return false;
    };
    for (const el of boxes) {
      if (el.offsetParent === null || el.closest('[hidden]')) continue;
      if (el.clientWidth <= 1 && el.clientHeight <= 1) continue; // visually hidden text (still named)
      const style = getComputedStyle(el);
      if (style.display.startsWith('inline') && !style.display.includes('block') && !style.display.includes('flex') && !style.display.includes('grid')) continue;
      const r = el.getBoundingClientRect();
      if (el.scrollWidth > el.clientWidth + 1) problems.push(`${label(el)} overflows: ${el.scrollWidth} > ${el.clientWidth}`);
      if ((r.left < -0.5 || r.right > viewport + 0.5) && !inScroller(el)) problems.push(`${label(el)} outside the viewport: ${Math.round(r.left)}–${Math.round(r.right)}`);
      const control = el.matches('button, a, select, input:not([type="checkbox"])') ? el : null;
      if (control && (r.width < 24 || r.height < 24)) problems.push(`${label(el)} target ${Math.round(r.width)}×${Math.round(r.height)}`);
      if (el instanceof HTMLSelectElement) {
        const ctx = document.createElement('canvas').getContext('2d');
        if (ctx) {
          ctx.font = style.font;
          const widest = Math.max(...[...el.options].map((o) => ctx.measureText(o.text).width));
          const content = el.clientWidth - Number.parseFloat(style.paddingInlineStart) - Number.parseFloat(style.paddingInlineEnd);
          if (widest > content + 0.5) problems.push(`${label(el)} longest option ${Math.round(widest)} > ${Math.round(content)}`);
        }
      }
    }
    return problems;
  });
}

test('switching to Русский in Settings: texts, lang and title; a reload keeps it, applied before render', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Games' })).toBeVisible();
  await page.getByRole('banner').getByRole('button', { name: 'Settings' }).click();
  const select = page.getByRole('combobox', { name: 'Language' });
  await expect(select).toBeFocused();
  await expect(select.locator('option')).toHaveText(['English', 'Русский']);
  await expect(select.locator('option[value="en"]')).toHaveAttribute('lang', 'en');
  await select.selectOption('ru');

  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await expect(page.getByRole('heading', { level: 1, name: 'Игры' })).toBeVisible();
  await expect(page).toHaveTitle('Lucky Lobby — игры казино');
  await expect(page.getByRole('combobox', { name: 'Язык' })).toBeFocused();

  // The boot script sets lang before any stylesheet is inserted (no English flash for screen readers or CSS).
  await page.addInitScript(() => {
    const w = window as { firstLang?: string };
    const observer = new MutationObserver(() => {
      if (!document.querySelector('link[rel="stylesheet"], style')) return;
      w.firstLang = document.documentElement.lang;
      observer.disconnect();
    });
    observer.observe(document, { childList: true, subtree: true });
  });
  await page.reload();
  expect(await page.evaluate(() => (window as { firstLang?: string }).firstLang)).toBe('ru');
  await expect(page.getByRole('heading', { level: 1, name: 'Игры' })).toBeVisible();
  await expect(page).toHaveTitle('Lucky Lobby — игры казино');
});

test('the catalog count uses the Russian plural for its number', async ({ page }) => {
  await openRu(page);
  const count = page.getByRole('main').getByRole('status').filter({ hasText: /^\d+ игр/ });
  const text = (await count.textContent()) ?? '';
  const n = Number(/^\d+/.exec(text)?.[0]);
  const forms: Partial<Record<Intl.LDMLPluralRule, string>> = { one: 'игра', few: 'игры', many: 'игр', other: 'игры' };
  const form = forms[new Intl.PluralRules('ru').select(n)];
  expect(text).toBe(`${n} ${form}`);
});

test.describe('ru, 360px phone', () => {
  test.use({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });

  test('filters expanded (chips, providers, tags, sort, Clear): nothing clipped, targets ≥ 24×24', async ({ page }) => {
    await openRu(page, '/?cat=live');
    await page.getByRole('button', { name: /^Фильтры/ }).click();
    const filters = page.getByRole('group', { name: 'Категория' });
    await expect(filters.getByRole('button', { name: 'Настольные игры' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Сбросить фильтры' }).first()).toBeVisible();
    expect(await layoutProblems(page.locator('main'))).toEqual([]);
    expect(await layoutProblems(page.getByRole('banner'))).toEqual([]);
  });

  test('deposit dialog with a preview and a validation message: fits, nothing clipped', async ({ page }) => {
    await openRu(page);
    await page.getByRole('banner').getByRole('button', { name: 'Пополнить', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Пополнение' });
    await dialog.getByLabel('Сумма').fill('10,90');
    await dialog.getByLabel('Валюта').selectOption('GBP');
    await expect(dialog.getByText('Вы вносите')).toBeVisible();
    expect(await layoutProblems(dialog)).toEqual([]);
    await dialog.getByLabel('Сумма').fill('0,001');
    await dialog.getByRole('button', { name: 'Подтвердить пополнение' }).click(); // messages show after a submit
    await expect(dialog.getByText('Не больше двух знаков после запятой.')).toBeVisible();
    expect(await layoutProblems(dialog)).toEqual([]);
  });

  test('settings panel and command palette: nothing clipped', async ({ page }) => {
    await openRu(page);
    await page.getByRole('banner').getByRole('button', { name: 'Настройки' }).click();
    const panel = page.getByRole('region', { name: 'Настройки' });
    await expect(panel.getByRole('button', { name: 'Сбросить оттенок' })).toBeVisible();
    expect(await layoutProblems(panel)).toEqual([]);
    await page.keyboard.press('Escape');

    await page.getByRole('banner').getByRole('button', { name: 'Поиск' }).click();
    const palette = page.getByRole('dialog', { name: 'Поиск и команды' });
    await palette.getByRole('combobox').fill('смен');
    await expect(palette.getByRole('option', { name: 'Сменить язык на English' })).toBeVisible();
    expect(await layoutProblems(palette)).toEqual([]);
  });
});

for (const scheme of ['light', 'dark'] as const) {
  test(`${scheme}: axe in ru (lobby, then the deposit dialog)`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    await openRu(page);
    const axe = async () =>
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations.map(
        (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
      );
    expect(await axe(), 'lobby').toEqual([]);
    await page.getByRole('banner').getByRole('button', { name: 'Пополнить', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Пополнение' })).toBeVisible();
    expect(await axe(), 'deposit dialog').toEqual([]);
  });
}
