import { test, expect } from '@playwright/test';

test.describe('showcase homepage', () => {
  test('loads and renders the hero and nav', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/ngx-streaming-player/i);
    // First navigation against a cold Angular dev server can take a while to
    // bundle/serve — give this one assertion more room than the default 5s.
    await expect(page.locator('.top-nav')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('app-hero')).toBeVisible();
  });

  test('renders the live demo player', async ({ page }) => {
    await page.goto('/#demo');
    const demoSection = page.locator('#demo');
    await expect(demoSection).toBeVisible();
    await expect(demoSection.locator('ngx-sp-player')).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('playground', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#playground');
    await page.locator('#playground').scrollIntoViewIfNeeded();
  });

  // Scoped to .preset-row: the page also has per-format example buttons
  // elsewhere (.source-btn) whose accessible names overlap with these presets.
  const presetButton = (page: import('@playwright/test').Page, name: RegExp) =>
    page.locator('.preset-row').getByRole('button', { name });

  test('adding the HLS preset renders a player card', async ({ page }) => {
    await presetButton(page, /HLS Live/i).click();
    const card = page.locator('.player-card').first();
    await expect(card).toBeVisible();
    await expect(card.locator('.player-card__url')).toContainText('.m3u8');
  });

  test('adding the DASH preset renders a player card', async ({ page }) => {
    await presetButton(page, /DASH VOD/i).click();
    const card = page.locator('.player-card').first();
    await expect(card).toBeVisible();
    await expect(card.locator('.player-card__url')).toContainText('.mpd');
  });

  test('adding the MP4 preset renders a player card', async ({ page }) => {
    await presetButton(page, /MP4 Video/i).click();
    const card = page.locator('.player-card').first();
    await expect(card).toBeVisible();
    await expect(card.locator('.player-card__url')).toContainText('.mp4');
  });

  test('clear all removes every player card', async ({ page }) => {
    await presetButton(page, /MP4 Video/i).click();
    await expect(page.locator('.player-card')).toHaveCount(1);

    await page.getByRole('button', { name: /Clear all/i }).click();
    await expect(page.locator('.player-card')).toHaveCount(0);
  });
});
