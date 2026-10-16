import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from './App';
import { THEME_KEY } from './theme';

afterEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});

describe('App shell', () => {
  it('renders header, main and the feed panel', () => {
    render(<App />);
    expect(screen.getByRole('banner')).toBeDefined();
    expect(screen.getByRole('main')).toBeDefined();
    expect(screen.getByRole('heading', { level: 1, name: 'Games' })).toBeDefined();
    expect(screen.getByRole('complementary', { name: 'Live wins' })).toBeDefined();
  });

  it('hides the language switcher while only one locale exists', () => {
    render(<App />);
    expect(screen.queryByRole('combobox', { name: 'Language' })).toBeNull();
  });

  it('theme toggle flips aria-pressed, data-theme and persists the choice', async () => {
    document.documentElement.dataset.theme = 'light';
    render(<App />);
    const toggle = screen.getByRole('button', { name: 'Dark theme' });
    expect(toggle.getAttribute('aria-pressed')).toBe('false');

    await userEvent.click(toggle);
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem(THEME_KEY)).toBe('dark');
  });

  it('feed toggle is a disclosure with aria-expanded', async () => {
    render(<App />);
    const toggle = screen.getByRole('button', { name: 'Show live wins' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    await userEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(toggle.textContent).toBe('Hide live wins');
  });
});
