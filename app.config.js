const appJson = require("./app.json");
const appConfig = appJson.expo;

module.exports = {
  ...appConfig,
  android: {
    ...(appConfig.android || {}),
    package: appConfig.android?.package || "com.hotplate.fooddelivery",
    config: {
      ...(appConfig.android?.config || {}),
      googleMaps: {
        ...(appConfig.android?.config?.googleMaps || {}),
        apiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY,
      },
    },
  },
};
