import React from "react";
import { View } from "react-native-web";

export function Modal({ visible = true, children, ...props }: { visible?: boolean; children?: React.ReactNode; [key: string]: unknown }) {
  if (visible === false) return null;
  return React.createElement(View, props as Record<string, unknown>, children);
}

