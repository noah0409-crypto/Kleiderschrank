const state = {
  activeTab: "home",
  authenticated: false,
  cameraImage: "",
  cameraStream: null,
  featuredProfiles: [],
  latestRecommendation: null,
  meta: null,
  savedOutfits: [],
  sharedOutfits: [],
  user: null,
  viewedProfile: null,
  wardrobe: [],
  weather: null,
};

const occasionStyleMap = {
  Alltag: ["minimal", "streetwear", "cozy"],
  Date: ["elevated", "romantic", "minimal"],
  Office: ["tailored", "minimal", "elevated"],
  Party: ["bold", "elevated", "streetwear"],
  Sport: ["sporty", "cozy"],
};

const vibeStyleMap = {
  bold: ["bold", "streetwear", "elevated"],
  clean: ["minimal", "tailored"],
  cozy: ["cozy", "romantic"],
  polished: ["tailored", "elevated", "minimal"],
};

const elements = {
  accountCard: document.querySelector("#account-card"),
  appContent: document.querySelector("#app-content"),
  authMessage: document.querySelector("#auth-message"),
  authSection: document.querySelector("#auth-section"),
  bottomNav: document.querySelector("#bottom-nav"),
  cameraCanvas: document.querySelector("#camera-canvas"),
  cameraCaptureButton: document.querySelector("#camera-capture-button"),
  cameraOpenButton: document.querySelector("#camera-open-button"),
  cameraPlaceholder: document.querySelector("#camera-placeholder"),
  cameraPreview: document.querySelector("#camera-preview"),
  cameraResetButton: document.querySelector("#camera-reset-button"),
  cameraStatus: document.querySelector("#camera-status"),
  cameraVideo: document.querySelector("#camera-video"),
  clothingForm: document.querySelector("#clothing-form"),
  featuredProfiles: document.querySelector("#featured-profiles"),
  generatorForm: document.querySelector("#generator-form"),
  headerUser: document.querySelector("#header-user"),
  imageInput: document.querySelector("#image-input"),
  installTipButton: document.querySelector("#install-tip-button"),
  loginForm: document.querySelector("#login-form"),
  logoutButton: document.querySelector("#logout-button"),
  manualTemperatureInput: document.querySelector("#manual-temperature-input"),
  mobileHelp: document.querySelector("#mobile-help"),
  navButtons: Array.from(document.querySelectorAll(".nav-button")),
  occasionFilter: document.querySelector("#occasion-filter"),
  outfitCaption: document.querySelector("#outfit-caption"),
  outfitName: document.querySelector("#outfit-name"),
  panels: Array.from(document.querySelectorAll(".tab-panel")),
  profileAvatarClear: document.querySelector("#profile-avatar-clear"),
  profileAvatarInput: document.querySelector("#profile-avatar-input"),
  profileBio: document.querySelector("#profile-bio"),
  profileDisplayName: document.querySelector("#profile-display-name"),
  profileForm: document.querySelector("#profile-form"),
  publicProfileView: document.querySelector("#public-profile-view"),
  recommendationBadge: document.querySelector("#recommendation-badge"),
  recommendationCard: document.querySelector("#recommendation-card"),
  recommendationEmpty: document.querySelector("#recommendation-empty"),
  recommendationItems: document.querySelector("#recommendation-items"),
  recommendationReason: document.querySelector("#recommendation-reason"),
  recommendationTitle: document.querySelector("#recommendation-title"),
  saveOutfitForm: document.querySelector("#save-outfit-form"),
  savedOutfits: document.querySelector("#saved-outfits"),
  sharedFeed: document.querySelector("#shared-feed"),
  signupForm: document.querySelector("#signup-form"),
  vibeFilter: document.querySelector("#vibe-filter"),
  wardrobeGrid: document.querySelector("#wardrobe-grid"),
  wardrobeTemplate: document.querySelector("#wardrobe-item-template"),
  weatherButton: document.querySelector("#weather-button"),
  weatherCard: document.querySelector("#weather-card"),
};

const localHostnames = new Set(["localhost", "127.0.0.1"]);

const insecureRemoteContext = !window.isSecureContext && !localHostnames.has(location.hostname);

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function setAuthMessage(message) {
  elements.authMessage.textContent = message;
}

function getCheckedValues(name) {
  return Array.from(document.querySelectorAll(`input[name="${name}"]:checked`)).map((input) => input.value);
}

function weatherCodeToLabel(code) {
  if (code === 0) return "Klar";
  if ([1, 2, 3].includes(code)) return "Leicht bewoelkt";
  if ([45, 48].includes(code)) return "Nebelig";
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return "Regnerisch";
  if ([71, 73, 75, 85, 86].includes(code)) return "Schnee";
  if ([95, 96, 99].includes(code)) return "Gewitter";
  return "Wetterwechsel";
}

