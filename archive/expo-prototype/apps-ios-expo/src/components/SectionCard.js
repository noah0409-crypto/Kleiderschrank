import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing, typography } from "../theme/tokens.js";

export function SectionCard({ eyebrow, title, children, tone = "dark" }) {
  const light = tone === "light";
  return (
    <View style={[styles.card, light ? styles.cardLight : styles.cardDark]}>
      <View style={styles.header}>
        <Text style={[styles.eyebrow, light ? styles.eyebrowLight : styles.eyebrowDark]}>
          {eyebrow}
        </Text>
        <Text style={[styles.title, light ? styles.titleLight : styles.titleDark]}>
          {title}
        </Text>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    padding: spacing.card,
    gap: 12,
    borderWidth: 1,
  },
  cardDark: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  cardLight: {
    backgroundColor: colors.surfaceLight,
    borderColor: "rgba(21,23,27,0.08)",
  },
  header: {
    gap: 4,
  },
  eyebrow: {
    ...typography.eyebrow,
  },
  eyebrowDark: {
    color: colors.textSecondary,
  },
  eyebrowLight: {
    color: "#6B7280",
  },
  title: {
    ...typography.sectionTitle,
  },
  titleDark: {
    color: colors.textPrimary,
  },
  titleLight: {
    color: colors.textDark,
  },
});
