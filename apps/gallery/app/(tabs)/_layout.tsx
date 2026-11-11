import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Tabs } from "expo-router";
import React from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { galleryTheme as t } from "../../constants/gallery-theme";
import { CatalogueProvider } from "../../features/catalogue/catalogue-provider";
export default function TabLayout() {
  const insets = useSafeAreaInsets();
  return (
    <CatalogueProvider>
      <Tabs
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: t.background },
          tabBarStyle: {
            backgroundColor: t.background,
            borderTopColor: t.border,
            borderTopWidth: 1,
            height: 62 + Math.max(insets.bottom, 8),
            paddingBottom: Math.max(insets.bottom, 8),
            paddingTop: 8,
          },
          tabBarActiveTintColor: t.accent,
          tabBarInactiveTintColor: t.muted,
          tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Library",
            tabBarAccessibilityLabel: "Library",
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons
                aria-hidden
                name="photo-library"
                color={color}
                size={size ?? 23}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="search"
          options={{
            title: "Search",
            tabBarAccessibilityLabel: "Search",
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons
                aria-hidden
                name="search"
                color={color}
                size={size ?? 23}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="sources"
          options={{
            title: "Sources",
            tabBarAccessibilityLabel: "Sources",
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons
                aria-hidden
                name="folder-open"
                color={color}
                size={size ?? 23}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: "Settings",
            tabBarAccessibilityLabel: "Settings",
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons
                aria-hidden
                name="tune"
                color={color}
                size={size ?? 23}
              />
            ),
          }}
        />
        <Tabs.Screen name="images" options={{ href: null, title: "Images" }} />
        <Tabs.Screen
          name="library"
          options={{ href: null, title: "Library" }}
        />
      </Tabs>
    </CatalogueProvider>
  );
}
