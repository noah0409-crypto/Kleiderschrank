import { createServer } from "node:http";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { networkInterfaces } from "node:os";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const publicDir = join(__dirname, "public");
const dataDir = process.env.DATA_DIR ? resolve(process.env.DATA_DIR) : join(__dirname, "data");
const uploadsDir = join(dataDir, "uploads");
const dbPath = join(dataDir, "closet-cloud.db");
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "0.0.0.0";
const publicBaseUrl = String(process.env.PUBLIC_BASE_URL || "").trim().replace(/\/+$/, "");
const forceSecureCookies = ["1", "true", "yes", "on"].includes(String(process.env.FORCE_SECURE_COOKIES || "").trim().toLowerCase());

function getLocalUrls() {
  const urls = [];

  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family === "IPv4" && !entry.internal) {
        urls.push(`http://${entry.address}:${port}`);
      }
    }
  }

  return Array.from(new Set(urls));
}

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".webp": "image/webp",
};

const wardrobeItemsByIdsSql = `
  SELECT id, user_id, name, category, color, seasons_json, temperature, occasions_json, styles_json, image, created_at
  FROM wardrobe_items
  WHERE user_id = ? AND id IN (%IDS%)
`;

await mkdir(dataDir, { recursive: true });
await mkdir(uploadsDir, { recursive: true });
await mkdir(join(uploadsDir, "avatars"), { recursive: true });
await mkdir(join(uploadsDir, "clothes"), { recursive: true });

const db = new DatabaseSync(dbPath);

db.exec(`
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    display_name TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    bio TEXT NOT NULL DEFAULT '',
    avatar_path TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS wardrobe_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    color TEXT,
    seasons_json TEXT NOT NULL,
    temperature TEXT NOT NULL,
    occasions_json TEXT NOT NULL,
    styles_json TEXT NOT NULL DEFAULT '[]',
    image TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS outfits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    caption TEXT,
    occasion TEXT NOT NULL,
    item_ids_json TEXT NOT NULL,
    weather_temperature REAL,
    weather_label TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS shared_outfits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    outfit_id INTEGER NOT NULL UNIQUE,
    user_id INTEGER NOT NULL,
    caption TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (outfit_id) REFERENCES outfits(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS follows (
    follower_id INTEGER NOT NULL,
    target_user_id INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (follower_id, target_user_id),
    FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS likes (
    user_id INTEGER NOT NULL,
    shared_outfit_id INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (user_id, shared_outfit_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (shared_outfit_id) REFERENCES shared_outfits(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    shared_outfit_id INTEGER NOT NULL,
    text TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (shared_outfit_id) REFERENCES shared_outfits(id) ON DELETE CASCADE
  );
`);

