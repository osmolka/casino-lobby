// Usage: npm run gen:games  (Node >= 22.18 runs .ts files natively)
import { writeFileSync } from 'node:fs';
import { FIXTURE_SEED, generateGames } from './games-fixture.ts';

const out = new URL('../public/api/games.json', import.meta.url);
const games = generateGames(FIXTURE_SEED);
writeFileSync(out, `${JSON.stringify(games, null, 2)}\n`);
console.log(`Wrote ${games.length} games to ${out.pathname}`);
