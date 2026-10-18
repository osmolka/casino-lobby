import type { PluralForms } from './types';

export const en = {
  app: {
    name: 'Lucky Lobby',
    /** document.title; index.html has the same text for the first paint. */
    title: 'Lucky Lobby — Casino games',
    home: 'Lucky Lobby home',
    skipToContent: 'Skip to content',
  },
  header: {
    controls: 'Lobby controls',
  },
  settings: {
    open: 'Settings',
    title: 'Settings',
    accent: 'Accent hue',
    accentValue: '{hue}°',
    reset: 'Reset accent',
  },
  theme: {
    dark: 'Dark theme',
  },
  language: {
    label: 'Language',
    // Endonyms: each language named in itself, in every dictionary.
    names: {
      en: 'English',
      ru: 'Русский',
    },
  },
  wallet: {
    loading: 'Loading wallet',
    title: 'Wallet',
    balance: 'Balance: {amount}',
    balanceIn: 'Balance in {currency}',
    deposit: 'Deposit',
    history: 'Recent transactions',
    error: 'Wallet unavailable',
    retry: 'Try again',
    empty: {
      title: 'No transactions yet',
      body: 'Make a deposit to start playing.',
    },
    kind: {
      opening: 'Opening deposit',
      deposit: 'Deposit',
    },
    status: {
      pending: 'Pending',
      confirmed: 'Confirmed',
      failed: 'Failed',
    },
    notice: {
      confirmed: 'Deposit of {amount} confirmed.',
      failed: 'Deposit of {amount} failed. Your balance was not changed.',
      dismiss: 'Dismiss',
    },
    dialog: {
      title: 'Deposit',
      close: 'Close',
      amount: 'Amount',
      currency: 'Currency',
      currencyOption: '{code} · {name}',
      limits: 'From {min} to {max}',
      youDeposit: 'You deposit',
      youReceive: 'You receive',
      rate: 'Rate',
      rateValue: '{from} = {to}',
      confirm: 'Confirm deposit',
      processing: 'Processing your deposit…',
      cancel: 'Cancel',
      offline: 'You are offline. Deposits are paused until the connection is back.',
      failed: 'The deposit of {amount} failed. Your balance was not changed.',
      error: {
        required: 'Enter an amount.',
        invalid: 'Enter a number, for example 25 or 25.50.',
        precision: 'Use at most two decimal places.',
        zero: 'Enter an amount greater than zero.',
        min: 'The minimum deposit is {min}.',
        max: 'The maximum deposit is {max}.',
      },
    },
  },
  catalog: {
    title: 'Games',
    loading: 'Loading games',
    error: {
      title: 'Games did not load',
      network: 'Could not reach the server. Check your connection and try again.',
      http: 'The server could not load the games. Try again in a moment.',
      invalid: 'The game list came back damaged. Try again.',
    },
    retry: 'Try again',
    count: {
      one: '{count} game',
      other: '{count} games',
    },
    empty: {
      title: 'No games match these filters',
      body: 'Try another search or clear the filters to see all games.',
    },
    search: {
      label: 'Search games',
      placeholder: 'Search by title or provider',
    },
    sort: {
      label: 'Sort by',
      trending: 'Trending',
      new: 'New releases',
      rtp: 'Highest RTP',
    },
    filters: {
      label: 'Filters',
      toggle: 'Filters',
      toggleActive: 'Filters ({count})',
      category: 'Category',
      provider: 'Provider',
      tag: 'Tag',
      all: 'All',
      clear: 'Clear filters',
    },
    category: {
      slots: 'Slots',
      table: 'Table games',
      live: 'Live casino',
    },
    tag: {
      classic: 'Classic',
      'bonus-buy': 'Bonus buy',
      megaways: 'Megaways',
      jackpot: 'Jackpot',
      new: 'New',
    },
    card: {
      rtp: 'RTP',
      bet: 'Bet',
    },
  },
  palette: {
    open: 'Search',
    shortcut: 'Ctrl K',
    shortcutMac: '⌘ K',
    title: 'Search and commands',
    label: 'Search games, providers and actions',
    placeholder: 'Search games, providers, actions',
    close: 'Close',
    results: 'Results',
    count: {
      one: '{count} result',
      other: '{count} results',
    },
    empty: 'Nothing found for {query}.',
    group: {
      action: 'Actions',
      game: 'Games',
      provider: 'Providers',
    },
    providerGames: {
      one: '{count} game',
      other: '{count} games',
    },
    gamesLoading: 'Loading games',
    gamesError: 'Games did not load, so only actions are listed.',
    retry: 'Try again',
    action: {
      darkTheme: 'Switch to dark theme',
      lightTheme: 'Switch to light theme',
      language: 'Change language to {language}',
      deposit: 'Make a deposit',
      clearFilters: 'Clear filters',
    },
  },
  promos: {
    title: 'Promotions',
    list: 'Current promotions',
    previous: 'Previous promotions',
    next: 'Next promotions',
    loading: 'Loading promotions',
    retry: 'Try again',
    error: {
      title: 'Promotions did not load',
      body: 'Could not load the current offers. Check your connection and try again.',
    },
    empty: {
      title: 'No promotions right now',
      body: 'New offers will appear here. Try again later.',
    },
    // Keys are the promo ids in api/promos.json (PromoId is derived from them).
    items: {
      liveWeek: {
        title: 'Live Casino Week',
        body: 'Real dealers, real tables. Join a live game tonight.',
        cta: 'Play live',
      },
      freshReleases: {
        title: 'Fresh releases',
        body: 'The newest games in the lobby, ready to play.',
        cta: 'See what’s new',
      },
      jackpotHunt: {
        title: 'Jackpot hunt',
        body: 'Progressive prizes that grow with every spin.',
        cta: 'Chase a jackpot',
      },
      megaways: {
        title: 'Megaways madness',
        body: 'Thousands of ways to win on every spin.',
        cta: 'Spin Megaways',
      },
      tableClassics: {
        title: 'Table classics',
        body: 'Blackjack, roulette and baccarat, dealt your way.',
        cta: 'Take a seat',
      },
    },
  },
  feed: {
    title: 'Live wins',
    show: 'Show live wins',
    hide: 'Hide live wins',
    loading: 'Loading live wins',
    list: 'Recent wins',
    win: '{player} won {amount}',
    meta: '{game} · {time}',
    justNow: 'just now',
    pause: 'Pause live feed',
    resume: 'Resume live feed',
    pausedReading: 'Paused while you read',
    pausedOffline: 'Paused while offline',
    retry: 'Try again',
    error: {
      title: 'Live wins did not load',
      body: 'Could not connect to the live feed. Check your connection and try again.',
    },
    empty: {
      title: 'No wins yet',
      body: 'Nobody has won in the last few minutes. Try again to reconnect.',
    },
  },
};

/** Values widened to string; a plural entry (has `other`) takes any Intl.PluralRules forms, e.g. ru few/many. */
type DeepString<T> = {
  [K in keyof T]: T[K] extends string ? string : T[K] extends { other: string } ? PluralForms : DeepString<T[K]>;
};
export type Messages = DeepString<typeof en>;
