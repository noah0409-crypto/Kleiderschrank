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
import {
  CATEGORIES,
  OCCASIONS,
  SEASONS,
  STYLES,
  TEMPERATURES,
  VIBES,
} from "./src/constants.js";
import {
  buildRecommendationContext,
  pickBestItems,
  summarizeLook,
  weatherCodeToLabel,
} from "./src/recommendation.js";

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

function initials(name) {
  return String(name || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "KL";
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

function Chip({ label, selected, onPress }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipActive]}>
      <Text style={[styles.chipText, selected && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function SectionCard({ eyebrow, title, children }) {
  return (
    <View style={styles.card}>
      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.eyebrow}>{eyebrow}</Text>
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>
      </View>
      {children}
    </View>
  );
}

function TabButton({ label, selected, onPress }) {
  return (
    <Pressable onPress={onPress} style={styles.tabButton}>
      <Text style={[styles.tabButtonText, selected && styles.tabButtonTextActive]}>{label}</Text>
    </Pressable>
  );
}

function Avatar({ user, size = 48 }) {
  const avatarUrl = user?.avatarUrl ? resolveAssetUrl(user.avatarUrl) : "";
  if (avatarUrl) {
    return <Image source={{ uri: avatarUrl }} style={[styles.avatarImage, { width: size, height: size, borderRadius: size / 2 }]} />;
  }

  return (
    <View style={[styles.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={styles.avatarFallbackText}>{initials(user?.displayName || user?.username)}</Text>
    </View>
  );
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [sessionToken, setSessionToken] = useState("");
  const [session, setSession] = useState(emptySession);
  const [activeTab, setActiveTab] = useState("home");
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
    }
  }

  async function chooseImage(source, target) {
    try {
      const permission =
        source === "camera"
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert("Zugriff noetig", source === "camera" ? "Bitte erlaube der App den Kamerazugriff." : "Bitte erlaube der App den Fotozugriff.");
        return;
      }

      const pickerFn = source === "camera" ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
      const result = await pickerFn({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.85,
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
        Alert.alert("Standort fehlt", "Bitte erlaube der App den Standort oder trage die Temperatur manuell ein.");
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
      Alert.alert("Nichts gefunden", "Fuer diesen Anlass fehlen passende Kleidungsstuecke.");
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
      Alert.alert("Bild fehlt", "Bitte fotografiere zuerst das Kleidungsstueck oder waehle ein Bild aus.");
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

  function renderImageCard(item) {
    return (
      <View key={item.id} style={styles.miniCard}>
        <Image source={{ uri: resolveAssetUrl(item.image) }} style={styles.miniImage} />
        <View style={styles.miniTextWrap}>
          <Text style={styles.miniTitle}>{item.name}</Text>
          <Text style={styles.metaText}>
            {item.category} · {item.color || "neutral"}
          </Text>
        </View>
      </View>
    );
  }

  function renderFeedPost(post, condensed = false) {
    return (
      <View key={post.id} style={styles.card}>
        <View style={styles.feedHeader}>
          <Pressable
            style={styles.feedAuthor}
            onPress={async () => {
              await loadPublicProfile(post.author.username);
              setActiveTab("profile");
            }}
          >
            <Avatar user={post.author} size={42} />
            <View>
              <Text style={styles.feedAuthorName}>{post.author.displayName}</Text>
              <Text style={styles.metaText}>@{post.author.username}</Text>
            </View>
          </Pressable>
          {post.author.id !== session.user?.id ? (
            <Pressable
              style={styles.secondaryButton}
              onPress={() => followUser(post.author.id, post.author.username)}
            >
              <Text style={styles.secondaryButtonText}>{post.isFollowing ? "Entfolgen" : "Folgen"}</Text>
            </Pressable>
          ) : null}
        </View>

        <Text style={styles.feedTitle}>{post.outfitName}</Text>
        <Text style={styles.bodyText}>{post.caption || "Ohne Caption."}</Text>
        <Text style={styles.metaText}>
          {post.weatherSnapshot?.temperature != null
            ? `${Math.round(post.weatherSnapshot.temperature)} Grad · ${post.weatherSnapshot.weatherLabel}`
            : "Ohne Wetterdaten"}
        </Text>

        <View style={styles.miniGrid}>{post.previewItems.map(renderImageCard)}</View>

        <View style={styles.inlineActions}>
          <Pressable style={styles.secondaryButton} onPress={() => toggleLike(post)}>
            <Text style={styles.secondaryButtonText}>
              {post.likedByViewer ? "Unlike" : "Like"} · {post.likes}
            </Text>
          </Pressable>
        </View>

        {condensed ? null : (
          <>
            <View style={styles.commentComposer}>
              <TextInput
                style={[styles.input, styles.commentInput]}
                placeholder="Kommentar schreiben"
                placeholderTextColor="#8e8e93"
                value={commentDrafts[post.id] || ""}
                onChangeText={(value) =>
                  setCommentDrafts((current) => ({ ...current, [post.id]: value }))
                }
              />
              <Pressable style={styles.primaryButton} onPress={() => postComment(post)}>
                <Text style={styles.primaryButtonText}>Senden</Text>
              </Pressable>
            </View>

            {post.comments.length ? (
              <View style={styles.commentList}>
                {post.comments.map((comment) => (
                  <View key={comment.id} style={styles.commentItem}>
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

  function renderAuthScreen() {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        <ScrollView contentContainerStyle={styles.authWrap}>
          <View style={styles.authCard}>
            <Text style={styles.eyebrow}>Kleiderschrank</Text>
            <Text style={styles.authTitle}>Native iPhone-App</Text>
            <Text style={styles.authText}>
              Kleidung hochladen, Wetter abrufen, Outfits speichern und deinen Style mit anderen teilen.
            </Text>

            <View style={styles.modeRow}>
              <Chip label="Registrieren" selected={authMode === "signup"} onPress={() => setAuthMode("signup")} />
              <Chip label="Login" selected={authMode === "login"} onPress={() => setAuthMode("login")} />
            </View>

            {authMode === "signup" ? (
              <TextInput
                style={styles.input}
                placeholder="Anzeigename"
                placeholderTextColor="#8e8e93"
                value={authDraft.displayName}
                onChangeText={(value) => setAuthDraft((current) => ({ ...current, displayName: value }))}
              />
            ) : null}

            <TextInput
              style={styles.input}
              autoCapitalize="none"
              placeholder="Benutzername"
              placeholderTextColor="#8e8e93"
              value={authDraft.username}
              onChangeText={(value) => setAuthDraft((current) => ({ ...current, username: value }))}
            />

            <TextInput
              style={styles.input}
              secureTextEntry
              placeholder="Passwort"
              placeholderTextColor="#8e8e93"
              value={authDraft.password}
              onChangeText={(value) => setAuthDraft((current) => ({ ...current, password: value }))}
            />

            <Pressable style={styles.primaryButton} onPress={submitAuth}>
              <Text style={styles.primaryButtonText}>
                {busyAction === "auth" ? "Bitte warten..." : authMode === "signup" ? "Account erstellen" : "Einloggen"}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  function renderHomeTab() {
    return (
      <>
        <SectionCard eyebrow="Heute" title="Dein Look fuer jetzt">
          <Text style={styles.bodyText}>
            {weather?.current
              ? `${Math.round(weather.current.temperature_2m)} Grad · ${weatherCodeToLabel(weather.current.weather_code)}`
              : "Noch kein Wetter geladen. Du kannst auch die Temperatur manuell eintragen."}
          </Text>
          <View style={styles.inlineActions}>
            <Pressable style={styles.primaryButton} onPress={loadWeatherForOutfits}>
              <Text style={styles.primaryButtonText}>
                {busyAction === "weather" ? "Laedt..." : "Wetter abrufen"}
              </Text>
            </Pressable>
          </View>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            placeholder="Temperatur manuell, z. B. 18"
            placeholderTextColor="#8e8e93"
            value={manualTemperature}
            onChangeText={setManualTemperature}
          />
        </SectionCard>

        <SectionCard eyebrow="Empfehlung" title="Smartes Outfit">
          <Text style={styles.fieldLabel}>Anlass</Text>
          <View style={styles.chipRow}>
            {OCCASIONS.map((entry) => (
              <Chip key={entry} label={entry} selected={occasion === entry} onPress={() => setOccasion(entry)} />
            ))}
          </View>

          <Text style={styles.fieldLabel}>Vibe</Text>
          <View style={styles.chipRow}>
            {VIBES.map((entry) => (
              <Chip key={entry} label={titleize(entry)} selected={vibe === entry} onPress={() => setVibe(entry)} />
            ))}
          </View>

          <Pressable style={styles.primaryButton} onPress={generateRecommendation}>
            <Text style={styles.primaryButtonText}>Outfit vorschlagen</Text>
          </Pressable>

          {recommendation ? (
            <View style={styles.recommendationWrap}>
              <Text style={styles.feedTitle}>{recommendation.title}</Text>
              <Text style={styles.metaText}>
                {Math.round(recommendation.context.temperature)} Grad · {recommendation.summary.primaryStyle}
              </Text>
              <Text style={styles.bodyText}>{recommendation.reason}</Text>
              <View style={styles.miniGrid}>{recommendation.items.map(renderImageCard)}</View>
              <Pressable style={styles.secondaryButton} onPress={saveRecommendation}>
                <Text style={styles.secondaryButtonText}>
                  {busyAction === "save-outfit" ? "Speichert..." : "Outfit speichern"}
                </Text>
              </Pressable>
            </View>
          ) : (
            <Text style={styles.metaText}>Noch kein Outfit generiert.</Text>
          )}
        </SectionCard>

        <SectionCard eyebrow="Discover" title="Profile entdecken">
          {session.featuredProfiles.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.storyRow}>
                {session.featuredProfiles.map((profile) => (
                  <Pressable
                    key={profile.id}
                    style={styles.profileBubble}
                    onPress={async () => {
                      await loadPublicProfile(profile.username);
                      setActiveTab("profile");
                    }}
                  >
                    <Avatar user={profile} size={56} />
                    <Text style={styles.profileBubbleName}>{profile.displayName}</Text>
                    <Text style={styles.metaText}>@{profile.username}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          ) : (
            <Text style={styles.metaText}>Sobald Nutzer Looks teilen, erscheinen sie hier.</Text>
          )}
        </SectionCard>

        <SectionCard eyebrow="Feed" title="Geteilte Outfits">
          {session.sharedOutfits.length ? session.sharedOutfits.map((post) => renderFeedPost(post)) : <Text style={styles.metaText}>Noch keine geteilten Looks.</Text>}
        </SectionCard>
      </>
    );
  }

  function renderCreateTab() {
    return (
      <>
        <SectionCard eyebrow="Kamera" title="Bild aufnehmen">
          {clothingImage?.uri ? (
            <Image source={{ uri: clothingImage.uri }} style={styles.heroImage} />
          ) : (
            <View style={styles.placeholderBox}>
              <Text style={styles.bodyText}>Noch kein Kleidungsbild ausgewaehlt.</Text>
            </View>
          )}

          <View style={styles.inlineActions}>
            <Pressable style={styles.primaryButton} onPress={() => chooseImage("camera", "clothing")}>
              <Text style={styles.primaryButtonText}>Kamera</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => chooseImage("library", "clothing")}>
              <Text style={styles.secondaryButtonText}>Galerie</Text>
            </Pressable>
          </View>
        </SectionCard>

        <SectionCard eyebrow="Upload" title="Kleidungsstueck anlegen">
          <TextInput
            style={styles.input}
            placeholder="Name, z. B. Grauer Hoodie"
            placeholderTextColor="#8e8e93"
            value={clothingDraft.name}
            onChangeText={(value) => setClothingDraft((current) => ({ ...current, name: value }))}
          />
          <TextInput
            style={styles.input}
            placeholder="Farbe"
            placeholderTextColor="#8e8e93"
            value={clothingDraft.color}
            onChangeText={(value) => setClothingDraft((current) => ({ ...current, color: value }))}
          />

          <Text style={styles.fieldLabel}>Kategorie</Text>
          <View style={styles.chipRow}>
            {CATEGORIES.map((entry) => (
              <Chip
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
              <Chip
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
              <Chip
                key={entry}
                label={titleize(entry)}
                selected={clothingDraft.temperature === entry}
                onPress={() => setClothingDraft((current) => ({ ...current, temperature: entry }))}
              />
            ))}
          </View>

          <Text style={styles.fieldLabel}>Anlass</Text>
          <View style={styles.chipRow}>
            {OCCASIONS.map((entry) => (
              <Chip
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
              <Chip
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

          <Pressable style={styles.primaryButton} onPress={saveClothingItem}>
            <Text style={styles.primaryButtonText}>
              {busyAction === "save-clothing" ? "Speichert..." : "Kleidungsstueck speichern"}
            </Text>
          </Pressable>
        </SectionCard>
      </>
    );
  }

  function renderClosetTab() {
    return (
      <>
        <SectionCard eyebrow="Saved" title="Deine Outfits">
          {session.savedOutfits.length ? (
            session.savedOutfits.map((outfit) => (
              <View key={outfit.id} style={styles.listCard}>
                <Text style={styles.feedTitle}>{outfit.name}</Text>
                <Text style={styles.metaText}>
                  {outfit.occasion} · {Math.round(outfit.weatherSnapshot?.temperature || 0)} Grad
                </Text>
                <Text style={styles.bodyText}>{outfit.caption || "Kein Text hinterlegt."}</Text>
                <View style={styles.miniGrid}>{outfit.items.map(renderImageCard)}</View>
                <View style={styles.inlineActions}>
                  <Pressable style={styles.secondaryButton} onPress={() => shareOutfit(outfit.id)}>
                    <Text style={styles.secondaryButtonText}>Teilen</Text>
                  </Pressable>
                  <Pressable style={styles.secondaryButton} onPress={() => deleteOutfit(outfit.id)}>
                    <Text style={styles.secondaryButtonText}>Loeschen</Text>
                  </Pressable>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.metaText}>Hier erscheinen deine gespeicherten Outfits.</Text>
          )}
        </SectionCard>

        <SectionCard eyebrow="Wardrobe" title="Dein Schrank">
          {session.wardrobe.length ? (
            session.wardrobe.map((item) => (
              <View key={item.id} style={styles.listCard}>
                <Image source={{ uri: resolveAssetUrl(item.image) }} style={styles.wardrobeImage} />
                <Text style={styles.feedTitle}>{item.name}</Text>
                <Text style={styles.metaText}>
                  {item.category} · {item.color || "ohne Farbangabe"}
                </Text>
                <Text style={styles.bodyText}>
                  {[...item.seasons, ...item.occasions, ...(item.styles || []), item.temperature].join(" · ")}
                </Text>
                <Pressable style={styles.secondaryButton} onPress={() => deleteWardrobeItem(item.id)}>
                  <Text style={styles.secondaryButtonText}>Loeschen</Text>
                </Pressable>
              </View>
            ))
          ) : (
            <Text style={styles.metaText}>Noch keine Kleidungsstuecke gespeichert.</Text>
          )}
        </SectionCard>
      </>
    );
  }

  function renderProfileTab() {
    return (
      <>
        <SectionCard eyebrow="Du" title="Profil bearbeiten">
          <View style={styles.profileHead}>
            <Avatar
              user={{
                displayName: session.user?.displayName,
                username: session.user?.username,
                avatarUrl: profileDraft.clearAvatar ? "" : profileDraft.avatarPreview || session.user?.avatarUrl,
              }}
              size={72}
            />
            <View style={styles.profileHeadCopy}>
              <Text style={styles.feedTitle}>{session.user?.displayName}</Text>
              <Text style={styles.metaText}>@{session.user?.username}</Text>
            </View>
          </View>

          <TextInput
            style={styles.input}
            placeholder="Anzeigename"
            placeholderTextColor="#8e8e93"
            value={profileDraft.displayName}
            onChangeText={(value) => setProfileDraft((current) => ({ ...current, displayName: value }))}
          />
          <TextInput
            style={[styles.input, styles.textArea]}
            multiline
            placeholder="Bio"
            placeholderTextColor="#8e8e93"
            value={profileDraft.bio}
            onChangeText={(value) => setProfileDraft((current) => ({ ...current, bio: value }))}
          />

          <View style={styles.inlineActions}>
            <Pressable style={styles.secondaryButton} onPress={() => chooseImage("library", "profile")}>
              <Text style={styles.secondaryButtonText}>Avatar waehlen</Text>
            </Pressable>
            <Pressable
              style={styles.secondaryButton}
              onPress={() =>
                setProfileDraft((current) => ({
                  ...current,
                  clearAvatar: true,
                  avatarPreview: "",
                  avatarDataUrl: "",
                }))
              }
            >
              <Text style={styles.secondaryButtonText}>Avatar entfernen</Text>
            </Pressable>
          </View>

          <View style={styles.inlineActions}>
            <Pressable style={styles.primaryButton} onPress={saveProfile}>
              <Text style={styles.primaryButtonText}>
                {busyAction === "profile" ? "Speichert..." : "Profil speichern"}
              </Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={logout}>
              <Text style={styles.secondaryButtonText}>Logout</Text>
            </Pressable>
          </View>
        </SectionCard>

        <SectionCard eyebrow="Profilansicht" title="Ausgewaehltes Profil">
          {viewedProfile ? (
            <>
              <View style={styles.profileHead}>
                <Avatar user={viewedProfile.profile} size={72} />
                <View style={styles.profileHeadCopy}>
                  <Text style={styles.feedTitle}>{viewedProfile.profile.displayName}</Text>
                  <Text style={styles.metaText}>@{viewedProfile.profile.username}</Text>
                </View>
              </View>
              <Text style={styles.bodyText}>{viewedProfile.profile.bio || "Kein Profiltext hinterlegt."}</Text>
              <Text style={styles.metaText}>
                {viewedProfile.profile.stats.sharedOutfits} Looks · {viewedProfile.profile.stats.followers} Follower ·{" "}
                {viewedProfile.profile.stats.wardrobeItems} Teile
              </Text>

              {!viewedProfile.profile.isCurrentUser ? (
                <Pressable
                  style={styles.secondaryButton}
                  onPress={() =>
                    followUser(viewedProfile.profile.id, viewedProfile.profile.username)
                  }
                >
                  <Text style={styles.secondaryButtonText}>
                    {viewedProfile.profile.isFollowing ? "Entfolgen" : "Folgen"}
                  </Text>
                </Pressable>
              ) : null}

              <View style={styles.stackGap}>
                {viewedProfile.sharedOutfits.length ? viewedProfile.sharedOutfits.map((post) => renderFeedPost(post, true)) : <Text style={styles.metaText}>Dieses Profil hat noch keine geteilten Looks.</Text>}
              </View>
            </>
          ) : (
            <Text style={styles.metaText}>Waehle im Feed oder in Discover ein Profil aus.</Text>
          )}
        </SectionCard>
      </>
    );
  }

  function renderCurrentTab() {
    if (activeTab === "create") return renderCreateTab();
    if (activeTab === "closet") return renderClosetTab();
    if (activeTab === "profile") return renderProfileTab();
    return renderHomeTab();
  }

  if (!apiConfigured) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerWrap}>
          <Text style={styles.authTitle}>Online-URL fehlt</Text>
          <Text style={styles.authText}>
            Trage in [app.json] eine echte HTTPS-Adresse fuer dein Online-Backend ein oder starte Expo mit EXPO_PUBLIC_API_URL.
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
          <ActivityIndicator size="large" color="#111111" />
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
      <StatusBar barStyle="dark-content" />
      <View style={styles.appShell}>
        <View style={styles.topBar}>
          <View>
            <Text style={styles.eyebrow}>Kleiderschrank</Text>
            <Text style={styles.appTitle}>Native Closet App</Text>
          </View>
          <View style={styles.headerUser}>
            <Avatar user={session.user} size={42} />
            <View>
              <Text style={styles.feedAuthorName}>{session.user?.displayName}</Text>
              <Text style={styles.metaText}>@{session.user?.username}</Text>
            </View>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>{renderCurrentTab()}</ScrollView>

        <View style={styles.bottomBar}>
          <TabButton label="Home" selected={activeTab === "home"} onPress={() => setActiveTab("home")} />
          <TabButton label="Create" selected={activeTab === "create"} onPress={() => setActiveTab("create")} />
          <TabButton label="Schrank" selected={activeTab === "closet"} onPress={() => setActiveTab("closet")} />
          <TabButton label="Profil" selected={activeTab === "profile"} onPress={() => setActiveTab("profile")} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f5f5f7",
  },
  appShell: {
    flex: 1,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerUser: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
    color: "#8e8e93",
    textTransform: "uppercase",
  },
  appTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111111",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 120,
    gap: 16,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: "#e5e5ea",
  },
  sectionHeader: {
    marginBottom: 2,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111111",
  },
  bodyText: {
    fontSize: 15,
    lineHeight: 22,
    color: "#303036",
  },
  metaText: {
    fontSize: 13,
    lineHeight: 18,
    color: "#8e8e93",
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#303036",
    marginTop: 6,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#d1d1d6",
    backgroundColor: "#f2f2f7",
  },
  chipActive: {
    backgroundColor: "#111111",
    borderColor: "#111111",
  },
  chipText: {
    color: "#303036",
    fontWeight: "600",
    fontSize: 13,
  },
  chipTextActive: {
    color: "#ffffff",
  },
  input: {
    backgroundColor: "#f2f2f7",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: "#111111",
    fontSize: 15,
    borderWidth: 1,
    borderColor: "#e5e5ea",
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  primaryButton: {
    backgroundColor: "#111111",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  secondaryButton: {
    backgroundColor: "#f2f2f7",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#d1d1d6",
  },
  secondaryButtonText: {
    color: "#111111",
    fontSize: 15,
    fontWeight: "700",
  },
  inlineActions: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  recommendationWrap: {
    gap: 10,
    marginTop: 6,
  },
  storyRow: {
    flexDirection: "row",
    gap: 12,
  },
  profileBubble: {
    width: 116,
    padding: 12,
    backgroundColor: "#f8f8fa",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#ececf1",
    alignItems: "center",
    gap: 8,
  },
  profileBubbleName: {
    textAlign: "center",
    fontSize: 14,
    fontWeight: "700",
    color: "#111111",
  },
  feedHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  feedAuthor: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  feedAuthorName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111111",
  },
  feedTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111111",
  },
  miniGrid: {
    gap: 10,
  },
  miniCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#f8f8fa",
    borderRadius: 18,
    padding: 10,
    borderWidth: 1,
    borderColor: "#ececf1",
  },
  miniImage: {
    width: 58,
    height: 58,
    borderRadius: 14,
    backgroundColor: "#e5e5ea",
  },
  miniTextWrap: {
    flex: 1,
    gap: 4,
  },
  miniTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111111",
  },
  commentComposer: {
    gap: 8,
  },
  commentInput: {
    minHeight: 52,
  },
  commentList: {
    gap: 10,
  },
  commentItem: {
    backgroundColor: "#f8f8fa",
    borderRadius: 16,
    padding: 12,
    gap: 4,
  },
  commentAuthor: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111111",
  },
  heroImage: {
    width: "100%",
    height: 240,
    borderRadius: 22,
    backgroundColor: "#ececf1",
  },
  placeholderBox: {
    height: 220,
    borderRadius: 22,
    backgroundColor: "#f2f2f7",
    borderWidth: 1,
    borderColor: "#e5e5ea",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  listCard: {
    gap: 10,
    padding: 14,
    borderRadius: 20,
    backgroundColor: "#f8f8fa",
    borderWidth: 1,
    borderColor: "#ececf1",
    marginTop: 10,
  },
  wardrobeImage: {
    width: "100%",
    height: 210,
    borderRadius: 18,
    backgroundColor: "#ececf1",
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
  stackGap: {
    gap: 12,
  },
  authWrap: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 22,
  },
  authCard: {
    backgroundColor: "#ffffff",
    borderRadius: 28,
    padding: 22,
    gap: 14,
    borderWidth: 1,
    borderColor: "#e5e5ea",
  },
  authTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#111111",
  },
  authText: {
    fontSize: 15,
    lineHeight: 22,
    color: "#51515a",
  },
  modeRow: {
    flexDirection: "row",
    gap: 8,
    marginVertical: 8,
  },
  centerWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 14,
  },
  bottomBar: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 18,
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#e5e5ea",
    padding: 8,
    justifyContent: "space-between",
    shadowColor: "#000000",
    shadowOpacity: 0.05,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 16,
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#8e8e93",
  },
  tabButtonTextActive: {
    color: "#111111",
  },
  avatarImage: {
    backgroundColor: "#ececf1",
  },
  avatarFallback: {
    backgroundColor: "#111111",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarFallbackText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
});