function getSeasonFromTemperature(temp) {
  if (temp < 10) return "Winter";
  if (temp < 18) return "Fruehling";
  if (temp < 24) return "Herbst";
  return "Sommer";
}

function getTemperatureBucket(temp) {
  if (temp < 10) return "cold";
  if (temp <= 20) return "mild";
  return "warm";
}

function normalizeColor(color) {
  return String(color || "").trim().toLowerCase();
}

function colorFamily(color) {
  const value = normalizeColor(color);
  if (!value) return "neutral";
  if (["black", "schwarz", "white", "weiss", "weiß", "grey", "gray", "grau", "cream", "creme", "silver"].some((token) => value.includes(token))) return "neutral";
  if (["navy", "blau", "blue", "teal", "mint", "green", "gruen", "grün"].some((token) => value.includes(token))) return "cool";
  if (["brown", "braun", "beige", "camel", "khaki", "olive"].some((token) => value.includes(token))) return "earth";
  if (["red", "rot", "orange", "yellow", "gelb", "pink", "burgundy"].some((token) => value.includes(token))) return "warm";
  return "neutral";
}

function colorCompatibility(firstColor, secondColor) {
  const first = colorFamily(firstColor);
  const second = colorFamily(secondColor);
  if (first === second) return 10;
  if (first === "neutral" || second === "neutral") return 8;
  if ((first === "earth" && second === "warm") || (first === "warm" && second === "earth")) return 7;
  return 4;
}

function initials(name) {
  return String(name || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "CC";
}

function avatarMarkup(user, sizeClass = "avatar") {
  if (user?.avatarUrl) {
    return `<div class="${sizeClass}"><img class="avatar-image" src="${escapeHtml(user.avatarUrl)}" alt="${escapeHtml(user.displayName || user.username)}" /></div>`;
  }
  return `<div class="${sizeClass}">${escapeHtml(initials(user?.displayName || user?.username))}</div>`;
}

function createTag(text) {
  const tag = document.createElement("span");
  tag.className = "tag";
  tag.textContent = text;
  return tag;
}

function uniqueById(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function styleOverlap(itemStyles, targetStyles) {
  return (itemStyles || []).filter((style) => targetStyles.includes(style)).length;
}

function scoreItem(item, context, neededCategory, selectedItems = []) {
  let score = 0;
  if (item.category === neededCategory) score += 50;
  if (item.occasions.includes(context.occasion)) score += 18;
  if (item.seasons.includes(context.season)) score += 12;
  if (item.temperature === context.temperatureBucket || item.temperature === "all") score += 14;
  score += styleOverlap(item.styles, context.targetStyles) * 12;

  if (selectedItems.length) {
    score += Math.max(...selectedItems.map((selectedItem) => colorCompatibility(selectedItem.color, item.color)));
    if (selectedItems.some((selectedItem) => styleOverlap(selectedItem.styles, item.styles) > 0)) {
      score += 6;
    }
  }

  if (context.weatherLabel === "Regnerisch" && item.category === "Outerwear") score += 10;
  if (context.weatherLabel === "Schnee" && ["Outerwear", "Shoes"].includes(item.category)) score += 14;
  if (context.temperatureBucket === "cold" && ["Outerwear", "Accessory"].includes(item.category)) score += 8;
  if (context.occasion === "Party" && colorFamily(item.color) !== "neutral") score += 6;
  return score;
}

function pickBestForCategory(category, context, selectedItems) {
  return state.wardrobe
    .filter((item) => item.category === category)
    .sort((left, right) => scoreItem(right, context, category, selectedItems) - scoreItem(left, context, category, selectedItems))[0];
}

function buildRecommendationContext(occasion, vibe) {
  const currentTemp = state.weather?.current?.temperature_2m ?? 18;
  const manualTemp = Number(elements.manualTemperatureInput?.value);
  const effectiveTemp = Number.isFinite(manualTemp) ? manualTemp : currentTemp;
  const weatherCode = state.weather?.current?.weather_code ?? 1;
  return {
    occasion,
    vibe,
    temperature: effectiveTemp,
    temperatureBucket: getTemperatureBucket(effectiveTemp),
    weatherLabel: weatherCodeToLabel(weatherCode),
    season: getSeasonFromTemperature(effectiveTemp),
    targetStyles: Array.from(new Set([...(occasionStyleMap[occasion] || []), ...(vibeStyleMap[vibe] || [])])),
  };
}

function pickBestItems(context) {
  const selectedItems = [];
  const dressCandidate = pickBestForCategory("Dress", context, selectedItems);
  const shouldUseDress =
    dressCandidate &&
    context.occasion !== "Sport" &&
    context.temperatureBucket !== "cold" &&
    scoreItem(dressCandidate, context, "Dress", selectedItems) >= 78;

  if (shouldUseDress) {
    selectedItems.push(dressCandidate);
    const shoes = pickBestForCategory("Shoes", context, selectedItems);
    if (shoes) selectedItems.push(shoes);
  } else {
    ["Top", "Bottom", "Shoes"].forEach((category) => {
      const item = pickBestForCategory(category, context, selectedItems);
      if (item) selectedItems.push(item);
    });
  }

  if (context.temperatureBucket === "cold" || ["Regnerisch", "Schnee"].includes(context.weatherLabel)) {
    const outerwear = pickBestForCategory("Outerwear", context, selectedItems);
    if (outerwear) selectedItems.push(outerwear);
  }

  if (context.temperatureBucket !== "warm" || context.occasion === "Party") {
    const accessory = pickBestForCategory("Accessory", context, selectedItems);
    if (accessory) selectedItems.push(accessory);
  }

  return uniqueById(selectedItems);
}

function summarizeLook(items, context) {
  const styles = items.flatMap((item) => item.styles || []);
  const colors = items.map((item) => colorFamily(item.color));
  const styleCounts = Object.fromEntries(styles.map((style) => [style, styles.filter((entry) => entry === style).length]));
  const colorCounts = Object.fromEntries(colors.map((color) => [color, colors.filter((entry) => entry === color).length]));
  const primaryStyle = Object.keys(styleCounts).sort((left, right) => styleCounts[right] - styleCounts[left])[0] || context.targetStyles[0] || "minimal";
  const primaryColor = Object.keys(colorCounts).sort((left, right) => colorCounts[right] - colorCounts[left])[0] || "neutral";
  return { primaryStyle, primaryColor };
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Request failed");
  }
  return payload;
}

async function loadMeta() {
  try {
    return await api("/api/meta");
  } catch {
    return null;
  }
}

function switchTab(nextTab) {
  state.activeTab = nextTab;
  elements.panels.forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.panel === nextTab);
  });
  elements.navButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.tab === nextTab);
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function stopCameraStream() {
  if (state.cameraStream) {
    state.cameraStream.getTracks().forEach((track) => track.stop());
    state.cameraStream = null;
  }
  elements.cameraVideo.srcObject = null;
}

