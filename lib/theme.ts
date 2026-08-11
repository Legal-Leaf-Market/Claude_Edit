/**
 * Theme selection, shared between the inline no-flash script and the toggle.
 *
 * Three states, and DARK IS THE DEFAULT.
 *
 * That is a product decision rather than a technical one. This site's palette
 * is built for dark: cut-out product photography separates on graphite, and
 * the brass edge and LED green only carry against a dark plate. A visitor
 * whose laptop happens to be in light mode should still see the site the way
 * it was designed, so an absent preference means dark rather than "ask the
 * OS".
 *
 * "system" survives as a real state you can choose, for people who genuinely
 * want their machine to decide. It just is not what you get by default any
 * more, which means it now has to be STORED: absence means dark, so "system"
 * cannot be represented by clearing the key the way it used to be.
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
 * the no-JS path, the storage-throws path and the no-preference path all land
 * on the default for free, without this script having to run at all.
 */
export const THEME_INIT_SCRIPT = `
(function(){
  try {
    var stored = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    var light = stored === "light" ||
      (stored === "system" && window.matchMedia("(prefers-color-scheme: light)").matches);
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
    // Every choice is stored, "system" included. Clearing the key would now
    // mean dark rather than system, so the old removeItem shortcut would have
    // silently turned "follow my OS" into "dark".
    localStorage.setItem(THEME_STORAGE_KEY, choice)
  } catch {
    // Private browsing can refuse writes. The theme still applied above, it
    // just will not survive a reload, which is the right way to degrade.
  }
}

export function readStoredChoice(): ThemeChoice {
  if (typeof window === "undefined") return "dark"
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    return isThemeChoice(stored) ? stored : "dark"
  } catch {
    // Storage refused, so there is no preference to read. Same answer as no
    // preference at all: dark.
    return "dark"
  }
}
