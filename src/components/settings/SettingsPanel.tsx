import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, Eye, EyeOff, Bot, Palette, Check, MessageSquareDot, SlidersHorizontal, Terminal, Copy, Keyboard, Code2 } from "lucide-react";
import KeybindingsSection from "./KeybindingsSection";
import { PROVIDERS } from "../ai/providers";
import { loadApiKey, saveApiKey, deleteApiKey } from "../../lib/secrets";
import { useTheme } from "../../themes/ThemeContext";
import { DEFAULT_SYSTEM_PROMPT, DEFAULT_ASK_PROMPT, DEFAULT_PLAN_PROMPT } from "../../lib/ai";
import {
  restoreEditorSuggestionDefaults,
  updateEditorSuggestionSettings,
  useEditorSuggestionSettings,
} from "../../lib/editorSuggestions";
import { getSetting, setSetting } from "../../lib/settings";

// ── Constants ────────────────────────────────────────────────────────────────

const LOCAL_IDS = new Set(["ollama", "lmstudio", "vllm"]);
const API_PROVIDERS = PROVIDERS.filter(p => !LOCAL_IDS.has(p.id));

type Section = "general" | "ai" | "prompts" | "appearance" | "terminal" | "keybindings" | "suggestions";

// ── Nav ──────────────────────────────────────────────────────────────────────

function NavItem({ active, icon, label, onClick }: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "9px",
        width: "100%",
        padding: "7px 10px",
        borderRadius: "6px",
        border: "none",
        cursor: "pointer",
        textAlign: "left",
        fontSize: "13px",
        fontWeight: active ? 500 : 400,
        backgroundColor: active ? "var(--r0-bg-hover)" : "transparent",
        color: active ? "var(--r0-fg-default)" : "var(--r0-fg-muted)",
        transition: "background 0.1s",
      }}
      onMouseEnter={e => {
        if (!active) e.currentTarget.style.backgroundColor = "var(--r0-bg-hover)";
      }}
      onMouseLeave={e => {
        if (!active) e.currentTarget.style.backgroundColor = "transparent";
      }}
    >
      <span style={{ opacity: active ? 1 : 0.7, display: "flex" }}>{icon}</span>
      {label}
    </button>
  );
}

// ── AI Providers Section ─────────────────────────────────────────────────────

type KeyState = {
  value: string;
  original: string;
  visible: boolean;
  saving: boolean;
  justSaved: boolean;
};

