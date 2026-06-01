jest.mock('react-native/Libraries/Utilities/Platform', () => ({
  OS: 'android',
  select: jest.fn(),
}));

jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual('react-native-reanimated'),
  useReducedMotion: jest.fn(() => false),
}));

jest.mock('expo-router', () => ({
  useRouter: jest.fn(() => ({
    navigate: jest.fn(),
    replace: jest.fn(),
    push: jest.fn(),
    back: jest.fn(),
  })),
  useLocalSearchParams: jest.fn(() => ({})),
  useFocusEffect: jest.fn((cb) => cb()),
  Link: jest.fn(({ href, children }) => `Link[href="${href}"]`),
}));

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(() =>
    Promise.resolve({ status: 'granted' }),
  ),
  getCurrentPositionAsync: jest.fn(() =>
    Promise.resolve({
      coords: { latitude: 43.6532, longitude: -79.3832 },
    }),
  ),
}));

jest.mock('@react-google-maps/api', () => ({
  useJsApiLoader: jest.fn(() => ({ isLoaded: true, loadError: null })),
  GoogleMap: jest.fn(({ onLoad, children }) => {
    onLoad && onLoad({ panTo: jest.fn(), setZoom: jest.fn() });
    return `GoogleMap[${children?.length || 0}]`;
  }),
  Marker: jest.fn(() => 'Marker'),
  Autocomplete: jest.fn(({ children }) => `Autocomplete[${children}]`),
  DirectionsRenderer: jest.fn(() => 'DirectionsRenderer'),
}));

jest.mock('react-native-maps', () => ({
  default: jest.fn(() => 'MapView'),
  Marker: jest.fn(() => 'Marker'),
  Polyline: jest.fn(() => 'Polyline'),
  PROVIDER_GOOGLE: 'google',
}));

jest.mock('expo-constants', () => ({
  default: { expoConfig: { extra: {}, plugins: [] } },
}));

jest.mock('expo-font', () => ({
  isLoaded: jest.fn(() => true),
  loadAsync: jest.fn(() => Promise.resolve(true)),
  isFontLoaderEnabled: jest.fn(() => true),
}));

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(() => Promise.resolve()),
  hideAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light' },
}));

jest.mock('@react-navigation/bottom-tabs', () => ({
  createBottomTabNavigator: jest.fn(() => ({
    Screen: jest.fn(),
    Navigator: jest.fn(),
  })),
}));

jest.mock('@/hooks/use-color-scheme', () => ({
  useColorScheme: jest.fn(() => 'light'),
}));

global.fetch = jest.fn();
