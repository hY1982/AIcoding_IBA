// Disable automatic cleanup to avoid timeout issues with fake timers
// Must be set BEFORE importing @testing-library/react-native
process.env.RNTL_SKIP_AUTO_CLEANUP = 'true';

// Polyfill setImmediate for React Native TouchableOpacity in jsdom
// @ts-expect-error: setImmediate is not defined in jsdom
if (typeof global.setImmediate === 'undefined') {
  global.setImmediate = (fn: (...args: unknown[]) => unknown, ...args: unknown[]) =>
    setTimeout(fn, 0, ...args);
}

// Register @testing-library/react-native matchers
// Use require (not import) to ensure env var is set before module loads
require('@testing-library/react-native');

// Mock React Navigation
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({
      navigate: jest.fn(),
      goBack: jest.fn(),
      setOptions: jest.fn(),
    }),
    useRoute: () => ({
      params: {},
    }),
  };
});

// Mock react-native-screens
jest.mock('react-native-screens', () => ({
  ...jest.requireActual('react-native-screens'),
  enableScreens: jest.fn(),
}));

// Use fake timers for consistent async behavior
jest.useFakeTimers();
