import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const isWindows = process.platform === 'win32';

function run(command, cwd = rootDir) {
  console.log(`\n▶ [Executing]: ${command} (in ${path.relative(rootDir, cwd) || '.'})`);
  execSync(command, { cwd, stdio: 'inherit' });
}

console.log('====================================================');
console.log('🚀 SELAH INTEGRATED BUILD, SYNC & DEPLOYMENT PIPELINE');
console.log('====================================================');

try {
  // Step 1: Verify Supabase Schema & Synced Tables
  console.log('\n[STEP 1/6] 🔄 Validating Supabase Schema & Remote Connection...');
  run('node scripts/sync_supabase_schema.js');

  // Step 2: Run Unit Tests
  console.log('\n[STEP 2/6] 🧪 Running Unit Tests...');
  run('npm run test');

  // Step 3: Build Web App Production Assets
  console.log('\n[STEP 3/6] 📦 Building Web Application (Vite)...');
  run('npm run build');

  // Step 4: Deploy to Vercel Production
  console.log('\n[STEP 4/6] 🌐 Deploying to Vercel Production...');
  run('vercel --prod --yes');

  // Step 5: Sync Capacitor Android
  console.log('\n[STEP 5/6] 📱 Syncing Capacitor Android Assets...');
  run('npx cap sync android');

  // Step 6: Assemble Android Debug APK
  console.log('\n[STEP 6/6] 🤖 Building Android Debug APK with Gradle...');
  const gradleCmd = isWindows ? 'gradlew.bat assembleDebug' : './gradlew assembleDebug';
  run(gradleCmd, path.join(rootDir, 'android'));

  // Copy APK to root
  const builtApkPath = path.join(rootDir, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
  const targetApkPath = path.join(rootDir, 'selah-app-debug.apk');

  if (fs.existsSync(builtApkPath)) {
    fs.copyFileSync(builtApkPath, targetApkPath);
    const stats = fs.statSync(targetApkPath);
    console.log(`\n🎉 APK copied to: ${targetApkPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
  } else {
    console.warn(`⚠️ Warning: Built APK not found at ${builtApkPath}`);
  }

  console.log('\n====================================================');
  console.log('✅ ALL STEPS COMPLETED SUCCESSFULLY!');
  console.log('   - Vercel:   https://jfcm-selah.vercel.app');
  console.log('   - Supabase: https://hbcfvixqrwrckcbtghwn.supabase.co');
  console.log('   - APK:      selah-app-debug.apk');
  console.log('====================================================\n');

} catch (err) {
  console.error('\n❌ Deployment pipeline failed:', err.message);
  process.exit(1);
}
