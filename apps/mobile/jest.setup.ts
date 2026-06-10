// Node.js v24+ compatibility: pre-define window to prevent react-native jest setup from redefining it
// @ts-expect-error: window polyfill for Node v24
if (!global.window) {
  global.window = global;
}

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
  const React = require('react');
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
    useFocusEffect: (cb: () => (() => void) | void) => {
      React.useEffect(() => {
        const cleanup = cb();
        return cleanup;
      }, []);
    },
  };
});

// Mock react-native-screens
jest.mock('react-native-screens', () => ({
  ...jest.requireActual('react-native-screens'),
  enableScreens: jest.fn(),
}));

// Use fake timers for consistent async behavior
jest.useFakeTimers();
