import { randomBytes, randomUUID } from "crypto";
import { db } from "@vercel/postgres";

export type AssetType = "VIDEO" | "PDF" | "ZIP";

export interface VaultAsset {
  id: string;
  packageId: string;
  externalAssetId: string | null;
  title: string;
  type: AssetType;
  googleDriveFileId: string;
  mimeType: string | null;
  sizeBytes: number | null;
  createdAt: string;
}

export interface VaultPackage {
  id: string;
  vaultId: string;
  externalRequestId: string | null;
  title: string;
  classCode: string | null;
  classDate: string | null;
  classPrice: number | null;
  createdAt: string;
  assets: VaultAsset[];
}

export interface VaultView {
  userId: string;
  email: string;
  vaultId: string;
  slug: string;
  packages: VaultPackage[];
}

export interface CatalogVideoEntry {
  id: string;
  videoId: string;
  classCode: string;
  classTitle: string;
  classDate: string | null;
  classPrice: number | null;
  googleDriveFileId: string;
  mimeType: string | null;
  materials: Array<{
    assetId: string;
    title: string;
    kind: "PDF" | "ZIP";
    googleDriveFileId: string;
    mimeType: string | null;
    sizeBytes: number | null;
  }>;
  createdAt: string;
  updatedAt: string;
}

interface SessionRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string | number;
  created_at: string | number;
  last_seen_at: string | number;
}

interface AdminSessionRow {
  id: string;
  admin_email: string;
  token_hash: string;
  expires_at: string | number;
  created_at: string | number;
  last_seen_at: string | number;
}

let initPromise: Promise<void> | null = null;

