import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { readBufferText } from "@/features/editor/services/buffer-text";
import { useBufferText } from "@/features/editor/hooks/use-buffer-text";
import { useBufferStore } from "@/features/editor/stores/buffer.store";
import AIChat from "@/features/ai/components/chat/ai-chat";
import { useAIChatStore } from "@/features/ai/stores/ai-chat.store";
import { EMPTY_CHAT_MESSAGES } from "@/features/ai/services/chat-normalization";
import { selectAgentSessions } from "@/features/ai/services/agent-session-list";
import { useOpenBuffersIgnoringText } from "@/features/editor/hooks/use-buffer-text";
import { PaneResizeHandle } from "@/features/panes/components/pane-resize-handle";
import { ChatBubbleTextIcon, CheckIcon, PaletteIcon, XIcon } from "@/ui/icons";
import { Button } from "@/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/ui/dropdown";
import { applyDiagramSourceEdit } from "../services/apply-diagram-source-edit";
import { exportDiagramFile } from "../services/diagram-export";
import { cancelMermaidRender, renderMermaidSvg } from "../services/mermaid-renderer";
import { useDiagramTheme } from "../hooks/use-diagram-theme";
import {
  getMermaidErrorMessage,
  getSequenceDiagramCorrection,
  getRenderableMermaidSource,
  needsSequenceDiagramDeclaration,
} from "../services/mermaid-source";
import { extractMermaidProposal } from "../services/diagram-document";
import {
  MERMAID_THEME_PRESETS,
  isMermaidThemePresetId,
  resolveMermaidThemePreset,
  type MermaidThemePresetId,
} from "../services/diagram-theme-presets";
import {
  calculateDiagramFitZoom,
  calculateDiagramPinchTransform,
  calculateDiagramZoomTransform,
  getDefaultDiagramWorkspacePreferences,
  getDiagramWheelZoomDelta,
  readDiagramDocumentPreferences,
  saveDiagramDocumentPreferences,
  saveDiagramWorkspacePreferences,
} from "../services/diagram-layout";

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4;

function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function getExportBaseName(filePath: string): string {
  const fileName = filePath.split(/[\\/]/).pop() || "diagram";
  const safeName = fileName.replace(/\.(mmd|mermaid)$/i, "").replace(/[<>:"/\\|?*]/g, "_");
  return (
    Array.from(safeName, (character) => (character.charCodeAt(0) < 32 ? "_" : character))
      .join("")
      .trim() || "diagram"
  );
}

async function createPngBlob(svg: string, background: string): Promise<Blob> {
  const svgUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("The SVG could not be rasterized."));
      image.src = svgUrl;
    });

    const sourceWidth = image.naturalWidth || 1200;
    const sourceHeight = image.naturalHeight || 900;
    const scale = Math.min(2, 4096 / sourceWidth, 4096 / sourceHeight);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.floor(sourceWidth * scale));
    canvas.height = Math.max(1, Math.floor(sourceHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("PNG export is unavailable in this environment.");
    context.fillStyle = background;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("The PNG image could not be created."));
      }, "image/png");
    });
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

