import Constants from "expo-constants";

const configuredApiUrl =
  process.env.EXPO_PUBLIC_API_URL ||
  Constants.expoConfig?.extra?.apiUrl ||
  "";

export const API_URL = configuredApiUrl.replace(/\/+$/, "");

export function resolveAssetUrl(assetPath) {
  if (!assetPath) return "";
  if (assetPath.startsWith("http://") || assetPath.startsWith("https://")) return assetPath;
  if (assetPath.startsWith("/") && API_URL) return `${API_URL}${assetPath}`;
  return assetPath;
}

export async function api(path, { method = "GET", body, token } = {}) {
  if (!API_URL) {
    throw new Error("API-URL fehlt. Trage in der nativen App deine Online-URL ein.");
  }

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Request failed");
  }
  return payload;
}
