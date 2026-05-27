require('@testing-library/jest-dom');

// Polyfill TextEncoder/TextDecoder for react-router-dom in jsdom
if (typeof global.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}
