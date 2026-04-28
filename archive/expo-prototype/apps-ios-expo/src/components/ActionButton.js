import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";

import { colors, radius } from "../theme/tokens.js";

export function ActionButton({ label, onPress, variant = "primary", fullWidth = false }) {
  const isPrimary = variant === "primary";
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.base,
        isPrimary ? styles.primary : styles.secondary,
        fullWidth && styles.fullWidth,
      ]}
    >
      <Text style={[styles.text, isPrimary ? styles.primaryText : styles.secondaryText]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 50,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  fullWidth: {
    width: "100%",
  },
  primary: {
    backgroundColor: colors.surfaceLight,
  },
  secondary: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  text: {
    fontSize: 15,
    fontWeight: "700",
  },
  primaryText: {
    color: colors.textDark,
  },
  secondaryText: {
    color: colors.textPrimary,
  },
});