function resetCameraUi(clearImage = true) {
  stopCameraStream();
  elements.cameraVideo.classList.add("hidden");
  elements.cameraPreview.classList.add("hidden");
  elements.cameraPlaceholder.classList.remove("hidden");
  if (clearImage) {
    state.cameraImage = "";
    elements.imageInput.value = "";
    elements.cameraStatus.textContent = "Noch kein Bild ausgewaehlt.";
  }
}

async function openCamera() {
  if (insecureRemoteContext) {
    alert("Live-Kamera im Browser braucht auf dem iPhone HTTPS. Nutze bitte 'Foto oder Galerie waehlen', das ist auf dem iPhone deutlich zuverlaessiger.");
    return;
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    alert("Die Kamera wird auf diesem Geraet im Browser nicht unterstuetzt.");
    return;
  }

  stopCameraStream();

  try {
    state.cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false,
    });
    elements.cameraVideo.srcObject = state.cameraStream;
    elements.cameraVideo.classList.remove("hidden");
    elements.cameraPreview.classList.add("hidden");
    elements.cameraPlaceholder.classList.add("hidden");
    elements.cameraStatus.textContent = "Kamera ist aktiv. Du kannst jetzt ein Foto machen.";
  } catch (error) {
    alert(`Kamera konnte nicht gestartet werden: ${error.message}`);
  }
}

function captureCameraPhoto() {
  if (!state.cameraStream) {
    alert("Oeffne zuerst die Kamera.");
    return;
  }

  const video = elements.cameraVideo;
  const canvas = elements.cameraCanvas;
  const width = video.videoWidth || 1080;
  const height = video.videoHeight || 1440;
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  context.drawImage(video, 0, 0, width, height);
  state.cameraImage = canvas.toDataURL("image/jpeg", 0.92);
  elements.cameraPreview.src = state.cameraImage;
  elements.cameraPreview.classList.remove("hidden");
  elements.cameraVideo.classList.add("hidden");
  elements.cameraPlaceholder.classList.add("hidden");
  elements.cameraStatus.textContent = "Foto aufgenommen. Du kannst es jetzt speichern.";
  stopCameraStream();
}

function renderAuthState() {
  elements.authSection.classList.toggle("hidden", state.authenticated);
  elements.appContent.classList.toggle("hidden", !state.authenticated);
  elements.bottomNav.classList.toggle("hidden", !state.authenticated);
  document.querySelector("#mobile-header").classList.toggle("hidden", !state.authenticated);
}

function renderHeaderUser() {
  if (!state.user) {
    elements.headerUser.innerHTML = "";
    return;
  }

  elements.headerUser.innerHTML = `
    <div class="feed-author">
      ${avatarMarkup(state.user, "avatar")}
      <div>
        <strong>${escapeHtml(state.user.displayName)}</strong>
        <div class="meta-inline">@${escapeHtml(state.user.username)}</div>
      </div>
    </div>
  `;
}

