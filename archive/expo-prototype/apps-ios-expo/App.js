import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";

import { api, API_URL, resolveAssetUrl } from "./src/api.js";
import { CATEGORIES, OCCASIONS, SEASONS, STYLES, TEMPERATURES, VIBES } from "./src/constants.js";
import {
  buildRecommendationContext,
  pickBestItems,
  summarizeLook,
  weatherCodeToLabel,
} from "./src/recommendation.js";
import { ActionButton } from "./src/components/ActionButton.js";
import { AvatarView } from "./src/components/AvatarView.js";
import { BottomTabs } from "./src/components/BottomTabs.js";
import { ChipPill } from "./src/components/ChipPill.js";
import { FeedPostCard } from "./src/components/FeedPostCard.js";
import { SectionCard } from "./src/components/SectionCard.js";
import { colors, radius, spacing, typography } from "./src/theme/tokens.js";

const STORAGE_KEY = "kleiderschrank-session-token";

const emptySession = {
  authenticated: false,
  user: null,
  wardrobe: [],
  savedOutfits: [],
  sharedOutfits: [],
  featuredProfiles: [],
};

const initialClothingDraft = {
  name: "",
  category: "Top",
  color: "",
  seasons: [...SEASONS],
  temperature: "all",
  occasions: ["Alltag"],
  styles: ["minimal"],
};

