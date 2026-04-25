const { existsSync } = require('fs');
const { resolve }    = require('path');

// These files are only needed for native (EAS) builds — not for Expo Go.
// Skip the reference when the file isn't present so Expo Go keeps working.
const googleServicesFile  = resolve(__dirname, 'google-services.json');
const hasGoogleServices   = existsSync(googleServicesFile);

const googleServicesPlist = resolve(__dirname, 'ios/Drift/GoogleService-Info.plist');
const hasGooglePlist      = existsSync(googleServicesPlist);

/** @type {import('@expo/config').ExpoConfig} */
module.exports = {
  expo: {
    name:                'Drift',
    slug:                'drift-app',
    version:             '1.0.0',
    orientation:         'portrait',
    icon:                './assets/icon.png',
    userInterfaceStyle:  'light',
    newArchEnabled:      true,

    splash: {
      image:           './assets/splash-icon.png',
      resizeMode:      'contain',
      backgroundColor: '#FF4B6E',
    },

    ios: {
      supportsTablet:   false,
      bundleIdentifier: 'com.drift.app',
      // Only included when file exists — no error if not downloaded yet
      ...(hasGooglePlist ? { googleServicesFile: './ios/Drift/GoogleService-Info.plist' } : {}),
    },

    android: {
      package: 'com.drift.app',

      // Only include when file actually exists — prevents Expo config parse error
      // in Expo Go where google-services.json isn't required.
      ...(hasGoogleServices ? { googleServicesFile: './google-services.json' } : {}),

      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#FF4B6E',
      },
      edgeToEdgeEnabled:            true,
      predictiveBackGestureEnabled: false,
    },

    web: {
      favicon: './assets/favicon.png',
    },

    extra: {
      // Expose backend URL to app code (also readable via EXPO_PUBLIC_ prefix)
      backendUrl: process.env.EXPO_PUBLIC_BACKEND_URL ?? '',
    },
  },
};