export function DiagramPreview({
  bufferId,
  filePath,
  splitRatio,
}: {
  bufferId: string;
  filePath: string;
  splitRatio?: number;
}) {
  const source = useBufferText(bufferId, { debounceMs: 200 });
  const buffers = useOpenBuffersIgnoringText();
  const activeBuffer = buffers.find((buffer) => buffer.id === bufferId) ?? null;
  const renderOwnerId = useId();
  const theme = useDiagramTheme();
  const [themePreset, setThemePreset] = useState<MermaidThemePresetId>("mermaid-chart");
  const previewBackground = resolveMermaidThemePreset(themePreset, theme).backgroundColor;
  const [svg, setSvg] = useState("");
  const [renderError, setRenderError] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [zoom, setZoom] = useState(() => readDiagramDocumentPreferences(filePath).zoom);
  const [pan, setPan] = useState(() => {
    const preferences = readDiagramDocumentPreferences(filePath);
    return { x: preferences.panX, y: preferences.panY };
  });
  const [assistantExpanded, setAssistantExpanded] = useState(
    () => readDiagramDocumentPreferences(filePath).assistantExpanded,
  );
  const [stackAssistantPanel, setStackAssistantPanel] = useState(false);
  const [assistantRatio, setAssistantRatio] = useState(
    () => readDiagramDocumentPreferences(filePath).assistantRatio,
  );
  const [assistantChatId, setAssistantChatId] = useState(
    () => readDiagramDocumentPreferences(filePath).assistantChatId,
  );
  const chatSessions = useAIChatStore((state) => state.chats);
  const conversationHistory = useMemo(
    () =>
      selectAgentSessions(chatSessions, {
        anyWorkspace: true,
        includeArchived: true,
        keepIds: [assistantChatId],
      }).filter((chat) => chat.title.startsWith("Mermaid:") || chat.id === assistantChatId),
    [assistantChatId, chatSessions],
  );
  const assistantMessages = useAIChatStore(
    (state) => state.messagesByChat[assistantChatId ?? ""] ?? EMPTY_CHAT_MESSAGES,
  );
  const [dismissedProposalId, setDismissedProposalId] = useState<string | null>(null);
  const [appliedProposalId, setAppliedProposalId] = useState<string | null>(null);
  const [proposalError, setProposalError] = useState<string | null>(null);
  const creatingAssistantChatRef = useRef<string | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const previewLayoutRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const svgContainerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    x: number;
    y: number;
    panX: number;
    panY: number;
    lastPanX: number;
    lastPanY: number;
  } | null>(null);
  const spacePressedRef = useRef(false);
  const initialDocumentPreferencesRef = useRef(readDiagramDocumentPreferences(filePath));
  const fitToViewportRef = useRef(
    initialDocumentPreferencesRef.current.fitToViewport ||
      initialDocumentPreferencesRef.current.viewportWidth <= 0 ||
      initialDocumentPreferencesRef.current.viewportHeight <= 0,
  );
  const restoreViewportRef = useRef(
    !initialDocumentPreferencesRef.current.fitToViewport &&
      initialDocumentPreferencesRef.current.viewportWidth > 0 &&
      initialDocumentPreferencesRef.current.viewportHeight > 0,
  );
  const savedViewportSizeRef = useRef({
    width: initialDocumentPreferencesRef.current.viewportWidth,
    height: initialDocumentPreferencesRef.current.viewportHeight,
  });
  const viewportTransformRef = useRef({ zoom, pan });
  viewportTransformRef.current = { zoom, pan };
  const gestureStartRef = useRef<{
    zoom: number;
    pan: { x: number; y: number };
  } | null>(null);
  const previousSourceRef = useRef(source);
  const touchPinchStartRef = useRef<{
    zoom: number;
    pan: { x: number; y: number };
    distance: number;
    center: { x: number; y: number };
  } | null>(null);
  const touchPointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pendingPreferenceRef = useRef<Partial<ReturnType<typeof readDiagramDocumentPreferences>>>(
    {},
  );
  const preferenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const baseName = getExportBaseName(filePath);
  const renderKey = `diagram-preview:${renderOwnerId}`;
  const canFixSequenceDeclaration = needsSequenceDiagramDeclaration(source);
  const latestMessage = assistantMessages[assistantMessages.length - 1];
  const proposalSource =
    latestMessage?.role === "assistant" && !latestMessage.isStreaming
      ? extractMermaidProposal(latestMessage.content)
      : null;
  const proposalMessageId =
    proposalSource && latestMessage?.role === "assistant" ? latestMessage.id : null;

  const renderMermaidProposal = useCallback(
    (messageId: string) => {
      if (!proposalSource || !proposalMessageId || messageId !== proposalMessageId) return null;
      const isProposalApplied = messageId === appliedProposalId || proposalSource === source.trim();
      if (messageId === dismissedProposalId || (isProposalApplied && !proposalError)) return null;

      return (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-divider bg-surface p-2">
          {!isProposalApplied ? (
            <p className="mr-auto text-muted-foreground ui-text-caption">
              Mermaid proposal ready. Keep it to update the source and preview.
            </p>
          ) : null}
          {proposalError ? (
            <p role="alert" className="basis-full text-destructive ui-text-caption">
              {proposalError}
            </p>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="accent"
            onClick={() => {
              const currentBuffer = useBufferStore
                .getState()
                .buffers.find((buffer) => buffer.id === bufferId);
              if (!currentBuffer || currentBuffer.type !== "editor" || currentBuffer.readOnly) {
                setProposalError("This Mermaid diagram is no longer editable.");
                return;
              }
              if (!isProposalApplied && readBufferText(currentBuffer) !== source) {
                setProposalError(
                  "The diagram changed while this proposal was waiting. Ask for a new proposal.",
                );
                return;
              }
              if (!isProposalApplied) {
                if (!applyDiagramSourceEdit(bufferId, proposalSource)) {
                  setProposalError("Could not apply the Mermaid proposal.");
                  return;
                }
                setAppliedProposalId(messageId);
              }
              if (!useBufferStore.getState().actions.persistEditorSessionDraft(bufferId)) {
                setProposalError("Could not keep this Mermaid diagram in the workspace.");
                return;
              }
              setProposalError(null);
              setDismissedProposalId(messageId);
            }}
          >
            <CheckIcon />
            {isProposalApplied ? "Keep diagram" : "Keep changes"}
          </Button>
          {!isProposalApplied ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setProposalError(null);
                setDismissedProposalId(messageId);
              }}
            >
              <XIcon />
              Undo
            </Button>
          ) : null}
        </div>
      );
    },
    [
      appliedProposalId,
      bufferId,
      dismissedProposalId,
      proposalError,
      proposalMessageId,
      proposalSource,
      source,
    ],
  );

  const persistDocumentPreferences = useCallback(
    (changes: Partial<ReturnType<typeof readDiagramDocumentPreferences>>) => {
      const viewport = canvasRef.current?.getBoundingClientRect();
      pendingPreferenceRef.current = {
        ...pendingPreferenceRef.current,
        ...(viewport
          ? {
              viewportWidth: viewport.width,
              viewportHeight: viewport.height,
            }
          : {}),
        ...changes,
      };
      if (preferenceTimerRef.current !== null) clearTimeout(preferenceTimerRef.current);
      preferenceTimerRef.current = setTimeout(() => {
        preferenceTimerRef.current = null;
        const pending = pendingPreferenceRef.current;
        pendingPreferenceRef.current = {};
        saveDiagramDocumentPreferences(filePath, pending);
      }, 300);
    },
    [filePath],
  );

  useEffect(
    () => () => {
      if (preferenceTimerRef.current !== null) {
        clearTimeout(preferenceTimerRef.current);
        preferenceTimerRef.current = null;
        saveDiagramDocumentPreferences(filePath, pendingPreferenceRef.current);
        pendingPreferenceRef.current = {};
      }
    },
    [filePath],
  );

  useEffect(() => {
    const preferences = readDiagramDocumentPreferences(filePath);
    fitToViewportRef.current = preferences.fitToViewport;
    savedViewportSizeRef.current = {
      width: preferences.viewportWidth,
      height: preferences.viewportHeight,
    };
    restoreViewportRef.current =
      !preferences.fitToViewport && preferences.viewportWidth > 0 && preferences.viewportHeight > 0;
    setZoom(preferences.zoom);
    setPan({ x: preferences.panX, y: preferences.panY });
    setAssistantExpanded(preferences.assistantExpanded);
    setAssistantRatio(preferences.assistantRatio);
    setAssistantChatId(preferences.assistantChatId);
  }, [filePath]);

  useEffect(() => {
    const container = previewLayoutRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setStackAssistantPanel(entry.contentRect.width < 720);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (assistantChatId || creatingAssistantChatRef.current === filePath) return;
    creatingAssistantChatRef.current = filePath;
    const chatStore = useAIChatStore.getState();
    const agentId =
      chatStore.lastSelectedAgentId ??
      chatStore.actions.getCurrentAgentId() ??
      chatStore.selectedAgentId;
    const chatId = chatStore.actions.createNewChat(agentId, {
      activate: false,
      reuseEmpty: false,
      rememberAgent: false,
    });
    const diagramName = filePath.split(/[\\/]/).pop() || "Diagram";
    chatStore.actions.updateChatTitle(chatId, `Mermaid: ${diagramName}`);
    setAssistantChatId(chatId);
    saveDiagramDocumentPreferences(filePath, { assistantChatId: chatId });
  }, [assistantChatId, filePath]);

  const selectMermaidConversation = useCallback(
    (chatId: string) => {
      setAssistantChatId(chatId);
      saveDiagramDocumentPreferences(filePath, { assistantChatId: chatId });
    },
    [filePath],
  );

  const deleteMermaidConversation = useCallback(
    (chatId: string) => {
      useAIChatStore.getState().actions.deleteChat(chatId);
      if (chatId === assistantChatId) {
        creatingAssistantChatRef.current = null;
        setAssistantChatId(null);
        saveDiagramDocumentPreferences(filePath, { assistantChatId: null });
      }
    },
    [assistantChatId, filePath],
  );

  const zoomAtPoint = useCallback(
    (nextZoomValue: number, clientX?: number, clientY?: number) => {
      const nextZoom = clampZoom(nextZoomValue);
      if (nextZoom === zoom) return;
      const rect = canvasRef.current?.getBoundingClientRect();
      const bounds = rect ?? { left: 0, top: 0, width: 0, height: 0 };
      const transform = calculateDiagramZoomTransform(
        { zoom, panX: pan.x, panY: pan.y },
        nextZoom,
        {
          x: clientX ?? bounds.left + bounds.width / 2,
          y: clientY ?? bounds.top + bounds.height / 2,
        },
        bounds,
      );
      const nextPan = { x: transform.panX, y: transform.panY };
      fitToViewportRef.current = false;
      setZoom(transform.zoom);
      setPan(nextPan);
      persistDocumentPreferences({
        zoom: transform.zoom,
        panX: nextPan.x,
        panY: nextPan.y,
        fitToViewport: false,
      });
    },
    [pan, persistDocumentPreferences, zoom],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleGestureStart = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      const current = viewportTransformRef.current;
      gestureStartRef.current = { zoom: current.zoom, pan: { ...current.pan } };
    };
    const handleGestureChange = (event: Event) => {
      const gesture = event as Event & {
        scale?: number;
        clientX?: number;
        clientY?: number;
      };
      const start = gestureStartRef.current;
      if (!start || typeof gesture.scale !== "number") return;
      event.preventDefault();
      event.stopPropagation();
      const rect = canvas.getBoundingClientRect();
      const transform = calculateDiagramZoomTransform(
        { zoom: start.zoom, panX: start.pan.x, panY: start.pan.y },
        start.zoom * gesture.scale,
        {
          x: gesture.clientX ?? rect.left + rect.width / 2,
          y: gesture.clientY ?? rect.top + rect.height / 2,
        },
        rect,
      );
      fitToViewportRef.current = false;
      setZoom(transform.zoom);
      setPan({ x: transform.panX, y: transform.panY });
      persistDocumentPreferences({
        zoom: transform.zoom,
        panX: transform.panX,
        panY: transform.panY,
        fitToViewport: false,
      });
    };
    const handleGestureEnd = () => {
      gestureStartRef.current = null;
    };

    canvas.addEventListener("gesturestart", handleGestureStart, { passive: false });
    canvas.addEventListener("gesturechange", handleGestureChange, { passive: false });
    canvas.addEventListener("gestureend", handleGestureEnd);
    return () => {
      canvas.removeEventListener("gesturestart", handleGestureStart);
      canvas.removeEventListener("gesturechange", handleGestureChange);
      canvas.removeEventListener("gestureend", handleGestureEnd);
      gestureStartRef.current = null;
    };
  }, [persistDocumentPreferences]);

  const panBy = useCallback(
    (deltaX: number, deltaY: number) => {
      fitToViewportRef.current = false;
      setPan((current) => {
        const nextPan = { x: current.x + deltaX, y: current.y + deltaY };
        persistDocumentPreferences({
          panX: nextPan.x,
          panY: nextPan.y,
          fitToViewport: false,
        });
        return nextPan;
      });
    },
    [persistDocumentPreferences],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (gestureStartRef.current) return;

      const zoomDelta = getDiagramWheelZoomDelta(event);
      if (zoomDelta !== null) {
        const current = viewportTransformRef.current;
        const rect = canvas.getBoundingClientRect();
        const transform = calculateDiagramZoomTransform(
          { zoom: current.zoom, panX: current.pan.x, panY: current.pan.y },
          current.zoom * Math.exp(-zoomDelta * 0.002),
          { x: event.clientX, y: event.clientY },
          rect,
        );
        fitToViewportRef.current = false;
        setZoom(transform.zoom);
        setPan({ x: transform.panX, y: transform.panY });
        persistDocumentPreferences({
          zoom: transform.zoom,
          panX: transform.panX,
          panY: transform.panY,
          fitToViewport: false,
        });
        return;
      }

      fitToViewportRef.current = false;
      panBy(-event.deltaX, -event.deltaY);
    };

    canvas.addEventListener("wheel", handleWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", handleWheel);
  }, [panBy, persistDocumentPreferences]);

  const fitDiagram = useCallback(() => {
    const viewport = canvasRef.current;
    const renderedSvg = svgContainerRef.current?.querySelector("svg");
    if (!viewport || !renderedSvg) return;

    const viewBox = renderedSvg.viewBox.baseVal;
    const width = viewBox.width || renderedSvg.width.baseVal.value;
    const height = viewBox.height || renderedSvg.height.baseVal.value;
    if (!width || !height) return;

    renderedSvg.style.width = `${width}px`;
    renderedSvg.style.height = `${height}px`;
    renderedSvg.style.maxWidth = "none";
    const fittedZoom = calculateDiagramFitZoom(
      width,
      height,
      viewport.clientWidth,
      viewport.clientHeight,
    );
    setZoom(fittedZoom);
    setPan({ x: 0, y: 0 });
  }, []);

  const restoreSavedViewport = useCallback(() => {
    if (!restoreViewportRef.current || !svgContainerRef.current?.querySelector("svg")) return;
    const viewport = canvasRef.current?.getBoundingClientRect();
    const savedSize = savedViewportSizeRef.current;
    if (!viewport || !savedSize.width || !savedSize.height || !viewport.width || !viewport.height)
      return;
    setPan((current) => ({
      x: current.x * (viewport.width / savedSize.width),
      y: current.y * (viewport.height / savedSize.height),
    }));
    restoreViewportRef.current = false;
  }, []);

  useEffect(() => {
    if (fitToViewportRef.current) fitDiagram();
    else restoreSavedViewport();
  }, [fitDiagram, restoreSavedViewport, svg]);

  useEffect(() => {
    const viewport = canvasRef.current;
    if (!viewport || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (fitToViewportRef.current) fitDiagram();
      else restoreSavedViewport();
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [fitDiagram, restoreSavedViewport]);

  useEffect(() => {
    if (!source.trim()) {
      setSvg("");
      setRenderError(null);
      setIsRendering(false);
      return;
    }

    let cancelled = false;
    setIsRendering(true);
    setRenderError(null);
    void renderMermaidSvg(source, renderKey, theme, themePreset)
      .then((renderedSvg) => {
        if (!cancelled) setSvg(renderedSvg);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setSvg("");
          setRenderError(getMermaidErrorMessage(error, getRenderableMermaidSource(source)));
        }
      })
      .finally(() => {
        if (!cancelled) setIsRendering(false);
      });

    return () => {
      cancelled = true;
      cancelMermaidRender(renderKey);
    };
  }, [renderKey, source, theme, themePreset]);

  useEffect(() => {
    if (previousSourceRef.current === source) return;
    previousSourceRef.current = source;
    if (!source.trim()) return;
    fitToViewportRef.current = true;
    restoreViewportRef.current = false;
    persistDocumentPreferences({ fitToViewport: true });
  }, [persistDocumentPreferences, source]);

  useEffect(
    () => () => {
      spacePressedRef.current = false;
    },
    [bufferId],
  );

  useEffect(() => {
    const resetSpace = () => {
      spacePressedRef.current = false;
    };
    window.addEventListener("blur", resetSpace);
    return () => window.removeEventListener("blur", resetSpace);
  }, []);

  const handleExportSvg = async () => {
    if (!svg || isExporting) return;
    setExportError(null);
    setIsExporting(true);
    try {
      await exportDiagramFile({ format: "svg", contents: svg, defaultPath: `${baseName}.svg` });
    } catch (error) {
      setExportError(errorMessage(error, "Unable to export the SVG."));
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPng = async () => {
    if (!svg || isExporting) return;
    setExportError(null);
    setIsExporting(true);
    try {
      const blob = await createPngBlob(svg, previewBackground);
      await exportDiagramFile({
        format: "png",
        contents: new Uint8Array(await blob.arrayBuffer()),
        defaultPath: `${baseName}.png`,
      });
    } catch (error) {
      setExportError(errorMessage(error, "Unable to export the PNG."));
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopySource = async () => {
    try {
      await navigator.clipboard.writeText(source);
      setExportError(null);
    } catch (error) {
      setExportError(errorMessage(error, "Unable to copy the Mermaid source."));
    }
  };

  const handleInsertSequenceDeclaration = () => {
    const buffer = useBufferStore.getState().buffers.find((item) => item.id === bufferId);
    if (!buffer || buffer.type !== "editor") {
      setRenderError("The diagram is no longer open.");
      return;
    }

    const currentSource = readBufferText(buffer);
    const correctedSource = getSequenceDiagramCorrection(currentSource);
    if (!correctedSource) {
      setRenderError(
        "The diagram changed. Review its current source before applying a correction.",
      );
      return;
    }

    if (!applyDiagramSourceEdit(bufferId, correctedSource)) {
      setRenderError("The diagram is read-only and cannot be changed.");
      return;
    }
    setRenderError(null);
  };

  return (
    <section
      className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background text-foreground ${splitRatio === undefined ? "" : "basis-0"}`}
      aria-label="Diagram preview"
      style={splitRatio === undefined ? undefined : { flex: `${splitRatio} 1 0%` }}
    >
      <header className="flex min-h-chrome-control shrink-0 flex-wrap items-center justify-between gap-2 border-divider border-b bg-surface px-3 py-1 text-foreground">
        <div className="flex items-center gap-2">
          <span className="font-sans ui-text-sm">Mermaid preview</span>
          <span className="text-muted-foreground ui-text-caption" aria-live="polite">
            {Math.round(zoom * 100)}%
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label="Select Mermaid theme"
                  title={`Mermaid theme: ${MERMAID_THEME_PRESETS.find((preset) => preset.id === themePreset)?.label ?? "Mermaid Chart"}`}
                />
              }
            >
              <PaletteIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <div className="px-2 py-1 font-sans font-medium text-subtle-foreground ui-text-caption">
                Themes
              </div>
              <DropdownMenuRadioGroup
                value={themePreset}
                onValueChange={(value) => {
                  if (isMermaidThemePresetId(value)) setThemePreset(value);
                }}
              >
                {MERMAID_THEME_PRESETS.map(({ id, label }) => (
                  <DropdownMenuRadioItem key={id} value={id} closeOnClick>
                    {label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            size="sm"
            variant="ghost"
            aria-label="Zoom out"
            title="Zoom out"
            disabled={!svg}
            onClick={() => zoomAtPoint(zoom / 1.2)}
          >
            −
          </Button>
          <Button
            size="sm"
            variant="ghost"
            aria-label="Zoom in"
            title="Zoom in"
            disabled={!svg}
            onClick={() => zoomAtPoint(zoom * 1.2)}
          >
            +
          </Button>
          <Button
            size="sm"
            variant="ghost"
            aria-label="Fit diagram to canvas"
            title="Fit diagram to canvas"
            disabled={!svg}
            onClick={() => {
              fitToViewportRef.current = true;
              persistDocumentPreferences({ fitToViewport: true });
              fitDiagram();
            }}
          >
            Fit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            aria-label="Center diagram"
            title="Center diagram"
            disabled={!svg}
            onClick={() => {
              fitToViewportRef.current = false;
              setPan({ x: 0, y: 0 });
              persistDocumentPreferences({ panX: 0, panY: 0, fitToViewport: false });
            }}
          >
            Center
          </Button>
          <Button
            size="sm"
            variant="ghost"
            aria-label="Reset zoom"
            title="Reset zoom"
            disabled={!svg}
            onClick={() => {
              fitToViewportRef.current = false;
              setZoom(1);
              setPan({ x: 0, y: 0 });
              persistDocumentPreferences({
                zoom: 1,
                panX: 0,
                panY: 0,
                fitToViewport: false,
              });
            }}
          >
            Reset
          </Button>
          <Button
            size="sm"
            variant="ghost"
            aria-label="Copy Mermaid source"
            disabled={!source}
            onClick={() => void handleCopySource()}
          >
            Copy source
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={!svg || isExporting}
            onClick={() => void handleExportSvg()}
          >
            {isExporting ? "Exporting…" : "Export SVG"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={!svg || isExporting}
            onClick={() => void handleExportPng()}
          >
            {isExporting ? "Exporting…" : "Export PNG"}
          </Button>
        </div>
      </header>
      {exportError && (
        <div className="shrink-0 border-divider border-b px-3 py-2">
          <p role="alert" className="whitespace-pre-wrap text-destructive ui-text-sm">
            {exportError}
          </p>
        </div>
      )}
      <div
        ref={previewLayoutRef}
        className={`flex min-h-0 min-w-0 flex-1 ${stackAssistantPanel ? "flex-col" : "flex-row"}`}
        data-pane-split-container="true"
      >
        <div
          ref={canvasRef}
          className={`relative min-h-0 min-w-0 overflow-hidden bg-background ${assistantExpanded ? "basis-0" : "flex-1"}`}
          role="group"
          aria-label="Diagram canvas; use the wheel to pan, Control or Command plus wheel to zoom, or middle-button or Space-drag to pan"
          tabIndex={svg ? 0 : -1}
          onPointerDown={(event) => {
            if (event.pointerType === "touch") {
              event.preventDefault();
              event.currentTarget.setPointerCapture(event.pointerId);
              touchPointersRef.current.set(event.pointerId, {
                x: event.clientX,
                y: event.clientY,
              });
              if (touchPointersRef.current.size === 2) {
                const [first, second] = Array.from(touchPointersRef.current.values());
                if (!first || !second) return;
                const current = viewportTransformRef.current;
                touchPinchStartRef.current = {
                  zoom: current.zoom,
                  pan: { ...current.pan },
                  distance: Math.hypot(second.x - first.x, second.y - first.y),
                  center: { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 },
                };
              }
              return;
            }
            if (event.button !== 1 && !(event.button === 0 && spacePressedRef.current)) return;
            event.preventDefault();
            dragRef.current = {
              x: event.clientX,
              y: event.clientY,
              panX: pan.x,
              panY: pan.y,
              lastPanX: pan.x,
              lastPanY: pan.y,
            };
            setIsPanning(true);
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (event.pointerType === "touch" && touchPointersRef.current.has(event.pointerId)) {
              event.preventDefault();
              touchPointersRef.current.set(event.pointerId, {
                x: event.clientX,
                y: event.clientY,
              });
              const start = touchPinchStartRef.current;
              if (!start || touchPointersRef.current.size !== 2) return;
              const [first, second] = Array.from(touchPointersRef.current.values());
              if (!first || !second) return;
              const transform = calculateDiagramPinchTransform(
                { zoom: start.zoom, panX: start.pan.x, panY: start.pan.y },
                start.distance,
                Math.hypot(second.x - first.x, second.y - first.y),
                start.center,
                { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 },
                canvasRef.current?.getBoundingClientRect() ?? {
                  left: 0,
                  top: 0,
                  width: 0,
                  height: 0,
                },
              );
              fitToViewportRef.current = false;
              setZoom(transform.zoom);
              setPan({ x: transform.panX, y: transform.panY });
              persistDocumentPreferences({
                zoom: transform.zoom,
                panX: transform.panX,
                panY: transform.panY,
                fitToViewport: false,
              });
              return;
            }
            const drag = dragRef.current;
            if (!drag) return;
            fitToViewportRef.current = false;
            const nextPan = {
              x: drag.panX + event.clientX - drag.x,
              y: drag.panY + event.clientY - drag.y,
            };
            drag.lastPanX = nextPan.x;
            drag.lastPanY = nextPan.y;
            setPan(nextPan);
          }}
          onPointerUp={(event) => {
            if (event.pointerType === "touch") {
              touchPointersRef.current.delete(event.pointerId);
              touchPinchStartRef.current = null;
              return;
            }
            const drag = dragRef.current;
            if (!drag) return;
            dragRef.current = null;
            setIsPanning(false);
            persistDocumentPreferences({
              panX: drag.lastPanX,
              panY: drag.lastPanY,
              fitToViewport: false,
            });
          }}
          onPointerCancel={(event) => {
            if (event.pointerType === "touch") {
              touchPointersRef.current.delete(event.pointerId);
              touchPinchStartRef.current = null;
              return;
            }
            dragRef.current = null;
            setIsPanning(false);
          }}
          onLostPointerCapture={(event) => {
            if (event.pointerType === "touch") {
              touchPointersRef.current.delete(event.pointerId);
              touchPinchStartRef.current = null;
              return;
            }
            dragRef.current = null;
            setIsPanning(false);
          }}
          onKeyDown={(event) => {
            const movement = 40;
            if (event.key === " ") {
              event.preventDefault();
              spacePressedRef.current = true;
            } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
              event.preventDefault();
              panBy(event.key === "ArrowLeft" ? movement : -movement, 0);
            } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
              event.preventDefault();
              panBy(0, event.key === "ArrowUp" ? movement : -movement);
            } else if (event.key === "+" || event.key === "=") {
              event.preventDefault();
              zoomAtPoint(zoom * 1.2);
            } else if (event.key === "-") {
              event.preventDefault();
              zoomAtPoint(zoom / 1.2);
            } else if (event.key === "Home") {
              event.preventDefault();
              fitToViewportRef.current = false;
              setPan({ x: 0, y: 0 });
              persistDocumentPreferences({ panX: 0, panY: 0, fitToViewport: false });
            }
          }}
          onKeyUp={(event) => {
            if (event.key === " ") spacePressedRef.current = false;
          }}
          style={{
            touchAction: "none",
            overscrollBehavior: "contain",
            cursor: isPanning ? "grabbing" : "grab",
            backgroundColor: previewBackground,
            ...(assistantExpanded ? { flex: `${100 - assistantRatio} 1 0%` } : {}),
          }}
        >
          {isRendering ? (
            <p
              role="status"
              className="absolute inset-0 grid place-items-center bg-background text-muted-foreground ui-text-sm"
            >
              Rendering diagram…
            </p>
          ) : renderError ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background p-4 text-center">
              <p
                role="alert"
                className="max-w-prose whitespace-pre-wrap text-destructive ui-text-sm"
              >
                {renderError}
              </p>
              {canFixSequenceDeclaration ? (
                <Button size="sm" variant="accent" onClick={handleInsertSequenceDeclaration}>
                  Insert sequenceDiagram declaration
                </Button>
              ) : null}
            </div>
          ) : svg ? (
            <div
              className="absolute top-1/2 left-1/2 [&_svg]:block"
              style={{
                transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${zoom})`,
                transformOrigin: "center",
              }}
              ref={svgContainerRef}
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          ) : (
            <p className="absolute inset-0 grid place-items-center p-4 text-center text-muted-foreground ui-text-sm">
              Add Mermaid source to see a live preview.
            </p>
          )}
        </div>
        {assistantExpanded ? (
          <PaneResizeHandle
            direction={stackAssistantPanel ? "vertical" : "horizontal"}
            initialSizes={[100 - assistantRatio, assistantRatio]}
            resizeHandleCount={1}
            onReset={() => {
              const defaults = getDefaultDiagramWorkspacePreferences();
              setAssistantRatio(defaults.assistantRatio);
              saveDiagramWorkspacePreferences({ assistantRatio: defaults.assistantRatio });
            }}
            onResize={([, assistantShare]) => {
              const preferences = saveDiagramWorkspacePreferences({
                assistantRatio: assistantShare,
              });
              setAssistantRatio(preferences.assistantRatio);
              persistDocumentPreferences({ assistantRatio: preferences.assistantRatio });
            }}
          />
        ) : null}
        <section
          aria-label="Mermaid AI"
          className={`min-h-0 min-w-0 border-divider bg-surface text-foreground ${assistantExpanded ? `flex basis-0 flex-col ${stackAssistantPanel ? "border-t" : "border-l"}` : `${stackAssistantPanel ? "h-workbench" : "w-workbench"} shrink-0 ${stackAssistantPanel ? "border-t" : "border-l"}`}`}
          style={assistantExpanded ? { flex: `${assistantRatio} 1 0%` } : undefined}
        >
          <button
            type="button"
            aria-expanded={assistantExpanded}
            title={assistantExpanded ? "Collapse Mermaid AI" : "Expand Mermaid AI"}
            className={`flex cursor-pointer items-center gap-2 text-left font-sans text-foreground outline-none focus-visible:ring-2 focus-visible:ring-focus ${assistantExpanded ? "w-full px-3 py-2 ui-text-sm" : "h-full w-full flex-col px-2 py-3 ui-text-caption"}`}
            onClick={() => {
              const nextExpanded = !assistantExpanded;
              setAssistantExpanded(nextExpanded);
              saveDiagramWorkspacePreferences({ assistantExpanded: nextExpanded });
              persistDocumentPreferences({ assistantExpanded: nextExpanded });
            }}
          >
            <ChatBubbleTextIcon className="size-4 shrink-0" />
            {assistantExpanded ? <span>Mermaid AI</span> : null}
            <span
              className={`${assistantExpanded ? "ml-auto text-muted-foreground ui-text-caption" : "[writing-mode:vertical-rl] rotate-180 text-muted-foreground ui-text-caption"}`}
            >
              {assistantExpanded ? "Collapse" : "Expand"}
            </span>
          </button>
          {assistantExpanded ? (
            assistantChatId ? (
              <AIChat
                mode="chat"
                surfaceId={`mermaid-diagram:${bufferId}`}
                chatId={assistantChatId}
                conversationHistory={conversationHistory}
                onSelectConversation={selectMermaidConversation}
                onDeleteConversation={deleteMermaidConversation}
                activeBuffer={activeBuffer}
                buffers={buffers}
                initialContextBufferIds={[bufferId]}
                taskInstructions={[
                  "You are the Mermaid diagram assistant for the open Mermaid document.",
                  "Help only with creating, editing, explaining, validating, and improving Mermaid diagrams and their visual presentation.",
                  "If asked about unrelated coding or general tasks, briefly explain that this panel is for Mermaid diagrams and redirect the user to the regular AI Chat.",
                  "Never directly edit or save the diagram. For a requested change, respond with a complete proposed Mermaid source in exactly one fenced ```mermaid code block. The user reviews it with Keep changes or Undo before it is applied.",
                  "Do not edit other files, run commands, or perform unrelated workspace actions.",
                  "The user may attach screenshots or other images as visual references; use them only to help create or improve the Mermaid diagram.",
                ].join("\n")}
                renderMessageAddon={renderMermaidProposal}
                className="min-h-0 flex-1"
              />
            ) : (
              <p
                role="status"
                className="grid min-h-0 flex-1 place-items-center text-muted-foreground ui-text-sm"
              >
                Preparing Mermaid chat…
              </p>
            )
          ) : null}
        </section>
      </div>
    </section>
  );
}
