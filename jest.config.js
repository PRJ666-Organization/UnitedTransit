{
  "preset": "jest-expo",
  "transform": {
    "^.+\\.tsx?$": "ts-jest"
  },
  "testEnvironment": "jsdom",
  "moduleFileExtensions": ["ts", "tsx", "js", "jsx", "json", "node"],
  "moduleNameMapper": {
    "^@/(.*)$": "<rootDir>/$1"
  },
  "testMatch": ["**/__tests__/**/*.test.ts", "**/__tests__/**/*.test.tsx"],
  "setupFilesAfterEnv": ["<rootDir>/jest.setup.ts"],
  "transformIgnorePatterns": [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-native-.*|@react-navigation|expo(-.*)?)/)"
  ],
  "collectCoverageFrom": [
    "src/**/*.{ts,tsx}",
    "app/**/*.{ts,tsx}",
    "components/**/*.{ts,tsx}",
    "hooks/**/*.{ts,tsx}",
    "server/**/*.{ts,tsx}",
    "!**/*.d.ts"
  ]
}
