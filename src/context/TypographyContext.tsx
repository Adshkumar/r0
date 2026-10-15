/* eslint-disable react-refresh/only-export-components -- exports useTypography alongside the provider */
import { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  DEFAULT_TYPOGRAPHY_SETTINGS,
  getSetting,
  setSetting,
  type TypographySettings,
} from "../lib/settings";

interface TypographyContextValue {
  settings: TypographySettings;
  updateSettings: (patch: Partial<TypographySettings>) => Promise<void>;
  resetSettings: () => Promise<void>;
}

const TypographyContext = createContext<TypographyContextValue | null>(null);

function normalizeSettings(value: Partial<TypographySettings> | null | undefined): TypographySettings {
  const settings = { ...DEFAULT_TYPOGRAPHY_SETTINGS, ...value };
  return {
    ...settings,
    uiFontFamily: settings.uiFontFamily.trim() || DEFAULT_TYPOGRAPHY_SETTINGS.uiFontFamily,
    editorFontFamily: settings.editorFontFamily.trim() || DEFAULT_TYPOGRAPHY_SETTINGS.editorFontFamily,
    terminalFontFamily: settings.terminalFontFamily.trim() || DEFAULT_TYPOGRAPHY_SETTINGS.terminalFontFamily,
    uiFontSize: Math.min(24, Math.max(10, Number(settings.uiFontSize) || DEFAULT_TYPOGRAPHY_SETTINGS.uiFontSize)),
    sidebarFontSize: Math.min(20, Math.max(10, Number(settings.sidebarFontSize) || DEFAULT_TYPOGRAPHY_SETTINGS.sidebarFontSize)),
    tabFontSize: Math.min(20, Math.max(10, Number(settings.tabFontSize) || DEFAULT_TYPOGRAPHY_SETTINGS.tabFontSize)),
    editorFontSize: Math.min(40, Math.max(8, Number(settings.editorFontSize) || DEFAULT_TYPOGRAPHY_SETTINGS.editorFontSize)),
    editorFontWeight: Math.min(900, Math.max(100, Number(settings.editorFontWeight) || DEFAULT_TYPOGRAPHY_SETTINGS.editorFontWeight)),
    editorLineHeight: Math.min(3, Math.max(1, Number(settings.editorLineHeight) || DEFAULT_TYPOGRAPHY_SETTINGS.editorLineHeight)),
    editorLetterSpacing: Math.min(5, Math.max(-2, Number(settings.editorLetterSpacing) || 0)),
    terminalFontSize: Math.min(32, Math.max(8, Number(settings.terminalFontSize) || DEFAULT_TYPOGRAPHY_SETTINGS.terminalFontSize)),
    terminalLineHeight: Math.min(2, Math.max(1, Number(settings.terminalLineHeight) || DEFAULT_TYPOGRAPHY_SETTINGS.terminalLineHeight)),
    editorFontLigatures: Boolean(settings.editorFontLigatures),
  };
}

function applyTypography(settings: TypographySettings): void {
  const root = document.documentElement;
  root.style.setProperty("--font-sans", settings.uiFontFamily);
  root.style.setProperty("--font-mono", settings.editorFontFamily);
  root.style.setProperty("--r0-ui-font-size", `${settings.uiFontSize}px`);
  root.style.setProperty("--r0-sidebar-font-size", `${settings.sidebarFontSize}px`);
  root.style.setProperty("--r0-tab-font-size", `${settings.tabFontSize}px`);
  root.style.setProperty("--r0-editor-font-family", settings.editorFontFamily);
  root.style.setProperty("--r0-editor-font-size", `${settings.editorFontSize}px`);
  root.style.setProperty("--r0-editor-font-weight", String(settings.editorFontWeight));
  root.style.setProperty("--r0-editor-line-height", String(settings.editorLineHeight));
  root.style.setProperty("--r0-editor-font-features", settings.editorFontLigatures ? "normal" : "none");
  root.style.setProperty("--r0-editor-letter-spacing", `${settings.editorLetterSpacing}px`);
}

export function TypographyProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState(DEFAULT_TYPOGRAPHY_SETTINGS);
  const settingsRef = useRef(settings);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let cancelled = false;
    getSetting("typography")
      .then(value => {
        if (cancelled) return;
        const normalized = normalizeSettings(value);
        settingsRef.current = normalized;
        setSettings(normalized);
        applyTypography(normalized);
      })
      .catch(error => console.error("Could not load typography settings:", error));
    return () => { cancelled = true; };
  }, []);

  async function updateSettings(patch: Partial<TypographySettings>) {
    const next = normalizeSettings({ ...settingsRef.current, ...patch });
    settingsRef.current = next;
    setSettings(next);
    applyTypography(next);
    try {
      const save = saveQueueRef.current.then(() => setSetting("typography", next));
      saveQueueRef.current = save.then(() => undefined, () => undefined);
      await save;
    } catch (error) {
      console.error("Could not save typography settings:", error);
      throw error;
    }
  }

  return (
    <TypographyContext.Provider value={{
      settings,
      updateSettings,
      resetSettings: () => updateSettings(DEFAULT_TYPOGRAPHY_SETTINGS),
    }}>
      {children}
    </TypographyContext.Provider>
  );
}

export function useTypography() {
  const context = useContext(TypographyContext);
  if (!context) throw new Error("useTypography must be used inside TypographyProvider");
  return context;
}