const statements = {
  insertUser: db.prepare(`
    INSERT INTO users (display_name, username, password_hash, bio, avatar_path, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `),
  findUserByUsername: db.prepare(`
    SELECT id, display_name, username, password_hash, bio, avatar_path, created_at
    FROM users
    WHERE username = ?
  `),
  findUserById: db.prepare(`
    SELECT id, display_name, username, bio, avatar_path, created_at
    FROM users
    WHERE id = ?
  `),
  updateProfile: db.prepare(`
    UPDATE users
    SET display_name = ?, bio = ?, avatar_path = ?
    WHERE id = ?
  `),
  insertSession: db.prepare(`
    INSERT INTO sessions (token, user_id, created_at)
    VALUES (?, ?, ?)
  `),
  findSessionUser: db.prepare(`
    SELECT users.id, users.display_name, users.username, users.bio, users.avatar_path, users.created_at
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.token = ?
  `),
  deleteSession: db.prepare(`DELETE FROM sessions WHERE token = ?`),
  listWardrobe: db.prepare(`
    SELECT id, user_id, name, category, color, seasons_json, temperature, occasions_json, styles_json, image, created_at
    FROM wardrobe_items
    WHERE user_id = ?
    ORDER BY datetime(created_at) DESC, id DESC
  `),
  insertWardrobe: db.prepare(`
    INSERT INTO wardrobe_items (user_id, name, category, color, seasons_json, temperature, occasions_json, styles_json, image, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  findWardrobeById: db.prepare(`
    SELECT id, image
    FROM wardrobe_items
    WHERE id = ? AND user_id = ?
  `),
  deleteWardrobe: db.prepare(`DELETE FROM wardrobe_items WHERE id = ? AND user_id = ?`),
  listOutfits: db.prepare(`
    SELECT id, user_id, name, caption, occasion, item_ids_json, weather_temperature, weather_label, created_at
    FROM outfits
    WHERE user_id = ?
    ORDER BY datetime(created_at) DESC, id DESC
  `),
  insertOutfit: db.prepare(`
    INSERT INTO outfits (user_id, name, caption, occasion, item_ids_json, weather_temperature, weather_label, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `),
  deleteOutfit: db.prepare(`DELETE FROM outfits WHERE id = ? AND user_id = ?`),
  getOutfitById: db.prepare(`
    SELECT id, user_id, name, caption, occasion, item_ids_json, weather_temperature, weather_label, created_at
    FROM outfits
    WHERE id = ? AND user_id = ?
  `),
  findSharedByOutfitAndUser: db.prepare(`
    SELECT id
    FROM shared_outfits
    WHERE outfit_id = ? AND user_id = ?
  `),
  insertSharedOutfit: db.prepare(`
    INSERT INTO shared_outfits (outfit_id, user_id, caption, created_at)
    VALUES (?, ?, ?, ?)
  `),
  listSharedOutfits: db.prepare(`
    SELECT
      shared_outfits.id,
      shared_outfits.outfit_id,
      shared_outfits.caption AS shared_caption,
      shared_outfits.created_at AS shared_created_at,
      outfits.name AS outfit_name,
      outfits.caption AS outfit_caption,
      outfits.occasion,
      outfits.item_ids_json,
      outfits.weather_temperature,
      outfits.weather_label,
      users.id AS author_id,
      users.display_name AS author_name,
      users.username AS author_username,
      users.bio AS author_bio,
      users.avatar_path AS author_avatar
    FROM shared_outfits
    JOIN outfits ON outfits.id = shared_outfits.outfit_id
    JOIN users ON users.id = shared_outfits.user_id
    ORDER BY datetime(shared_outfits.created_at) DESC, shared_outfits.id DESC
  `),
  listSharedOutfitsByUserId: db.prepare(`
    SELECT
      shared_outfits.id,
      shared_outfits.outfit_id,
      shared_outfits.caption AS shared_caption,
      shared_outfits.created_at AS shared_created_at,
      outfits.name AS outfit_name,
      outfits.caption AS outfit_caption,
      outfits.occasion,
      outfits.item_ids_json,
      outfits.weather_temperature,
      outfits.weather_label,
      users.id AS author_id,
      users.display_name AS author_name,
      users.username AS author_username,
      users.bio AS author_bio,
      users.avatar_path AS author_avatar
    FROM shared_outfits
    JOIN outfits ON outfits.id = shared_outfits.outfit_id
    JOIN users ON users.id = shared_outfits.user_id
    WHERE users.id = ?
    ORDER BY datetime(shared_outfits.created_at) DESC, shared_outfits.id DESC
  `),
  countLikes: db.prepare(`SELECT COUNT(*) AS count FROM likes WHERE shared_outfit_id = ?`),
  hasLike: db.prepare(`SELECT 1 FROM likes WHERE user_id = ? AND shared_outfit_id = ?`),
  addLike: db.prepare(`
    INSERT OR IGNORE INTO likes (user_id, shared_outfit_id, created_at)
    VALUES (?, ?, ?)
  `),
  removeLike: db.prepare(`DELETE FROM likes WHERE user_id = ? AND shared_outfit_id = ?`),
  listComments: db.prepare(`
    SELECT comments.id, comments.text, comments.created_at, users.display_name AS author_name, users.username AS author_username
    FROM comments
    JOIN users ON users.id = comments.user_id
    WHERE comments.shared_outfit_id = ?
    ORDER BY datetime(comments.created_at) DESC, comments.id DESC
  `),
  addComment: db.prepare(`
    INSERT INTO comments (user_id, shared_outfit_id, text, created_at)
    VALUES (?, ?, ?, ?)
  `),
  isFollowing: db.prepare(`SELECT 1 FROM follows WHERE follower_id = ? AND target_user_id = ?`),
  addFollow: db.prepare(`
    INSERT OR IGNORE INTO follows (follower_id, target_user_id, created_at)
    VALUES (?, ?, ?)
  `),
  removeFollow: db.prepare(`DELETE FROM follows WHERE follower_id = ? AND target_user_id = ?`),
  countFollowers: db.prepare(`SELECT COUNT(*) AS count FROM follows WHERE target_user_id = ?`),
  countFollowing: db.prepare(`SELECT COUNT(*) AS count FROM follows WHERE follower_id = ?`),
  countWardrobe: db.prepare(`SELECT COUNT(*) AS count FROM wardrobe_items WHERE user_id = ?`),
  countSharedOutfitsByUser: db.prepare(`SELECT COUNT(*) AS count FROM shared_outfits WHERE user_id = ?`),
  featuredProfiles: db.prepare(`
    SELECT
      users.id,
      users.display_name,
      users.username,
      users.bio,
      users.avatar_path,
      users.created_at,
      COUNT(shared_outfits.id) AS shared_count
    FROM users
    JOIN shared_outfits ON shared_outfits.user_id = users.id
    GROUP BY users.id
    ORDER BY shared_count DESC, datetime(MAX(shared_outfits.created_at)) DESC
    LIMIT 8
  `),
};

function sendJson(res, statusCode, payload, extraHeaders = {}) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...extraHeaders,
  });
  res.end(JSON.stringify(payload));
}

function sendText(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(payload);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function normalizeUrlPath(urlPath) {
  return normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, "");
}

function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

function verifyPassword(password, storedHash) {
  const [salt, expectedHash] = storedHash.split(":");
  const candidate = scryptSync(password, salt, 64);
  return timingSafeEqual(candidate, Buffer.from(expectedHash, "hex"));
}

function parseCookies(req) {
  const raw = req.headers.cookie || "";
  return Object.fromEntries(
    raw
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separatorIndex = part.indexOf("=");
        return [part.slice(0, separatorIndex), decodeURIComponent(part.slice(separatorIndex + 1))];
      })
  );
}

function getBearerToken(req) {
  const authorization = req.headers.authorization;
  if (typeof authorization !== "string") return "";
  const [scheme, token] = authorization.split(" ");
  if (!scheme || !token || scheme.toLowerCase() !== "bearer") return "";
  return token.trim();
}

function isSecureRequest(req) {
  if (forceSecureCookies) return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  return typeof forwardedProto === "string" && forwardedProto.split(",")[0].trim() === "https";
}

function createSessionCookie(req, token) {
  const secureAttribute = isSecureRequest(req) ? "; Secure" : "";
  return `closet_session=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000${secureAttribute}`;
}

function clearSessionCookie(req) {
  const secureAttribute = isSecureRequest(req) ? "; Secure" : "";
  return `closet_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secureAttribute}`;
}

function getPublicAppUrl(req) {
  if (publicBaseUrl) return publicBaseUrl;
  const protocol = isSecureRequest(req) ? "https" : "http";
  return `${protocol}://${req.headers.host || `localhost:${port}`}`;
}

function parseId(value, prefix) {
  if (!value || !value.startsWith(prefix)) return null;
  const parsed = Number(value.slice(prefix.length));
  return Number.isInteger(parsed) ? parsed : null;
}

function normalizeUser(row) {
  return {
    id: row.id,
    displayName: row.display_name,
    username: row.username,
    bio: row.bio || "",
    avatarUrl: row.avatar_path || "",
    createdAt: row.created_at,
  };
}

function normalizeWardrobeItem(row) {
  return {
    id: `clothing-${row.id}`,
    numericId: row.id,
    userId: row.user_id,
    name: row.name,
    category: row.category,
    color: row.color || "",
    seasons: JSON.parse(row.seasons_json),
    temperature: row.temperature,
    occasions: JSON.parse(row.occasions_json),
    styles: JSON.parse(row.styles_json || "[]"),
    image: row.image,
    createdAt: row.created_at,
  };
}

function getWardrobeItemsByIds(userId, numericIds) {
  if (!numericIds.length) return [];
  const placeholders = numericIds.map(() => "?").join(",");
  const statement = db.prepare(wardrobeItemsByIdsSql.replace("%IDS%", placeholders));
  return statement.all(userId, ...numericIds).map(normalizeWardrobeItem);
}

function normalizeOutfit(row, userId) {
  const numericIds = JSON.parse(row.item_ids_json);
  return {
    id: `outfit-${row.id}`,
    numericId: row.id,
    name: row.name,
    caption: row.caption || "",
    occasion: row.occasion,
    itemIds: numericIds.map((id) => `clothing-${id}`),
    items: getWardrobeItemsByIds(userId, numericIds),
    weatherSnapshot: {
      temperature: row.weather_temperature,
      weatherLabel: row.weather_label,
    },
    createdAt: row.created_at,
  };
}

function buildComments(sharedOutfitId) {
  return statements.listComments.all(sharedOutfitId).map((comment) => ({
    id: `comment-${comment.id}`,
    authorName: comment.author_name,
    authorUsername: comment.author_username,
    text: comment.text,
    createdAt: comment.created_at,
  }));
}

function buildProfileStats(userId) {
  return {
    followers: statements.countFollowers.get(userId).count,
    following: statements.countFollowing.get(userId).count,
    wardrobeItems: statements.countWardrobe.get(userId).count,
    sharedOutfits: statements.countSharedOutfitsByUser.get(userId).count,
  };
}

function buildSharedPost(row, viewerId) {
  const numericIds = JSON.parse(row.item_ids_json);
  return {
    id: `shared-${row.id}`,
    numericId: row.id,
    outfitId: `outfit-${row.outfit_id}`,
    author: {
      id: row.author_id,
      displayName: row.author_name,
      username: row.author_username,
      bio: row.author_bio || "",
      avatarUrl: row.author_avatar || "",
    },
    isFollowing: viewerId ? Boolean(statements.isFollowing.get(viewerId, row.author_id)) : false,
    likedByViewer: viewerId ? Boolean(statements.hasLike.get(viewerId, row.id)) : false,
    outfitName: row.outfit_name,
    caption: row.shared_caption || row.outfit_caption || "",
    occasion: row.occasion,
    createdAt: row.shared_created_at,
    weatherSnapshot: {
      temperature: row.weather_temperature,
      weatherLabel: row.weather_label,
    },
    likes: statements.countLikes.get(row.id).count,
    comments: buildComments(row.id),
    previewItems: getWardrobeItemsByIds(row.author_id, numericIds),
  };
}

function buildSharedFeed(viewerId) {
  return statements.listSharedOutfits.all().map((row) => buildSharedPost(row, viewerId));
}

function buildFeaturedProfiles(viewerId) {
  return statements.featuredProfiles.all().map((row) => ({
    ...normalizeUser(row),
    stats: buildProfileStats(row.id),
    isFollowing: viewerId ? Boolean(statements.isFollowing.get(viewerId, row.id)) : false,
  }));
}

function safeAssetPath(assetPath) {
  const normalized = normalize(assetPath).replace(/^(\.\.[/\\])+/, "");
  const resolved = join(uploadsDir, normalized);
  if (!resolved.startsWith(uploadsDir)) return null;
  return resolved;
}

async function saveDataUrlImage(dataUrl, folderName) {
  if (!dataUrl) return "";
  if (dataUrl.startsWith("/uploads/")) return dataUrl;

  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    throw new Error("Ungueltiges Bildformat.");
  }

  const extensionMap = {
    "image/gif": ".gif",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
  };

  const extension = extensionMap[match[1]];
  if (!extension) {
    throw new Error("Dieses Bildformat wird nicht unterstuetzt.");
  }

  const fileName = `${Date.now()}-${randomBytes(8).toString("hex")}${extension}`;
  const relativePath = `${folderName}/${fileName}`;
  await writeFile(join(uploadsDir, relativePath), Buffer.from(match[2], "base64"));
  return `/uploads/${relativePath}`;
}