async function initDb(): Promise<void> {
  if (!initPromise) {
    initPromise = db
      .query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS vaults (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE,
        slug TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        CONSTRAINT fk_vaults_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS vault_packages (
        id TEXT PRIMARY KEY,
        vault_id TEXT NOT NULL,
        external_request_id TEXT UNIQUE,
        title TEXT NOT NULL,
        class_code TEXT,
        class_date TEXT,
        class_price DOUBLE PRECISION,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        CONSTRAINT fk_vault_packages_vault FOREIGN KEY (vault_id) REFERENCES vaults(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS vault_assets (
        id TEXT PRIMARY KEY,
        package_id TEXT NOT NULL,
        external_asset_id TEXT,
        title TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('VIDEO', 'PDF', 'ZIP')),
        google_drive_file_id TEXT NOT NULL,
        mime_type TEXT,
        size_bytes BIGINT,
        created_at TEXT NOT NULL,
        CONSTRAINT fk_vault_assets_package FOREIGN KEY (package_id) REFERENCES vault_packages(id) ON DELETE CASCADE,
        CONSTRAINT uq_vault_assets_pkg_drive UNIQUE (package_id, google_drive_file_id),
        CONSTRAINT uq_vault_assets_pkg_external UNIQUE (package_id, external_asset_id)
      );
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at BIGINT NOT NULL,
        created_at BIGINT NOT NULL,
        last_seen_at BIGINT NOT NULL,
        CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS login_codes (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        code_hash TEXT NOT NULL,
        expires_at BIGINT NOT NULL,
        consumed_at BIGINT,
        created_at BIGINT NOT NULL,
        CONSTRAINT fk_login_codes_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS admin_sessions (
        id TEXT PRIMARY KEY,
        admin_email TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at BIGINT NOT NULL,
        created_at BIGINT NOT NULL,
        last_seen_at BIGINT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS video_catalog (
        id TEXT PRIMARY KEY,
        video_id TEXT NOT NULL UNIQUE,
        class_code TEXT NOT NULL,
        class_title TEXT NOT NULL,
        class_date TEXT,
        class_price DOUBLE PRECISION,
        google_drive_file_id TEXT NOT NULL,
        mime_type TEXT,
        materials_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
      CREATE INDEX IF NOT EXISTS idx_login_codes_user_id_expires_at ON login_codes(user_id, expires_at);
      CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires_at ON admin_sessions(expires_at);
      CREATE INDEX IF NOT EXISTS idx_video_catalog_video_id ON video_catalog(video_id);
    `)
      .then(() => undefined);
  }
  await initPromise;
}

function nowIso(): string {
  return new Date().toISOString();
}

function nowMs(): number {
  return Date.now();
}

function newId(): string {
  return randomUUID();
}

function newSlug(): string {
  return randomBytes(12).toString("hex");
}

function toNumber(value: unknown): number | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function pruneExpiredAuthRows(): Promise<void> {
  await initDb();
  const now = nowMs();
  await db.query("DELETE FROM sessions WHERE expires_at <= $1", [now]);
  await db.query("DELETE FROM login_codes WHERE expires_at <= $1 OR consumed_at IS NOT NULL", [now]);
  await db.query("DELETE FROM admin_sessions WHERE expires_at <= $1", [now]);
}

export async function findUserByEmail(email: string): Promise<{ id: string; email: string } | null> {
  await initDb();
  const result = await db.query<{ id: string; email: string }>("SELECT id, email FROM users WHERE email = $1", [
    normalizeEmail(email),
  ]);
  return result.rows[0] ?? null;
}

export async function upsertUserAndVault(email: string): Promise<{ userId: string; email: string; vaultId: string; slug: string }> {
  await initDb();
  const normalized = normalizeEmail(email);
  const existing = await db.query<{ userid: string; email: string; vaultid: string; slug: string }>(
    `SELECT u.id as userId, u.email as email, v.id as vaultId, v.slug as slug
     FROM users u
     JOIN vaults v ON v.user_id = u.id
     WHERE u.email = $1`,
    [normalized],
  );

  if (existing.rows[0]) {
    return {
      userId: existing.rows[0].userid,
      email: existing.rows[0].email,
      vaultId: existing.rows[0].vaultid,
      slug: existing.rows[0].slug,
    };
  }

  const userId = newId();
  const vaultId = newId();
  const createdAt = nowIso();
  const slug = newSlug();
  await db.query("INSERT INTO users (id, email, created_at, updated_at) VALUES ($1, $2, $3, $4)", [
    userId,
    normalized,
    createdAt,
    createdAt,
  ]);
  await db.query("INSERT INTO vaults (id, user_id, slug, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)", [
    vaultId,
    userId,
    slug,
    createdAt,
    createdAt,
  ]);

  return { userId, email: normalized, vaultId, slug };
}

export interface IngestAssetInput {
  externalAssetId?: string;
  title: string;
  type: AssetType;
  googleDriveFileId: string;
  mimeType?: string;
  sizeBytes?: number;
}

export interface IngestPayload {
  email: string;
  requestId?: string;
  packageTitle: string;
  classCode?: string;
  classDate?: string;
  classPrice?: number;
  assets: IngestAssetInput[];
}

export async function ingestPackage(payload: IngestPayload) {
  await initDb();
  const owner = await upsertUserAndVault(payload.email);
  const now = nowIso();

  let packageId = newId();
  if (payload.requestId) {
    const existing = await db.query<{ id: string }>(
      "SELECT id FROM vault_packages WHERE vault_id = $1 AND external_request_id = $2",
      [owner.vaultId, payload.requestId],
    );
    if (existing.rows[0]) packageId = existing.rows[0].id;
  }

  const hasPackage = await db.query<{ id: string }>("SELECT id FROM vault_packages WHERE id = $1", [packageId]);
  if (hasPackage.rows[0]) {
    await db.query(
      "UPDATE vault_packages SET title = $1, class_code = $2, class_date = $3, class_price = $4, updated_at = $5 WHERE id = $6",
      [payload.packageTitle, payload.classCode ?? null, payload.classDate ?? null, payload.classPrice ?? null, now, packageId],
    );
  } else {
    await db.query(
      `INSERT INTO vault_packages
       (id, vault_id, external_request_id, title, class_code, class_date, class_price, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        packageId,
        owner.vaultId,
        payload.requestId ?? null,
        payload.packageTitle,
        payload.classCode ?? null,
        payload.classDate ?? null,
        payload.classPrice ?? null,
        now,
        now,
      ],
    );
  }

  for (const asset of payload.assets) {
    const existing = await db.query<{ id: string }>(
      `SELECT id FROM vault_assets
       WHERE package_id = $1
         AND (google_drive_file_id = $2 OR ($3 IS NOT NULL AND external_asset_id = $4))
       LIMIT 1`,
      [packageId, asset.googleDriveFileId, asset.externalAssetId ?? null, asset.externalAssetId ?? null],
    );

    if (existing.rows[0]) {
      await db.query(
        `UPDATE vault_assets
         SET title = $1, type = $2, mime_type = $3, size_bytes = $4, external_asset_id = $5
         WHERE id = $6`,
        [
          asset.title,
          asset.type,
          asset.mimeType ?? null,
          asset.sizeBytes ?? null,
          asset.externalAssetId ?? null,
          existing.rows[0].id,
        ],
      );
    } else {
      await db.query(
        `INSERT INTO vault_assets
         (id, package_id, external_asset_id, title, type, google_drive_file_id, mime_type, size_bytes, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          newId(),
          packageId,
          asset.externalAssetId ?? null,
          asset.title,
          asset.type,
          asset.googleDriveFileId,
          asset.mimeType ?? null,
          asset.sizeBytes ?? null,
          now,
        ],
      );
    }
  }

  return { owner, packageId, totalAssets: payload.assets.length };
}

async function buildVaultView(owner: { userId: string; email: string; vaultId: string; slug: string }): Promise<VaultView> {
  const pkgRows = await db.query<{
    id: string;
    vaultid: string;
    externalrequestid: string | null;
    title: string;
    classcode: string | null;
    classdate: string | null;
    classprice: string | number | null;
    createdat: string;
  }>(
    `SELECT id, vault_id as vaultId, external_request_id as externalRequestId, title,
            class_code as classCode, class_date as classDate, class_price as classPrice, created_at as createdAt
     FROM vault_packages
     WHERE vault_id = $1
     ORDER BY created_at DESC`,
    [owner.vaultId],
  );

  const packages: VaultPackage[] = [];
  for (const pkg of pkgRows.rows) {
    const assetRows = await db.query<{
      id: string;
      packageid: string;
      externalassetid: string | null;
      title: string;
      type: AssetType;
      googledrivefileid: string;
      mimetype: string | null;
      sizebytes: string | number | null;
      createdat: string;
    }>(
      `SELECT id, package_id as packageId, external_asset_id as externalAssetId, title, type,
              google_drive_file_id as googleDriveFileId, mime_type as mimeType, size_bytes as sizeBytes,
              created_at as createdAt
       FROM vault_assets
       WHERE package_id = $1
       ORDER BY created_at DESC`,
      [pkg.id],
    );

    packages.push({
      id: pkg.id,
      vaultId: pkg.vaultid,
      externalRequestId: pkg.externalrequestid,
      title: pkg.title,
      classCode: pkg.classcode,
      classDate: pkg.classdate,
      classPrice: toNumber(pkg.classprice),
      createdAt: pkg.createdat,
      assets: assetRows.rows.map((asset) => ({
        id: asset.id,
        packageId: asset.packageid,
        externalAssetId: asset.externalassetid,
        title: asset.title,
        type: asset.type,
        googleDriveFileId: asset.googledrivefileid,
        mimeType: asset.mimetype,
        sizeBytes: toNumber(asset.sizebytes),
        createdAt: asset.createdat,
      })),
    });
  }

  return { ...owner, packages };
}

export async function getVaultByUserId(userId: string): Promise<VaultView | null> {
  await initDb();
  const owner = await db.query<{ userid: string; email: string; vaultid: string; slug: string }>(
    `SELECT u.id as userId, u.email as email, v.id as vaultId, v.slug as slug
     FROM users u
     JOIN vaults v ON v.user_id = u.id
     WHERE u.id = $1`,
    [userId],
  );
  if (!owner.rows[0]) return null;
  return buildVaultView({
    userId: owner.rows[0].userid,
    email: owner.rows[0].email,
    vaultId: owner.rows[0].vaultid,
    slug: owner.rows[0].slug,
  });
}

export async function getVaultByEmail(email: string): Promise<VaultView | null> {
  await initDb();
  const owner = await db.query<{ userid: string; email: string; vaultid: string; slug: string }>(
    `SELECT u.id as userId, u.email as email, v.id as vaultId, v.slug as slug
     FROM users u
     JOIN vaults v ON v.user_id = u.id
     WHERE u.email = $1`,
    [normalizeEmail(email)],
  );
  if (!owner.rows[0]) return null;
  return buildVaultView({
    userId: owner.rows[0].userid,
    email: owner.rows[0].email,
    vaultId: owner.rows[0].vaultid,
    slug: owner.rows[0].slug,
  });
}

export async function createLoginCode(userId: string, codeHash: string, expiresAtMs: number): Promise<void> {
  await initDb();
  const now = nowMs();
  await db.query(
    "INSERT INTO login_codes (id, user_id, code_hash, expires_at, consumed_at, created_at) VALUES ($1, $2, $3, $4, NULL, $5)",
    [newId(), userId, codeHash, expiresAtMs, now],
  );
}

export async function listActiveLoginCodes(userId: string): Promise<Array<{ id: string; created_at: number }>> {
  await initDb();
  const rows = await db.query<{ id: string; created_at: string | number }>(
    "SELECT id, created_at FROM login_codes WHERE user_id = $1 AND consumed_at IS NULL AND expires_at > $2 ORDER BY created_at DESC",
    [userId, nowMs()],
  );
  return rows.rows.map((row) => ({ id: row.id, created_at: Number(row.created_at) }));
}

export async function consumeLoginCode(userId: string, codeHash: string): Promise<boolean> {
  await initDb();
  const now = nowMs();
  const row = await db.query<{ id: string }>(
    `SELECT id FROM login_codes
     WHERE user_id = $1 AND code_hash = $2 AND consumed_at IS NULL AND expires_at > $3
     ORDER BY created_at DESC LIMIT 1`,
    [userId, codeHash, now],
  );
  if (!row.rows[0]) return false;
  await db.query("UPDATE login_codes SET consumed_at = $1 WHERE id = $2", [now, row.rows[0].id]);
  return true;
}

export async function createSession(userId: string, tokenHash: string, expiresAtMs: number): Promise<void> {
  await initDb();
  const now = nowMs();
  await db.query(
    "INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at, last_seen_at) VALUES ($1, $2, $3, $4, $5, $6)",
    [newId(), userId, tokenHash, expiresAtMs, now, now],
  );
}

export async function getSessionByTokenHash(tokenHash: string): Promise<SessionRow | null> {
  await initDb();
  const row = await db.query<SessionRow>(
    "SELECT id, user_id, token_hash, expires_at, created_at, last_seen_at FROM sessions WHERE token_hash = $1",
    [tokenHash],
  );
  return row.rows[0] ?? null;
}

export async function touchSession(sessionId: string): Promise<void> {
  await initDb();
  await db.query("UPDATE sessions SET last_seen_at = $1 WHERE id = $2", [nowMs(), sessionId]);
}

export async function deleteSessionByTokenHash(tokenHash: string): Promise<void> {
  await initDb();
  await db.query("DELETE FROM sessions WHERE token_hash = $1", [tokenHash]);
}

export async function createAdminSession(adminEmail: string, tokenHash: string, expiresAtMs: number): Promise<void> {
  await initDb();
  const now = nowMs();
  await db.query(
    "INSERT INTO admin_sessions (id, admin_email, token_hash, expires_at, created_at, last_seen_at) VALUES ($1, $2, $3, $4, $5, $6)",
    [newId(), adminEmail, tokenHash, expiresAtMs, now, now],
  );
}

export async function getAdminSessionByTokenHash(tokenHash: string): Promise<AdminSessionRow | null> {
  await initDb();
  const row = await db.query<AdminSessionRow>(
    "SELECT id, admin_email, token_hash, expires_at, created_at, last_seen_at FROM admin_sessions WHERE token_hash = $1",
    [tokenHash],
  );
  return row.rows[0] ?? null;
}

export async function touchAdminSession(sessionId: string): Promise<void> {
  await initDb();
  await db.query("UPDATE admin_sessions SET last_seen_at = $1 WHERE id = $2", [nowMs(), sessionId]);
}

export async function deleteAdminSessionByTokenHash(tokenHash: string): Promise<void> {
  await initDb();
  await db.query("DELETE FROM admin_sessions WHERE token_hash = $1", [tokenHash]);
}

export interface UpsertCatalogVideoInput {
  videoId: string;
  classCode: string;
  classTitle: string;
  classDate?: string;
  classPrice?: number;
  googleDriveFileId: string;
  mimeType?: string;
  materials: Array<{
    assetId?: string;
    title: string;
    kind: "PDF" | "ZIP";
    googleDriveFileId: string;
    mimeType?: string;
    sizeBytes?: number;
  }>;
}

function mapCatalogRow(row: {
  id: string;
  videoid: string;
  classcode: string;
  classtitle: string;
  classdate: string | null;
  classprice: string | number | null;
  googledrivefileid: string;
  mimetype: string | null;
  materialsjson: string;
  createdat: string;
  updatedat: string;
}): CatalogVideoEntry {
  const parsed = JSON.parse(row.materialsjson) as CatalogVideoEntry["materials"];
  return {
    id: row.id,
    videoId: row.videoid,
    classCode: row.classcode,
    classTitle: row.classtitle,
    classDate: row.classdate,
    classPrice: toNumber(row.classprice),
    googleDriveFileId: row.googledrivefileid,
    mimeType: row.mimetype,
    materials: Array.isArray(parsed) ? parsed : [],
    createdAt: row.createdat,
    updatedAt: row.updatedat,
  };
}

export async function upsertCatalogVideoEntry(input: UpsertCatalogVideoInput): Promise<CatalogVideoEntry> {
  await initDb();
  const now = nowIso();
  const normalizedVideoId = input.videoId.trim();
  const materials = input.materials.map((material, index) => ({
    assetId: material.assetId?.trim() || `${normalizedVideoId}:mat:${index + 1}`,
    title: material.title,
    kind: material.kind,
    googleDriveFileId: material.googleDriveFileId,
    mimeType: material.mimeType ?? null,
    sizeBytes: material.sizeBytes ?? null,
  }));

  await db.query(
    `INSERT INTO video_catalog
     (id, video_id, class_code, class_title, class_date, class_price, google_drive_file_id, mime_type, materials_json, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (video_id) DO UPDATE SET
       class_code = EXCLUDED.class_code,
       class_title = EXCLUDED.class_title,
       class_date = EXCLUDED.class_date,
       class_price = EXCLUDED.class_price,
       google_drive_file_id = EXCLUDED.google_drive_file_id,
       mime_type = EXCLUDED.mime_type,
       materials_json = EXCLUDED.materials_json,
       updated_at = EXCLUDED.updated_at`,
    [
      newId(),
      normalizedVideoId,
      input.classCode,
      input.classTitle,
      input.classDate ?? null,
      input.classPrice ?? null,
      input.googleDriveFileId,
      input.mimeType ?? null,
      JSON.stringify(materials),
      now,
      now,
    ],
  );

  const row = await db.query<{
    id: string;
    videoid: string;
    classcode: string;
    classtitle: string;
    classdate: string | null;
    classprice: string | number | null;
    googledrivefileid: string;
    mimetype: string | null;
    materialsjson: string;
    createdat: string;
    updatedat: string;
  }>(
    `SELECT id, video_id as videoId, class_code as classCode, class_title as classTitle, class_date as classDate,
            class_price as classPrice, google_drive_file_id as googleDriveFileId, mime_type as mimeType,
            materials_json as materialsJson, created_at as createdAt, updated_at as updatedAt
     FROM video_catalog WHERE video_id = $1`,
    [normalizedVideoId],
  );

  if (!row.rows[0]) throw new Error("Catalog entry retrieval failed after upsert.");
  return mapCatalogRow(row.rows[0]);
}

export async function listCatalogVideoEntries(limit = 50): Promise<CatalogVideoEntry[]> {
  await initDb();
  const rows = await db.query<{
    id: string;
    videoid: string;
    classcode: string;
    classtitle: string;
    classdate: string | null;
    classprice: string | number | null;
    googledrivefileid: string;
    mimetype: string | null;
    materialsjson: string;
    createdat: string;
    updatedat: string;
  }>(
    `SELECT id, video_id as videoId, class_code as classCode, class_title as classTitle, class_date as classDate,
            class_price as classPrice, google_drive_file_id as googleDriveFileId, mime_type as mimeType,
            materials_json as materialsJson, created_at as createdAt, updated_at as updatedAt
     FROM video_catalog ORDER BY updated_at DESC LIMIT $1`,
    [limit],
  );
  return rows.rows.map(mapCatalogRow);
}

export async function findCatalogVideosByIds(videoIds: string[]): Promise<CatalogVideoEntry[]> {
  await initDb();
  if (videoIds.length === 0) return [];
  const placeholders = videoIds.map((_, i) => `$${i + 1}`).join(", ");
  const rows = await db.query<{
    id: string;
    videoid: string;
    classcode: string;
    classtitle: string;
    classdate: string | null;
    classprice: string | number | null;
    googledrivefileid: string;
    mimetype: string | null;
    materialsjson: string;
    createdat: string;
    updatedat: string;
  }>(
    `SELECT id, video_id as videoId, class_code as classCode, class_title as classTitle, class_date as classDate,
            class_price as classPrice, google_drive_file_id as googleDriveFileId, mime_type as mimeType,
            materials_json as materialsJson, created_at as createdAt, updated_at as updatedAt
     FROM video_catalog WHERE video_id IN (${placeholders})`,
    videoIds,
  );
  return rows.rows.map(mapCatalogRow);
}

export async function assignCatalogVideosToEmail(params: { email: string; requestId?: string; videoIds: string[] }) {
  const requested = Array.from(new Set(params.videoIds.map((id) => id.trim()).filter(Boolean)));
  const entries = await findCatalogVideosByIds(requested);
  const found = new Set(entries.map((e) => e.videoId));
  const missingVideoIds = requested.filter((id) => !found.has(id));
  if (missingVideoIds.length > 0) return { success: false as const, missingVideoIds };

  const owner = await upsertUserAndVault(params.email);
  const entryMap = new Map(entries.map((entry) => [entry.videoId, entry]));
  const packages = [];
  for (const videoId of requested) {
    const entry = entryMap.get(videoId);
    if (!entry) continue;
    const requestId = `${params.requestId ?? "catalog"}:${owner.email}:${entry.videoId}`;
    const result = await ingestPackage({
      email: owner.email,
      requestId,
      packageTitle: `${entry.classCode} - ${entry.classTitle}`,
      classCode: entry.classCode,
      classDate: entry.classDate ?? undefined,
      classPrice: entry.classPrice ?? undefined,
      assets: [
        {
          externalAssetId: `${entry.videoId}:video`,
          title: entry.classTitle,
          type: "VIDEO",
          googleDriveFileId: entry.googleDriveFileId,
          mimeType: entry.mimeType ?? "video/mp4",
        },
        ...entry.materials.map((material) => ({
          externalAssetId: material.assetId,
          title: material.title,
          type: material.kind,
          googleDriveFileId: material.googleDriveFileId,
          mimeType: material.mimeType ?? undefined,
          sizeBytes: material.sizeBytes ?? undefined,
        })),
      ],
    });

    packages.push({
      videoId: entry.videoId,
      packageId: result.packageId,
      totalAssets: result.totalAssets,
      classCode: entry.classCode,
      classTitle: entry.classTitle,
    });
  }

  return { success: true as const, owner, packages };
}

export async function syncCatalogEntryToExistingPackages(videoId: string): Promise<{ updatedPackages: number; upsertedAssets: number }> {
  const entry = (await findCatalogVideosByIds([videoId]))[0];
  if (!entry) return { updatedPackages: 0, upsertedAssets: 0 };
  const pkgRows = await db.query<{ id: string }>("SELECT id FROM vault_packages WHERE external_request_id LIKE $1", [
    `%:${entry.videoId}`,
  ]);
  if (pkgRows.rows.length === 0) return { updatedPackages: 0, upsertedAssets: 0 };

  const now = nowIso();
  const assets: IngestAssetInput[] = [
    {
      externalAssetId: `${entry.videoId}:video`,
      title: entry.classTitle,
      type: "VIDEO",
      googleDriveFileId: entry.googleDriveFileId,
      mimeType: entry.mimeType ?? "video/mp4",
    },
    ...entry.materials.map((material) => ({
      externalAssetId: material.assetId,
      title: material.title,
      type: material.kind,
      googleDriveFileId: material.googleDriveFileId,
      mimeType: material.mimeType ?? undefined,
      sizeBytes: material.sizeBytes ?? undefined,
    })),
  ];

  let upsertedAssets = 0;
  for (const pkg of pkgRows.rows) {
    await db.query(
      "UPDATE vault_packages SET title = $1, class_code = $2, class_date = $3, class_price = $4, updated_at = $5 WHERE id = $6",
      [`${entry.classCode} - ${entry.classTitle}`, entry.classCode, entry.classDate ?? null, entry.classPrice ?? null, now, pkg.id],
    );
    for (const asset of assets) {
      const existing = await db.query<{ id: string }>(
        `SELECT id FROM vault_assets
         WHERE package_id = $1
         AND (google_drive_file_id = $2 OR ($3 IS NOT NULL AND external_asset_id = $4))
         LIMIT 1`,
        [pkg.id, asset.googleDriveFileId, asset.externalAssetId ?? null, asset.externalAssetId ?? null],
      );
      if (existing.rows[0]) {
        await db.query(
          `UPDATE vault_assets
           SET title = $1, type = $2, mime_type = $3, size_bytes = $4, external_asset_id = $5
           WHERE id = $6`,
          [
            asset.title,
            asset.type,
            asset.mimeType ?? null,
            asset.sizeBytes ?? null,
            asset.externalAssetId ?? null,
            existing.rows[0].id,
          ],
        );
      } else {
        await db.query(
          `INSERT INTO vault_assets
           (id, package_id, external_asset_id, title, type, google_drive_file_id, mime_type, size_bytes, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            newId(),
            pkg.id,
            asset.externalAssetId ?? null,
            asset.title,
            asset.type,
            asset.googleDriveFileId,
            asset.mimeType ?? null,
            asset.sizeBytes ?? null,
            now,
          ],
        );
      }
      upsertedAssets += 1;
    }
  }

  return { updatedPackages: pkgRows.rows.length, upsertedAssets };
}

export async function findAssetForUser(userId: string, assetId: string): Promise<VaultAsset | null> {
  await initDb();
  const row = await db.query<{
    id: string;
    packageid: string;
    externalassetid: string | null;
    title: string;
    type: AssetType;
    googledrivefileid: string;
    mimetype: string | null;
    sizebytes: string | number | null;
    createdat: string;
  }>(
    `SELECT a.id, a.package_id as packageId, a.external_asset_id as externalAssetId, a.title, a.type,
            a.google_drive_file_id as googleDriveFileId, a.mime_type as mimeType, a.size_bytes as sizeBytes,
            a.created_at as createdAt
     FROM vault_assets a
     JOIN vault_packages p ON p.id = a.package_id
     JOIN vaults v ON v.id = p.vault_id
     WHERE a.id = $1 AND v.user_id = $2`,
    [assetId, userId],
  );
  if (!row.rows[0]) return null;
  return {
    id: row.rows[0].id,
    packageId: row.rows[0].packageid,
    externalAssetId: row.rows[0].externalassetid,
    title: row.rows[0].title,
    type: row.rows[0].type,
    googleDriveFileId: row.rows[0].googledrivefileid,
    mimeType: row.rows[0].mimetype,
    sizeBytes: toNumber(row.rows[0].sizebytes),
    createdAt: row.rows[0].createdat,
  };
}

export async function getAppSetting(key: string): Promise<string | null> {
  await initDb();
  const row = await db.query<{ value: string }>("SELECT value FROM app_settings WHERE key = $1", [key]);
  return row.rows[0]?.value ?? null;
}

export async function upsertAppSetting(key: string, value: string): Promise<void> {
  await initDb();
  const now = nowIso();
  await db.query(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES ($1, $2, $3)
     ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
    [key, value, now],
  );
}

export async function upsertDriveConnection(params: { refreshToken: string; email?: string | null }): Promise<void> {
  await upsertAppSetting("drive_refresh_token", params.refreshToken);
  await upsertAppSetting("drive_connected_at", nowIso());
  if (params.email) await upsertAppSetting("drive_connected_email", params.email.trim().toLowerCase());
}

export async function getDriveConnectionInfo(): Promise<{
  hasStoredRefreshToken: boolean;
  connectedEmail: string | null;
  connectedAt: string | null;
}> {
  const refreshToken = await getAppSetting("drive_refresh_token");
  const connectedEmail = await getAppSetting("drive_connected_email");
  const connectedAt = await getAppSetting("drive_connected_at");
  return {
    hasStoredRefreshToken: Boolean(refreshToken),
    connectedEmail,
    connectedAt,
  };
}
