import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  define: {
    __DEV__: true,
  },
  esbuild: {
    jsx: "automatic",
  },
  test: {
    environment: "node",
  },
  resolve: {
    alias: {
      "@expo/vector-icons/MaterialIcons": path.resolve(__dirname, "tests/mocks/expo-vector-icons.tsx"),
      "@expo/vector-icons": path.resolve(__dirname, "tests/mocks/expo-vector-icons.tsx"),
      "react-native": path.resolve(__dirname, "tests/mocks/react-native.ts"),
      "@": path.resolve(__dirname, "."),
    },
  },
});
