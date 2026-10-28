import { loadDeviceConfig } from '../MainManager/device-config.mjs';
const path = process.argv[2];
try {
  if (!path) throw new Error('Usage: npm run check:device -- Config/Local/DeviceConfig.json');
  const { config } = await loadDeviceConfig(path);
  console.log(`Config valid: ${config.profileName}. Device connectivity/build compatibility not checked.`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
