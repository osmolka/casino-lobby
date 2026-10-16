// Failure injection for manual verification (PLAN §3.6). Works in dev and preview.
export const MOCK_FLAGS = ['fail-catalog', 'fail-feed', 'fail-wallet', 'empty-feed', 'slow'] as const;
export type MockFlag = (typeof MOCK_FLAGS)[number];

export function getMockFlags(search: string): ReadonlySet<MockFlag> {
  const flags = new Set<MockFlag>();
  for (const value of new URLSearchParams(search).getAll('mock')) {
    for (const part of value.split(',')) {
      const flag = MOCK_FLAGS.find((known) => known === part.trim());
      if (flag) flags.add(flag);
    }
  }
  return flags;
}