function renderAccountCard() {
  if (!state.user) {
    elements.accountCard.innerHTML = "";
    return;
  }

  elements.profileDisplayName.value = state.user.displayName || "";
  elements.profileBio.value = state.user.bio || "";
  elements.profileAvatarClear.checked = false;

  const stats = state.user.stats || {};
  elements.accountCard.innerHTML = `
    <div class="account-head">
      ${avatarMarkup(state.user, "avatar-large")}
      <div>
        <h3>${escapeHtml(state.user.displayName)}</h3>
        <p class="meta-inline">@${escapeHtml(state.user.username)}</p>
      </div>
    </div>
    <p>${escapeHtml(state.user.bio || "Noch keine Bio hinterlegt.")}</p>
    <div class="stat-row">
      <span class="stat-pill">${stats.wardrobeItems || 0} Teile</span>
      <span class="stat-pill">${stats.sharedOutfits || 0} Looks</span>
      <span class="stat-pill">${stats.followers || 0} Follower</span>
      <span class="stat-pill">${stats.following || 0} Following</span>
    </div>
  `;
}

function renderWeatherCard() {
  if (!state.weather?.current) {
    elements.weatherCard.innerHTML = `
      <p class="weather-label">Wetter</p>
      <strong>Noch kein Wetter geladen</strong>
      <p class="microcopy">Nutze deinen Standort oder trage die Temperatur manuell ein.</p>
    `;
    return;
  }

  const current = state.weather.current;
  elements.weatherCard.innerHTML = `
    <p class="weather-label">Live Wetter</p>
    <strong>${Math.round(current.temperature_2m)} Grad · ${escapeHtml(weatherCodeToLabel(current.weather_code))}</strong>
    <p class="microcopy">Gefuehlt wie ${Math.round(current.apparent_temperature)} Grad bei ${Math.round(current.wind_speed_10m)} km/h Wind.</p>
  `;
}

function renderMobileHelp() {
  if (!elements.mobileHelp) return;

  const publicUrl = state.meta?.publicUrl || window.location.origin;
  const hosted = Boolean(state.meta?.hosted) || !localHostnames.has(location.hostname);

  if (hosted) {
    const secureHint = window.isSecureContext
      ? "Die App laeuft ueber HTTPS. Kamera, Standort und Homescreen-Installation sind auf dem iPhone damit deutlich zuverlaessiger."
      : "Diese Online-Adresse ist noch nicht als sichere HTTPS-Verbindung erkannt. Fuer Kamera und Standort brauchst du spaetestens in Produktion HTTPS.";

    elements.mobileHelp.innerHTML = `
      <strong>Online auf dem iPhone</strong>
      <p class="microcopy">Die App ist jetzt direkt ueber <code>${escapeHtml(publicUrl)}</code> erreichbar und nicht mehr nur im lokalen WLAN.</p>
      <p class="microcopy">${secureHint}</p>
      <p class="microcopy">Zum Installieren auf dem iPhone die Adresse in Safari oeffnen und dann "Zum Home-Bildschirm" waehlen.</p>
    `;
    return;
  }

  const localUrl = state.meta?.localUrls?.[0] || "";
  const connectionHint =
    localHostnames.has(location.hostname)
      ? localUrl
        ? `Auf dem iPhone im selben WLAN oeffnest du die App ueber <code>${escapeHtml(localUrl)}</code> und nicht ueber localhost.`
        : "Auf dem iPhone brauchst du die lokale IP deines Macs im selben WLAN und nicht localhost."
      : "Du bist bereits ueber eine Netzwerkadresse verbunden.";

  const secureHint = insecureRemoteContext
    ? "Achtung: Diese Verbindung laeuft ohne HTTPS. Auf dem iPhone koennen Live-Kamera und Standortzugriff deshalb blockiert sein."
    : "Diese Verbindung ist fuer die aktuelle Browser-Umgebung in Ordnung.";

  elements.mobileHelp.innerHTML = `
    <strong>iPhone-Hinweis</strong>
    <p class="microcopy">${connectionHint}</p>
    <p class="microcopy">${secureHint}</p>
    <p class="microcopy">Falls die Live-Kamera nicht startet, nutze bitte den Button fuer Foto oder Galerie.</p>
  `;
}

function renderWardrobe() {
  elements.wardrobeGrid.innerHTML = "";

  if (!state.wardrobe.length) {
    elements.wardrobeGrid.innerHTML = `<div class="empty-state">Noch keine Kleidungsstuecke gespeichert.</div>`;
    return;
  }

  state.wardrobe.forEach((item) => {
    const node = elements.wardrobeTemplate.content.cloneNode(true);
    const card = node.querySelector(".wardrobe-card");
    node.querySelector("img").src = item.image;
    node.querySelector("img").alt = item.name;
    node.querySelector("h3").textContent = item.name;
    node.querySelector(".wardrobe-meta").textContent = `${item.category} · ${item.color || "ohne Farbangabe"}`;
    const tagList = node.querySelector(".tag-list");
    [...item.seasons, ...item.occasions, ...(item.styles || []), item.temperature].forEach((value) => {
      tagList.appendChild(createTag(value));
    });
    node.querySelector(".delete-button").addEventListener("click", async () => {
      await api(`/api/wardrobe/${item.id}`, { method: "DELETE" });
      await loadSession();
    });
    elements.wardrobeGrid.appendChild(card);
  });
}

