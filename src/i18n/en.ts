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
      network: 'Could not reach the server. Check your connection and try again.',
      http: 'The server could not load the games. Try again in a moment.',
      invalid: 'The game list came back damaged. Try again.',
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
