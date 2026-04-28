import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radius } from "../theme/tokens.js";

const tabs = [
  { key: "home", label: "Looks" },
  { key: "create", label: "Upload" },
  { key: "closet", label: "Schrank" },
  { key: "profile", label: "Profil" },
];

export function BottomTabs({ activeTab, onChange }) {
  return (
    <View style={styles.shell}>
      {tabs.map((tab) => {
        const selected = activeTab === tab.key;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onChange(tab.key)}
            style={[styles.tab, selected && styles.tabSelected]}
          >
            <Text style={[styles.label, selected && styles.labelSelected]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 18,
    flexDirection: "row",
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    padding: 8,
    gap: 8,
  },
  tab: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
  },
  tabSelected: {
    backgroundColor: colors.surfaceLight,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  labelSelected: {
    color: colors.textDark,
  },
});
