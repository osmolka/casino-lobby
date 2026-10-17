import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function axe(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`axe, ${scheme}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('/');
      await expect(page.locator('main [aria-busy="true"]')).toHaveCount(0);
      await expect(page.getByRole('button', { name: /^Balance:/ })).toBeVisible();
    });

    test('feed panel filled (desktop: always expanded)', async ({ page }) => {
      await expect(page.getByRole('list', { name: 'Recent wins' }).getByRole('listitem')).not.toHaveCount(0);
      expect(await axe(page)).toEqual([]);
    });

    test('feed panel filled, mobile: collapsed and expanded', async ({ page }) => {
      await page.setViewportSize({ width: 360, height: 740 });
      const toggle = page.getByRole('button', { name: 'Show live wins' });
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      expect(await axe(page), 'collapsed').toEqual([]);

      await toggle.click();
      await expect(page.getByRole('list', { name: 'Recent wins' }).getByRole('listitem')).not.toHaveCount(0);
      expect(await axe(page), 'expanded').toEqual([]);
    });

    test('promo Prev/Next: at the start and after Next', async ({ page }) => {
      const promos = page.getByRole('region', { name: 'Promotions' });
      await expect(promos.getByRole('button', { name: 'Previous promotions' })).toHaveAttribute('aria-disabled', 'true');
      expect(await axe(page), 'start').toEqual([]);
      await promos.getByRole('button', { name: 'Next promotions' }).click();
      await expect(promos.getByRole('button', { name: 'Previous promotions' })).not.toHaveAttribute('aria-disabled');
      expect(await axe(page), 'after Next').toEqual([]);
    });

    test('lobby with the wallet panel expanded', async ({ page }) => {
      await page.getByRole('button', { name: /^Balance:/ }).click();
      await expect(page.getByRole('region', { name: 'Wallet' })).toBeVisible();
      expect(await axe(page)).toEqual([]);
    });

    test('command palette: default list, matches with an active option, no results', async ({ page }) => {
      await page.keyboard.press('Control+k');
      const palette = page.getByRole('dialog', { name: 'Search and commands' });
      await expect(palette.getByRole('option').first()).toBeVisible();
      expect(await axe(page), 'default list').toEqual([]);

      await page.keyboard.type('ro');
      await page.keyboard.press('ArrowDown');
      await expect(palette.locator('mark').first()).toBeVisible();
      expect(await axe(page), 'matches').toEqual([]);

      await page.keyboard.type('qqq');
      await expect(palette.getByRole('option')).toHaveCount(0);
      expect(await axe(page), 'no results').toEqual([]);
    });

    test('deposit dialog: preview, validation error, failure alert', async ({ page }) => {
      await page.getByRole('banner').getByRole('button', { name: 'Deposit', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Deposit' });
      await dialog.getByLabel('Currency').selectOption('USD');
      await dialog.getByLabel('Amount').fill('10.90');
      expect(await axe(page), 'preview').toEqual([]);

      await dialog.getByLabel('Amount').fill('abc');
      await dialog.getByRole('button', { name: 'Confirm deposit' }).click();
      await expect(dialog.getByText('Enter a number')).toBeVisible();
      expect(await axe(page), 'validation error').toEqual([]);

      await dialog.getByLabel('Amount').fill('19');
      await dialog.getByRole('button', { name: 'Confirm deposit' }).click();
      await expect(dialog.getByRole('alert')).toBeVisible();
      expect(await axe(page), 'failure alert').toEqual([]);
    });
  });
}

for (const scheme of ['light', 'dark'] as const) {
  test(`axe, ${scheme}: promos loading, error and empty`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    const promos = page.getByRole('region', { name: 'Promotions' });

    await page.goto('/?mock=slow');
    await expect(promos.locator('[aria-busy="true"]')).toBeVisible();
    expect(await axe(page), 'loading').toEqual([]);

    await page.goto('/?mock=fail-promos');
    await expect(promos.getByRole('alert')).toBeVisible();
    expect(await axe(page), 'error').toEqual([]);

    await page.goto('/?mock=empty-promos');
    await expect(promos.getByRole('heading', { name: 'No promotions right now' })).toBeVisible();
    expect(await axe(page), 'empty').toEqual([]);
  });
}