async function removeStoredImage(assetUrl) {
  if (!assetUrl || !assetUrl.startsWith("/uploads/")) return;
  const absolutePath = safeAssetPath(assetUrl.slice("/uploads/".length));
  if (!absolutePath) return;
  try {
    await unlink(absolutePath);
  } catch {
    // Ignore missing files.
  }
}

function getSessionToken(req) {
  const bearerToken = getBearerToken(req);
  if (bearerToken) return bearerToken;
  const cookies = parseCookies(req);
  return cookies.closet_session || "";
}

function getCurrentUser(req) {
  const sessionToken = getSessionToken(req);
  if (!sessionToken) return null;
  const row = statements.findSessionUser.get(sessionToken);
  return row ? normalizeUser(row) : null;
}

function requireUser(req, res) {
  const user = getCurrentUser(req);
  if (!user) {
    sendJson(res, 401, { error: "Bitte zuerst anmelden." });
    return null;
  }
  return user;
}

function buildSessionPayload(user) {
  return {
    authenticated: true,
    user: {
      ...user,
      stats: buildProfileStats(user.id),
    },
    wardrobe: statements.listWardrobe.all(user.id).map(normalizeWardrobeItem),
    savedOutfits: statements.listOutfits.all(user.id).map((row) => normalizeOutfit(row, user.id)),
    sharedOutfits: buildSharedFeed(user.id),
    featuredProfiles: buildFeaturedProfiles(user.id),
  };
}

