const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Monorepo support: watch shared packages and resolve from root node_modules
const monorepoPackages = {
  '@basketball-match/shared': path.resolve(__dirname, '../../shared/types'),
};

// Path alias support for @/ imports
const pathAliases = {
  '@': path.resolve(__dirname, 'src'),
};

// Merge with Expo's default watch folders
const defaultWatchFolders = config.watchFolders || [];
config.watchFolders = [
  ...defaultWatchFolders,
  path.resolve(__dirname, '../../shared'),
];

config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
  path.resolve(__dirname, '../../node_modules'),
];

config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  ...monorepoPackages,
  ...pathAliases,
};

module.exports = config;