function titleize(value) {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function toggleValue(items, value) {
  return items.includes(value) ? items.filter((entry) => entry !== value) : [...items, value];
}

function createDataUrlFromAsset(asset) {
  if (!asset?.base64) return "";
  return `data:${asset.mimeType || "image/jpeg"};base64,${asset.base64}`;
}

function emptyProfileDraft(user) {
  return {
    displayName: user?.displayName || "",
    bio: user?.bio || "",
    clearAvatar: false,
    avatarPreview: user?.avatarUrl ? resolveAssetUrl(user.avatarUrl) : "",
    avatarDataUrl: "",
  };
}

function MiniWardrobeCard({ item }) {
  return (
    <View style={styles.miniItem}>
      <Image source={{ uri: resolveAssetUrl(item.image) }} style={styles.miniItemImage} />
      <View style={styles.miniItemCopy}>
        <Text style={styles.miniItemTitle}>{item.name}</Text>
        <Text style={styles.metaText}>
          {item.category} · {item.color || "neutral"}
        </Text>
      </View>
    </View>
  );
}

function MetricPill({ label, value }) {
  return (
    <View style={styles.metricPill}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [sessionToken, setSessionToken] = useState("");
  const [session, setSession] = useState(emptySession);
  const [activeTab, setActiveTab] = useState("create");
  const [authMode, setAuthMode] = useState("signup");
  const [authDraft, setAuthDraft] = useState({
    displayName: "",
    username: "",
    password: "",
  });
  const [weather, setWeather] = useState(null);
  const [manualTemperature, setManualTemperature] = useState("");
  const [occasion, setOccasion] = useState("Alltag");
  const [vibe, setVibe] = useState("clean");
  const [recommendation, setRecommendation] = useState(null);
  const [clothingDraft, setClothingDraft] = useState(initialClothingDraft);
  const [clothingImage, setClothingImage] = useState(null);
  const [profileDraft, setProfileDraft] = useState(emptyProfileDraft(null));
  const [viewedProfile, setViewedProfile] = useState(null);
  const [commentDrafts, setCommentDrafts] = useState({});
  const [busyAction, setBusyAction] = useState("");

  const apiConfigured = Boolean(API_URL) && !API_URL.includes("deine-render-url.onrender.com");

  useEffect(() => {
    bootstrap();
  }, []);

  useEffect(() => {
    setProfileDraft(emptyProfileDraft(session.user));
  }, [session.user?.id]);

  async function bootstrap() {
    try {
      const storedToken = (await AsyncStorage.getItem(STORAGE_KEY)) || "";
      if (storedToken) {
        setSessionToken(storedToken);
        await loadSession(storedToken);
      }
    } catch (error) {
      showError(error);
    } finally {
      setLoading(false);
    }
  }

  async function persistSessionToken(nextToken) {
    setSessionToken(nextToken);
    if (nextToken) {
      await AsyncStorage.setItem(STORAGE_KEY, nextToken);
      return;
    }
    await AsyncStorage.removeItem(STORAGE_KEY);
  }

  function applySessionPayload(payload) {
    setSession({
      authenticated: payload.authenticated,
      user: payload.user,
      wardrobe: payload.wardrobe || [],
      savedOutfits: payload.savedOutfits || [],
      sharedOutfits: payload.sharedOutfits || [],
      featuredProfiles: payload.featuredProfiles || [],
    });
  }

  async function loadSession(tokenOverride = sessionToken) {
    if (!tokenOverride) {
      setSession(emptySession);
      return;
    }

    const payload = await api("/api/session", { token: tokenOverride });
    if (!payload.authenticated) {
      await persistSessionToken("");
      setSession(emptySession);
      return;
    }

    applySessionPayload(payload);
  }

  async function refreshSessionAndProfile() {
    await loadSession();
    if (viewedProfile?.profile?.username) {
      await loadPublicProfile(viewedProfile.profile.username);
    }
  }

  function showError(error) {
    Alert.alert("Fehler", error?.message || String(error));
  }

  async function submitAuth() {
    try {
      setBusyAction("auth");
      const path = authMode === "signup" ? "/api/signup" : "/api/login";
      const payload = await api(path, {
        method: "POST",
        body:
          authMode === "signup"
            ? {
                displayName: authDraft.displayName.trim(),
                username: authDraft.username.trim(),
                password: authDraft.password,
              }
            : {
                username: authDraft.username.trim(),
                password: authDraft.password,
              },
      });

      await persistSessionToken(payload.sessionToken || "");
      applySessionPayload(payload);
      setAuthDraft({ displayName: "", username: "", password: "" });
      setActiveTab("create");
    } catch (error) {
      showError(error);
    } finally {
      setBusyAction("");
    }
  }

  async function logout() {
    try {
      if (sessionToken) {
        await api("/api/logout", { method: "POST", token: sessionToken });
      }
    } catch {
      // Ignore logout network issues and clear local state anyway.
    } finally {
      await persistSessionToken("");
      setSession(emptySession);
      setViewedProfile(null);
      setWeather(null);
      setRecommendation(null);
      setClothingImage(null);
      setActiveTab("create");
    }
  }

  async function chooseImage(source, target) {
    try {
      const permission =
        source === "camera"
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Zugriff noetig",
          source === "camera"
            ? "Bitte erlaube der App den Kamerazugriff."
            : "Bitte erlaube der App den Fotozugriff."
        );
        return;
      }

      const pickerFn =
        source === "camera"
          ? ImagePicker.launchCameraAsync
          : ImagePicker.launchImageLibraryAsync;

      const result = await pickerFn({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.88,
        base64: true,
      });

      if (result.canceled) return;

      const asset = result.assets?.[0];
      const imagePayload = {
        uri: asset?.uri || "",
        dataUrl: createDataUrlFromAsset(asset),
      };

      if (!imagePayload.dataUrl) {
        throw new Error("Das Bild konnte nicht gelesen werden.");
      }

      if (target === "profile") {
        setProfileDraft((current) => ({
          ...current,
          clearAvatar: false,
          avatarPreview: imagePayload.uri,
          avatarDataUrl: imagePayload.dataUrl,
        }));
        return;
      }

      setClothingImage(imagePayload);
    } catch (error) {
      showError(error);
    }
  }

  async function loadWeatherForOutfits() {
    try {
      setBusyAction("weather");
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Standort fehlt",
          "Bitte erlaube der App den Standort oder trage die Temperatur manuell ein."
        );
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const payload = await api(
        `/api/weather?lat=${location.coords.latitude}&lon=${location.coords.longitude}`,
        { token: sessionToken }
      );

      setWeather(payload);
    } catch (error) {
      showError(error);
    } finally {
      setBusyAction("");
    }
  }

  function generateRecommendation() {
    if (!session.wardrobe.length) {
      Alert.alert("Noch leer", "Speichere zuerst ein paar Kleidungsstuecke.");
      return;
    }

    const context = buildRecommendationContext({
      weather,
      manualTemperature,
      occasion,
      vibe,
    });
    const items = pickBestItems(session.wardrobe, context);

    if (!items.length) {
      Alert.alert(
        "Nichts gefunden",
        "Fuer diesen Anlass fehlen passende Kleidungsstuecke."
      );
      return;
    }

    const summary = summarizeLook(items, context);
    setRecommendation({
      title: `${occasion}-Look im ${vibe}-Vibe`,
      items,
      context,
      summary,
      reason: `Der Vorschlag kombiniert ${occasion.toLowerCase()}-Teile, ${summary.primaryStyle}-Stil und eine ${summary.primaryColor}-nahe Farbpalette fuer ${Math.round(context.temperature)} Grad bei ${context.weatherLabel}.`,
    });
  }

  async function saveRecommendation() {
    if (!recommendation) return;

    try {
      setBusyAction("save-outfit");
      await api("/api/outfits", {
        method: "POST",
        token: sessionToken,
        body: {
          name: recommendation.title,
          caption: recommendation.reason,
          itemIds: recommendation.items.map((item) => item.id),
          occasion: recommendation.context.occasion,
          weatherSnapshot: {
            temperature: recommendation.context.temperature,
            weatherLabel: recommendation.context.weatherLabel,
          },
        },
      });
      await loadSession();
      setActiveTab("closet");
    } catch (error) {
      showError(error);
    } finally {
      setBusyAction("");
    }
  }

  async function saveClothingItem() {
    if (!clothingImage?.dataUrl) {
      Alert.alert(
        "Bild fehlt",
        "Bitte fotografiere zuerst das Kleidungsstueck oder waehle ein Bild aus."
      );
      return;
    }

    try {
      setBusyAction("save-clothing");
      await api("/api/wardrobe", {
        method: "POST",
        token: sessionToken,
        body: {
          ...clothingDraft,
          name: clothingDraft.name.trim(),
          color: clothingDraft.color.trim(),
          image: clothingImage.dataUrl,
        },
      });

      setClothingDraft(initialClothingDraft);
      setClothingImage(null);
      await loadSession();
      setActiveTab("closet");
    } catch (error) {
      showError(error);
    } finally {
      setBusyAction("");
    }
  }

  async function saveProfile() {
    try {
      setBusyAction("profile");
      const payload = await api("/api/profile", {
        method: "PATCH",
        token: sessionToken,
        body: {
          displayName: profileDraft.displayName.trim(),
          bio: profileDraft.bio.trim(),
          avatarImage: profileDraft.avatarDataUrl,
          clearAvatar: profileDraft.clearAvatar,
        },
      });

      setSession((current) => ({
        ...current,
        user: payload.user,
      }));
      setProfileDraft(emptyProfileDraft(payload.user));
    } catch (error) {
      showError(error);
    } finally {
      setBusyAction("");
    }
  }

  async function loadPublicProfile(username) {
    try {
      const payload = await api(`/api/profiles/${encodeURIComponent(username)}`, {
        token: sessionToken,
      });
      setViewedProfile(payload);
    } catch (error) {
      showError(error);
    }
  }

  async function followUser(targetUserId, usernameToRefresh) {
    try {
      await api("/api/follows", {
        method: "POST",
        token: sessionToken,
        body: { targetUserId },
      });
      await refreshSessionAndProfile();
      if (usernameToRefresh) {
        await loadPublicProfile(usernameToRefresh);
      }
    } catch (error) {
      showError(error);
    }
  }

  async function toggleLike(post) {
    try {
      await api(`/api/shared-outfits/${post.id}/like`, {
        method: "POST",
        token: sessionToken,
      });
      await refreshSessionAndProfile();
    } catch (error) {
      showError(error);
    }
  }

  async function postComment(post) {
    const text = (commentDrafts[post.id] || "").trim();
    if (!text) return;

    try {
      await api(`/api/shared-outfits/${post.id}/comments`, {
        method: "POST",
        token: sessionToken,
        body: { text },
      });
      setCommentDrafts((current) => ({ ...current, [post.id]: "" }));
      await refreshSessionAndProfile();
    } catch (error) {
      showError(error);
    }
  }

  async function deleteWardrobeItem(itemId) {
    try {
      await api(`/api/wardrobe/${itemId}`, {
        method: "DELETE",
        token: sessionToken,
      });
      await loadSession();
    } catch (error) {
      showError(error);
    }
  }

  async function deleteOutfit(outfitId) {
    try {
      await api(`/api/outfits/${outfitId}`, {
        method: "DELETE",
        token: sessionToken,
      });
      await loadSession();
    } catch (error) {
      showError(error);
    }
  }

  async function shareOutfit(outfitId) {
    try {
      await api("/api/shared-outfits", {
        method: "POST",
        token: sessionToken,
        body: { outfitId },
      });
      await loadSession();
      setActiveTab("home");
    } catch (error) {
      showError(error);
    }
  }

  function renderAuthScreen() {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" />
        <ScrollView contentContainerStyle={styles.authScroll}>
          <View style={styles.authShell}>
            <View style={styles.authHero}>
              <Text style={styles.darkEyebrow}>Kleiderschrank</Text>
              <Text style={styles.authTitle}>Native iPhone-App fuer deinen Style</Text>
              <Text style={styles.authText}>
                Fotografieren, hochladen, Outfit-Vorschlaege bekommen und deine Looks in einer
                hochwertigen App verwalten.
              </Text>
            </View>

            <SectionCard
              eyebrow={authMode === "signup" ? "Registrierung" : "Login"}
              title={authMode === "signup" ? "Account anlegen" : "Einloggen"}
              tone="light"
            >
              <View style={styles.modeRow}>
                <ChipPill
                  label="Registrieren"
                  selected={authMode === "signup"}
                  invert
                  onPress={() => setAuthMode("signup")}
                />
                <ChipPill
                  label="Login"
                  selected={authMode === "login"}
                  invert
                  onPress={() => setAuthMode("login")}
                />
              </View>

              {authMode === "signup" ? (
                <TextInput
                  style={[styles.input, styles.inputLight]}
                  placeholder="Anzeigename"
                  placeholderTextColor="#6B7280"
                  value={authDraft.displayName}
                  onChangeText={(value) =>
                    setAuthDraft((current) => ({ ...current, displayName: value }))
                  }
                />
              ) : null}

              <TextInput
                style={[styles.input, styles.inputLight]}
                autoCapitalize="none"
                placeholder="Benutzername"
                placeholderTextColor="#6B7280"
                value={authDraft.username}
                onChangeText={(value) =>
                  setAuthDraft((current) => ({ ...current, username: value }))
                }
              />

              <TextInput
                style={[styles.input, styles.inputLight]}
                secureTextEntry
                placeholder="Passwort"
                placeholderTextColor="#6B7280"
                value={authDraft.password}
                onChangeText={(value) =>
                  setAuthDraft((current) => ({ ...current, password: value }))
                }
              />

              <ActionButton
                label={
                  busyAction === "auth"
                    ? "Bitte warten..."
                    : authMode === "signup"
                      ? "Account erstellen"
                      : "Einloggen"
                }
                variant="primary"
                fullWidth
                onPress={submitAuth}
              />
            </SectionCard>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  function renderHomeTab() {
    return (
      <>
        <SectionCard eyebrow="Heute" title="Atelier fuer deinen Tageslook">
          <Text style={styles.bodyText}>
            {weather?.current
              ? `${Math.round(weather.current.temperature_2m)} Grad · ${weatherCodeToLabel(weather.current.weather_code)}`
              : "Noch kein Wetter geladen. Du kannst die Temperatur auch manuell eintragen."}
          </Text>
          <View style={styles.actionRow}>
            <ActionButton
              label={busyAction === "weather" ? "Laedt..." : "Wetter abrufen"}
              onPress={loadWeatherForOutfits}
            />
          </View>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            placeholder="Temperatur manuell, z. B. 18"
            placeholderTextColor={colors.textSecondary}
            value={manualTemperature}
            onChangeText={setManualTemperature}
          />
        </SectionCard>

        <SectionCard eyebrow="Empfehlung" title="Outfit Engine">
          <Text style={styles.fieldLabel}>Anlass</Text>
          <View style={styles.chipRow}>
            {OCCASIONS.map((entry) => (
              <ChipPill
                key={entry}
                label={entry}
                selected={occasion === entry}
                onPress={() => setOccasion(entry)}
              />
            ))}
          </View>

          <Text style={styles.fieldLabel}>Vibe</Text>
          <View style={styles.chipRow}>
            {VIBES.map((entry) => (
              <ChipPill
                key={entry}
                label={titleize(entry)}
                selected={vibe === entry}
                onPress={() => setVibe(entry)}
              />
            ))}
          </View>

          <ActionButton label="Outfit vorschlagen" onPress={generateRecommendation} fullWidth />

          {recommendation ? (
            <View style={styles.stack}>
              <Text style={styles.sectionSubTitle}>{recommendation.title}</Text>
              <Text style={styles.metaText}>
                {Math.round(recommendation.context.temperature)} Grad · {recommendation.summary.primaryStyle}
              </Text>
              <Text style={styles.bodyText}>{recommendation.reason}</Text>
              <View style={styles.stack}>
                {recommendation.items.map((item) => (
                  <MiniWardrobeCard key={item.id} item={item} />
                ))}
              </View>
              <ActionButton
                label={busyAction === "save-outfit" ? "Speichert..." : "Outfit speichern"}
                variant="secondary"
                onPress={saveRecommendation}
                fullWidth
              />
            </View>
          ) : (
            <Text style={styles.metaText}>Noch kein Outfit generiert.</Text>
          )}
        </SectionCard>

        <SectionCard eyebrow="Community" title="Profile entdecken">
          {session.featuredProfiles.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.storyRail}>
                {session.featuredProfiles.map((profile) => (
                  <Pressable
                    key={profile.id}
                    style={styles.profileBubble}
                    onPress={async () => {
                      await loadPublicProfile(profile.username);
                      setActiveTab("profile");
                    }}
                  >
                    <AvatarView user={profile} size={58} />
                    <Text style={styles.profileBubbleName}>{profile.displayName}</Text>
                    <Text style={styles.metaText}>@{profile.username}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          ) : (
            <Text style={styles.metaText}>
              Sobald Nutzer ihre Looks teilen, erscheinen die ersten Profile hier.
            </Text>
          )}
        </SectionCard>

        <SectionCard eyebrow="Feed" title="Geteilte Outfits">
          {session.sharedOutfits.length ? (
            <View style={styles.stack}>
              {session.sharedOutfits.map((post) => (
                <FeedPostCard
                  key={post.id}
                  post={post}
                  currentUserId={session.user?.id}
                  commentValue={commentDrafts[post.id] || ""}
                  onOpenProfile={async () => {
                    await loadPublicProfile(post.author.username);
                    setActiveTab("profile");
                  }}
                  onToggleFollow={() => followUser(post.author.id, post.author.username)}
                  onToggleLike={() => toggleLike(post)}
                  onCommentChange={(value) =>
                    setCommentDrafts((current) => ({ ...current, [post.id]: value }))
                  }
                  onSubmitComment={() => postComment(post)}
                />
              ))}
            </View>
          ) : (
            <Text style={styles.metaText}>Noch keine geteilten Looks.</Text>
          )}
        </SectionCard>
      </>
    );
  }

  function renderCreateTab() {
    return (
      <>
        <SectionCard eyebrow="Upload Studio" title="Kleidung fotografieren" tone="light">
          {clothingImage?.uri ? (
            <Image source={{ uri: clothingImage.uri }} style={styles.heroImage} />
          ) : (
            <View style={styles.heroPlaceholder}>
              <Text style={styles.heroPlaceholderTitle}>Bereit fuer dein naechstes Kleidungsstueck</Text>
              <Text style={styles.heroPlaceholderText}>
                Nimm direkt ein Foto auf oder waehle ein Bild aus deiner Galerie.
              </Text>
            </View>
          )}

          <View style={styles.actionRow}>
            <ActionButton label="Kamera" onPress={() => chooseImage("camera", "clothing")} />
            <ActionButton
              label="Galerie"
              variant="secondary"
              onPress={() => chooseImage("library", "clothing")}
            />
          </View>
        </SectionCard>

        <SectionCard eyebrow="Details" title="Kleidungsstueck anlegen">
          <TextInput
            style={styles.input}
            placeholder="Name, z. B. Anthrazit Overshirt"
            placeholderTextColor={colors.textSecondary}
            value={clothingDraft.name}
            onChangeText={(value) => setClothingDraft((current) => ({ ...current, name: value }))}
          />
          <TextInput
            style={styles.input}
            placeholder="Farbe"
            placeholderTextColor={colors.textSecondary}
            value={clothingDraft.color}
            onChangeText={(value) => setClothingDraft((current) => ({ ...current, color: value }))}
          />

          <Text style={styles.fieldLabel}>Kategorie</Text>
          <View style={styles.chipRow}>
            {CATEGORIES.map((entry) => (
              <ChipPill
                key={entry}
                label={entry}
                selected={clothingDraft.category === entry}
                onPress={() => setClothingDraft((current) => ({ ...current, category: entry }))}
              />
            ))}
          </View>

          <Text style={styles.fieldLabel}>Jahreszeiten</Text>
          <View style={styles.chipRow}>
            {SEASONS.map((entry) => (
              <ChipPill
                key={entry}
                label={entry}
                selected={clothingDraft.seasons.includes(entry)}
                onPress={() =>
                  setClothingDraft((current) => ({
                    ...current,
                    seasons: toggleValue(current.seasons, entry),
                  }))
                }
              />
            ))}
          </View>

          <Text style={styles.fieldLabel}>Temperaturbereich</Text>
          <View style={styles.chipRow}>
            {TEMPERATURES.map((entry) => (
              <ChipPill
                key={entry}
                label={titleize(entry)}
                selected={clothingDraft.temperature === entry}
                onPress={() =>
                  setClothingDraft((current) => ({ ...current, temperature: entry }))
                }
              />
            ))}
          </View>

          <Text style={styles.fieldLabel}>Anlass</Text>
          <View style={styles.chipRow}>
            {OCCASIONS.map((entry) => (
              <ChipPill
                key={entry}
                label={entry}
                selected={clothingDraft.occasions.includes(entry)}
                onPress={() =>
                  setClothingDraft((current) => ({
                    ...current,
                    occasions: toggleValue(current.occasions, entry),
                  }))
                }
              />
            ))}
          </View>

          <Text style={styles.fieldLabel}>Stile</Text>
          <View style={styles.chipRow}>
            {STYLES.map((entry) => (
              <ChipPill
                key={entry}
                label={titleize(entry)}
                selected={clothingDraft.styles.includes(entry)}
                onPress={() =>
                  setClothingDraft((current) => ({
                    ...current,
                    styles: toggleValue(current.styles, entry),
                  }))
                }
              />
            ))}
          </View>

          <ActionButton
            label={
              busyAction === "save-clothing"
                ? "Speichert..."
                : "Kleidungsstueck speichern"
            }
            onPress={saveClothingItem}
            fullWidth
          />
        </SectionCard>
      </>
    );
  }

  function renderClosetTab() {
    return (
      <>
        <SectionCard eyebrow="Gespeichert" title="Deine Outfits">
          {session.savedOutfits.length ? (
            <View style={styles.stack}>
              {session.savedOutfits.map((outfit) => (
                <View key={outfit.id} style={styles.listCard}>
                  <Text style={styles.sectionSubTitle}>{outfit.name}</Text>
                  <Text style={styles.metaText}>
                    {outfit.occasion} · {Math.round(outfit.weatherSnapshot?.temperature || 0)} Grad
                  </Text>
                  <Text style={styles.bodyText}>
                    {outfit.caption || "Kein Text hinterlegt."}
                  </Text>
                  <View style={styles.stack}>
                    {outfit.items.map((item) => (
                      <MiniWardrobeCard key={item.id} item={item} />
                    ))}
                  </View>
                  <View style={styles.actionRow}>
                    <ActionButton
                      label="Teilen"
                      variant="secondary"
                      onPress={() => shareOutfit(outfit.id)}
                    />
                    <ActionButton
                      label="Loeschen"
                      variant="secondary"
                      onPress={() => deleteOutfit(outfit.id)}
                    />
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.metaText}>Hier erscheinen deine gespeicherten Outfits.</Text>
          )}
        </SectionCard>

        <SectionCard eyebrow="Schrank" title="Deine Teile">
          {session.wardrobe.length ? (
            <View style={styles.stack}>
              {session.wardrobe.map((item) => (
                <View key={item.id} style={styles.listCard}>
                  <Image source={{ uri: resolveAssetUrl(item.image) }} style={styles.wardrobeImage} />
                  <Text style={styles.sectionSubTitle}>{item.name}</Text>
                  <Text style={styles.metaText}>
                    {item.category} · {item.color || "ohne Farbangabe"}
                  </Text>
                  <Text style={styles.bodyText}>
                    {[...item.seasons, ...item.occasions, ...(item.styles || []), item.temperature].join(" · ")}
                  </Text>
                  <ActionButton
                    label="Loeschen"
                    variant="secondary"
                    onPress={() => deleteWardrobeItem(item.id)}
                    fullWidth
                  />
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.metaText}>Noch keine Kleidungsstuecke gespeichert.</Text>
          )}
        </SectionCard>
      </>
    );
  }

  function renderProfileTab() {
    const stats = session.user?.stats || {};

    return (
      <>
        <SectionCard eyebrow="Profil" title="Dein Account">
          <View style={styles.profileHead}>
            <AvatarView
              user={{
                displayName: session.user?.displayName,
                username: session.user?.username,
                avatarUrl:
                  profileDraft.clearAvatar
                    ? ""
                    : profileDraft.avatarPreview || session.user?.avatarUrl,
              }}
              size={72}
            />
            <View style={styles.profileHeadCopy}>
              <Text style={styles.sectionSubTitle}>{session.user?.displayName}</Text>
              <Text style={styles.metaText}>@{session.user?.username}</Text>
            </View>
          </View>

          <View style={styles.metricRow}>
            <MetricPill label="Teile" value={stats.wardrobeItems || 0} />
            <MetricPill label="Looks" value={stats.sharedOutfits || 0} />
            <MetricPill label="Follower" value={stats.followers || 0} />
          </View>

          <TextInput
            style={styles.input}
            placeholder="Anzeigename"
            placeholderTextColor={colors.textSecondary}
            value={profileDraft.displayName}
            onChangeText={(value) =>
              setProfileDraft((current) => ({ ...current, displayName: value }))
            }
          />
          <TextInput
            style={[styles.input, styles.textArea]}
            multiline
            placeholder="Bio"
            placeholderTextColor={colors.textSecondary}
            value={profileDraft.bio}
            onChangeText={(value) => setProfileDraft((current) => ({ ...current, bio: value }))}
          />

          <View style={styles.actionRow}>
            <ActionButton
              label="Avatar waehlen"
              variant="secondary"
              onPress={() => chooseImage("library", "profile")}
            />
            <ActionButton
              label="Avatar entfernen"
              variant="secondary"
              onPress={() =>
                setProfileDraft((current) => ({
                  ...current,
                  clearAvatar: true,
                  avatarPreview: "",
                  avatarDataUrl: "",
                }))
              }
            />
          </View>

          <View style={styles.actionRow}>
            <ActionButton
              label={busyAction === "profile" ? "Speichert..." : "Profil speichern"}
              onPress={saveProfile}
            />
            <ActionButton label="Logout" variant="secondary" onPress={logout} />
          </View>
        </SectionCard>

        <SectionCard eyebrow="Community" title="Ausgewaehltes Profil">
          {viewedProfile ? (
            <View style={styles.stack}>
              <View style={styles.profileHead}>
                <AvatarView user={viewedProfile.profile} size={72} />
                <View style={styles.profileHeadCopy}>
                  <Text style={styles.sectionSubTitle}>{viewedProfile.profile.displayName}</Text>
                  <Text style={styles.metaText}>@{viewedProfile.profile.username}</Text>
                </View>
              </View>
              <Text style={styles.bodyText}>
                {viewedProfile.profile.bio || "Kein Profiltext hinterlegt."}
              </Text>
              <Text style={styles.metaText}>
                {viewedProfile.profile.stats.sharedOutfits} Looks ·{" "}
                {viewedProfile.profile.stats.followers} Follower ·{" "}
                {viewedProfile.profile.stats.wardrobeItems} Teile
              </Text>

              {!viewedProfile.profile.isCurrentUser ? (
                <ActionButton
                  label={viewedProfile.profile.isFollowing ? "Entfolgen" : "Folgen"}
                  variant="secondary"
                  onPress={() =>
                    followUser(viewedProfile.profile.id, viewedProfile.profile.username)
                  }
                  fullWidth
                />
              ) : null}

              {viewedProfile.sharedOutfits.length ? (
                <View style={styles.stack}>
                  {viewedProfile.sharedOutfits.map((post) => (
                    <FeedPostCard
                      key={post.id}
                      post={post}
                      currentUserId={session.user?.id}
                      condensed
                      onOpenProfile={async () => {
                        await loadPublicProfile(post.author.username);
                        setActiveTab("profile");
                      }}
                      onToggleFollow={() => followUser(post.author.id, post.author.username)}
                      onToggleLike={() => toggleLike(post)}
                    />
                  ))}
                </View>
              ) : (
                <Text style={styles.metaText}>
                  Dieses Profil hat noch keine geteilten Looks.
                </Text>
              )}
            </View>
          ) : (
            <Text style={styles.metaText}>
              Waehle im Feed oder in den entdeckbaren Profilen jemanden aus.
            </Text>
          )}
        </SectionCard>
      </>
    );
  }

  function renderCurrentTab() {
    if (activeTab === "home") return renderHomeTab();
    if (activeTab === "closet") return renderClosetTab();
    if (activeTab === "profile") return renderProfileTab();
    return renderCreateTab();
  }

  if (!apiConfigured) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerWrap}>
          <Text style={styles.authTitle}>Online-URL fehlt</Text>
          <Text style={styles.authText}>
            Trage in `apps/ios/app.json` eine echte HTTPS-Adresse fuer dein Online-Backend ein
            oder starte Expo mit `EXPO_PUBLIC_API_URL`.
          </Text>
          <Text style={styles.metaText}>{API_URL || "Noch keine URL gesetzt"}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color={colors.white} />
          <Text style={styles.metaText}>App startet...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!session.authenticated) {
    return renderAuthScreen();
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <View style={styles.appShell}>
        <View style={styles.topBar}>
          <View style={styles.topBarCopy}>
            <Text style={styles.darkEyebrow}>Kleiderschrank</Text>
            <Text style={styles.appTitle}>Closet Studio</Text>
            <Text style={styles.topBarSubline}>Professionell organisiert fuer iPhone</Text>
          </View>
          <View style={styles.topBarUser}>
            <AvatarView user={session.user} size={44} />
            <View>
              <Text style={styles.userName}>{session.user?.displayName}</Text>
              <Text style={styles.metaText}>@{session.user?.username}</Text>
            </View>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {renderCurrentTab()}
        </ScrollView>

        <BottomTabs activeTab={activeTab} onChange={setActiveTab} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  appShell: {
    flex: 1,
  },
  authScroll: {
    flexGrow: 1,
    justifyContent: "center",
  },
  authShell: {
    paddingHorizontal: spacing.screen,
    paddingVertical: 32,
    gap: spacing.section,
  },
  authHero: {
    gap: 8,
    paddingRight: 18,
  },
  darkEyebrow: {
    ...typography.eyebrow,
    color: colors.textSecondary,
  },
  authTitle: {
    ...typography.title,
    color: colors.textPrimary,
  },
  authText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  appTitle: {
    fontSize: 30,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  topBar: {
    paddingHorizontal: spacing.screen,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 18,
  },
  topBarCopy: {
    gap: 4,
  },
  topBarSubline: {
    ...typography.meta,
    color: colors.textSecondary,
  },
  topBarUser: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  userName: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  scrollContent: {
    paddingHorizontal: spacing.screen,
    paddingTop: 8,
    paddingBottom: 126,
    gap: spacing.section,
  },
  input: {
    minHeight: 54,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: colors.textPrimary,
    fontSize: 15,
  },
  inputLight: {
    backgroundColor: colors.white,
    borderColor: "rgba(21,23,27,0.10)",
    color: colors.textDark,
  },
  textArea: {
    minHeight: 104,
    textAlignVertical: "top",
  },
  modeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  centerWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 14,
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  stack: {
    gap: 10,
  },
  bodyText: {
    ...typography.body,
    color: colors.textPrimary,
  },
  metaText: {
    ...typography.meta,
    color: colors.textSecondary,
  },
  sectionSubTitle: {
    ...typography.cardTitle,
    color: colors.textPrimary,
  },
  storyRail: {
    flexDirection: "row",
    gap: 12,
  },
  profileBubble: {
    width: 124,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    gap: 8,
  },
  profileBubbleName: {
    textAlign: "center",
    fontSize: 14,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  heroImage: {
    width: "100%",
    height: 256,
    borderRadius: radius.lg,
    backgroundColor: "#E5E7EB",
  },
  heroPlaceholder: {
    minHeight: 236,
    borderRadius: radius.lg,
    backgroundColor: "#ECEDE8",
    padding: 22,
    justifyContent: "flex-end",
    gap: 8,
  },
  heroPlaceholderTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.textDark,
  },
  heroPlaceholderText: {
    ...typography.body,
    color: "#4B5563",
  },
  miniItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 10,
    borderRadius: radius.md,
    backgroundColor: colors.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  miniItemImage: {
    width: 58,
    height: 58,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceSoft,
  },
  miniItemCopy: {
    gap: 4,
    flex: 1,
  },
  miniItemTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  listCard: {
    gap: 10,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  wardrobeImage: {
    width: "100%",
    height: 220,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSoft,
  },
  profileHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  profileHeadCopy: {
    flex: 1,
    gap: 4,
  },
  metricRow: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  metricPill: {
    flex: 1,
    minWidth: 92,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: colors.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 2,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  metricLabel: {
    ...typography.meta,
    color: colors.textSecondary,
  },
});
