import html from '../../index.html?raw';
import { fireEvent, render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { en } from './en';
import { LocaleProvider, useI18n } from './LocaleProvider';
import { LOCALE_KEY } from './locales';
import { ru } from './ru';

const root = document.documentElement;

function Probe() {
  const { t, setLocale } = useI18n();
  return (
    <>
      <p>{t('catalog.title')}</p>
      <button type="button" onClick={() => {
          setLocale('ru');
        }}>
        to ru
      </button>
      <button type="button" onClick={() => {
          setLocale('en');
        }}>
        to en
      </button>
    </>
  );
}

function renderProvider() {
  render(
    <StrictMode>
      <LocaleProvider>
        <Probe />
      </LocaleProvider>
    </StrictMode>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  root.lang = '';
  root.dir = '';
  document.title = '';
});

describe('LocaleProvider', () => {
  it('starts in the locale the boot script put on <html lang>', () => {
    root.lang = 'ru';
    renderProvider();
    expect(screen.getByText('Игры')).toBeDefined();
    expect(document.title).toBe(ru.app.title);
  });

  it('setLocale switches texts, lang, dir and document.title, and stores the choice', () => {
    root.lang = 'en';
    renderProvider();
    expect(document.title).toBe(en.app.title);
    fireEvent.click(screen.getByRole('button', { name: 'to ru' }));
    expect(screen.getByText('Игры')).toBeDefined();
    expect(root.lang).toBe('ru');
    expect(root.dir).toBe('ltr');
    expect(document.title).toBe(ru.app.title);
    expect(localStorage.getItem(LOCALE_KEY)).toBe('ru');

    fireEvent.click(screen.getByRole('button', { name: 'to en' }));
    expect(document.title).toBe(en.app.title);
    expect(root.lang).toBe('en');
  });

  it('the static <title> in index.html is the en title (shown before the app mounts)', () => {
    expect(/<title>([^<]*)<\/title>/.exec(html)?.[1]).toBe(en.app.title);
  });
});
