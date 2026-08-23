import { pixelAsset } from "./PixelIcon";

export function Spinner() {
  return (
    <i
      className="spinner"
      aria-label="กำลังดำเนินการ"
      style={{ backgroundImage: `url(${pixelAsset("illustrations/loading/loading-spinner-spritesheet@2x.png")})` }}
    />
  );
}
