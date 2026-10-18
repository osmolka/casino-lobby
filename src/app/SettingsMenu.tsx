import { useEffect, useId, useRef, useState } from 'react';
import { useI18n } from '../i18n/LocaleProvider';
import { SettingsIcon } from '../shared/icons';
import { DEFAULT_ACCENT_HUE, applyHue, readStoredHue, resetHue, storeHue } from './accent';
import headerStyles from './Header.module.css';
import { LanguageSwitcher } from './LanguageSwitcher';
import styles from './SettingsMenu.module.css';

const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]';

/**
 * Header settings: a disclosure with Language and the accent hue. Non-modal: Esc, a click outside or focus leaving
 * the menu closes it. Esc, and a click outside on something that cannot take focus, return focus to the toggle
 * (a click on something focusable leaves focus there).
 */
export function SettingsMenu() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  /** Set by an outside click on something that cannot take focus: the click then returns focus to the toggle. */
  const restoreOnClickRef = useRef(false);
  const panelId = useId();
  const titleId = useId();

  // Focus the first control once the panel is shown.
  useEffect(() => {
    if (open) panelRef.current?.querySelector<HTMLElement>('select, input, button')?.focus();
  }, [open]);

  // Always mounted: the click arrives after the panel closed (and its listeners were removed). The browser moves
  // focus to <body> on mousedown (after pointerdown, whatever pointerdown does), so focus is restored on click.
  useEffect(() => {
    const onPointerDown = () => {
      restoreOnClickRef.current = false;
    };
    const onClick = () => {
      if (!restoreOnClickRef.current) return;
      restoreOnClickRef.current = false;
      const active = document.activeElement;
      // On <body>, or still on a control in the now hidden panel (browsers without focus fixup).
      if (active === null || active === document.body || panelRef.current?.contains(active)) toggleRef.current?.focus();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('click', onClick);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('click', onClick);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const focusInside = () => rootRef.current?.contains(document.activeElement) ?? false;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element) || rootRef.current?.contains(target)) return;
      restoreOnClickRef.current = focusInside() && !target.closest(FOCUSABLE);
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const restore = focusInside();
      setOpen(false);
      if (restore) toggleRef.current?.focus();
    };
    const onFocusOut = (event: FocusEvent) => {
      // relatedTarget is null when focus goes nowhere (e.g. a click on the panel's padding): that is not leaving.
      if (event.relatedTarget instanceof Node && !rootRef.current?.contains(event.relatedTarget)) setOpen(false);
    };
    const root = rootRef.current;
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    root?.addEventListener('focusout', onFocusOut);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      root?.removeEventListener('focusout', onFocusOut);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={styles.settings}>
      <button
        ref={toggleRef}
        type="button"
        className={headerStyles.iconButton}
        aria-label={t('settings.open')}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          setOpen((v) => !v);
        }}
      >
        <SettingsIcon />
      </button>
      <div ref={panelRef} id={panelId} role="region" aria-labelledby={titleId} tabIndex={-1} hidden={!open} className={styles.panel}>
        <h2 id={titleId} className={styles.title}>
          {t('settings.title')}
        </h2>
        <div className={styles.field}>
          <LanguageSwitcher />
        </div>
        {/* Mounted only while open: the slider reads the current hue each time the panel opens. */}
        {open && <AccentHue />}
      </div>
    </div>
  );
}

/**
 * The slider changes only `--accent-h` on <html>; no app state or context re-renders. The local state just feeds
 * the slider's own value and aria-valuetext.
 */
function AccentHue() {
  const { t } = useI18n();
  const [hue, setHue] = useState(readStoredHue);
  const id = useId();
  const valueText = t('settings.accentValue', { hue });
  return (
    <div className={styles.hue}>
      <div className={styles.hueHead}>
        <label htmlFor={id}>{t('settings.accent')}</label>
        <output htmlFor={id} aria-hidden="true" className={styles.hueValue}>
          {valueText}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={359}
        step={1}
        value={hue}
        aria-valuetext={valueText}
        className={styles.slider}
        onChange={(event) => {
          const next = Number(event.target.value);
          setHue(next);
          applyHue(next);
          storeHue(next);
        }}
      />
      <button
        type="button"
        className={styles.reset}
        onClick={() => {
          resetHue();
          setHue(DEFAULT_ACCENT_HUE);
        }}
      >
        {t('settings.reset')}
      </button>
    </div>
  );
}
