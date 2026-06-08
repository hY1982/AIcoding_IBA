const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Monorepo support: watch shared packages and resolve from root node_modules
const monorepoPackages = {
  '@basketball-match/shared': path.resolve(__dirname, '../../shared/types'),
};

config.watchFolders = [
  __dirname,
  path.resolve(__dirname, '../../shared'),
];

config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  ...monorepoPackages,
};

module.exports = config;
