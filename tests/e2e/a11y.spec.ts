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

    test('lobby with the wallet panel expanded', async ({ page }) => {
      await page.getByRole('button', { name: /^Balance:/ }).click();
      await expect(page.getByRole('region', { name: 'Wallet' })).toBeVisible();
      expect(await axe(page)).toEqual([]);
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
