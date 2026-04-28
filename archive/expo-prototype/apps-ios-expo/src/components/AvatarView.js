import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";

import { resolveAssetUrl } from "../api.js";
import { colors } from "../theme/tokens.js";

function initials(name) {
  return String(name || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "KS";
}

export function AvatarView({ user, size = 48, dark = false }) {
  const avatarUrl = user?.avatarUrl ? resolveAssetUrl(user.avatarUrl) : "";
  if (avatarUrl) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        style={[
          styles.image,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
          },
        ]}
      />
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        dark ? styles.fallbackDark : styles.fallbackLight,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
      ]}
    >
      <Text style={[styles.initials, dark ? styles.initialsDark : styles.initialsLight]}>
        {initials(user?.displayName || user?.username)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    backgroundColor: colors.surfaceMuted,
  },
  fallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  fallbackDark: {
    backgroundColor: colors.surfaceLight,
  },
  fallbackLight: {
    backgroundColor: colors.surfaceSoft,
  },
  initials: {
    fontSize: 15,
    fontWeight: "700",
  },
  initialsDark: {
    color: colors.textDark,
  },
  initialsLight: {
    color: colors.white,
  },
});
