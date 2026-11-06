export const UPDATE_MANIFEST_URL = "https://suttipat-cmd.github.io/fi-quotation-web/android-update.json";
const DOWNLOAD_ORIGIN = "https://suttipat-cmd.github.io";
const DOWNLOAD_PATH = "/fi-quotation-web/android/";

export type AndroidUpdate = { versionCode: number; versionName: string; downloadUrl: string; notes: string };

export function parseAndroidUpdate(value: unknown, installedCode: number): AndroidUpdate | null {
  if (!value || typeof value !== "object" || !Number.isSafeInteger(installedCode) || installedCode < 1) return null;
  const data = value as Record<string, unknown>;
  if (data.enabled !== true || data.schemaVersion !== 1 || !Number.isSafeInteger(data.versionCode) || (data.versionCode as number) <= installedCode || typeof data.versionName !== "string" || !data.versionName.trim() || data.versionName.length > 40 || typeof data.downloadUrl !== "string") return null;
  try {
    const url = new URL(data.downloadUrl);
    if (url.origin !== DOWNLOAD_ORIGIN || !url.pathname.startsWith(DOWNLOAD_PATH) || !url.pathname.endsWith(".apk") || url.username || url.password || url.search || url.hash) return null;
    return { versionCode: data.versionCode as number, versionName: data.versionName, downloadUrl: url.href, notes: typeof data.notes === "string" ? data.notes.slice(0, 300) : "" };
  } catch { return null; }
}
