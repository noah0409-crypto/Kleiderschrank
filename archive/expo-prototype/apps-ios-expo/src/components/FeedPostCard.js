import React from "react";
import { Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { colors, radius, typography } from "../theme/tokens.js";
import { AvatarView } from "./AvatarView.js";
import { ActionButton } from "./ActionButton.js";
import { resolveAssetUrl } from "../api.js";

function PreviewItem({ item }) {
  return (
    <View style={styles.previewCard}>
      <Image source={{ uri: resolveAssetUrl(item.image) }} style={styles.previewImage} />
      <View style={styles.previewCopy}>
        <Text style={styles.previewTitle}>{item.name}</Text>
        <Text style={styles.metaText}>
          {item.category} · {item.color || "neutral"}
        </Text>
      </View>
    </View>
  );
}

export function FeedPostCard({
  post,
  currentUserId,
  commentValue = "",
  condensed = false,
  onOpenProfile,
  onToggleFollow,
  onToggleLike,
  onCommentChange,
  onSubmitComment,
}) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Pressable style={styles.authorRow} onPress={onOpenProfile}>
          <AvatarView user={post.author} size={42} />
          <View>
            <Text style={styles.authorName}>{post.author.displayName}</Text>
            <Text style={styles.metaText}>@{post.author.username}</Text>
          </View>
        </Pressable>
        {post.author.id !== currentUserId ? (
          <ActionButton
            label={post.isFollowing ? "Entfolgen" : "Folgen"}
            variant="secondary"
            onPress={onToggleFollow}
          />
        ) : null}
      </View>

      <Text style={styles.title}>{post.outfitName}</Text>
      <Text style={styles.bodyText}>{post.caption || "Ohne Caption."}</Text>
      <Text style={styles.metaText}>
        {post.weatherSnapshot?.temperature != null
          ? `${Math.round(post.weatherSnapshot.temperature)} Grad · ${post.weatherSnapshot.weatherLabel}`
          : "Ohne Wetterdaten"}
      </Text>

      <View style={styles.previewList}>
        {post.previewItems.map((item) => (
          <PreviewItem key={item.id} item={item} />
        ))}
      </View>

      <View style={styles.actionRow}>
        <ActionButton
          label={`${post.likedByViewer ? "Unlike" : "Like"} · ${post.likes}`}
          variant="secondary"
          onPress={onToggleLike}
        />
      </View>

      {condensed ? null : (
        <>
          <View style={styles.commentComposer}>
            <TextInput
              style={styles.input}
              placeholder="Kommentar schreiben"
              placeholderTextColor={colors.textSecondary}
              value={commentValue}
              onChangeText={onCommentChange}
            />
            <ActionButton label="Senden" onPress={onSubmitComment} />
          </View>

          {post.comments.length ? (
            <View style={styles.commentList}>
              {post.comments.map((comment) => (
                <View key={comment.id} style={styles.commentCard}>
                  <Text style={styles.commentAuthor}>{comment.authorName}</Text>
                  <Text style={styles.bodyText}>{comment.text}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.metaText}>Noch keine Kommentare.</Text>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 12,
    padding: 16,
    borderRadius: radius.lg,
    backgroundColor: colors.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  authorName: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  title: {
    ...typography.cardTitle,
    color: colors.textPrimary,
  },
  bodyText: {
    ...typography.body,
    color: colors.textPrimary,
  },
  metaText: {
    ...typography.meta,
    color: colors.textSecondary,
  },
  previewList: {
    gap: 10,
  },
  previewCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 10,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  previewImage: {
    width: 58,
    height: 58,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceSoft,
  },
  previewCopy: {
    gap: 4,
    flex: 1,
  },
  previewTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  commentComposer: {
    gap: 8,
  },
  input: {
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: colors.textPrimary,
    fontSize: 15,
  },
  commentList: {
    gap: 10,
  },
  commentCard: {
    borderRadius: radius.md,
    padding: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  commentAuthor: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textPrimary,
  },
});
