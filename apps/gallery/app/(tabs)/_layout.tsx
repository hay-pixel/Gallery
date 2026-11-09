import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Tabs } from "expo-router";
import React from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CatalogueProvider } from "../../features/catalogue/catalogue-provider";

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <CatalogueProvider>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: "#080D18",
            borderTopColor: "#263554",
            borderTopWidth: 1,
            height: 56 + Math.max(insets.bottom, 12),
            paddingBottom: Math.max(insets.bottom, 8),
            paddingTop: 6,
          },
          tabBarActiveTintColor: "#50D4FF",
          tabBarInactiveTintColor: "#A8B4C8",
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: "700",
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons name="home" color={color} size={size ?? 22} />
            ),
          }}
        />
        <Tabs.Screen
          name="images"
          options={{
            title: "Images",
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons name="image" color={color} size={size ?? 22} />
            ),
          }}
        />
        <Tabs.Screen
          name="search"
          options={{
            title: "Search",
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons name="search" color={color} size={size ?? 22} />
            ),
          }}
        />
        <Tabs.Screen
          name="library"
          options={{
            title: "Library",
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons name="folder" color={color} size={size ?? 22} />
            ),
          }}
        />
        <Tabs.Screen
          name="sources"
          options={{
            title: "Sources",
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons name="storage" color={color} size={size ?? 22} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: "Settings",
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons name="settings" color={color} size={size ?? 22} />
            ),
          }}
        />
      </Tabs>
    </CatalogueProvider>
  );
}
