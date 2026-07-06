const { withAndroidManifest } = require('expo/config-plugins');

/**
 * Expo config plugin to add a broad <queries> block to the AndroidManifest.xml.
 *
 * This allows IntentLauncher.openApplication() to see other launcher apps
 * without needing the restricted QUERY_ALL_PACKAGES permission.
 */
const withAndroidQueries = (config) => {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    // Add <queries> with a broad intent filter so the OS resolves MAIN/LAUNCHER packages
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

module.exports = withAndroidQueries;
