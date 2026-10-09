import type { ConfigContext, ExpoConfig } from 'expo/config';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const configureApp = ({ config }: ConfigContext): ExpoConfig => {
  const googleFile = process.env.GOOGLE_SERVICES_JSON || './google-services.json';
  // EAS runs Expo config from the mobile project root; __dirname is unavailable
  // when the TypeScript config is evaluated as an ES module.
  const hasGoogleFile = existsSync(resolve(process.cwd(), googleFile));
  if (process.env.EAS_BUILD === 'true' && process.env.EAS_BUILD_PLATFORM === 'android' && !hasGoogleFile) {
    throw new Error('Android push requires the Firebase google-services.json file for ro.nitido.app.');
  }
  const distribution = ['preview', 'production'].includes(process.env.EAS_BUILD_PROFILE || '');
  return {
    ...config,
    name: config.name || 'NITIDO',
    slug: config.slug || 'nitido-ro',
    android: { ...config.android, ...(hasGoogleFile ? { googleServicesFile: googleFile } : {}) },
    plugins: (config.plugins || []).map(plugin => Array.isArray(plugin) && plugin[0] === 'expo-notifications'
      ? [plugin[0], { ...plugin[1], mode: distribution ? 'production' : 'development' }]
      : plugin),
  };
};
export default configureApp;
