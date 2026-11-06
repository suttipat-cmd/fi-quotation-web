import { useEffect, useState } from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { App } from "@capacitor/app";
import { parseAndroidUpdate, UPDATE_MANIFEST_URL, type AndroidUpdate } from "./android-update";

const AndroidUpdateBrowser = registerPlugin<{ open(options: { url: string }): Promise<void> }>("AndroidUpdateBrowser");

export function AndroidUpdateNotice() {
  const [update, setUpdate] = useState<AndroidUpdate | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (Capacitor.getPlatform() !== "android") return;
    let cancelled = false;
    let checking = false;
    let lastCheck = 0;
    const check = async () => {
      if (checking || Date.now() - lastCheck < 15 * 60_000) return;
      checking = true;
      try {
        const info = await App.getInfo();
        const response = await fetch(`${UPDATE_MANIFEST_URL}?t=${Date.now()}`, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
        if (!response.ok) return;
        const found = parseAndroidUpdate(await response.json(), Number(info.build));
        lastCheck = Date.now();
        if (!cancelled) setUpdate(found);
      } catch { /* Update checks must never block normal use. */ }
      finally { checking = false; }
    };
    void check();
    const listener = App.addListener("appStateChange", ({ isActive }) => { if (isActive) void check(); });
    return () => { cancelled = true; void listener.then((handle) => handle.remove()); };
  }, []);
  if (!update || dismissed) return null;
  return <aside className="android-update-notice" role="status" aria-live="polite">
    <div><strong>มีแอปเวอร์ชันใหม่ {update.versionName}</strong><p>{update.notes || "ดาวน์โหลดและติดตั้งเพื่ออัปเดตแอป"}</p>{error && <p>เปิดหน้าดาวน์โหลดไม่สำเร็จ กรุณาลองใหม่อีกครั้ง</p>}</div>
    <div className="android-update-actions"><button type="button" onClick={() => setDismissed(true)}>ไว้ภายหลัง</button><button type="button" className="primary" onClick={() => { setError(false); void AndroidUpdateBrowser.open({ url: update.downloadUrl }).catch(() => setError(true)); }}>ดาวน์โหลด APK</button></div>
  </aside>;
}
