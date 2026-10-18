import { fireEvent, render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocaleProvider } from '../i18n/LocaleProvider';
import { setupUser } from '../test/user';
import { ACCENT_HUE_KEY } from './accent';
import { SettingsMenu } from './SettingsMenu';

const root = document.documentElement;

function renderMenu() {
  render(
    <StrictMode>
      <LocaleProvider>
        <button type="button">Before</button>
        <SettingsMenu />
        <button type="button">Outside</button>
        <p>Plain text</p>
      </LocaleProvider>
    </StrictMode>,
  );
}

const toggle = () => screen.getByRole('button', { name: 'Settings' });
const slider = () => screen.getByRole<HTMLInputElement>('slider', { name: 'Accent hue' });
const panel = () => screen.queryByRole('region', { name: 'Settings' });
const language = () => screen.getByRole<HTMLSelectElement>('combobox', { name: 'Language' });

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
  root.removeAttribute('style');
  root.lang = '';
  root.dir = '';
});

describe('SettingsMenu', () => {
  it('is a disclosure: opening focuses the first control', async () => {
    const user = setupUser();
    renderMenu();
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    expect(panel()).toBeNull(); // hidden
    await user.click(toggle());
    expect(toggle().getAttribute('aria-expanded')).toBe('true');
    expect(panel()).not.toBeNull();
    expect(document.activeElement).toBe(language()); // focus order: Language → hue slider → Reset
  });

  it('Esc closes it and returns focus to the toggle', async () => {
    const user = setupUser();
    renderMenu();
    await user.click(toggle());
    await user.keyboard('{Escape}');
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(toggle());
  });

  it('a click outside on something focusable closes it and leaves focus there', async () => {
    const user = setupUser();
    renderMenu();
    await user.click(toggle());
    await user.click(screen.getByRole('button', { name: 'Outside' }));
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Outside' }));
  });

  it('a click outside on plain text closes it and returns focus to the toggle', async () => {
    const user = setupUser();
    renderMenu();
    await user.click(toggle());
    // From the slider: user-event (unlike Chromium) leaves a focused select element focused on mousedown elsewhere.
    // The select case runs in real Chromium: tests/e2e/accent.spec.ts.
    await user.tab();
    await user.click(screen.getByText('Plain text'));
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(toggle());
  });

  it('focus leaving it (Tab past the last control) closes it', async () => {
    const user = setupUser();
    renderMenu();
    await user.click(toggle());
    await user.tab(); // Language → slider
    expect(document.activeElement).toBe(slider());
    await user.tab(); // slider → Reset
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Reset accent' }));
    expect(toggle().getAttribute('aria-expanded')).toBe('true');
    await user.tab(); // Reset → Outside
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Outside' }));
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
  });

  it('Shift+Tab from the first control to the toggle keeps it open', async () => {
    const user = setupUser();
    renderMenu();
    await user.click(toggle());
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(toggle());
    expect(toggle().getAttribute('aria-expanded')).toBe('true');
  });

  it('the slider shows the stored hue, sets --accent-h and stores it; aria-valuetext has the degrees', async () => {
    localStorage.setItem(ACCENT_HUE_KEY, '120');
    const user = setupUser();
    renderMenu();
    await user.click(toggle());
    expect(slider().value).toBe('120');
    expect(slider().getAttribute('aria-valuetext')).toBe('120°');
    fireEvent.change(slider(), { target: { value: '45' } });
    expect(root.style.getPropertyValue('--accent-h')).toBe('45');
    expect(localStorage.getItem(ACCENT_HUE_KEY)).toBe('45');
    expect(slider().getAttribute('aria-valuetext')).toBe('45°');
    // Arrow keys on the range input: tests/e2e/accent.spec.ts (user-event does not move jsdom ranges).
  });

  it('Reset restores the default hue and forgets the choice', async () => {
    const user = setupUser();
    renderMenu();
    await user.click(toggle());
    fireEvent.change(slider(), { target: { value: '10' } });
    await user.click(screen.getByRole('button', { name: 'Reset accent' }));
    expect(root.style.getPropertyValue('--accent-h')).toBe('');
    expect(localStorage.getItem(ACCENT_HUE_KEY)).toBeNull();
    expect(slider().value).toBe('292');
    expect(toggle().getAttribute('aria-expanded')).toBe('true');
  });

  it('Language options are labelled in their own language, each with its lang', async () => {
    const user = setupUser();
    renderMenu();
    await user.click(toggle());
    const options = [...language().options].map((o) => [o.value, o.textContent, o.lang]);
    expect(options).toEqual([
      ['en', 'English', 'en'],
      ['ru', 'Русский', 'ru'],
    ]);
  });

  it('choosing Русский switches the UI, lang and the stored choice; the panel stays open on the select', async () => {
    const user = setupUser();
    renderMenu();
    await user.click(toggle());
    await user.selectOptions(language(), 'ru');
    expect(root.lang).toBe('ru');
    expect(localStorage.getItem('lobby.locale')).toBe('ru');
    const select = screen.getByRole<HTMLSelectElement>('combobox', { name: 'Язык' });
    expect(document.activeElement).toBe(select);
    expect(screen.getByRole('slider', { name: 'Оттенок акцента' })).toBeDefined();
    expect([...select.options].map((o) => o.textContent)).toEqual(['English', 'Русский']);
    await user.selectOptions(select, 'en');
    expect(root.lang).toBe('en');
  });
});
