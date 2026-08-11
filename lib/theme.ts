/**
 * Theme selection, shared between the inline no-flash script and the toggle.
 *
 * Three states, not two. "system" is the default and it is a real state
 * rather than a synonym for dark: a visitor who has their OS in light mode
 * gets the light theme without ever finding the toggle, and one who flips the
 * OS later gets followed. Storing an explicit "dark" only when someone
 * actually chooses it is what makes that possible.
 */

export const THEME_STORAGE_KEY = "gearavail-theme"

export type ThemeChoice = "light" | "dark" | "system"

export function isThemeChoice(value: unknown): value is ThemeChoice {
  return value === "light" || value === "dark" || value === "system"
}

/**
 * Runs before first paint, inlined into <head>.
 *
 * It has to be a string rather than an imported function because it must
 * execute synchronously ahead of hydration; anything React renders is already
 * too late and the page flashes the wrong theme for a frame. Kept minimal and
 * wrapped in try/catch because localStorage throws outright in some privacy
 * modes, and a theme preference is never worth a blank page.
 *
 * Only the light theme gets an attribute. Dark is the value of bare :root, so
 * the no-JS and storage-throws paths both land on it for free.
 */
export const THEME_INIT_SCRIPT = `
(function(){
  try {
    var stored = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    var light = stored === "light" ||
      (stored !== "dark" && window.matchMedia("(prefers-color-scheme: light)").matches);
    if (light) document.documentElement.setAttribute("data-theme", "light");
  } catch (e) {}
})();
`.trim()

/** Resolve a choice to the theme actually painted, for the toggle's own label. */
export function resolveTheme(choice: ThemeChoice): "light" | "dark" {
  if (choice !== "system") return choice
  if (typeof window === "undefined") return "dark"
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"
}

/** Write the choice to the DOM and to storage. The single place that mutates either. */
export function applyTheme(choice: ThemeChoice): void {
  if (typeof document === "undefined") return
  const resolved = resolveTheme(choice)
  if (resolved === "light") document.documentElement.setAttribute("data-theme", "light")
  else document.documentElement.removeAttribute("data-theme")

  try {
    if (choice === "system") localStorage.removeItem(THEME_STORAGE_KEY)
    else localStorage.setItem(THEME_STORAGE_KEY, choice)
  } catch {
    // Private browsing can refuse writes. The theme still applied above, it
    // just will not survive a reload, which is the right way to degrade.
  }
}

export function readStoredChoice(): ThemeChoice {
  if (typeof window === "undefined") return "system"
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    return isThemeChoice(stored) ? stored : "system"
  } catch {
    return "system"
  }
}
