const SVG_DATA_URL_PREFIX = 'data:image/svg+xml;utf8,';

const svgMarkup = (icon: string) => {
  const source = icon.startsWith(SVG_DATA_URL_PREFIX)
    ? icon.slice(SVG_DATA_URL_PREFIX.length)
    : icon;
  try {
    return decodeURIComponent(source);
  } catch {
    return source;
  }
};

export function SvgIcon({
  icon,
  className,
  decorative = true,
}: {
  icon: string;
  className?: string;
  decorative?: boolean;
}) {
  return (
    <span
      className={className ? `svg-icon ${className}` : 'svg-icon'}
      aria-hidden={decorative ? 'true' : undefined}
      role={decorative ? undefined : 'img'}
      dangerouslySetInnerHTML={{ __html: svgMarkup(icon) }}
    />
  );
}
