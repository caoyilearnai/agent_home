import { rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const frontendRoot = resolve(scriptDir, '..');
const distApkPath = resolve(frontendRoot, 'dist/agent-home-android.apk');
const androidAssetsApkPath = resolve(frontendRoot, 'android/app/src/main/assets/public/agent-home-android.apk');

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: frontendRoot,
    stdio: 'inherit',
    shell: false
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function removeIfExists(targetPath) {
  rmSync(targetPath, { force: true });
}

console.log('[agent-home] building web assets for android');
run('node', ['./node_modules/vite/bin/vite.js', 'build', '--mode', 'android']);

// The homepage download APK should remain available for PC web builds,
// but must not be copied into the Android app's own bundled web assets.
removeIfExists(distApkPath);
removeIfExists(androidAssetsApkPath);

console.log('[agent-home] syncing capacitor android project');
run('npx', ['cap', 'sync', 'android']);

// Some sync flows may leave stale generated assets behind, so delete again.
removeIfExists(androidAssetsApkPath);