function renderRecommendation() {
  if (!state.latestRecommendation) {
    elements.recommendationCard.classList.add("hidden");
    elements.recommendationEmpty.classList.remove("hidden");
    return;
  }

  const recommendation = state.latestRecommendation;
  elements.recommendationCard.classList.remove("hidden");
  elements.recommendationEmpty.classList.add("hidden");
  elements.recommendationTitle.textContent = recommendation.title;
  elements.recommendationBadge.textContent = `${Math.round(recommendation.context.temperature)} Grad · ${recommendation.summary.primaryStyle}`;
  elements.recommendationReason.textContent = recommendation.reason;
  elements.recommendationItems.innerHTML = "";

  recommendation.items.forEach((item) => {
    const card = document.createElement("article");
    card.className = "mini-item";
    card.innerHTML = `
      <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" />
      <div class="mini-content">
        <h4>${escapeHtml(item.name)}</h4>
        <p class="wardrobe-meta">${escapeHtml(item.category)} · ${escapeHtml(item.color || "neutral")}</p>
      </div>
    `;
    elements.recommendationItems.appendChild(card);
  });
}

function renderSavedOutfits() {
  elements.savedOutfits.innerHTML = "";

  if (!state.savedOutfits.length) {
    elements.savedOutfits.innerHTML = `<div class="empty-state">Hier erscheinen deine gespeicherten Outfits.</div>`;
    return;
  }

  state.savedOutfits.forEach((outfit) => {
    const card = document.createElement("article");
    card.className = "outfit-card";
    const previewItems = outfit.items
      .map(
        (item) => `
          <div class="mini-item">
            <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" />
            <div class="mini-content">
              <h4>${escapeHtml(item.name)}</h4>
              <p class="wardrobe-meta">${escapeHtml(item.category)}</p>
            </div>
          </div>
        `
      )
      .join("");

    card.innerHTML = `
      <div class="outfit-content">
        <div class="shared-head">
          <div>
            <h3>${escapeHtml(outfit.name)}</h3>
            <p class="wardrobe-meta">${escapeHtml(outfit.occasion)} · ${Math.round(outfit.weatherSnapshot.temperature || 0)} Grad</p>
          </div>
          <button class="ghost-button share-button" type="button">Teilen</button>
        </div>
        <p>${escapeHtml(outfit.caption || "Kein Kommentar hinzugefuegt.")}</p>
      </div>
      <div class="mini-grid">${previewItems}</div>
      <button class="ghost-button delete-outfit-button" type="button">Outfit loeschen</button>
    `;

    card.querySelector(".share-button").addEventListener("click", async () => {
      try {
        await api("/api/shared-outfits", {
          method: "POST",
          body: JSON.stringify({ outfitId: outfit.id }),
        });
      } catch (error) {
        alert(error.message);
      }
      await loadSession();
      switchTab("home");
    });

    card.querySelector(".delete-outfit-button").addEventListener("click", async () => {
      await api(`/api/outfits/${outfit.id}`, { method: "DELETE" });
      await loadSession();
    });

    elements.savedOutfits.appendChild(card);
  });
}

