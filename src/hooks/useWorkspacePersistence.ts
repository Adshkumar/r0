import { useState, useEffect } from "react";
import { getSetting, setSetting } from "../lib/settings";

const ls = {
  get: (k: string) => localStorage.getItem(k),
  set: (k: string, v: string) => localStorage.setItem(k, v),
};

export function useWorkspacePersistence() {
  const [sidebarOpen,    setSidebarOpen]    = useState(() => ls.get('r0-sidebar-open') !== 'false');
  const [aiPanelOpen,    setAiPanelOpen]    = useState(() => ls.get('r0-ai-panel-open') === 'true');
  const [terminalOpen,   setTerminalOpen]   = useState(() => ls.get('r0-terminal-open') === 'true');
  const [terminalHeight, setTerminalHeight] = useState(() => {
    const n = parseInt(ls.get('r0-terminal-height') ?? '', 10);
    return isNaN(n) ? 240 : n;
  });
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Workspace selection is restored by App after session state has loaded.
  useEffect(() => {
    Promise.all([
      getSetting('sidebar.open'),
      getSetting('terminal.open'),
      getSetting('terminal.height'),
    ]).then(([sidebar, termOpen, termHeight]) => {
      setSidebarOpen(sidebar);
      ls.set('r0-sidebar-open', String(sidebar));

      setTerminalOpen(termOpen);
      ls.set('r0-terminal-open', String(termOpen));

      if (termHeight > 0) {
        setTerminalHeight(termHeight);
        ls.set('r0-terminal-height', String(termHeight));
      }
    }).catch(error => {
      console.error('Could not load workspace layout settings:', error);
    }).finally(() => setSettingsLoaded(true));
  }, []);

  useEffect(() => {
    ls.set('r0-sidebar-open', String(sidebarOpen));
    setSetting('sidebar.open', sidebarOpen);
  }, [sidebarOpen]);

  useEffect(() => {
    ls.set('r0-terminal-open', String(terminalOpen));
    setSetting('terminal.open', terminalOpen);
  }, [terminalOpen]);

  useEffect(() => {
    ls.set('r0-terminal-height', String(terminalHeight));
    setSetting('terminal.height', terminalHeight);
  }, [terminalHeight]);

  useEffect(() => {
    ls.set('r0-ai-panel-open', String(aiPanelOpen));
  }, [aiPanelOpen]);

  return {
    settingsLoaded,
    sidebarOpen,    setSidebarOpen,
    aiPanelOpen,    setAiPanelOpen,
    terminalOpen,   setTerminalOpen,
    terminalHeight, setTerminalHeight,
  };
}
