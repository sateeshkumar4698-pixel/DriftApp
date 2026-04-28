const { existsSync } = require('fs');
const { resolve }    = require('path');

const googleServicesFile  = resolve(__dirname, 'google-services.json');
const hasGoogleServices   = existsSync(googleServicesFile);

const googleServicesPlist = resolve(__dirname, 'ios/Drift/GoogleService-Info.plist');
const hasGooglePlist      = existsSync(googleServicesPlist);

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

/** @type {import('@expo/config').ExpoConfig} */
module.exports = {
  expo: {
    name:                'Drift',
    slug:                'drift-app',
    version:             '1.0.0',
    runtimeVersion:      { policy: 'appVersion' },
    orientation:         'portrait',
    icon:                './assets/icon.png',
    userInterfaceStyle:  'light',
    newArchEnabled:      true,

    splash: {
      image:           './assets/splash-icon.png',
      resizeMode:      'contain',
      backgroundColor: '#FF4B6E',
    },

    // ── Permissions ────────────────────────────────────────────────────────────
    plugins: [
      [
        'expo-camera',
        {
          cameraPermission: 'Drift needs camera access to scan QR codes and share profiles.',
        },
      ],
      [
        'expo-image-picker',
        {
          photosPermission: 'Drift needs photo access to let you add profile photos and post images.',
          cameraPermission: 'Drift needs camera access to take profile photos.',
        },
      ],
      [
        'expo-notifications',
        {
          icon:  './assets/icon.png',
          color: '#FF4B6E',
          sounds: [],
        },
      ],
    ],

    ios: {
      supportsTablet:   false,
      bundleIdentifier: 'com.drift.app',
      buildNumber:      '1',
      infoPlist: {
        NSCameraUsageDescription:            'Drift uses the camera to scan QR codes and take profile photos.',
        NSPhotoLibraryUsageDescription:      'Drift accesses your photos to let you set a profile picture and share images.',
        NSPhotoLibraryAddUsageDescription:   'Drift saves shared profile cards to your photo library.',
        NSMicrophoneUsageDescription:        'Drift uses the microphone for voice rooms with your connections.',
      },
      ...(hasGooglePlist ? { googleServicesFile: './ios/Drift/GoogleService-Info.plist' } : {}),
    },

    android: {
      package:     'com.drift.app',
      versionCode: 1,

      permissions: [
        'CAMERA',
        'READ_MEDIA_IMAGES',
        'READ_EXTERNAL_STORAGE',
        'WRITE_EXTERNAL_STORAGE',
        'VIBRATE',
        'RECEIVE_BOOT_COMPLETED',
        'SCHEDULE_EXACT_ALARM',
        'USE_EXACT_ALARM',
        'INTERNET',
        'ACCESS_NETWORK_STATE',
      ],

      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#FF4B6E',
      },
      edgeToEdgeEnabled:            true,
      predictiveBackGestureEnabled: false,
      enableProguardInReleaseBuilds: true,
      enableShrinkResourcesInReleaseBuilds: true,

      ...(hasGoogleServices ? { googleServicesFile: './google-services.json' } : {}),
    },

    web: {
      favicon: './assets/favicon.png',
    },

    extra: {
      backendUrl: BACKEND_URL,
      eas: { projectId: 'fc2e6166-1ac7-4be0-9ea0-3cf975f0ba64' },
    },
  },
};
