import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.mengxj.monosaba.mobile",
  appName: "魔女小屋",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
  android: {
    backgroundColor: "#0a0507",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      backgroundColor: "#0a0507",
      showSpinner: false,
      androidScaleType: "CENTER_CROP",
    },
    StatusBar: {
      overlaysWebView: true,
      style: "DARK",
      backgroundColor: "#00000000",
    },
    ScreenOrientation: {
      orientation: "portrait",
    },
  },
};

export default config;