function buildSharedPostCard(post, condensed = false) {
  const card = document.createElement("article");
  card.className = "shared-card";
  const preview = post.previewItems
    .map(
      (item) => `
        <div class="mini-item">
          <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" />
          <div class="mini-content">
            <h4>${escapeHtml(item.name)}</h4>
            <p class="wardrobe-meta">${escapeHtml(item.category)}</p>
          </div>
        </div>
      `
    )
    .join("");
  const comments = post.comments
    .map(
      (comment) => `
        <div class="comment">
          <strong>${escapeHtml(comment.authorName)}</strong>
          <p>${escapeHtml(comment.text)}</p>
        </div>
      `
    )
    .join("");

  card.innerHTML = `
    <div class="shared-content">
      <div class="shared-head">
        <div class="feed-author">
          ${avatarMarkup(post.author, "avatar")}
          <button class="open-profile-button" type="button">
            <div>
              <strong>${escapeHtml(post.author.displayName)}</strong>
              <div class="wardrobe-meta">@${escapeHtml(post.author.username)}</div>
            </div>
          </button>
        </div>
        ${post.author.id === state.user.id ? "" : `<button class="ghost-button follow-button" type="button">${post.isFollowing ? "Entfolgen" : "Folgen"}</button>`}
      </div>
      <div>
        <h3>${escapeHtml(post.outfitName)}</h3>
        <p>${escapeHtml(post.caption || "Ohne Caption.")}</p>
        <p class="wardrobe-meta">${post.weatherSnapshot?.temperature != null ? `${Math.round(post.weatherSnapshot.temperature)} Grad · ${escapeHtml(post.weatherSnapshot.weatherLabel)}` : "Ohne Wetterdaten"}</p>
      </div>
    </div>
    <div class="mini-grid">${preview}</div>
    <div class="shared-actions">
      <button class="ghost-button like-button" type="button">${post.likedByViewer ? "Unlike" : "Like"} · ${post.likes}</button>
    </div>
    ${condensed ? "" : `
      <form class="comment-box">
        <textarea rows="2" placeholder="Kommentar schreiben"></textarea>
        <button type="submit">Kommentieren</button>
      </form>
      <div class="stack-list">${comments || `<div class="empty-state">Noch keine Kommentare.</div>`}</div>
    `}
  `;

  card.querySelector(".open-profile-button").addEventListener("click", async () => {
    await loadPublicProfile(post.author.username);
    switchTab("profile");
  });

  card.querySelector(".follow-button")?.addEventListener("click", async () => {
    await api("/api/follows", {
      method: "POST",
      body: JSON.stringify({ targetUserId: post.author.id }),
    });
    await loadSession();
    if (state.viewedProfile?.profile.username === post.author.username) {
      await loadPublicProfile(post.author.username);
    }
  });

  card.querySelector(".like-button").addEventListener("click", async () => {
    await api(`/api/shared-outfits/${post.id}/like`, { method: "POST" });
    await loadSession();
    if (state.viewedProfile?.profile.username === post.author.username) {
      await loadPublicProfile(post.author.username);
    }
  });

  if (!condensed) {
    card.querySelector(".comment-box").addEventListener("submit", async (event) => {
      event.preventDefault();
      const textarea = card.querySelector("textarea");
      if (!textarea.value.trim()) return;
      await api(`/api/shared-outfits/${post.id}/comments`, {
        method: "POST",
        body: JSON.stringify({ text: textarea.value }),
      });
      await loadSession();
      if (state.viewedProfile?.profile.username === post.author.username) {
        await loadPublicProfile(post.author.username);
      }
    });
  }

  return card;
}

function renderSharedFeed() {
  elements.sharedFeed.innerHTML = "";

  if (!state.sharedOutfits.length) {
    elements.sharedFeed.innerHTML = `<div class="empty-state">Noch keine geteilten Outfits. Teile deinen ersten Look.</div>`;
    return;
  }

  state.sharedOutfits.forEach((post) => {
    elements.sharedFeed.appendChild(buildSharedPostCard(post));
  });
}

function renderFeaturedProfiles() {
  elements.featuredProfiles.innerHTML = "";

  if (!state.featuredProfiles.length) {
    elements.featuredProfiles.innerHTML = `<div class="empty-state">Sobald Nutzer Outfits teilen, erscheinen hier entdeckbare Profile.</div>`;
    return;
  }

  state.featuredProfiles.forEach((profile) => {
    const card = document.createElement("article");
    card.className = "profile-bubble";
    card.innerHTML = `
      ${avatarMarkup(profile, "avatar-medium")}
      <div>
        <strong>${escapeHtml(profile.displayName)}</strong>
        <div class="wardrobe-meta">@${escapeHtml(profile.username)}</div>
      </div>
      <div class="stat-row">
        <span class="stat-pill">${profile.stats.sharedOutfits} Looks</span>
      </div>
      <button class="ghost-button open-profile-button" type="button">Ansehen</button>
    `;
    card.querySelector(".open-profile-button").addEventListener("click", async () => {
      await loadPublicProfile(profile.username);
      switchTab("profile");
    });
    elements.featuredProfiles.appendChild(card);
  });
}

