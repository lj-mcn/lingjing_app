const { getDefaultConfig } = require("@expo/metro-config");

const defaultConfig = getDefaultConfig(__dirname);

defaultConfig.resolver.assetExts.push("cjs");
defaultConfig.resolver.assetExts.push("mp4");
defaultConfig.resolver.unstable_conditionNames = ['browser', 'require', 'react-native'];

module.exports = defaultConfig;