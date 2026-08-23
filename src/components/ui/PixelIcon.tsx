type PixelIconProps = {
  name: string;
  label?: string;
  className?: string;
};

/** Paths point at public assets so they keep the app's GitHub Pages base path. */
export const pixelAsset = (path: string) =>
  `${import.meta.env.BASE_URL}assets/pixel/${path}`;

export function PixelIcon({ name, label, className = "" }: PixelIconProps) {
  return (
    <img
      className={`pixel-icon ${className}`.trim()}
      src={pixelAsset(`icons/${name}.svg`)}
      alt={label || ""}
      aria-hidden={label ? undefined : true}
    />
  );
}
