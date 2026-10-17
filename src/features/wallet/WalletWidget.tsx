import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useI18n } from '../../i18n/LocaleProvider';
import { Dialog } from '../../shared/Dialog';
import { formatDateTime, formatEnteredAmount, formatMoney } from '../../shared/format';
import { ChevronDownIcon, CloseIcon, PlusIcon } from '../../shared/icons';
import { Skeleton } from '../../shared/Skeleton';
import { useAnimatedNumber } from '../../shared/useAnimatedNumber';
import { DepositForm } from './DepositForm';
import { WALLET_CURRENCY, type Transaction } from './types';
import { useWallet, type DepositRequest, type DepositResult } from './WalletProvider';
import styles from './WalletWidget.module.css';

const RECENT = 6;

/** Header wallet: balance toggle (opens the history panel), Deposit button, deposit dialog. */
export function WalletWidget() {
  const { t } = useI18n();
  const wallet = useWallet();
  const slotRef = useRef<HTMLDivElement>(null);

  const { retry } = wallet;
  // The Retry button is replaced by the skeleton: keep focus on the stable slot.
  const onRetry = useCallback(() => {
    retry();
    slotRef.current?.focus();
  }, [retry]);

  return (
    <div ref={slotRef} tabIndex={-1} className={styles.slot}>
      {wallet.load === 'loading' && (
        <div role="status" aria-busy="true" aria-label={t('wallet.loading')} className={styles.skeleton}>
          <Skeleton inlineSize="7.5rem" blockSize="2.5rem" />
        </div>
      )}
      {wallet.load === 'error' && (
        <div role="alert" className={styles.loadError}>
          <span>{t('wallet.error')}</span>
          <button type="button" className={styles.retry} onClick={onRetry}>
            {t('wallet.retry')}
          </button>
        </div>
      )}
      {wallet.load === 'ready' && <WalletReady />}
    </div>
  );
}

interface Notice {
  /** Formatted amount as entered. */
  amount: string;
}

