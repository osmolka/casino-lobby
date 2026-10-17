import { Fragment, useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useTheme } from '../../app/ThemeProvider';
import { useI18n } from '../../i18n/LocaleProvider';
import { LOCALES, isLocaleCode } from '../../i18n/locales';
import { Dialog } from '../../shared/Dialog';
import { CloseIcon, SearchIcon } from '../../shared/icons';
import { Skeleton } from '../../shared/Skeleton';
import { useCatalogContext } from '../catalog/CatalogProvider';
import { DEFAULT_FILTERS, sortGames } from '../catalog/filters';
import { providerOptions } from '../catalog/labels';
import { filtersEqual } from '../catalog/urlState';
import { useWallet } from '../wallet/WalletProvider';
import { markRanges } from './fuzzy';
import { isPaletteHotkey } from './hotkey';
import { buildResults, type PaletteItem } from './results';
import styles from './CommandPalette.module.css';

const LOCALE_LIST = Object.values(LOCALES);
const IS_MAC = /Mac|iPhone|iPad/.test(navigator.userAgent);

/**
 * Header trigger + Ctrl/Cmd+K + the palette dialog. Open state and query live here only:
 * typing in the palette never re-renders the catalog. Selection closes the palette first
 * (Dialog returns focus to the trigger), then the chosen action runs in the same commit.
 */
