// jest-setup.ts
import '@testing-library/react-native/extend-expect';

// Mock expo-router
jest.mock('expo-router', () => ({
  Tabs: 'Tabs',
  useRouter: () => ({
    push: jest.fn(),
    back: jest.fn(),
  }),
  useFocusEffect: jest.fn(),
}));

// Mock gesture handler
jest.mock('react-native-gesture-handler', () => {
  const View = require('react-native').View;
  return {
    GestureHandlerRootView: View,
  };
});

// Mock safe area context
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: any) => children,
  SafeAreaView: ({ children }: any) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// Mock reanimated
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

// Silence console warnings during tests
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
};