function WalletReady() {
  const { t, rich, locale } = useI18n();
  const { balance, transactions, deposit } = useWallet();
  const shown = useAnimatedNumber(balance);
  const [panelOpen, setPanelOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const depositRef = useRef<HTMLButtonElement>(null);
  /** Incremented per dialog open: a result from an earlier open never closes a newer dialog. */
  const sessionRef = useRef(0);
  const dialogOpenRef = useRef(false);
  const panelId = useId();
  const panelTitleId = useId();
  const dialogTitleId = useId();
  const code = locale.code;

  useEffect(() => {
    dialogOpenRef.current = dialogOpen;
  }, [dialogOpen]);

  // Click outside or Esc closes the panel. The dialog is a DOM child, so clicks in it count as inside;
  // Esc belongs to the dialog while it is open.
  useEffect(() => {
    if (!panelOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setPanelOpen(false);
    };
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape' || dialogOpenRef.current) return;
      const focusInside = rootRef.current?.contains(document.activeElement) ?? false;
      setPanelOpen(false);
      if (focusInside) toggleRef.current?.focus();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [panelOpen]);

  const openDeposit = () => {
    sessionRef.current += 1;
    setNotice(null);
    setDialogOpen(true);
  };
  const closeDeposit = useCallback(() => {
    setDialogOpen(false);
  }, []);
  const fallbackFocus = useCallback(() => depositRef.current, []);

  const confirm = useCallback(
    async (request: DepositRequest): Promise<DepositResult> => {
      const session = sessionRef.current;
      const result = await deposit(request);
      const amount = formatEnteredAmount(request.normalized, request.source.currency, code);
      const dialogShowsIt = dialogOpenRef.current && session === sessionRef.current;
      if (result === 'confirmed') {
        setAnnouncement(t('wallet.notice.confirmed', { amount }));
        if (dialogShowsIt) setDialogOpen(false);
      } else if (!dialogShowsIt) {
        // The dialog was closed while the request was in flight: announce the failure here.
        setNotice({ amount });
      }
      return result;
    },
    [deposit, code, t],
  );

  const formattedBalance = formatMoney(balance, WALLET_CURRENCY, code);

  return (
    <div ref={rootRef} className={styles.wallet}>
      <button
        ref={toggleRef}
        type="button"
        className={styles.balance}
        aria-expanded={panelOpen}
        aria-controls={panelId}
        onClick={() => {
          setPanelOpen((v) => !v);
        }}
      >
        <span className="visually-hidden">{t('wallet.balance', { amount: formattedBalance })}</span>
        <bdi aria-hidden="true" className={styles.amount}>
          {formatMoney(shown, WALLET_CURRENCY, code)}
        </bdi>
        <ChevronDownIcon className={styles.chevron} />
      </button>
      <button ref={depositRef} type="button" className={styles.deposit} onClick={openDeposit}>
        <PlusIcon />
        <span className={styles.depositText}>{t('wallet.deposit')}</span>
      </button>

      <div className={styles.popovers}>
        {notice && (
          <div role="alert" className={styles.notice}>
            <p>{rich('wallet.notice.failed', { amount: <bdi>{notice.amount}</bdi> })}</p>
            <button
              type="button"
              className={styles.iconButton}
              aria-label={t('wallet.notice.dismiss')}
              onClick={() => {
                setNotice(null);
                depositRef.current?.focus();
              }}
            >
              <CloseIcon />
            </button>
          </div>
        )}
        <section id={panelId} hidden={!panelOpen} aria-labelledby={panelTitleId} className={styles.panel}>
          <div className={styles.panelHead}>
            <h2 id={panelTitleId} className={styles.panelTitle}>
              {t('wallet.title')}
            </h2>
            <p className={styles.panelBalance}>
              <span className={styles.muted}>{t('wallet.balanceIn', { currency: WALLET_CURRENCY })}</span>
              <bdi className={styles.panelAmount}>{formattedBalance}</bdi>
            </p>
          </div>
          {transactions.length === 0 ? (
            <div className={styles.empty}>
              <h3 className={styles.emptyTitle}>{t('wallet.empty.title')}</h3>
              <p className={styles.muted}>{t('wallet.empty.body')}</p>
              <button type="button" className={styles.action} onClick={openDeposit}>
                {t('wallet.deposit')}
              </button>
            </div>
          ) : (
            <>
              <h3 className={styles.historyTitle}>{t('wallet.history')}</h3>
              <ul className={styles.list}>
                {transactions.slice(0, RECENT).map((tx) => (
                  <TransactionRow key={tx.id} tx={tx} />
                ))}
              </ul>
            </>
          )}
        </section>
      </div>

      <p role="status" className="visually-hidden">
        {announcement}
      </p>

      <Dialog open={dialogOpen} onClose={closeDeposit} titleId={dialogTitleId} fallbackFocus={fallbackFocus}>
        <DepositForm titleId={dialogTitleId} onConfirm={confirm} onClose={closeDeposit} />
      </Dialog>
    </div>
  );
}

function TransactionRow({ tx }: { tx: Transaction }) {
  const { t, locale } = useI18n();
  const code = locale.code;
  return (
    <li className={styles.row} data-status={tx.status}>
      <span className={styles.rowMain}>
        <span className={styles.kind}>{t(tx.kind === 'opening' ? 'wallet.kind.opening' : 'wallet.kind.deposit')}</span>
        <time dateTime={tx.createdAt} className={styles.muted}>
          {formatDateTime(tx.createdAt, code)}
        </time>
      </span>
      <span className={styles.rowSide}>
        <bdi className={styles.rowAmount}>{formatMoney(tx.amount, WALLET_CURRENCY, code)}</bdi>
        {tx.source.currency !== WALLET_CURRENCY && (
          <bdi className={styles.muted}>{formatMoney(tx.source.amount, tx.source.currency, code)}</bdi>
        )}
        <span className={styles.status}>{t(`wallet.status.${tx.status}`)}</span>
      </span>
    </li>
  );
}
