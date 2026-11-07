import React from "react";

export default function MockIcon(props: { name: string; size?: number; color?: string }) {
  return React.createElement("span", { "data-icon": props.name });
}

