import type { ConfigContext, ExpoConfig } from 'expo/config';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const configureApp = ({ config }: ConfigContext): ExpoConfig => {
  const googleFile = process.env.GOOGLE_SERVICES_JSON || './google-services.json';
  // EAS runs Expo config from the mobile project root; __dirname is unavailable
  // when the TypeScript config is evaluated as an ES module.
  const hasGoogleFile = existsSync(resolve(process.cwd(), googleFile));
  if (hasGoogleFile) {
    const services = JSON.parse(readFileSync(resolve(process.cwd(), googleFile), 'utf8'));
    if (!services.client?.some((client: { client_info?: { android_client_info?: { package_name?: string } } }) => client.client_info?.android_client_info?.package_name === 'ro.nitido.app')) {
      throw new Error('Firebase google-services.json must contain the approved Android package ro.nitido.app.');
    }
  }
  if (process.env.EAS_BUILD === 'true' && process.env.EAS_BUILD_PLATFORM === 'android' && !hasGoogleFile) {
    throw new Error('Android push requires the Firebase google-services.json file for ro.nitido.app.');
  }
  const distribution = ['preview', 'production'].includes(process.env.EAS_BUILD_PROFILE || '');
  if (process.env.EAS_BUILD_PROFILE === 'production') {
    if (process.env.EXPO_PUBLIC_NITIDO_API_BASE_URL !== 'https://nitido.ro') {
      throw new Error('The production Expo profile requires EXPO_PUBLIC_NITIDO_API_BASE_URL=https://nitido.ro.');
    }
  }
  return {
    ...config,
    name: config.name || 'NITIDO',
    slug: config.slug || 'nitido-ro',
    ios: { ...config.ios, infoPlist: { ...config.ios?.infoPlist, ...(distribution ? { NSAppTransportSecurity: { NSAllowsArbitraryLoads: false } } : {}) } },
    android: { ...config.android, blockedPermissions: [...(config.android?.blockedPermissions || []), ...(distribution ? ['android.permission.SYSTEM_ALERT_WINDOW'] : [])], ...(hasGoogleFile ? { googleServicesFile: googleFile } : {}) },
    plugins: (config.plugins || []).map(plugin => Array.isArray(plugin) && plugin[0] === 'expo-notifications'
      ? [plugin[0], { ...plugin[1], mode: distribution ? 'production' : 'development' }]
      : plugin),
  };
};
export default configureApp;
