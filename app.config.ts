import type { ExpoConfig } from "expo/config";

// Public values only. The anon key is safe to ship in the app binary —
// every query it makes is still gated by Supabase RLS. Never put the
// service-role key or any other secret here.
const SUPABASE_URL = "https://puhhhlleujtdjepgiiuo.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1aGhobGxldWp0ZGplcGdpaXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM2MzI4ODUsImV4cCI6MjEwOTIwODg4NX0.e0RuoYT6XbgWQgpZXpxVxc-ozwLT4SNmN7p4EoTFbyQ";
const API_BASE_URL = "https://wacrm-rosy-alpha.vercel.app";

const config: ExpoConfig = {
  name: "Shanthi Inbox",
  slug: "wacrm-mobile",
  scheme: "wacrm",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "automatic",
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.shanthiboutique.wacrm",
    infoPlist: {
      NSCameraUsageDescription: "Take photos to send to customers on WhatsApp.",
      NSPhotoLibraryUsageDescription: "Choose photos to send to customers on WhatsApp.",
      NSMicrophoneUsageDescription: "Record voice notes to send to customers on WhatsApp.",
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: "com.shanthiboutique.wacrm",
    adaptiveIcon: {
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundImage: "./assets/android-icon-background.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    },
    permissions: ["CAMERA", "RECORD_AUDIO", "POST_NOTIFICATIONS"],
  },
  web: { favicon: "./assets/favicon.png" },
  plugins: [
    "expo-router",
    "expo-secure-store",
    [
      "expo-audio",
      { microphonePermission: "Record voice notes to send to customers on WhatsApp." },
    ],
    [
      "expo-image-picker",
      {
        photosPermission: "Choose photos to send to customers on WhatsApp.",
        cameraPermission: "Take photos to send to customers on WhatsApp.",
      },
    ],
    ["expo-notifications", { color: "#00a884" }],
    "expo-image",
    [
      "expo-splash-screen",
      { image: "./assets/splash-icon.png", imageWidth: 160, resizeMode: "contain", backgroundColor: "#0b141a" },
    ],
  ],
  experiments: { typedRoutes: true },
  extra: {
    supabaseUrl: SUPABASE_URL,
    supabaseAnonKey: SUPABASE_ANON_KEY,
    apiBaseUrl: API_BASE_URL,
    // Filled in by `npx eas-cli init`; push tokens need it.
    eas: { projectId: process.env.EAS_PROJECT_ID },
  },
};

export default config;
