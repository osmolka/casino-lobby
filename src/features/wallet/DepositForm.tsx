import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useI18n } from '../../i18n/LocaleProvider';
import type { MessageKey } from '../../i18n/types';
import { currencyName, formatEnteredAmount, formatMoney } from '../../shared/format';
import { CloseIcon } from '../../shared/icons';
import { useOnline } from '../../shared/useOnline';
import { MAX_DEPOSIT, MIN_DEPOSIT, parseAmount, type AmountError } from './amount';
import { RATES, convertToWallet } from './rates';
import { CURRENCIES, WALLET_CURRENCY, type Currency } from './types';
import type { DepositRequest, DepositResult } from './WalletProvider';
import styles from './DepositForm.module.css';

const ERROR_KEYS: Record<AmountError, MessageKey> = {
  required: 'wallet.dialog.error.required',
  invalid: 'wallet.dialog.error.invalid',
  precision: 'wallet.dialog.error.precision',
  zero: 'wallet.dialog.error.zero',
  min: 'wallet.dialog.error.min',
  max: 'wallet.dialog.error.max',
};

let sequence = 0;
const newKey = () => `dep-${Date.now().toString(36)}-${(++sequence).toString(36)}`;

interface Props {
  titleId: string;
  onConfirm: (request: DepositRequest) => Promise<DepositResult>;
  onClose: () => void;
}

/** Content of the deposit dialog. Mounted per open, so every open starts clean. */
export function DepositForm({ titleId, onConfirm, onClose }: Props) {
  const { t, rich, locale } = useI18n();
  const online = useOnline();
  const [text, setText] = useState('');
  const [currency, setCurrency] = useState<Currency>(WALLET_CURRENCY);
  const [showErrors, setShowErrors] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  /** The entered amount of the last failed attempt, formatted. */
  const [failure, setFailure] = useState<string | null>(null);
  /** Idempotency key of the current attempt; '' = a new one is created on submit. */
  const keyRef = useRef('');
  const inFlightRef = useRef(false);
  const mountedRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const amountId = useId();
  const currencyId = useId();
  const hintId = useId();
  const errorId = useId();

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const code = locale.code;
  const money = (minor: number, cur: Currency) => <bdi>{formatMoney(minor, cur, code)}</bdi>;
  const parsed = parseAmount(text);
  const error = showErrors && !parsed.ok ? parsed.error : null;
  const blocked = submitting || !online;

  const errorText = (e: AmountError) => {
    if (e === 'min') return rich(ERROR_KEYS.min, { min: money(MIN_DEPOSIT, currency) });
    if (e === 'max') return rich(ERROR_KEYS.max, { max: money(MAX_DEPOSIT, currency) });
    return t(ERROR_KEYS[e]);
  };

  const edit = (apply: () => void) => {
    if (inFlightRef.current) return;
    apply();
    keyRef.current = '';
    setFailure(null);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (inFlightRef.current || !online) return;
    setShowErrors(true);
    if (!parsed.ok) {
      inputRef.current?.focus();
      return;
    }
    keyRef.current ||= newKey();
    inFlightRef.current = true;
    setSubmitting(true);
    setFailure(null);
    const result = await onConfirm({ key: keyRef.current, normalized: parsed.normalized, source: { amount: parsed.minor, currency } });
    if (!mountedRef.current) return;
    inFlightRef.current = false;
    setSubmitting(false);
    if (result === 'failed') {
      keyRef.current = '';
      setFailure(formatEnteredAmount(parsed.normalized, currency, code));
    }
  };

  return (
    <form className={styles.form} noValidate onSubmit={(e) => void submit(e)}>
      <div className={styles.head}>
        <h2 id={titleId} className={styles.title}>
          {t('wallet.dialog.title')}
        </h2>
        <button type="button" className={styles.close} aria-label={t('wallet.dialog.close')} onClick={onClose}>
          <CloseIcon />
        </button>
      </div>

      <div className={styles.body}>
        <div className={styles.fields}>
          <div className={styles.field}>
            <label htmlFor={amountId} className={styles.label}>
              {t('wallet.dialog.amount')}
            </label>
            <input
              ref={inputRef}
              id={amountId}
              data-autofocus
              className={styles.input}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={text}
              readOnly={submitting}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${hintId} ${errorId}` : hintId}
              onChange={(e) => {
                const value = e.target.value;
                edit(() => {
                  setText(value);
                });
              }}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor={currencyId} className={styles.label}>
              {t('wallet.dialog.currency')}
            </label>
            <select
              id={currencyId}
              className={styles.input}
              value={currency}
              onChange={(e) => {
                const value = CURRENCIES.find((c) => c === e.target.value) ?? WALLET_CURRENCY;
                edit(() => {
                  setCurrency(value);
                });
              }}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {t('wallet.dialog.currencyOption', { code: c, name: currencyName(c, code) })}
                </option>
              ))}
            </select>
          </div>
        </div>

        <p id={hintId} className={styles.hint}>
          {rich('wallet.dialog.limits', { min: money(MIN_DEPOSIT, currency), max: money(MAX_DEPOSIT, currency) })}
        </p>
        {error && (
          <p id={errorId} className={styles.error}>
            {errorText(error)}
          </p>
        )}

        {parsed.ok && (
          <dl className={styles.preview}>
            <div className={styles.previewRow}>
              <dt>{t('wallet.dialog.youDeposit')}</dt>
              <dd>
                <bdi>{formatEnteredAmount(parsed.normalized, currency, code)}</bdi>
              </dd>
            </div>
            {currency !== WALLET_CURRENCY && (
              <div className={styles.previewRow}>
                <dt>{t('wallet.dialog.rate')}</dt>
                <dd>{rich('wallet.dialog.rateValue', { from: money(100, currency), to: money(RATES[currency], WALLET_CURRENCY) })}</dd>
              </div>
            )}
            <div className={`${styles.previewRow} ${styles.total}`}>
              <dt>{t('wallet.dialog.youReceive')}</dt>
              <dd>{money(convertToWallet(parsed.minor, currency), WALLET_CURRENCY)}</dd>
            </div>
          </dl>
        )}

        <div role="status">
          {!online && <p className={styles.offline}>{t('wallet.dialog.offline')}</p>}
        </div>
        {failure && (
          <p role="alert" className={styles.failure}>
            {rich('wallet.dialog.failed', { amount: <bdi>{failure}</bdi> })}
          </p>
        )}
      </div>

      <div className={styles.foot}>
        <button type="button" className={styles.secondary} onClick={onClose}>
          {t('wallet.dialog.cancel')}
        </button>
        <button type="submit" className={styles.primary} aria-disabled={blocked ? true : undefined}>
          {t(submitting ? 'wallet.dialog.processing' : 'wallet.dialog.confirm')}
        </button>
      </div>
    </form>
  );
}
