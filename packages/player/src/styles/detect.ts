/**
 * Detect whether the host application provides shadcn CSS custom properties.
 *
 * This is informational — the CSS fallback mechanism in `cormTheme` handles
 * both cases automatically. The detector is useful for logging / debugging.
 */
export function detectHostTheme(): "shadcn" | "standalone" {
  const root = document.documentElement;
  const style = getComputedStyle(root);
  // Check if --primary is defined by host
  const primary = style.getPropertyValue("--primary").trim();
  return primary ? "shadcn" : "standalone";
}