function renderPublicProfile() {
  if (!state.viewedProfile) {
    elements.publicProfileView.innerHTML = `<div class="empty-state">Waehle oben im Feed oder bei den Profilen jemanden aus.</div>`;
    return;
  }

  const { profile, sharedOutfits } = state.viewedProfile;
  const wrapper = document.createElement("div");
  wrapper.className = "stack-list";
  wrapper.innerHTML = `
    <article class="public-profile-card">
      <div class="public-head">
        ${avatarMarkup(profile, "avatar-large")}
        <div>
          <h3>${escapeHtml(profile.displayName)}</h3>
          <p class="meta-inline">@${escapeHtml(profile.username)}</p>
        </div>
      </div>
      <p>${escapeHtml(profile.bio || "Kein Profiltext hinterlegt.")}</p>
      <div class="stat-row">
        <span class="stat-pill">${profile.stats.sharedOutfits} Looks</span>
        <span class="stat-pill">${profile.stats.followers} Follower</span>
        <span class="stat-pill">${profile.stats.wardrobeItems} Teile</span>
      </div>
      ${profile.isCurrentUser ? "" : `<button class="ghost-button follow-profile-button" type="button">${profile.isFollowing ? "Entfolgen" : "Folgen"}</button>`}
    </article>
  `;

  if (!profile.isCurrentUser) {
    wrapper.querySelector(".follow-profile-button").addEventListener("click", async () => {
      await api("/api/follows", {
        method: "POST",
        body: JSON.stringify({ targetUserId: profile.id }),
      });
      await loadSession();
      await loadPublicProfile(profile.username);
    });
  }

  if (!sharedOutfits.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Dieses Profil hat noch keine geteilten Looks.";
    wrapper.appendChild(empty);
  } else {
    sharedOutfits.forEach((post) => wrapper.appendChild(buildSharedPostCard(post, true)));
  }

  elements.publicProfileView.innerHTML = "";
  elements.publicProfileView.appendChild(wrapper);
}

function renderAll() {
  renderAuthState();
  renderHeaderUser();
  renderAccountCard();
  renderWeatherCard();
  renderMobileHelp();
  renderWardrobe();
  renderRecommendation();
  renderSavedOutfits();
  renderSharedFeed();
  renderFeaturedProfiles();
  renderPublicProfile();
}

async function loadSession() {
  const payload = await api("/api/session");
  state.authenticated = payload.authenticated;
  state.user = payload.user;
  state.wardrobe = payload.wardrobe || [];
  state.savedOutfits = payload.savedOutfits || [];
  state.sharedOutfits = payload.sharedOutfits || [];
  state.featuredProfiles = payload.featuredProfiles || [];

  if (!state.authenticated) {
    state.weather = null;
    state.latestRecommendation = null;
    state.viewedProfile = null;
    stopCameraStream();
    state.cameraImage = "";
  }

  renderAll();
}

async function loadPublicProfile(username) {
  const payload = await api(`/api/profiles/${encodeURIComponent(username)}`);
  state.viewedProfile = payload;
  renderPublicProfile();
}

async function loadWeather() {
  if (insecureRemoteContext) {
    alert("Standortzugriff ist auf dem iPhone ueber lokales HTTP oft blockiert. Trage bitte die Temperatur manuell im Outfit-Bereich ein oder nutze spaeter HTTPS.");
    return;
  }

  if (!navigator.geolocation) {
    alert("Geolocation wird auf diesem Geraet nicht unterstuetzt.");
    return;
  }

  const position = await new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
    });
  }).catch(() => null);

  if (!position) {
    alert("Standort konnte nicht geladen werden.");
    return;
  }

  state.weather = await api(`/api/weather?lat=${position.coords.latitude}&lon=${position.coords.longitude}`);
  renderWeatherCard();
}

elements.navButtons.forEach((button) => {
  button.addEventListener("click", () => switchTab(button.dataset.tab));
});

elements.signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const payload = await api("/api/signup", {
      method: "POST",
      body: JSON.stringify({
        displayName: document.querySelector("#signup-display-name").value,
        username: document.querySelector("#signup-username").value,
        password: document.querySelector("#signup-password").value,
      }),
    });
    state.authenticated = payload.authenticated;
    state.user = payload.user;
    state.wardrobe = payload.wardrobe || [];
    state.savedOutfits = payload.savedOutfits || [];
    state.sharedOutfits = payload.sharedOutfits || [];
    state.featuredProfiles = payload.featuredProfiles || [];
    state.viewedProfile = null;
    elements.signupForm.reset();
    setAuthMessage("Account erstellt. Du bist jetzt eingeloggt.");
    renderAll();
  } catch (error) {
    setAuthMessage(error.message);
  }
});

elements.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const payload = await api("/api/login", {
      method: "POST",
      body: JSON.stringify({
        username: document.querySelector("#login-username").value,
        password: document.querySelector("#login-password").value,
      }),
    });
    state.authenticated = payload.authenticated;
    state.user = payload.user;
    state.wardrobe = payload.wardrobe || [];
    state.savedOutfits = payload.savedOutfits || [];
    state.sharedOutfits = payload.sharedOutfits || [];
    state.featuredProfiles = payload.featuredProfiles || [];
    state.viewedProfile = null;
    elements.loginForm.reset();
    setAuthMessage("");
    renderAll();
  } catch (error) {
    setAuthMessage(error.message);
  }
});

elements.logoutButton.addEventListener("click", async () => {
  await api("/api/logout", { method: "POST" });
  setAuthMessage("Du wurdest ausgeloggt.");
  await loadSession();
});

elements.installTipButton.addEventListener("click", () => {
  if (state.meta?.hosted || !localHostnames.has(location.hostname)) {
    alert("Auf dem iPhone: die Online-Adresse der App in Safari oeffnen und danach 'Zum Home-Bildschirm' waehlen.");
    return;
  }

  alert("Auf dem iPhone: zuerst die lokale Netzwerkadresse deines Macs oeffnen, danach in Safari unten auf Teilen tippen und 'Zum Home-Bildschirm' waehlen.");
});

