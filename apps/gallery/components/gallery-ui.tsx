import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { createContext, useContext } from "react";
export const lightPalette = {
  bg: "#FFFFFF",
  surface: "#F3F6F9",
  text: "#172D3D",
  muted: "#596D7B",
  line: "#E1E8EC",
  accent: "#176B76",
  tint: "#E7F3F4",
  danger: "#B4433A",
};
export const darkPalette = {
  bg: "#121D25",
  surface: "#1C2B35",
  text: "#F0F5F7",
  muted: "#AABBC5",
  line: "#324650",
  accent: "#7BCAD1",
  tint: "#233E46",
  danger: "#FFACA3",
};
export type Palette = typeof lightPalette;
export const PaletteContext = createContext<Palette>(lightPalette);
export function Label({
  children,
  muted = false,
  large = false,
}: {
  children: React.ReactNode;
  muted?: boolean;
  large?: boolean;
}) {
  const p = useContext(PaletteContext);
  return (
    <Text
      style={{
        color: muted ? p.muted : p.text,
        fontSize: large ? 24 : 15,
        lineHeight: large ? 31 : 23,
        fontWeight: large ? "600" : "400",
      }}
    >
      {children}
    </Text>
  );
}
export function Button({
  title,
  onPress,
  primary = false,
  disabled = false,
  icon,
  style,
}: {
  title: string;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
  icon?: keyof typeof MaterialIcons.glyphMap;
  style?: StyleProp<ViewStyle>;
}) {
  const p = useContext(PaletteContext);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        {
          minHeight: 48,
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderRadius: 12,
          flexDirection: "row",
          gap: 9,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: primary ? p.accent : p.surface,
          opacity: disabled ? 0.45 : pressed ? 0.7 : 1,
        },
        style,
      ]}
    >
      {icon && (
        <MaterialIcons
          name={icon}
          size={20}
          color={primary ? p.bg : p.accent}
        />
      )}
      <Text
        style={{
          color: primary ? p.bg : p.text,
          fontSize: 14,
          fontWeight: "600",
          flexShrink: 1,
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}
export function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: 13, marginBottom: 28 }}>
      <Text
        style={{
          color: useContext(PaletteContext).text,
          fontSize: 19,
          fontWeight: "600",
          lineHeight: 26,
        }}
      >
        {title}
      </Text>
      {children}
    </View>
  );
}
export const layout = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  page: { paddingHorizontal: 22, paddingTop: 12, paddingBottom: 24, gap: 18 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    minHeight: 48,
  },
  center: { paddingVertical: 36, gap: 15 },
  details: { gap: 16, padding: 22 },
  nav: { flexDirection: "row", paddingTop: 8, borderTopWidth: 1 },
  navItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    minHeight: 55,
    paddingHorizontal: 4,
  },
});