export function CommandPalette() {
  const { t, setLocale } = useI18n();
  const { showGame, showProvider, clearFilters } = useCatalogContext();
  const { toggle } = useTheme();
  const { openDeposit } = useWallet();
  const [open, setOpen] = useState(false);
  const openRef = useRef(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (!isPaletteHotkey(event)) return;
      event.preventDefault();
      if (openRef.current) setOpen(false);
      // Never stack modals: the hotkey does nothing while another dialog (deposit) is open.
      else if (!document.querySelector('dialog[open]')) setOpen(true);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const close = useCallback(() => {
    setOpen(false);
  }, []);
  const fallbackFocus = useCallback(() => triggerRef.current, []);

  const select = useCallback(
    (item: PaletteItem) => {
      setOpen(false);
      if (item.kind === 'game') showGame(item.game);
      else if (item.kind === 'provider') showProvider(item.id);
      else if (item.id === 'theme') toggle();
      else if (item.id === 'deposit') openDeposit();
      else if (item.id === 'clear') clearFilters();
      else {
        const code = item.id.slice('locale:'.length);
        if (isLocaleCode(code)) setLocale(code);
      }
    },
    [showGame, showProvider, toggle, openDeposit, clearFilters, setLocale],
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-haspopup="dialog"
        aria-keyshortcuts="Control+K Meta+K"
        onClick={() => {
          setOpen(true);
        }}
      >
        <SearchIcon />
        <span className={styles.triggerText}>{t('palette.open')}</span>
        <kbd aria-hidden="true" className={styles.kbd}>
          {t(IS_MAC ? 'palette.shortcutMac' : 'palette.shortcut')}
        </kbd>
      </button>
      <Dialog open={open} onClose={close} titleId={titleId} fallbackFocus={fallbackFocus} className={styles.dialog}>
        <PaletteBody titleId={titleId} onSelect={select} onClose={close} />
      </Dialog>
    </>
  );
}

interface BodyProps {
  titleId: string;
  onSelect: (item: PaletteItem) => void;
  onClose: () => void;
}

/** Mounted only while the dialog is open, so the query and the active option reset on every open. */
function PaletteBody({ titleId, onSelect, onClose }: BodyProps) {
  const { t, rich, locale } = useI18n();
  const { catalog, filters } = useCatalogContext();
  const { theme } = useTheme();
  const wallet = useWallet();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const listId = useId();

  const games = catalog.status === 'ready' ? catalog.games : null;
  const gameItems = useMemo<PaletteItem[]>(
    () => (games ? sortGames(games, 'trending').map((game) => ({ kind: 'game', id: game.id, label: game.title, game })) : []),
    [games],
  );
  const providerItems = useMemo<PaletteItem[]>(() => {
    if (!games) return [];
    const counts = new Map<string, number>();
    for (const game of games) counts.set(game.provider, (counts.get(game.provider) ?? 0) + 1);
    return providerOptions(games).map((p) => ({ kind: 'provider', id: p.slug, label: p.name, count: counts.get(p.slug) ?? 0 }));
  }, [games]);

  const filtersActive = !filtersEqual(filters.filters, DEFAULT_FILTERS) || filters.query !== '';
  const actionItems = useMemo(() => {
    const items: PaletteItem[] = [
      { kind: 'action', id: 'theme', label: t(theme === 'dark' ? 'palette.action.lightTheme' : 'palette.action.darkTheme') },
    ];
    for (const other of LOCALE_LIST) {
      if (other === locale) continue;
      const language = t(`language.names.${other.code}`);
      items.push({ kind: 'action', id: `locale:${other.code}`, label: t('palette.action.language', { language }) });
    }
    if (wallet.load === 'ready') items.push({ kind: 'action', id: 'deposit', label: t('palette.action.deposit') });
    if (filtersActive) items.push({ kind: 'action', id: 'clear', label: t('palette.action.clearFilters') });
    return items;
  }, [t, theme, locale, wallet.load, filtersActive]);

  const { groups, flat } = useMemo(
    () => buildResults(query, { actions: actionItems, games: gameItems, providers: providerItems }),
    [query, actionItems, gameItems, providerItems],
  );
  const count = flat.length;
  const activeIndex = Math.min(active, count - 1);
  const optionId = (index: number) => `${listId}-option-${index}`;
  const activeId = activeIndex >= 0 ? optionId(activeIndex) : undefined;

  useEffect(() => {
    if (activeId) document.getElementById(activeId)?.scrollIntoView({ block: 'nearest' });
  }, [activeId, flat]);

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    let next: number;
    switch (event.key) {
      case 'ArrowDown':
        next = (activeIndex + 1) % count;
        break;
      case 'ArrowUp':
        next = (activeIndex - 1 + count) % count;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = count - 1;
        break;
      case 'Enter': {
        // An IME is composing (e.g. Japanese input): Enter confirms the composition, not an option.
        if (event.nativeEvent.isComposing) return;
        const item = flat[activeIndex]?.item;
        if (!item) return;
        event.preventDefault();
        onSelect(item);
        return;
      }
      default:
        return;
    }
    if (count === 0) return;
    event.preventDefault();
    setActive(next);
  };

  const { retry } = catalog;
  // The Retry button is replaced by the skeleton: keep focus in the dialog.
  const onRetry = () => {
    retry();
    inputRef.current?.focus();
  };

  return (
    <div className={styles.palette}>
      <h2 id={titleId} className="visually-hidden">
        {t('palette.title')}
      </h2>
      <div className={styles.searchRow}>
        <SearchIcon className={styles.searchIcon} />
        <label htmlFor={inputId} className="visually-hidden">
          {t('palette.label')}
        </label>
        <input
          ref={inputRef}
          id={inputId}
          data-autofocus
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={count > 0}
          aria-controls={listId}
          aria-activedescendant={activeId}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="go"
          placeholder={t('palette.placeholder')}
          className={styles.input}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
        />
        <button type="button" className={styles.close} aria-label={t('palette.close')} onClick={onClose}>
          <CloseIcon />
        </button>
      </div>

      <p role="status" className="visually-hidden">
        {t('palette.count', { count })}
      </p>

      {catalog.status === 'loading' && (
        <div aria-busy="true" className={styles.loading}>
          <span className="visually-hidden">{t('palette.gamesLoading')}</span>
          <Skeleton inlineSize="70%" />
          <Skeleton inlineSize="45%" />
        </div>
      )}
      {catalog.status === 'error' && (
        <div className={styles.note}>
          <span>{t('palette.gamesError')}</span>
          <button type="button" className={styles.retry} onClick={onRetry}>
            {t('palette.retry')}
          </button>
        </div>
      )}

      <div role="listbox" id={listId} aria-label={t('palette.results')} hidden={count === 0} className={styles.list}>
        {groups.map((group) => {
          const labelId = `${listId}-${group.kind}`;
          return (
            <div key={group.kind} role="group" aria-labelledby={labelId} className={styles.group}>
              <div role="presentation" id={labelId} className={styles.groupLabel}>
                {t(`palette.group.${group.kind}`)}
              </div>
              {group.items.map((ranked) => {
                const index = flat.indexOf(ranked);
                const { item } = ranked;
                return (
                  // Options are not focusable: focus stays in the combobox (aria-activedescendant),
                  // which handles the keyboard. The mouse handlers mirror Enter and the arrows.
                  // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/interactive-supports-focus
                  <div
                    key={`${item.kind}:${item.id}`}
                    id={optionId(index)}
                    role="option"
                    aria-selected={index === activeIndex}
                    className={styles.option}
                    onMouseDown={(event) => {
                      event.preventDefault(); // keep focus in the input
                    }}
                    onMouseMove={() => {
                      if (index !== activeIndex) setActive(index);
                    }}
                    onClick={() => {
                      onSelect(item);
                    }}
                  >
                    <span className={styles.label}>
                      <Highlight text={item.label} matches={ranked.matches} />
                    </span>
                    {item.kind === 'game' && <span className={styles.meta}>{item.game.providerName}</span>}
                    {item.kind === 'provider' && (
                      <span className={styles.meta}>{t('palette.providerGames', { count: item.count })}</span>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {count === 0 && <p className={styles.empty}>{rich('palette.empty', { query: <bdi>{query.trim()}</bdi> })}</p>}
    </div>
  );
}

/** Matched characters in <mark>; adjacent matches share one <mark>. */
function Highlight({ text, matches }: { text: string; matches: readonly number[] }) {
  const parts: ReactNode[] = [];
  let at = 0;
  for (const [start, end] of markRanges(matches)) {
    if (start > at) parts.push(<Fragment key={`t${at}`}>{text.slice(at, start)}</Fragment>);
    parts.push(<mark key={`m${start}`}>{text.slice(start, end)}</mark>);
    at = end;
  }
  if (at < text.length) parts.push(<Fragment key={`t${at}`}>{text.slice(at)}</Fragment>);
  return <>{parts}</>;
}
