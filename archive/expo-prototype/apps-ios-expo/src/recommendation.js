import { OCCASION_STYLE_MAP, VIBE_STYLE_MAP } from "./constants.js";

export function weatherCodeToLabel(code) {
  if (code === 0) return "Klar";
  if ([1, 2, 3].includes(code)) return "Leicht bewoelkt";
  if ([45, 48].includes(code)) return "Nebelig";
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return "Regnerisch";
  if ([71, 73, 75, 85, 86].includes(code)) return "Schnee";
  if ([95, 96, 99].includes(code)) return "Gewitter";
  return "Wetterwechsel";
}

export function getSeasonFromTemperature(temp) {
  if (temp < 10) return "Winter";
  if (temp < 18) return "Fruehling";
  if (temp < 24) return "Herbst";
  return "Sommer";
}

export function getTemperatureBucket(temp) {
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

function pickBestForCategory(wardrobe, category, context, selectedItems) {
  return wardrobe
    .filter((item) => item.category === category)
    .sort((left, right) => scoreItem(right, context, category, selectedItems) - scoreItem(left, context, category, selectedItems))[0];
}

function uniqueById(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export function buildRecommendationContext({ weather, manualTemperature, occasion, vibe }) {
  const currentTemp = weather?.current?.temperature_2m ?? 18;
  const numericManual = Number(manualTemperature);
  const effectiveTemp = Number.isFinite(numericManual) ? numericManual : currentTemp;
  const weatherCode = weather?.current?.weather_code ?? 1;

  return {
    occasion,
    vibe,
    temperature: effectiveTemp,
    temperatureBucket: getTemperatureBucket(effectiveTemp),
    weatherLabel: weatherCodeToLabel(weatherCode),
    season: getSeasonFromTemperature(effectiveTemp),
    targetStyles: Array.from(new Set([...(OCCASION_STYLE_MAP[occasion] || []), ...(VIBE_STYLE_MAP[vibe] || [])])),
  };
}

export function pickBestItems(wardrobe, context) {
  const selectedItems = [];
  const dressCandidate = pickBestForCategory(wardrobe, "Dress", context, selectedItems);
  const shouldUseDress =
    dressCandidate &&
    context.occasion !== "Sport" &&
    context.temperatureBucket !== "cold" &&
    scoreItem(dressCandidate, context, "Dress", selectedItems) >= 78;

  if (shouldUseDress) {
    selectedItems.push(dressCandidate);
    const shoes = pickBestForCategory(wardrobe, "Shoes", context, selectedItems);
    if (shoes) selectedItems.push(shoes);
  } else {
    ["Top", "Bottom", "Shoes"].forEach((category) => {
      const item = pickBestForCategory(wardrobe, category, context, selectedItems);
      if (item) selectedItems.push(item);
    });
  }

  if (context.temperatureBucket === "cold" || ["Regnerisch", "Schnee"].includes(context.weatherLabel)) {
    const outerwear = pickBestForCategory(wardrobe, "Outerwear", context, selectedItems);
    if (outerwear) selectedItems.push(outerwear);
  }

  if (context.temperatureBucket !== "warm" || context.occasion === "Party") {
    const accessory = pickBestForCategory(wardrobe, "Accessory", context, selectedItems);
    if (accessory) selectedItems.push(accessory);
  }

  return uniqueById(selectedItems);
}

export function summarizeLook(items, context) {
  const styles = items.flatMap((item) => item.styles || []);
  const colors = items.map((item) => colorFamily(item.color));
  const styleCounts = Object.fromEntries(styles.map((style) => [style, styles.filter((entry) => entry === style).length]));
  const colorCounts = Object.fromEntries(colors.map((color) => [color, colors.filter((entry) => entry === color).length]));
  const primaryStyle = Object.keys(styleCounts).sort((left, right) => styleCounts[right] - styleCounts[left])[0] || context.targetStyles[0] || "minimal";
  const primaryColor = Object.keys(colorCounts).sort((left, right) => colorCounts[right] - colorCounts[left])[0] || "neutral";
  return { primaryStyle, primaryColor };
}
