import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Read .env if present
const envPath = path.join(rootDir, '.env');
let supabaseUrl = process.env.VITE_SUPABASE_URL;
let supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
let serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...vals] = trimmed.split('=');
    const val = vals.join('=').trim().replace(/^["']|["']$/g, '');
    if (key.trim() === 'VITE_SUPABASE_URL' && !supabaseUrl) supabaseUrl = val;
    if (key.trim() === 'VITE_SUPABASE_ANON_KEY' && !supabaseAnonKey) supabaseAnonKey = val;
    if (key.trim() === 'SUPABASE_SERVICE_ROLE_KEY' && !serviceRoleKey) serviceRoleKey = val;
  }
}

console.log('----------------------------------------------------');
console.log('🔄 SELAH SUPABASE SCHEMA & CONNECTION SYNC WORKFLOW');
console.log('----------------------------------------------------');
console.log(`Supabase URL: ${supabaseUrl || 'NOT SET'}`);
console.log(`Anon Key:     ${supabaseAnonKey ? supabaseAnonKey.slice(0, 16) + '...' : 'NOT SET'}`);

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Error: Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const clientKey = serviceRoleKey || supabaseAnonKey;
const supabase = createClient(supabaseUrl, clientKey);

async function verifyTables() {
  const tables = ['churches', 'profiles', 'songs', 'setlists', 'minister_schedules', 'user_notifications'];
  console.log('\n🔍 Verifying Supabase synced tables:');
  
  let allHealthy = true;
  for (const table of tables) {
    try {
      const { data, error, status } = await supabase.from(table).select('id').limit(1);
      if (error && status !== 200) {
        console.warn(`  ⚠️  Table [${table}]: Warning - ${error.message} (Status: ${status})`);
        allHealthy = false;
      } else {
        console.log(`  ✅ Table [${table}]: Connected & Synced (Status: ${status})`);
      }
    } catch (e) {
      console.error(`  ❌ Table [${table}]: Exception - ${e.message}`);
      allHealthy = false;
    }
  }

  // Check schema files
  const schemaPath = path.join(rootDir, 'supabase_schema.sql');
  const fixScriptPath = path.join(rootDir, 'supabase_fix_infinite_recursion.sql');
  
  console.log('\n📄 Schema Migration Artifacts:');
  if (fs.existsSync(schemaPath)) {
    console.log(`  ✅ Complete Schema: ${schemaPath} (${(fs.statSync(schemaPath).size / 1024).toFixed(1)} KB)`);
  }
  if (fs.existsSync(fixScriptPath)) {
    console.log(`  ✅ Targeted Fix Script: ${fixScriptPath} (${(fs.statSync(fixScriptPath).size / 1024).toFixed(1)} KB)`);
  }

  console.log('\n💡 Note: To apply the latest RLS policies and table structure to your Supabase project:');
  console.log('   Paste the contents of supabase_fix_infinite_recursion.sql into:');
  console.log(`   ${supabaseUrl.replace('.supabase.co', '')}/project/_/sql (or your Supabase SQL Editor)\n`);

  return allHealthy;
}

verifyTables().catch(err => {
  console.error('Workflow check failed:', err);
  process.exit(1);
});