function AIProvidersSection() {
  const { theme } = useTheme();
  const isDark = theme.type === "dark";
  const [keys, setKeys] = useState<Record<string, KeyState>>(() =>
    Object.fromEntries(
      API_PROVIDERS.map(p => [p.id, { value: "", original: "", visible: false, saving: false, justSaved: false }])
    )
  );

  useEffect(() => {
    API_PROVIDERS.forEach(async ({ id }) => {
      const key = await loadApiKey(id).catch(() => null);
      if (key) {
        setKeys(prev => ({
          ...prev,
          [id]: { ...prev[id], value: key, original: key },
        }));
      }
    });
  }, []);

  const update = useCallback((id: string, patch: Partial<KeyState>) => {
    setKeys(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }, []);

  async function handleSave(id: string) {
    const { value } = keys[id];
    update(id, { saving: true });
    try {
      if (value.trim()) {
        await saveApiKey(id, value.trim());
        update(id, { saving: false, original: value.trim(), justSaved: true });
        setTimeout(() => update(id, { justSaved: false }), 1800);
      } else {
        await deleteApiKey(id);
        update(id, { saving: false, original: "", justSaved: true });
        setTimeout(() => update(id, { justSaved: false }), 1800);
      }
    } catch {
      update(id, { saving: false });
    }
  }

  async function handleClear(id: string) {
    await deleteApiKey(id).catch(() => {});
    update(id, { value: "", original: "" });
  }

  return (
    <div style={{ padding: "2px 0 16px" }}>
      <p style={{ fontSize: "12px", color: "var(--r0-fg-muted)", marginBottom: "18px", lineHeight: 1.5 }}>
        API keys are stored in your OS keychain and never leave your device.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        {API_PROVIDERS.map(provider => {
          const state = keys[provider.id];
          if (!state) return null;
          const isDirty = state.value !== state.original;
          const hasSaved = state.original !== "";

          return (
            <div
              key={provider.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1px solid var(--r0-border-default)",
                backgroundColor: "var(--r0-bg-base)",
              }}
            >
              {/* Provider icon */}
              <div style={{
                width: 28, height: 28, flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                borderRadius: "6px",
                backgroundColor: provider.icon ? "transparent" : provider.color,
                overflow: "hidden",
              }}>
                {provider.icon ? (
                  <img
                    src={provider.icon}
                    alt={provider.name}
                    style={{
                      width: 20, height: 20,
                      filter: provider.invert ? (isDark ? "brightness(0) invert(1)" : "none") : "none",
                    }}
                  />
                ) : (
                  <span style={{ fontSize: "10px", fontWeight: 700, color: provider.textColor }}>
                    {provider.initial}
                  </span>
                )}
              </div>

              {/* Name */}
              <div style={{ width: 90, flexShrink: 0 }}>
                <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--r0-fg-default)" }}>
                  {provider.name}
                </span>
                {hasSaved && (
                  <div style={{ display: "flex", alignItems: "center", gap: "3px", marginTop: "1px" }}>
                    <Check size={10} style={{ color: "var(--r0-semantic-success)" }} />
                    <span style={{ fontSize: "10px", color: "var(--r0-semantic-success)" }}>Key saved</span>
                  </div>
                )}
              </div>

              {/* Key input */}
              <div style={{ flex: 1, position: "relative" }}>
                <input
                  type={state.visible ? "text" : "password"}
                  value={state.value}
                  placeholder="Paste API key…"
                  onChange={e => update(provider.id, { value: e.target.value })}
                  onKeyDown={e => { if (e.key === "Enter") handleSave(provider.id); }}
                  style={{
                    width: "100%",
                    padding: "6px 30px 6px 9px",
                    borderRadius: "6px",
                    border: "1px solid var(--r0-border-default)",
                    backgroundColor: "var(--r0-bg-sidebar)",
                    color: "var(--r0-fg-default)",
                    fontSize: "12px",
                    fontFamily: "var(--font-mono)",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
                <button
                  onClick={() => update(provider.id, { visible: !state.visible })}
                  style={{
                    position: "absolute", right: 7, top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer",
                    color: "var(--r0-fg-subtle)", padding: 0, display: "flex",
                  }}
                  tabIndex={-1}
                >
                  {state.visible ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                <button
                  onClick={() => handleSave(provider.id)}
                  disabled={!isDirty || state.saving}
                  style={{
                    padding: "5px 12px",
                    borderRadius: "6px",
                    border: "1px solid var(--r0-border-default)",
                    backgroundColor: state.justSaved
                      ? "color-mix(in srgb, var(--r0-semantic-success) 15%, transparent)"
                      : isDirty
                        ? "var(--r0-fg-default)"
                        : "transparent",
                    color: state.justSaved
                      ? "var(--r0-semantic-success)"
                      : isDirty
                        ? "var(--r0-bg-base)"
                        : "var(--r0-fg-subtle)",
                    fontSize: "12px",
                    fontWeight: 500,
                    cursor: isDirty ? "pointer" : "default",
                    transition: "all 0.15s",
                    minWidth: 50,
                  }}
                >
                  {state.saving ? "…" : state.justSaved ? "Saved!" : "Save"}
                </button>
                {hasSaved && (
                  <button
                    onClick={() => handleClear(provider.id)}
                    style={{
                      padding: "5px 10px",
                      borderRadius: "6px",
                      border: "1px solid var(--r0-border-default)",
                      backgroundColor: "transparent",
                      color: "var(--r0-fg-muted)",
                      fontSize: "12px",
                      cursor: "pointer",
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Local providers note */}
      <div style={{
        marginTop: "20px",
        padding: "10px 12px",
        borderRadius: "8px",
        border: "1px solid var(--r0-border-default)",
        backgroundColor: "var(--r0-bg-base)",
      }}>
        <div style={{ fontSize: "12px", fontWeight: 500, color: "var(--r0-fg-muted)", marginBottom: "2px" }}>
          Local providers (Ollama, LM Studio, vLLM)
        </div>
        <div style={{ fontSize: "12px", color: "var(--r0-fg-subtle)" }}>
          No API key required. Make sure your local server is running before starting a chat.
        </div>
      </div>
    </div>
  );
}

// ── Appearance Section ───────────────────────────────────────────────────────

function AppearanceSection() {
  const { theme, themes, setTheme } = useTheme();

  return (
    <div style={{ padding: "2px 0 16px" }}>
      <div style={{ marginBottom: "20px" }}>
        <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--r0-fg-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "10px" }}>
          Theme
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          {themes.map(t => {
            const isActive = t.name === theme.name;
            return (
              <button
                key={t.name}
                onClick={() => setTheme(t)}
                aria-pressed={isActive}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: `1px solid ${isActive ? "var(--r0-fg-muted)" : "var(--r0-border-default)"}`,
                  backgroundColor: isActive ? "var(--r0-bg-hover)" : "var(--r0-bg-base)",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.1s",
                }}
                onMouseEnter={e => {
                  if (!isActive) e.currentTarget.style.backgroundColor = "var(--r0-bg-hover)";
                }}
                onMouseLeave={e => {
                  if (!isActive) e.currentTarget.style.backgroundColor = "var(--r0-bg-base)";
                }}
              >
                <div aria-hidden="true" style={{
                  display: "flex",
                  width: 30,
                  height: 20,
                  overflow: "hidden",
                  borderRadius: "5px",
                  border: `1px solid ${t.colors["border.default"]}`,
                  flexShrink: 0,
                }}>
                  {["bg.sidebar", "bg.editor", "accent.blue"].map(token => (
                    <span key={token} style={{ flex: 1, backgroundColor: t.colors[token] }} />
                  ))}
                </div>
                <span style={{ fontSize: "13px", color: "var(--r0-fg-default)", fontWeight: isActive ? 500 : 400 }}>
                  {t.name}
                </span>
                {isActive && (
                  <Check size={14} style={{ marginLeft: "auto", color: "var(--r0-fg-default)" }} />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Prompts Section ──────────────────────────────────────────────────────────

type PromptTab = "agent" | "ask" | "plan";

const PROMPT_CONFIGS: Record<PromptTab, { label: string; storageKey: string; defaultValue: string; description: string }> = {
  agent: {
    label: "Agent",
    storageKey: "r0-ai-system-prompt",
    defaultValue: DEFAULT_SYSTEM_PROMPT,
    description: "Used in Agent mode. Full tool access — read, write, edit, bash.",
  },
  ask: {
    label: "Ask",
    storageKey: "r0-ai-ask-prompt",
    defaultValue: DEFAULT_ASK_PROMPT,
    description: "Used in Ask mode. Can call edit / multi_edit; changes go through the diff view.",
  },
  plan: {
    label: "Plan",
    storageKey: "r0-ai-plan-prompt",
    defaultValue: DEFAULT_PLAN_PROMPT,
    description: "Used in Plan mode Phase 1 (exploration) and drives the structured plan format.",
  },
};

function PromptEditor({ tab }: { tab: PromptTab }) {
  const cfg = PROMPT_CONFIGS[tab];
  const [value, setValue] = useState(() => localStorage.getItem(cfg.storageKey) ?? cfg.defaultValue);
  const [saved, setSaved] = useState(() => localStorage.getItem(cfg.storageKey) ?? cfg.defaultValue);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(cfg.storageKey) ?? cfg.defaultValue;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load persisted setting value on mount/config change
    setValue(stored);
    setSaved(stored);
  }, [cfg.storageKey, cfg.defaultValue]);

  const isDirty = value !== saved;
  const isDefault = value.trim() === cfg.defaultValue.trim();

  function handleSave() {
    if (isDefault) {
      localStorage.removeItem(cfg.storageKey);
    } else {
      localStorage.setItem(cfg.storageKey, value);
    }
    setSaved(value);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1800);
  }

  return (
    <div>
      <p style={{ fontSize: "12px", color: "var(--r0-fg-muted)", marginBottom: "12px", lineHeight: 1.6 }}>
        {cfg.description} Changes take effect on the next message sent.
      </p>
      <textarea
        value={value}
        onChange={e => setValue(e.target.value)}
        spellCheck={false}
        style={{
          width: "100%",
          minHeight: "200px",
          padding: "10px 12px",
          borderRadius: "8px",
          border: "1px solid var(--r0-border-default)",
          backgroundColor: "var(--r0-bg-base)",
          color: "var(--r0-fg-default)",
          fontSize: "12px",
          fontFamily: "var(--font-mono)",
          lineHeight: "1.65",
          outline: "none",
          resize: "vertical",
          boxSizing: "border-box",
          display: "block",
        }}
        onFocus={e => { e.currentTarget.style.borderColor = "var(--r0-fg-muted)"; }}
        onBlur={e => { e.currentTarget.style.borderColor = "var(--r0-border-default)"; }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "10px" }}>
        <button
          onClick={() => setValue(cfg.defaultValue)}
          disabled={isDefault}
          style={{
            padding: "5px 12px", borderRadius: "6px",
            border: "1px solid var(--r0-border-default)",
            backgroundColor: "transparent",
            color: isDefault ? "var(--r0-fg-subtle)" : "var(--r0-fg-muted)",
            fontSize: "12px", cursor: isDefault ? "default" : "pointer",
          }}
        >
          Reset to Default
        </button>
        <div style={{ flex: 1 }} />
        <button
          onClick={handleSave}
          disabled={!isDirty}
          style={{
            padding: "5px 16px", borderRadius: "6px",
            border: "1px solid var(--r0-border-default)",
            backgroundColor: justSaved
              ? "color-mix(in srgb, var(--r0-semantic-success) 15%, transparent)"
              : isDirty ? "var(--r0-fg-default)" : "transparent",
            color: justSaved
              ? "var(--r0-semantic-success)"
              : isDirty ? "var(--r0-bg-base)" : "var(--r0-fg-subtle)",
            fontSize: "12px", fontWeight: 500,
            cursor: isDirty ? "pointer" : "default",
            transition: "all 0.15s", minWidth: 56,
          }}
        >
          {justSaved ? "Saved!" : "Save"}
        </button>
      </div>
    </div>
  );
}

function PromptsSection() {
  const [tab, setTab] = useState<PromptTab>("agent");
  const tabs: PromptTab[] = ["agent", "ask", "plan"];

  return (
    <div style={{ padding: "2px 0 16px" }}>
      {/* Tab bar */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "16px" }}>
        {tabs.map(t => {
          const active = t === tab;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: "4px 14px", borderRadius: "6px", fontSize: "12px", fontWeight: active ? 500 : 400,
                border: "1px solid",
                borderColor: active ? "var(--r0-fg-muted)" : "var(--r0-border-default)",
                backgroundColor: active ? "var(--r0-bg-hover)" : "transparent",
                color: active ? "var(--r0-fg-default)" : "var(--r0-fg-muted)",
                cursor: "pointer", transition: "all 0.1s",
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.backgroundColor = "var(--r0-bg-hover)"; }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.backgroundColor = "transparent"; }}
            >
              {PROMPT_CONFIGS[t].label}
            </button>
          );
        })}
      </div>
      <PromptEditor key={tab} tab={tab} />
    </div>
  );
}

// ── General Section ──────────────────────────────────────────────────────────

const AUTOCOMPLETE_DELAY_KEY = 'r0-editor-autocomplete-delay';
const AUTOCOMPLETE_DELAY_UNIT_KEY = 'r0-editor-autocomplete-delay-unit';

type DelayUnit = 'ms' | 's';

function msToDisplay(ms: number, unit: DelayUnit): string {
  return unit === 's' ? (ms / 1000).toString() : ms.toString();
}

function displayToMs(raw: string, unit: DelayUnit): number | null {
  const n = parseFloat(raw);
  if (isNaN(n) || n <= 0) return null;
  return unit === 's' ? Math.round(n * 1000) : Math.round(n);
}

function GeneralSection() {
  const suggestionSettings = useEditorSuggestionSettings();
  const [unit, setUnit] = useState<DelayUnit>(
    () => (localStorage.getItem(AUTOCOMPLETE_DELAY_UNIT_KEY) as DelayUnit | null) ?? 'ms'
  );
  const [inputVal, setInputVal] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [formatOnSave, setFormatOnSave] = useState(false);
  const completionsEnabled = suggestionSettings.aiInlineCompletions;

  useEffect(() => {
    getSetting('editor.formatOnSave')
      .then(setFormatOnSave)
      .catch(error => setSettingsError(`Could not load format-on-save setting: ${String(error)}`));
  }, []);

  function commitInput(raw: string) {
    const ms = displayToMs(raw, unit);
    if (ms !== null) {
      setInputVal(null);
      localStorage.setItem(AUTOCOMPLETE_DELAY_KEY, String(ms));
      void updateEditorSuggestionSettings({ debounceMs: ms })
        .catch(error => setSettingsError(`Could not save suggestion delay: ${String(error)}`));
    } else {
      setInputVal(null);
    }
  }

  function switchUnit(next: DelayUnit) {
    setUnit(next);
    setInputVal(null);
    localStorage.setItem(AUTOCOMPLETE_DELAY_UNIT_KEY, next);
  }

  function toggleCompletions() {
    const next = !completionsEnabled;
    void updateEditorSuggestionSettings({ aiInlineCompletions: next })
      .catch(error => setSettingsError(`Could not save AI completion setting: ${String(error)}`));
  }

  function toggleFormatOnSave() {
    const next = !formatOnSave;
    setFormatOnSave(next);
    void setSetting('editor.formatOnSave', next)
      .catch(error => {
        setFormatOnSave(!next);
        setSettingsError(`Could not save format-on-save setting: ${String(error)}`);
      });
  }

  const inputStyle: React.CSSProperties = {
    width: "80px",
    padding: "5px 8px",
    borderRadius: "6px",
    border: "1px solid var(--r0-border-default)",
    backgroundColor: "var(--r0-bg-sidebar)",
    color: "var(--r0-fg-default)",
    fontSize: "12px",
    fontFamily: "var(--font-mono)",
    outline: "none",
    textAlign: "right",
  };

  return (
    <div style={{ padding: "2px 0 16px" }}>
      <div style={{
        fontSize: "12px", fontWeight: 600, color: "var(--r0-fg-muted)",
        textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "10px",
      }}>
        AI Inline Suggestions
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {/* Inline completions toggle */}
        <div style={{
          display: "flex", alignItems: "center", gap: "12px",
          padding: "10px 12px", borderRadius: "8px",
          border: "1px solid var(--r0-border-default)",
          backgroundColor: "var(--r0-bg-base)",
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "13px", color: "var(--r0-fg-default)" }}>Enable AI inline completions</div>
            <div style={{ fontSize: "11px", color: "var(--r0-fg-muted)", marginTop: "2px" }}>
              Ghost text as you type — Tab to accept, Escape to dismiss.
            </div>
          </div>
          <button
            onClick={toggleCompletions}
            style={{
              padding: "4px 12px", borderRadius: "6px", fontSize: "12px",
              border: "1px solid var(--r0-border-default)",
              backgroundColor: completionsEnabled ? "var(--r0-fg-default)" : "transparent",
              color: completionsEnabled ? "var(--r0-bg-base)" : "var(--r0-fg-muted)",
              cursor: "pointer", fontWeight: 500, transition: "all 0.15s",
            }}
          >
            {completionsEnabled ? "On" : "Off"}
          </button>
        </div>
        <div style={{
          display: "flex", alignItems: "center", gap: "12px",
          padding: "10px 12px", borderRadius: "8px",
          border: "1px solid var(--r0-border-default)",
          backgroundColor: "var(--r0-bg-base)",
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "13px", color: "var(--r0-fg-default)" }}>Format active documents on save</div>
            <div style={{ fontSize: "11px", color: "var(--r0-fg-muted)", marginTop: "2px" }}>
              Uses the built-in Prettier formatter where supported and honors JSON project configuration.
            </div>
          </div>
          <button
            onClick={toggleFormatOnSave}
            aria-pressed={formatOnSave}
            style={{
              padding: "4px 12px", borderRadius: "6px", fontSize: "12px",
              border: "1px solid var(--r0-border-default)",
              backgroundColor: formatOnSave ? "var(--r0-fg-default)" : "transparent",
              color: formatOnSave ? "var(--r0-bg-base)" : "var(--r0-fg-muted)",
              cursor: "pointer", fontWeight: 500,
            }}
          >
            {formatOnSave ? "On" : "Off"}
          </button>
        </div>
        {/* Ghost text delay */}
        <div style={{
          display: "flex", alignItems: "center", gap: "12px",
          padding: "10px 14px", borderRadius: "8px",
          border: "1px solid var(--r0-border-default)",
          backgroundColor: "var(--r0-bg-base)",
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "13px", color: "var(--r0-fg-default)" }}>Ghost text delay</div>
            <div style={{ fontSize: "11px", color: "var(--r0-fg-muted)", marginTop: "2px" }}>
              Wait time after typing stops before requesting a suggestion.
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
            <input
              type="number"
              min={unit === 's' ? 0.1 : 100}
              step={unit === 's' ? 0.1 : 50}
              value={inputVal ?? msToDisplay(suggestionSettings.debounceMs, unit)}
              onChange={e => setInputVal(e.target.value)}
              onBlur={e => { e.currentTarget.style.borderColor = "var(--r0-border-default)"; commitInput(e.target.value); }}
              onKeyDown={e => { if (e.key === 'Enter') { e.currentTarget.blur(); } }}
              style={inputStyle}
              onFocus={e => { e.currentTarget.style.borderColor = "var(--r0-fg-muted)"; }}
            />
            <div style={{ display: "flex", borderRadius: "6px", border: "1px solid var(--r0-border-default)", overflow: "hidden" }}>
              {(['ms', 's'] as DelayUnit[]).map(u => (
                <button
                  key={u}
                  onClick={() => switchUnit(u)}
                  style={{
                    padding: "5px 9px",
                    fontSize: "11px",
                    fontWeight: 500,
                    border: "none",
                    borderRight: u === 'ms' ? "1px solid var(--r0-border-default)" : "none",
                    cursor: "pointer",
                    backgroundColor: unit === u ? "var(--r0-fg-default)" : "transparent",
                    color: unit === u ? "var(--r0-bg-base)" : "var(--r0-fg-muted)",
                    transition: "all 0.1s",
                  }}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      {settingsError && <p role="alert" style={{ color: "var(--r0-semantic-error)", fontSize: 11 }}>{settingsError}</p>}
    </div>
  );
}

// ── Terminal Section ─────────────────────────────────────────────────────────

const SHELL_CONFIGS: Record<string, { label: string; filename: string; code: string }> = {
  powershell: {
    label: "PowerShell",
    filename: "$PROFILE",
    code: [
      'function prompt {',
      '    $code = if ($?) { 0 } else { $LASTEXITCODE }',
      "    $p = ($PWD.Path -replace '\\\\', '/') -replace '^([A-Za-z]):', '/$1'",
      '    $esc = [char]27',
      '    [Console]::Write("$esc]133;D;$code`a$esc]7;file://$env:COMPUTERNAME$p`a$esc]133;A`a")',
      '    "PS $($PWD.Path)> $esc]133;B`a"',
      '}',
    ].join('\n'),
  },
  bash: {
    label: "Bash",
    filename: "~/.bashrc",
    code: [
      '__r0_prompt() {',
      '  local code=$?',
      "  printf '\\033]133;D;%s\\007' \"$code\"",
      "  printf '\\033]7;file://%s%s\\007' \"$HOSTNAME\" \"$PWD\"",
      "  printf '\\033]133;A\\007'",
      '}',
      'PROMPT_COMMAND="__r0_prompt${PROMPT_COMMAND:+;$PROMPT_COMMAND}"',
      "PS1=\"${PS1}\"$'\\033]133;B\\007'",
    ].join('\n'),
  },
  zsh: {
    label: "Zsh",
    filename: "~/.zshrc",
    code: [
      '__r0_precmd() {',
      '  local code=$?',
      "  printf '\\033]133;D;%s\\007' \"$code\"",
      "  printf '\\033]7;file://%s%s\\007' \"$HOST\" \"$PWD\"",
      "  printf '\\033]133;A\\007'",
      '}',
      'precmd_functions+=(__r0_precmd)',
      "PROMPT=\"${PROMPT}\"$'\\033]133;B\\007'",
    ].join('\n'),
  },
};

function TerminalSection() {
  const [copied, setCopied] = useState<string | null>(null);

  function copy(key: string, code: string) {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 1800);
    }).catch(() => {});
  }

  return (
    <div style={{ padding: "2px 0 16px" }}>
      <div style={{
        fontSize: "12px", fontWeight: 600, color: "var(--r0-fg-muted)",
        textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "10px",
      }}>
        Shell Integration
      </div>
      <p style={{ fontSize: "12px", color: "var(--r0-fg-muted)", marginBottom: "20px", lineHeight: 1.6 }}>
        Paste the snippet for your shell into the file shown, then reload your shell. Once active, terminal tabs show a live directory and a colored dot for command exit status.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {Object.entries(SHELL_CONFIGS).map(([key, cfg]) => (
          <div key={key}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--r0-fg-default)" }}>{cfg.label}</span>
                <span style={{ fontSize: "11px", color: "var(--r0-fg-subtle)", fontFamily: "var(--font-mono)" }}>{cfg.filename}</span>
              </div>
              <button
                onClick={() => copy(key, cfg.code)}
                style={{
                  display: "flex", alignItems: "center", gap: "5px",
                  padding: "4px 10px", borderRadius: "6px", fontSize: "12px",
                  border: "1px solid var(--r0-border-default)",
                  backgroundColor: copied === key
                    ? "color-mix(in srgb, var(--r0-semantic-success) 15%, transparent)"
                    : "transparent",
                  color: copied === key ? "var(--r0-semantic-success)" : "var(--r0-fg-muted)",
                  cursor: "pointer", transition: "all 0.15s",
                }}
              >
                {copied === key ? <Check size={11} /> : <Copy size={11} />}
                {copied === key ? "Copied!" : "Copy"}
              </button>
            </div>
            <pre style={{
              margin: 0, padding: "10px 14px",
              borderRadius: "8px",
              border: "1px solid var(--r0-border-default)",
              backgroundColor: "var(--r0-bg-base)",
              color: "var(--r0-fg-default)",
              fontSize: "11px",
              fontFamily: "var(--font-mono)",
              lineHeight: "1.65",
              overflowX: "auto",
              whiteSpace: "pre",
            }}>
              {cfg.code}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}

const LANGUAGE_LABELS: Record<string, string> = {
  javascript: "JavaScript",
  typescript: "TypeScript",
  python: "Python",
  rust: "Rust",
  html: "HTML",
  css: "CSS",
  json: "JSON",
  other: "Other supported languages",
};

function EditorSuggestionsSection() {
  const settings = useEditorSuggestionSettings();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [debounceDraft, setDebounceDraft] = useState<string | null>(null);
  const [maxItemsDraft, setMaxItemsDraft] = useState<string | null>(null);

  async function update(patch: Parameters<typeof updateEditorSuggestionSettings>[0]) {
    setSaveError(null);
    try {
      await updateEditorSuggestionSettings(patch);
    } catch (error) {
      setSaveError(`Could not save suggestion settings: ${String(error)}`);
    }
  }

  function toggleRow(
    key: keyof typeof settings,
    title: string,
    description: string,
  ) {
    const value = settings[key];
    if (typeof value !== "boolean") return null;
    return (
      <label key={key} style={suggestionRowStyle}>
        <span style={{ flex: 1 }}>
          <span style={{ display: "block", fontSize: 12, color: "var(--r0-fg-default)" }}>{title}</span>
          <span style={{ display: "block", marginTop: 3, fontSize: 11, color: "var(--r0-fg-muted)" }}>{description}</span>
        </span>
        <input
          type="checkbox"
          checked={value}
          onChange={event => void update({ [key]: event.target.checked })}
          aria-label={title}
          style={{ accentColor: "var(--r0-accent-blue)", width: 15, height: 15 }}
        />
      </label>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, paddingBottom: 18 }}>
      <p style={{ margin: 0, color: "var(--r0-fg-muted)", fontSize: 12, lineHeight: 1.55 }}>
        Autocomplete provides local symbols and language built-ins. Semantic IntelliSense uses an installed language server. Inline suggestions are separate AI-generated ghost text.
      </p>
      <section>
        <SuggestionHeading>Autocomplete</SuggestionHeading>
        {toggleRow("enabled", "Enable Autocomplete", "Enable completion suggestions in the editor.")}
        {toggleRow("showWhileTyping", "Show Suggestions While Typing", "Trigger local and semantic completions as you type.")}
        {toggleRow("manualSuggestions", "Enable Manual Suggestions", "Allow Ctrl+Space to request suggestions when automatic suggestions are off.")}
        {toggleRow("showDocumentation", "Show Completion Documentation", "Show documentation when a completion provider supplies it.")}
        {toggleRow("showDetails", "Show Completion Details and Icons", "Show completion kind and detail labels in the suggestion list.")}
        {toggleRow("semanticIntelliSense", "Enable Semantic IntelliSense", "Use a configured language server for project-aware completions and language features.")}
      </section>
      <section>
        <SuggestionHeading>AI Inline Suggestions</SuggestionHeading>
        {toggleRow("inlineSuggestions", "Enable Inline Suggestions", "Enable inline ghost text independently of the completion popup.")}
        {toggleRow("aiInlineCompletions", "Enable AI Inline Completions", "Allow the configured AI provider to generate inline code suggestions.")}
        {toggleRow("showGhostText", "Show Inline Ghost Text", "Display AI suggestions inline without changing the document.")}
        {toggleRow("acceptWithTab", "Accept Inline Suggestion with Tab", "When enabled, Tab accepts visible ghost text; otherwise it inserts normal indentation.")}
      </section>
      <section>
        <SuggestionHeading>Language and Performance</SuggestionHeading>
        {Object.entries(LANGUAGE_LABELS).map(([language, label]) => (
          <label key={language} style={suggestionRowStyle}>
            <span style={{ flex: 1, fontSize: 12, color: "var(--r0-fg-default)" }}>{label}</span>
            <input
              type="checkbox"
              checked={settings.languageEnabled[language] ?? true}
              onChange={event => void update({ language, languageEnabledValue: event.target.checked })}
              aria-label={`Enable automatic suggestions for ${label}`}
              style={{ accentColor: "var(--r0-accent-blue)", width: 15, height: 15 }}
            />
          </label>
        ))}
        <div style={suggestionRowStyle}>
          <label htmlFor="suggestion-debounce" style={{ flex: 1 }}>
            <span style={{ display: "block", fontSize: 12, color: "var(--r0-fg-default)" }}>Suggestion debounce</span>
            <span style={{ display: "block", marginTop: 3, fontSize: 11, color: "var(--r0-fg-muted)" }}>Delay before opening automatic completion, in milliseconds.</span>
          </label>
          <input
            id="suggestion-debounce"
            type="number"
            min={100}
            max={2000}
            step={50}
            value={debounceDraft ?? String(settings.debounceMs)}
            onChange={event => {
              setDebounceDraft(event.target.value);
            }}
            onBlur={() => {
              if (debounceDraft === null) return;
              const value = Number(debounceDraft);
              setDebounceDraft(null);
              if (Number.isFinite(value)) void update({ debounceMs: Math.max(100, Math.min(2000, value)) });
              else setSaveError("Enter a valid suggestion delay.");
            }}
            onKeyDown={event => { if (event.key === "Enter") event.currentTarget.blur(); }}
            style={suggestionInputStyle}
          />
        </div>
        <div style={suggestionRowStyle}>
          <label htmlFor="suggestion-max-items" style={{ flex: 1 }}>
            <span style={{ display: "block", fontSize: 12, color: "var(--r0-fg-default)" }}>Maximum completion items</span>
            <span style={{ display: "block", marginTop: 3, fontSize: 11, color: "var(--r0-fg-muted)" }}>Limits the number of local suggestions rendered.</span>
          </label>
          <input
            id="suggestion-max-items"
            type="number"
            min={5}
            max={100}
            step={5}
            value={maxItemsDraft ?? String(settings.maxItems)}
            onChange={event => {
              setMaxItemsDraft(event.target.value);
            }}
            onBlur={() => {
              if (maxItemsDraft === null) return;
              const value = Number(maxItemsDraft);
              setMaxItemsDraft(null);
              if (Number.isFinite(value)) void update({ maxItems: Math.max(5, Math.min(100, value)) });
              else setSaveError("Enter a valid maximum completion count.");
            }}
            onKeyDown={event => { if (event.key === "Enter") event.currentTarget.blur(); }}
            style={suggestionInputStyle}
          />
        </div>
      </section>
      {saveError && <p role="alert" style={{ margin: 0, color: "var(--r0-semantic-error)", fontSize: 11 }}>{saveError}</p>}
      <button
        onClick={() => {
          setSaveError(null);
          void restoreEditorSuggestionDefaults().catch(error => setSaveError(`Could not restore defaults: ${String(error)}`));
        }}
        style={{ alignSelf: "flex-start", padding: "6px 10px", borderRadius: 5, border: "1px solid var(--r0-border-default)", background: "var(--r0-bg-base)", color: "var(--r0-fg-default)", cursor: "pointer", fontSize: 11 }}
      >
        Restore Defaults
      </button>
    </div>
  );
}

const suggestionRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "9px 10px",
  border: "1px solid var(--r0-border-default)",
  borderRadius: 7,
  background: "var(--r0-bg-base)",
};

function SuggestionHeading({ children }: { children: React.ReactNode }) {
  return <h3 style={{ margin: "0 0 7px", color: "var(--r0-fg-muted)", fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>{children}</h3>;
}

const suggestionInputStyle: React.CSSProperties = {
  width: 74,
  padding: "5px 7px",
  borderRadius: 5,
  border: "1px solid var(--r0-border-default)",
  background: "var(--r0-bg-sidebar)",
  color: "var(--r0-fg-default)",
  fontSize: 12,
  fontFamily: "var(--font-mono)",
};

// ── Settings Panel ───────────────────────────────────────────────────────────

interface SettingsPanelProps {
  onClose: () => void;
}

export default function SettingsPanel({ onClose }: SettingsPanelProps) {
  const [section, setSection] = useState<Section>("general");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 10000,
        backgroundColor: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: "min(760px, 92vw)",
          height: "min(540px, 88vh)",
          backgroundColor: "var(--r0-bg-sidebar)",
          border: "1px solid var(--r0-border-default)",
          borderRadius: "12px",
          boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
        onMouseDown={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: "flex",
          alignItems: "center",
          padding: "0 16px",
          height: "48px",
          borderBottom: "1px solid var(--r0-border-default)",
          flexShrink: 0,
        }}>
          <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--r0-fg-default)" }}>
            Settings
          </span>
          <button
            onClick={onClose}
            style={{
              marginLeft: "auto",
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 26, height: 26,
              borderRadius: "6px",
              border: "none",
              background: "none",
              cursor: "pointer",
              color: "var(--r0-fg-muted)",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = "var(--r0-bg-hover)";
              e.currentTarget.style.color = "var(--r0-fg-default)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = "var(--r0-fg-muted)";
            }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          {/* Left nav */}
          <div style={{
            width: "172px",
            flexShrink: 0,
            borderRight: "1px solid var(--r0-border-default)",
            padding: "10px 8px",
            overflowY: "auto",
          }}>
            <div style={{ fontSize: "10px", fontWeight: 600, color: "var(--r0-fg-subtle)", textTransform: "uppercase", letterSpacing: "0.07em", padding: "4px 10px 6px" }}>
              Settings
            </div>
            <NavItem
              active={section === "general"}
              icon={<SlidersHorizontal size={14} />}
              label="General"
              onClick={() => setSection("general")}
            />
            <NavItem
              active={section === "suggestions"}
              icon={<Code2 size={14} />}
              label="Editor: Suggestions"
              onClick={() => setSection("suggestions")}
            />
            <NavItem
              active={section === "ai"}
              icon={<Bot size={14} />}
              label="AI Providers"
              onClick={() => setSection("ai")}
            />
            <NavItem
              active={section === "prompts"}
              icon={<MessageSquareDot size={14} />}
              label="System Prompts"
              onClick={() => setSection("prompts")}
            />
            <NavItem
              active={section === "appearance"}
              icon={<Palette size={14} />}
              label="Appearance"
              onClick={() => setSection("appearance")}
            />
            <NavItem
              active={section === "terminal"}
              icon={<Terminal size={14} />}
              label="Terminal"
              onClick={() => setSection("terminal")}
            />
            <NavItem
              active={section === "keybindings"}
              icon={<Keyboard size={14} />}
              label="Keyboard Shortcuts"
              onClick={() => setSection("keybindings")}
            />
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
            <div style={{
              fontSize: "15px", fontWeight: 600,
              color: "var(--r0-fg-default)",
              marginBottom: "14px",
            }}>
              {section === "general" ? "General" : section === "suggestions" ? "Editor · Suggestions" : section === "ai" ? "AI Providers" : section === "prompts" ? "System Prompts" : section === "appearance" ? "Appearance" : section === "keybindings" ? "Keyboard Shortcuts" : "Terminal"}
            </div>
            {section === "general"    && <GeneralSection />}
            {section === "suggestions" && <EditorSuggestionsSection />}
            {section === "ai"         && <AIProvidersSection />}
            {section === "prompts"    && <PromptsSection />}
            {section === "appearance" && <AppearanceSection />}
            {section === "terminal"      && <TerminalSection />}
            {section === "keybindings"  && <KeybindingsSection />}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
