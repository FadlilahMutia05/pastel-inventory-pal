import { useEffect } from "react";
import { useStoreSettings } from "./use-store-settings";

const THEME_CACHE_KEY = "app-theme-cache";

// Theme presets dengan HSL values
export const THEME_PRESETS = {
  pink: {
    name: "Pink Pastel",
    primary: "340 80% 70%",
    background: "30 50% 98%",
    preview: {
      primary: "hsl(340, 80%, 70%)",
      background: "hsl(30, 50%, 98%)",
    },
  },
  lavender: {
    name: "Lavender Dream",
    primary: "270 60% 70%",
    background: "270 50% 97%",
    preview: {
      primary: "hsl(270, 60%, 70%)",
      background: "hsl(270, 50%, 97%)",
    },
  },
  mint: {
    name: "Mint Fresh",
    primary: "165 60% 55%",
    background: "165 40% 97%",
    preview: {
      primary: "hsl(165, 60%, 55%)",
      background: "hsl(165, 40%, 97%)",
    },
  },
  peach: {
    name: "Peach Sunset",
    primary: "25 85% 65%",
    background: "30 60% 97%",
    preview: {
      primary: "hsl(25, 85%, 65%)",
      background: "hsl(30, 60%, 97%)",
    },
  },
  sky: {
    name: "Sky Blue",
    primary: "200 80% 60%",
    background: "200 50% 97%",
    preview: {
      primary: "hsl(200, 80%, 60%)",
      background: "hsl(200, 50%, 97%)",
    },
  },
  rose: {
    name: "Rose Garden",
    primary: "350 75% 60%",
    background: "350 40% 97%",
    preview: {
      primary: "hsl(350, 75%, 60%)",
      background: "hsl(350, 40%, 97%)",
    },
  },
  violet: {
    name: "Violet Night",
    primary: "280 70% 65%",
    background: "280 40% 97%",
    preview: {
      primary: "hsl(280, 70%, 65%)",
      background: "hsl(280, 40%, 97%)",
    },
  },
  coral: {
    name: "Coral Reef",
    primary: "15 80% 65%",
    background: "20 50% 97%",
    preview: {
      primary: "hsl(15, 80%, 65%)",
      background: "hsl(20, 50%, 97%)",
    },
  },
} as const;

export type ThemePreset = keyof typeof THEME_PRESETS;

function applyThemeColors(primary: string, background: string) {
  const root = document.documentElement;
  
  // Parse HSL values
  const [pH, pS, pL] = primary.split(" ").map(v => parseFloat(v));
  const [bH, bS, bL] = background.split(" ").map(v => parseFloat(v));
  
  // Apply primary color and related colors
  root.style.setProperty("--primary", primary);
  root.style.setProperty("--ring", primary);
  root.style.setProperty("--sidebar-primary", primary);
  root.style.setProperty("--sidebar-ring", primary);
  
  // Derive pink variations from primary
  root.style.setProperty("--pink", primary);
  root.style.setProperty("--pink-light", `${pH} ${Math.max(pS - 10, 0)}% 90%`);
  
  // Apply background color and related colors
  root.style.setProperty("--background", background);
  root.style.setProperty("--card", `${bH} ${Math.min(bS + 10, 100)}% ${Math.max(bL - 1, 90)}%`);
  
  // Derive sidebar colors
  root.style.setProperty("--sidebar-background", `${bH} ${Math.min(bS + 10, 100)}% ${Math.max(bL - 2, 90)}%`);
  
  // Update secondary based on primary hue shift
  const secondaryH = (pH + 70) % 360;
  root.style.setProperty("--secondary", `${secondaryH} 60% 85%`);
  root.style.setProperty("--lavender", `${secondaryH} 60% 80%`);
  root.style.setProperty("--lavender-light", `${secondaryH} 50% 92%`);
  root.style.setProperty("--sidebar-accent", `${secondaryH} 40% 90%`);
  
  // Update gradients
  root.style.setProperty(
    "--gradient-primary",
    `linear-gradient(135deg, hsl(${pH}, ${pS}%, ${pL}%) 0%, hsl(${(pH + 60) % 360}, ${pS - 10}%, ${pL + 5}%) 100%)`
  );
  root.style.setProperty(
    "--gradient-welcome",
    `linear-gradient(135deg, hsl(${pH}, ${pS - 10}%, ${pL + 10}%) 0%, hsl(${(pH + 70) % 360}, ${pS - 20}%, ${pL + 10}%) 50%, hsl(${(pH + 140) % 360}, ${pS - 20}%, ${pL + 15}%) 100%)`
  );
  
  // Update shadows
  root.style.setProperty(
    "--shadow-soft",
    `0 4px 20px -4px hsl(${pH} ${pS - 30}% ${pL}% / 0.15)`
  );
  root.style.setProperty(
    "--shadow-card",
    `0 8px 30px -8px hsl(${pH} ${pS - 30}% ${pL}% / 0.2)`
  );
  root.style.setProperty(
    "--shadow-glow",
    `0 0 30px hsl(${pH} ${pS}% ${pL}% / 0.3)`
  );
}

// Apply cached theme immediately on module load to prevent flash
function applyCachedTheme() {
  try {
    const cached = localStorage.getItem(THEME_CACHE_KEY);
    if (cached) {
      const { primary, background } = JSON.parse(cached);
      applyThemeColors(primary, background);
    }
  } catch {
    // ignore parse errors
  }
}

// Run immediately when module is imported
applyCachedTheme();

function cacheTheme(primary: string, background: string) {
  try {
    localStorage.setItem(THEME_CACHE_KEY, JSON.stringify({ primary, background }));
  } catch {
    // ignore storage errors
  }
}

export function useApplyTheme() {
  const { data: settings } = useStoreSettings();
  
  useEffect(() => {
    if (!settings) return;
    
    const preset = settings.theme_preset as ThemePreset | undefined;
    
    if (preset && THEME_PRESETS[preset]) {
      const theme = THEME_PRESETS[preset];
      applyThemeColors(theme.primary, theme.background);
      cacheTheme(theme.primary, theme.background);
    } else if (settings.primary_color && settings.background_color) {
      applyThemeColors(settings.primary_color, settings.background_color);
      cacheTheme(settings.primary_color, settings.background_color);
    }
  }, [settings]);
}

export function previewTheme(preset: ThemePreset) {
  const theme = THEME_PRESETS[preset];
  applyThemeColors(theme.primary, theme.background);
}

export function resetTheme() {
  const root = document.documentElement;
  root.style.removeProperty("--primary");
  root.style.removeProperty("--ring");
  root.style.removeProperty("--sidebar-primary");
  root.style.removeProperty("--sidebar-ring");
  root.style.removeProperty("--pink");
  root.style.removeProperty("--pink-light");
  root.style.removeProperty("--background");
  root.style.removeProperty("--card");
  root.style.removeProperty("--sidebar-background");
  root.style.removeProperty("--secondary");
  root.style.removeProperty("--lavender");
  root.style.removeProperty("--lavender-light");
  root.style.removeProperty("--sidebar-accent");
  root.style.removeProperty("--gradient-primary");
  root.style.removeProperty("--gradient-welcome");
  root.style.removeProperty("--shadow-soft");
  root.style.removeProperty("--shadow-card");
  root.style.removeProperty("--shadow-glow");
}
