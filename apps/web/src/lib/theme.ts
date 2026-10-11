import { useEffect, useSyncExternalStore } from "react";

export type ThemePref = "light" | "dark" | "system";
const KEY = "cartucho-theme";
const listeners = new Set<() => void>();

function readPref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

let pref = readPref();
const media = matchMedia("(prefers-color-scheme: dark)");

function apply() {
  const dark = pref === "dark" || (pref === "system" && media.matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document
    .querySelectorAll('meta[name="theme-color"]')
    .forEach((m) => m.setAttribute("content", dark ? "#0F0E15" : "#E9E8F0"));
}

media.addEventListener("change", () => {
  apply();
  listeners.forEach((l) => l());
});

export function setTheme(next: ThemePref) {
  pref = next;
  try {
    if (next === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, next);
  } catch {}
  apply();
  listeners.forEach((l) => l());
}

export function useTheme() {
  const value = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => pref,
  );
  useEffect(apply, []);
  const resolved = value === "system" ? (media.matches ? "dark" : "light") : value;
  return { pref: value, resolved, setTheme };
}
