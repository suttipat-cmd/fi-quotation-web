import { describe, expect, it } from "vitest";
import { parseAndroidUpdate } from "./android-update";

const release = { schemaVersion: 1, enabled: true, versionCode: 3, versionName: "1.2", downloadUrl: "https://suttipat-cmd.github.io/fi-quotation-web/android/fi-quotation-1.2.apk", notes: "อัปเดต" };
describe("Android update manifest", () => {
  it("offers only a newer release from the trusted APK location", () => {
    expect(parseAndroidUpdate(release, 2)).toMatchObject({ versionCode: 3, versionName: "1.2", downloadUrl: release.downloadUrl });
    expect(parseAndroidUpdate(release, 3)).toBeNull();
    expect(parseAndroidUpdate(release, 4)).toBeNull();
  });
  it("rejects disabled, invalid and untrusted manifests", () => {
    for (const invalid of [
      { ...release, enabled: false }, { ...release, versionCode: "3" },
      { ...release, downloadUrl: "https://example.com/update.apk" },
      { ...release, downloadUrl: "http://suttipat-cmd.github.io/fi-quotation-web/android/a.apk" },
      { ...release, downloadUrl: "https://suttipat-cmd.github.io/fi-quotation-web/android/../fake.apk" },
      { ...release, downloadUrl: "https://suttipat-cmd.github.io/fi-quotation-web/android/a.html" },
    ]) expect(parseAndroidUpdate(invalid, 2)).toBeNull();
    expect(parseAndroidUpdate(release, NaN)).toBeNull();
  });
});