function servePublicFile(res, pathname) {
  const relativePath = pathname === "/" ? "index.html" : normalizeUrlPath(pathname).replace(/^[/\\]/, "");
  const absolutePath = join(publicDir, relativePath);
  return readFile(absolutePath)
    .then((contents) => {
      res.writeHead(200, {
        "Content-Type": mimeTypes[extname(absolutePath)] || "application/octet-stream",
      });
      res.end(contents);
    })
    .catch(() => sendText(res, 404, "Not found"));
}

function serveUploadFile(res, pathname) {
  const relativePath = normalizeUrlPath(pathname.slice("/uploads/".length));
  const absolutePath = safeAssetPath(relativePath);
  if (!absolutePath) {
    return sendText(res, 404, "Not found");
  }
  return readFile(absolutePath)
    .then((contents) => {
      res.writeHead(200, {
        "Content-Type": mimeTypes[extname(absolutePath)] || "application/octet-stream",
      });
      res.end(contents);
    })
    .catch(() => sendText(res, 404, "Not found"));
}

const server = createServer(async (req, res) => {
  const requestUrl = new URL(req.url || "/", `http://${req.headers.host}`);
  const { pathname, searchParams } = requestUrl;

  try {
    if (pathname === "/healthz" && req.method === "GET") {
      db.prepare("SELECT 1 AS ok").get();
      return sendJson(res, 200, {
        ok: true,
        uptimeSeconds: Math.round(process.uptime()),
      });
    }

    if (pathname === "/api/session" && req.method === "GET") {
      const user = getCurrentUser(req);
      if (!user) {
        return sendJson(res, 200, {
          authenticated: false,
          user: null,
          wardrobe: [],
          savedOutfits: [],
          sharedOutfits: [],
          featuredProfiles: [],
        });
      }
      return sendJson(res, 200, buildSessionPayload(user));
    }

    if (pathname === "/api/meta" && req.method === "GET") {
      const publicUrl = getPublicAppUrl(req);
      const publicHost = new URL(publicUrl).hostname;
      const hosted = !["localhost", "127.0.0.1"].includes(publicHost);
      return sendJson(res, 200, {
        appName: "Kleiderschrank",
        hosted,
        localUrls: hosted ? [] : getLocalUrls(),
        publicUrl,
        needsHttpsFor: ["live-camera", "location"],
      });
    }

    if (pathname === "/api/signup" && req.method === "POST") {
      const body = await readBody(req);
      const displayName = String(body.displayName || "").trim();
      const username = String(body.username || "").trim().toLowerCase();
      const password = String(body.password || "");

      if (!displayName || !username || password.length < 6) {
        return sendJson(res, 400, { error: "Name, Benutzername und ein Passwort mit mindestens 6 Zeichen sind erforderlich." });
      }

      if (statements.findUserByUsername.get(username)) {
        return sendJson(res, 409, { error: "Benutzername ist bereits vergeben." });
      }

      const now = new Date().toISOString();
      statements.insertUser.run(displayName, username, hashPassword(password), "", "", now);
      const createdUser = statements.findUserByUsername.get(username);
      const token = randomBytes(24).toString("hex");
      statements.insertSession.run(token, createdUser.id, now);
      return sendJson(res, 201, {
        ...buildSessionPayload(normalizeUser(createdUser)),
        sessionToken: token,
      }, {
        "Set-Cookie": createSessionCookie(req, token),
      });
    }

    if (pathname === "/api/login" && req.method === "POST") {
      const body = await readBody(req);
      const username = String(body.username || "").trim().toLowerCase();
      const password = String(body.password || "");
      const user = statements.findUserByUsername.get(username);

      if (!user || !verifyPassword(password, user.password_hash)) {
        return sendJson(res, 401, { error: "Benutzername oder Passwort ist falsch." });
      }

      const token = randomBytes(24).toString("hex");
      statements.insertSession.run(token, user.id, new Date().toISOString());
      return sendJson(res, 200, {
        ...buildSessionPayload(normalizeUser(user)),
        sessionToken: token,
      }, {
        "Set-Cookie": createSessionCookie(req, token),
      });
    }

    if (pathname === "/api/logout" && req.method === "POST") {
      const sessionToken = getSessionToken(req);
      if (sessionToken) {
        statements.deleteSession.run(sessionToken);
      }
      return sendJson(res, 200, { ok: true }, { "Set-Cookie": clearSessionCookie(req) });
    }

    if (pathname === "/api/profile" && req.method === "PATCH") {
      const user = requireUser(req, res);
      if (!user) return;
      const body = await readBody(req);
      const current = statements.findUserById.get(user.id);
      const displayName = String(body.displayName || current.display_name).trim() || current.display_name;
      const bio = String(body.bio ?? current.bio ?? "").trim().slice(0, 220);
      let avatarPath = current.avatar_path || "";

      if (body.clearAvatar) {
        await removeStoredImage(avatarPath);
        avatarPath = "";
      } else if (body.avatarImage) {
        const nextAvatar = await saveDataUrlImage(String(body.avatarImage), "avatars");
        if (nextAvatar && nextAvatar !== avatarPath) {
          await removeStoredImage(avatarPath);
          avatarPath = nextAvatar;
        }
      }

      statements.updateProfile.run(displayName, bio, avatarPath, user.id);
      const updatedUser = normalizeUser(statements.findUserById.get(user.id));
      return sendJson(res, 200, {
        user: {
          ...updatedUser,
          stats: buildProfileStats(user.id),
        },
      });
    }

    if (pathname.startsWith("/api/profiles/") && req.method === "GET") {
      const viewer = requireUser(req, res);
      if (!viewer) return;
      const username = decodeURIComponent(pathname.slice("/api/profiles/".length)).trim().toLowerCase();
      const profileRow = statements.findUserByUsername.get(username);
      if (!profileRow) {
        return sendJson(res, 404, { error: "Profil nicht gefunden." });
      }
      return sendJson(res, 200, {
        profile: {
          ...normalizeUser(profileRow),
          stats: buildProfileStats(profileRow.id),
          isFollowing: Boolean(statements.isFollowing.get(viewer.id, profileRow.id)),
          isCurrentUser: viewer.id === profileRow.id,
        },
        sharedOutfits: statements.listSharedOutfitsByUserId.all(profileRow.id).map((row) => buildSharedPost(row, viewer.id)),
      });
    }

    if (pathname === "/api/wardrobe" && req.method === "POST") {
      const user = requireUser(req, res);
      if (!user) return;
      const body = await readBody(req);
      const storedImage = await saveDataUrlImage(String(body.image || ""), "clothes");
      const now = new Date().toISOString();
      statements.insertWardrobe.run(
        user.id,
        String(body.name || "").trim(),
        String(body.category || "").trim(),
        String(body.color || "").trim(),
        JSON.stringify(body.seasons || []),
        String(body.temperature || "all"),
        JSON.stringify(body.occasions || []),
        JSON.stringify(body.styles || []),
        storedImage,
        now
      );
      const latestItem = statements.listWardrobe.all(user.id).map(normalizeWardrobeItem)[0];
      return sendJson(res, 201, latestItem);
    }

    if (pathname.startsWith("/api/wardrobe/") && req.method === "DELETE") {
      const user = requireUser(req, res);
      if (!user) return;
      const numericId = parseId(pathname.split("/").pop(), "clothing-");
      if (!numericId) {
        return sendJson(res, 400, { error: "Ungueltige ID." });
      }
      const row = statements.findWardrobeById.get(numericId, user.id);
      if (row) {
        await removeStoredImage(row.image);
      }
      statements.deleteWardrobe.run(numericId, user.id);
      return sendJson(res, 200, { ok: true });
    }

    if (pathname === "/api/outfits" && req.method === "POST") {
      const user = requireUser(req, res);
      if (!user) return;
      const body = await readBody(req);
      const numericItemIds = (body.itemIds || []).map((id) => parseId(id, "clothing-")).filter(Boolean);
      const now = new Date().toISOString();
      statements.insertOutfit.run(
        user.id,
        String(body.name || "").trim(),
        String(body.caption || "").trim(),
        String(body.occasion || "Alltag"),
        JSON.stringify(numericItemIds),
        body.weatherSnapshot?.temperature ?? null,
        body.weatherSnapshot?.weatherLabel ?? null,
        now
      );
      const latestOutfit = statements.listOutfits.all(user.id).map((row) => normalizeOutfit(row, user.id))[0];
      return sendJson(res, 201, latestOutfit);
    }

    if (pathname.startsWith("/api/outfits/") && req.method === "DELETE") {
      const user = requireUser(req, res);
      if (!user) return;
      const numericId = parseId(pathname.split("/").pop(), "outfit-");
      if (!numericId) {
        return sendJson(res, 400, { error: "Ungueltige ID." });
      }
      statements.deleteOutfit.run(numericId, user.id);
      return sendJson(res, 200, { ok: true });
    }

    if (pathname === "/api/shared-outfits" && req.method === "POST") {
      const user = requireUser(req, res);
      if (!user) return;
      const body = await readBody(req);
      const numericOutfitId = parseId(body.outfitId, "outfit-");
      if (!numericOutfitId) {
        return sendJson(res, 400, { error: "Ungueltiges Outfit." });
      }
      const outfit = statements.getOutfitById.get(numericOutfitId, user.id);
      if (!outfit) {
        return sendJson(res, 404, { error: "Outfit nicht gefunden." });
      }
      if (statements.findSharedByOutfitAndUser.get(numericOutfitId, user.id)) {
        return sendJson(res, 409, { error: "Dieses Outfit wurde bereits geteilt." });
      }
      statements.insertSharedOutfit.run(numericOutfitId, user.id, String(body.caption || outfit.caption || "").trim(), new Date().toISOString());
      return sendJson(res, 201, { ok: true });
    }

    if (pathname.match(/^\/api\/shared-outfits\/shared-\d+\/like$/) && req.method === "POST") {
      const user = requireUser(req, res);
      if (!user) return;
      const numericId = parseId(pathname.split("/")[3], "shared-");
      if (!numericId) {
        return sendJson(res, 400, { error: "Ungueltige ID." });
      }
      if (statements.hasLike.get(user.id, numericId)) {
        statements.removeLike.run(user.id, numericId);
      } else {
        statements.addLike.run(user.id, numericId, new Date().toISOString());
      }
      return sendJson(res, 200, { ok: true });
    }

    if (pathname.match(/^\/api\/shared-outfits\/shared-\d+\/comments$/) && req.method === "POST") {
      const user = requireUser(req, res);
      if (!user) return;
      const numericId = parseId(pathname.split("/")[3], "shared-");
      const body = await readBody(req);
      const text = String(body.text || "").trim();
      if (!numericId || !text) {
        return sendJson(res, 400, { error: "Kommentar fehlt." });
      }
      statements.addComment.run(user.id, numericId, text, new Date().toISOString());
      return sendJson(res, 201, { ok: true });
    }

    if (pathname === "/api/follows" && req.method === "POST") {
      const user = requireUser(req, res);
      if (!user) return;
      const body = await readBody(req);
      const targetUserId = Number(body.targetUserId);
      if (!Number.isInteger(targetUserId) || targetUserId === user.id) {
        return sendJson(res, 400, { error: "Ungueltiger Follow-Zielnutzer." });
      }
      if (statements.isFollowing.get(user.id, targetUserId)) {
        statements.removeFollow.run(user.id, targetUserId);
      } else {
        statements.addFollow.run(user.id, targetUserId, new Date().toISOString());
      }
      return sendJson(res, 200, { ok: true });
    }

    if (pathname === "/api/weather" && req.method === "GET") {
      const user = requireUser(req, res);
      if (!user) return;
      const lat = searchParams.get("lat");
      const lon = searchParams.get("lon");
      if (!lat || !lon) {
        return sendJson(res, 400, { error: "lat und lon sind erforderlich." });
      }

      const weatherUrl = new URL("https://api.open-meteo.com/v1/forecast");
      weatherUrl.searchParams.set("latitude", lat);
      weatherUrl.searchParams.set("longitude", lon);
      weatherUrl.searchParams.set("current", "temperature_2m,apparent_temperature,weather_code,is_day,wind_speed_10m");
      weatherUrl.searchParams.set("daily", "temperature_2m_max,temperature_2m_min,precipitation_probability_max");
      weatherUrl.searchParams.set("timezone", "auto");

      const weatherResponse = await fetch(weatherUrl);
      if (!weatherResponse.ok) {
        return sendJson(res, 502, { error: "Weather service unavailable" });
      }
      return sendJson(res, 200, await weatherResponse.json());
    }

    if (pathname === "/" || pathname.endsWith(".html") || pathname.endsWith(".css") || pathname.endsWith(".js") || pathname.endsWith(".svg") || pathname.endsWith(".webmanifest")) {
      return servePublicFile(res, pathname);
    }

    if (pathname.startsWith("/uploads/")) {
      return serveUploadFile(res, pathname);
    }

    return sendText(res, 404, "Not found");
  } catch (error) {
    console.error(error);
    return sendJson(res, 500, {
      error: "Unexpected server error",
      details: String(error.message || error),
    });
  }
});

if (process.env.NO_LISTEN !== "1") {
  server.listen(port, host, () => {
    console.log(`Kleiderschrank app listening on http://localhost:${port}`);
    console.log(`Datenverzeichnis: ${dataDir}`);
    if (publicBaseUrl) {
      console.log(`Oeffentliche URL: ${publicBaseUrl}`);
    }
    const localUrls = getLocalUrls();
    if (localUrls.length) {
      console.log(`Im selben WLAN erreichbar unter: ${localUrls.join(", ")}`);
    }
  });
}
