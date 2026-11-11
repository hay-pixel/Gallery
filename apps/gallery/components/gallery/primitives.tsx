import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { galleryTheme as t } from "../../constants/gallery-theme";

export function ActionButton({
  label,
  onPress,
  secondary = false,
  disabled = false,
  icon,
}: {
  label: string;
  onPress?: () => void;
  secondary?: boolean;
  disabled?: boolean;
  icon?: keyof typeof MaterialIcons.glyphMap;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        secondary && s.secondary,
        (pressed || disabled) && { opacity: 0.6 },
      ]}
    >
      {icon ? (
        <MaterialIcons
          name={icon}
          size={20}
          color={secondary ? t.text : t.accentText}
        />
      ) : null}
      <Text style={[s.buttonText, secondary && { color: t.text }]}>
        {label}
      </Text>
    </Pressable>
  );
}
export function IconButton({
  label,
  icon,
  onPress,
  selected,
}: {
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  onPress: () => void;
  selected?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      aria-pressed={selected}
      onPress={onPress}
      style={({ pressed }) => [
        s.iconButton,
        selected && { backgroundColor: t.raised },
        pressed && { opacity: 0.6 },
      ]}
    >
      <MaterialIcons
        name={icon}
        size={21}
        color={selected ? t.accent : t.muted}
      />
    </Pressable>
  );
}
export function ScreenHeading({
  title,
  subtitle,
  eyebrow,
  action,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={s.heading}>
      <View style={{ flex: 1, minWidth: 0 }}>
        {eyebrow ? <Text style={s.eyebrow}>{eyebrow}</Text> : null}
        <Text accessibilityRole="header" style={s.title}>
          {title}
        </Text>
        {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
}
export function FilterChips({
  options,
  value,
  onChange,
}: {
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      style={{ flexGrow: 0, flexShrink: 0 }}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.chips}
    >
      {options.map((label) => (
        <Pressable
          key={label}
          accessibilityRole="button"
          aria-pressed={value === label}
          onPress={() => onChange(label)}
          style={[s.chip, value === label && s.selectedChip]}
        >
          <Text
            style={[s.chipText, value === label && { color: t.accentText }]}
          >
            {label}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
export function Notice({
  text,
  error = false,
}: {
  text: string;
  error?: boolean;
}) {
  return (
    <Text
      accessibilityRole={error ? "alert" : undefined}
      accessibilityLiveRegion="polite"
      style={[s.notice, error && { color: t.error, borderColor: "#75433F" }]}
    >
      {text}
    </Text>
  );
}
export function LoadingState({
  label = "Loading your library",
}: {
  label?: string;
}) {
  return (
    <View style={{ padding: 36, gap: 12, alignItems: "center" }}>
      <ActivityIndicator color={t.accent} />
      <Text style={s.subtitle}>{label}</Text>
    </View>
  );
}
const s = StyleSheet.create({
  heading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingTop: 12,
    paddingBottom: 22,
  },
  eyebrow: {
    color: t.accent,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 2,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  title: {
    color: t.text,
    fontSize: 32,
    fontWeight: "600",
    letterSpacing: -1.1,
  },
  subtitle: { color: t.muted, fontSize: 14, lineHeight: 21, marginTop: 6 },
  button: {
    minHeight: 48,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: t.accent,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  buttonText: { color: t.accentText, fontSize: 14, fontWeight: "700" },
  secondary: {
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.border,
  },
  iconButton: {
    width: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  chips: { alignItems: "center", gap: 8, paddingBottom: 18, paddingTop: 2 },
  chip: {
    minHeight: 44,
    paddingHorizontal: 17,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: t.border,
    justifyContent: "center",
  },
  selectedChip: { backgroundColor: t.accent, borderColor: t.accent },
  chipText: { color: t.muted, fontSize: 14, fontWeight: "600" },
  notice: {
    color: t.muted,
    fontSize: 14,
    lineHeight: 21,
    padding: 14,
    borderWidth: 1,
    borderColor: t.border,
    backgroundColor: t.surface,
    borderRadius: 14,
    marginBottom: 16,
  },
});
