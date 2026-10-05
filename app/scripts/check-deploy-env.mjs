// Runs before a deploy: refuse to ship a build that cannot read the booth cloud.
// Reads the env exactly as `vite build` will (.env, .env.production, .env.local, shell).
import { loadEnv } from 'vite';

const env = loadEnv('production', process.cwd(), 'VITE_');
const problems = [];
if (env.VITE_PROVIDER !== 'search') problems.push(`VITE_PROVIDER is "${env.VITE_PROVIDER || 'mock'}", not "search"`);
if (!env.VITE_SEARCH_URL) problems.push('VITE_SEARCH_URL is empty (sign one with `node scripts/sign-search-url.mjs`)');
else if (!/^https:\/\/res\.cloudinary\.com\/[^/]+\/search\//.test(env.VITE_SEARCH_URL)) problems.push('VITE_SEARCH_URL is not a Cloudinary search URL');

if (problems.length && process.env.MOCK_DEPLOY !== '1') {
  console.error(`Not deploying: ${problems.join('; ')}. Fix app/.env (see .env.example), or MOCK_DEPLOY=1 to ship the mock data on purpose.`);
  process.exit(1);
}
console.log(problems.length ? 'Deploying with MOCK data (MOCK_DEPLOY=1).' : `Deploying with the booth cloud search URL (${env.VITE_SEARCH_URL.split('/')[3]}).`);
