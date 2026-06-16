const { withAndroidManifest } = require('expo/config-plugins');

/**
 * Expo config plugin to add QUERY_ALL_PACKAGES permission and a
 * broad <queries> block to the AndroidManifest.xml.
 *
 * This is required on Android 11+ (API 30+) so that
 * IntentLauncher.openApplication() and Linking.canOpenURL()
 * can see other installed packages (including games managed
 * by Samsung Gaming Hub).
 */
const withQueryAllPackages = (config) => {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    // 1. Add <uses-permission android:name="android.permission.QUERY_ALL_PACKAGES" />
    if (!manifest['uses-permission']) {
      manifest['uses-permission'] = [];
    }
    const alreadyHasPermission = manifest['uses-permission'].some(
      (p) => p.$?.['android:name'] === 'android.permission.QUERY_ALL_PACKAGES'
    );
    if (!alreadyHasPermission) {
      manifest['uses-permission'].push({
        $: { 'android:name': 'android.permission.QUERY_ALL_PACKAGES' },
      });
    }

    // 2. Add <queries> with a broad intent filter so the OS resolves MAIN/LAUNCHER packages
    if (!manifest['queries']) {
      manifest['queries'] = [];
    }
    manifest['queries'].push({
      intent: [
        {
          action: [{ $: { 'android:name': 'android.intent.action.MAIN' } }],
          category: [{ $: { 'android:name': 'android.intent.category.LAUNCHER' } }],
        },
      ],
    });

    return config;
  });
};

module.exports = withQueryAllPackages;