elements.weatherButton.addEventListener("click", async () => {
  try {
    await loadWeather();
  } catch (error) {
    alert(`Wetter konnte nicht geladen werden: ${error.message}`);
  }
});

elements.cameraOpenButton.addEventListener("click", async () => {
  await openCamera();
});

elements.cameraCaptureButton.addEventListener("click", () => {
  captureCameraPhoto();
});

elements.cameraResetButton.addEventListener("click", () => {
  resetCameraUi();
});

elements.imageInput.addEventListener("change", async () => {
  const file = elements.imageInput.files[0];
  if (!file) return;
  stopCameraStream();
  state.cameraImage = await fileToDataUrl(file);
  elements.cameraPreview.src = state.cameraImage;
  elements.cameraPreview.classList.remove("hidden");
  elements.cameraVideo.classList.add("hidden");
  elements.cameraPlaceholder.classList.add("hidden");
  elements.cameraStatus.textContent = `Galeriebild ausgewaehlt: ${file.name}`;
});

elements.profileForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const avatarFile = elements.profileAvatarInput.files[0];
  const avatarImage = avatarFile ? await fileToDataUrl(avatarFile) : "";
  const payload = await api("/api/profile", {
    method: "PATCH",
    body: JSON.stringify({
      displayName: elements.profileDisplayName.value.trim(),
      bio: elements.profileBio.value.trim(),
      avatarImage,
      clearAvatar: elements.profileAvatarClear.checked,
    }),
  });
  state.user = payload.user;
  elements.profileAvatarInput.value = "";
  elements.profileAvatarClear.checked = false;
  renderAccountCard();
  renderHeaderUser();
});

elements.clothingForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  let imagePayload = state.cameraImage;
  if (!imagePayload && elements.imageInput.files[0]) {
    imagePayload = await fileToDataUrl(elements.imageInput.files[0]);
  }

  if (!imagePayload) {
    alert("Bitte mache zuerst ein Foto oder waehle ein Bild aus.");
    return;
  }

  await api("/api/wardrobe", {
    method: "POST",
    body: JSON.stringify({
      name: document.querySelector("#name-input").value.trim(),
      category: document.querySelector("#category-input").value,
      color: document.querySelector("#color-input").value.trim(),
      seasons: getCheckedValues("season").length ? getCheckedValues("season") : ["Fruehling", "Sommer", "Herbst", "Winter"],
      temperature: document.querySelector("#temperature-input").value,
      occasions: getCheckedValues("occasion").length ? getCheckedValues("occasion") : ["Alltag"],
      styles: getCheckedValues("style").length ? getCheckedValues("style") : ["minimal"],
      image: imagePayload,
    }),
  });

  elements.clothingForm.reset();
  resetCameraUi();
  await loadSession();
  switchTab("closet");
});

elements.generatorForm.addEventListener("submit", (event) => {
  event.preventDefault();

  if (!state.wardrobe.length) {
    alert("Speichere zuerst ein paar Kleidungsstuecke.");
    return;
  }

  const occasion = elements.occasionFilter.value;
  const vibe = elements.vibeFilter.value;
  const context = buildRecommendationContext(occasion, vibe);
  const items = pickBestItems(context);

  if (!items.length) {
    alert("Fuer diesen Anlass fehlen passende Kleidungsstuecke.");
    return;
  }

  const summary = summarizeLook(items, context);
  state.latestRecommendation = {
    title: `${occasion}-Look im ${vibe}-Vibe`,
    items,
    context,
    summary,
    reason: `Der Vorschlag kombiniert ${occasion.toLowerCase()}-taugliche Teile, ${summary.primaryStyle}-Stil und eine ${summary.primaryColor}-nahe Farbpalette fuer ${Math.round(context.temperature)} Grad bei ${context.weatherLabel}.`,
  };

  renderRecommendation();
});

elements.saveOutfitForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!state.latestRecommendation) {
    return;
  }

  await api("/api/outfits", {
    method: "POST",
    body: JSON.stringify({
      name: elements.outfitName.value.trim(),
      caption: elements.outfitCaption.value.trim(),
      itemIds: state.latestRecommendation.items.map((item) => item.id),
      occasion: state.latestRecommendation.context.occasion,
      weatherSnapshot: {
        temperature: state.latestRecommendation.context.temperature,
        weatherLabel: state.latestRecommendation.context.weatherLabel,
      },
    }),
  });

  elements.saveOutfitForm.reset();
  await loadSession();
  switchTab("closet");
});

window.addEventListener("beforeunload", () => {
  stopCameraStream();
});

(async () => {
  state.meta = await loadMeta();
  await loadSession();
})();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
