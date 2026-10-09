import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function run(command) {
  console.log(`\n▶ [Executing]: ${command}`);
  execSync(command, { cwd: rootDir, stdio: 'inherit' });
}

console.log('🌐 Starting Selah Vercel Redeployment Pipeline...');

// 1. Sync Supabase Schema & check connection
run('node scripts/sync_supabase_schema.js');

// 2. Build Web Bundle
run('npm run build');

// 3. Deploy to Vercel Production
run('vercel --prod --yes');

console.log('\n✅ Vercel redeployment complete: https://jfcm-selah.vercel.app');
