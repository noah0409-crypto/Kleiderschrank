import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";

import { colors, radius } from "../theme/tokens.js";

export function ChipPill({ label, selected, onPress, invert = false }) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.base,
        invert ? styles.baseInvert : styles.baseDefault,
        selected && (invert ? styles.selectedInvert : styles.selectedDefault),
      ]}
    >
      <Text
        style={[
          styles.text,
          invert ? styles.textInvert : styles.textDefault,
          selected && (invert ? styles.textSelectedInvert : styles.textSelectedDefault),
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  baseDefault: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
  },
  baseInvert: {
    backgroundColor: colors.white,
    borderColor: "rgba(21,23,27,0.08)",
  },
  selectedDefault: {
    backgroundColor: colors.surfaceLight,
    borderColor: colors.surfaceLight,
  },
  selectedInvert: {
    backgroundColor: colors.textDark,
    borderColor: colors.textDark,
  },
  text: {
    fontSize: 13,
    fontWeight: "700",
  },
  textDefault: {
    color: colors.textPrimary,
  },
  textInvert: {
    color: colors.textDark,
  },
  textSelectedDefault: {
    color: colors.textDark,
  },
  textSelectedInvert: {
    color: colors.textPrimary,
  },
});
