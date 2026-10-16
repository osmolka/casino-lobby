export const en = {
  app: {
    name: 'Lucky Lobby',
    home: 'Lucky Lobby home',
    skipToContent: 'Skip to content',
  },
  header: {
    controls: 'Settings',
  },
  theme: {
    dark: 'Dark theme',
  },
  language: {
    label: 'Language',
    names: {
      en: 'English',
    },
  },
  wallet: {
    loading: 'Loading wallet',
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
  feed: {
    title: 'Live wins',
    show: 'Show live wins',
    hide: 'Hide live wins',
    loading: 'Loading live wins',
  },
};

type DeepString<T> = { [K in keyof T]: T[K] extends string ? string : DeepString<T[K]> };
export type Messages = DeepString<typeof en>;
