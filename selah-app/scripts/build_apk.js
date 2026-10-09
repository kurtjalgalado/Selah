import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const isWindows = process.platform === 'win32';

function run(command, cwd = rootDir) {
  console.log(`\n▶ [Executing]: ${command}`);
  execSync(command, { cwd, stdio: 'inherit' });
}

console.log('🤖 Starting Selah Android APK Build Pipeline...');

// 1. Sync Supabase Schema & check connection
run('node scripts/sync_supabase_schema.js');

// 2. Build Web Bundle
run('npm run build');

// 3. Sync to Capacitor Android
run('npx cap sync android');

// 4. Assemble Debug APK
const gradleCmd = isWindows ? 'gradlew.bat assembleDebug' : './gradlew assembleDebug';
run(gradleCmd, path.join(rootDir, 'android'));

// 5. Copy built APK
const builtApkPath = path.join(rootDir, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
const targetApkPath = path.join(rootDir, 'selah-app-debug.apk');

if (fs.existsSync(builtApkPath)) {
  fs.copyFileSync(builtApkPath, targetApkPath);
  const stats = fs.statSync(targetApkPath);
  console.log(`\n✅ Fresh APK copied to: ${targetApkPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
} else {
  console.warn(`⚠️ Warning: Built APK not found at ${builtApkPath}`);
}
