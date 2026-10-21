import {
  createContext,
  createElement,
  forwardRef,
  useContext,
  type ComponentType,
  type CSSProperties,
  type ForwardRefExoticComponent,
  type RefAttributes,
  type SVGProps,
} from "react";
import * as Lucide from "lucide-react";

export type IconOptical = "sm" | "md" | "lg";

const OPTICAL_STROKE: Record<IconOptical, string> = {
  sm: "1.25px",
  md: "1.5px",
  lg: "2px",
};

const OPTICAL_MD_MIN_SIZE = 20;
const OPTICAL_LG_MIN_SIZE = 28;

export type IconProps = Omit<SVGProps<SVGSVGElement>, "strokeWidth"> & {
  size?: number | string;
  optical?: IconOptical;
  mirrored?: boolean;
  title?: string;
  filled?: boolean;
};

export type Icon = ForwardRefExoticComponent<Omit<IconProps, "ref"> & RefAttributes<SVGSVGElement>>;

export const IconContext = createContext<Partial<IconProps>>({});

function opticalForSize(size: IconProps["size"]): IconOptical {
  if (typeof size !== "number") return "sm";
  if (size >= OPTICAL_LG_MIN_SIZE) return "lg";
  if (size >= OPTICAL_MD_MIN_SIZE) return "md";
  return "sm";
}

const LucideIcons = Lucide as unknown as Record<string, ComponentType<any>>;

function createIconComponent(IconComponent: ComponentType<any>, displayName: string): Icon {
  const Wrapped = forwardRef<SVGSVGElement, IconProps>(function R0Icon(props, ref) {
    const context = useContext(IconContext);
    const {
      filled,
      mirrored,
      optical,
      size = "1em",
      style,
      title,
      ...iconProps
    } = { ...context, ...props };

    const nextStyle = {
      ...style,
      "--icon-stroke": OPTICAL_STROKE[optical ?? opticalForSize(size)],
      ...(mirrored
        ? { transform: [style?.transform, "scaleX(-1)"].filter(Boolean).join(" ") }
        : null),
    } as CSSProperties;

    return createElement(IconComponent, {
      ...iconProps,
      "data-r0-icon": "",
      ...(filled ? { "data-r0-filled": "" } : {}),
      ref,
      size,
      style: nextStyle,
      title,
    });
  });

  Wrapped.displayName = displayName;
  return Wrapped as Icon;
}

export const ActivityIcon = createIconComponent(LucideIcons["Activity"], "ActivityIcon");
export const ArchiveIcon = createIconComponent(LucideIcons["Archive"], "ArchiveIcon");
export const ArrowClockwiseIcon = createIconComponent(
  LucideIcons["RotateCw"],
  "ArrowClockwiseIcon",
);
export const ArrowCornerDownLeftIcon = createIconComponent(
  LucideIcons["CornerDownLeft"],
  "ArrowCornerDownLeftIcon",
);
export const ArrowCounterClockwiseIcon = createIconComponent(
  LucideIcons["RotateCcw"],
  "ArrowCounterClockwiseIcon",
);
export const ArrowDownIcon = createIconComponent(LucideIcons["ArrowDown"], "ArrowDownIcon");
export const ArrowDownToLineIcon = createIconComponent(
  LucideIcons["ArrowDownToLine"],
  "ArrowDownToLineIcon",
);
export const ArrowLeftIcon = createIconComponent(LucideIcons["ArrowLeft"], "ArrowLeftIcon");
export const ArrowRightIcon = createIconComponent(LucideIcons["ArrowRight"], "ArrowRightIcon");
export const ArrowUpIcon = createIconComponent(LucideIcons["ArrowUp"], "ArrowUpIcon");
export const ArrowsClockwiseIcon = createIconComponent(
  LucideIcons["RefreshCw"],
  "ArrowsClockwiseIcon",
);
export const ArrowsInIcon = createIconComponent(LucideIcons["Minimize2"], "ArrowsInIcon");
export const ArrowsLeftRightIcon = createIconComponent(
  LucideIcons["ArrowLeftRight"],
  "ArrowsLeftRightIcon",
);
export const ArrowsOutIcon = createIconComponent(LucideIcons["Maximize2"], "ArrowsOutIcon");
export const BellIcon = createIconComponent(LucideIcons["Bell"], "BellIcon");
export const BoltIcon = createIconComponent(LucideIcons["Bolt"], "BoltIcon");
export const BoltSlashIcon = createIconComponent(LucideIcons["ZapOff"], "BoltSlashIcon");
export const BookOpenIcon = createIconComponent(LucideIcons["BookOpen"], "BookOpenIcon");
export const BracketsCurlyIcon = createIconComponent(LucideIcons["Braces"], "BracketsCurlyIcon");
export const BrainIcon = createIconComponent(LucideIcons["Brain"], "BrainIcon");
export const BroadcastIcon = createIconComponent(LucideIcons["Radio"], "BroadcastIcon");
export const BugIcon = createIconComponent(LucideIcons["Bug"], "BugIcon");
export const CalendarIcon = createIconComponent(LucideIcons["Calendar"], "CalendarIcon");
export const CaseSensitiveIcon = createIconComponent(
  LucideIcons["CaseSensitive"],
  "CaseSensitiveIcon",
);
export const ChatBubbleTextIcon = createIconComponent(
  LucideIcons["MessageSquareText"],
  "ChatBubbleTextIcon",
);
export const CheckCircleIcon = createIconComponent(LucideIcons["CheckCircle"], "CheckCircleIcon");
export const CheckIcon = createIconComponent(LucideIcons["Check"], "CheckIcon");
export const ChevronDoubleLeftIcon = createIconComponent(
  LucideIcons["ChevronsLeft"],
  "ChevronDoubleLeftIcon",
);
export const ChevronDoubleRightIcon = createIconComponent(
  LucideIcons["ChevronsRight"],
  "ChevronDoubleRightIcon",
);
export const ChevronDoubleUpIcon = createIconComponent(
  LucideIcons["ChevronsUp"],
  "ChevronDoubleUpIcon",
);
export const ChevronDownIcon = createIconComponent(LucideIcons["ChevronDown"], "ChevronDownIcon");
export const ChevronExpandYIcon = createIconComponent(
  LucideIcons["ChevronsUpDown"],
  "ChevronExpandYIcon",
);
export const ChevronLeftIcon = createIconComponent(LucideIcons["ChevronLeft"], "ChevronLeftIcon");
export const ChevronRightIcon = createIconComponent(
  LucideIcons["ChevronRight"],
  "ChevronRightIcon",
);
export const ChevronUpIcon = createIconComponent(LucideIcons["ChevronUp"], "ChevronUpIcon");
export const CircleDotIcon = createIconComponent(LucideIcons["CircleDot"], "CircleDotIcon");
export const CircleDottedIcon = createIconComponent(
  LucideIcons["CircleDashed"],
  "CircleDottedIcon",
);
export const CirclesIcon = createIconComponent(LucideIcons["Blend"], "CirclesIcon");
export const ClickIcon = createIconComponent(LucideIcons["MousePointerClick"], "ClickIcon");
export const ClipboardIcon = createIconComponent(LucideIcons["Clipboard"], "ClipboardIcon");
export const BroomIcon = createIconComponent(LucideIcons["Broom"], "BroomIcon");
export const ClipboardTextIcon = createIconComponent(
  LucideIcons["ClipboardList"],
  "ClipboardTextIcon",
);
export const ClockIcon = createIconComponent(LucideIcons["Clock"], "ClockIcon");
export const CloudArrowDownIcon = createIconComponent(
  LucideIcons["CloudDownload"],
  "CloudArrowDownIcon",
);
export const CloudIcon = createIconComponent(LucideIcons["Cloud"], "CloudIcon");
export const CloudSlashIcon = createIconComponent(LucideIcons["CloudOff"], "CloudSlashIcon");
export const CloudWarningIcon = createIconComponent(LucideIcons["CloudAlert"], "CloudWarningIcon");
export const CodeBlockIcon = createIconComponent(LucideIcons["SquareCode"], "CodeBlockIcon");
export const CodeIcon = createIconComponent(LucideIcons["Code"], "CodeIcon");
export const ColumnsIcon = createIconComponent(LucideIcons["Columns"], "ColumnsIcon");
export const CopyIcon = createIconComponent(LucideIcons["Copy"], "CopyIcon");
export const CreditCardIcon = createIconComponent(LucideIcons["CreditCard"], "CreditCardIcon");
export const CrosshairIcon = createIconComponent(LucideIcons["Crosshair"], "CrosshairIcon");
export const CubeIcon = createIconComponent(LucideIcons["Box"], "CubeIcon");
export const DatabaseIcon = createIconComponent(LucideIcons["Database"], "DatabaseIcon");
export const DotsIcon = createIconComponent(LucideIcons["Ellipsis"], "DotsIcon");
export const DownloadIcon = createIconComponent(LucideIcons["Download"], "DownloadIcon");
export const ExtensionsIcon = createIconComponent(LucideIcons["Blocks"], "ExtensionsIcon");
export const EyeIcon = createIconComponent(LucideIcons["Eye"], "EyeIcon");
export const EyeSlashIcon = createIconComponent(LucideIcons["EyeOff"], "EyeSlashIcon");
export const FileCodeIcon = createIconComponent(LucideIcons["FileCode"], "FileCodeIcon");
export const FileIcon = createIconComponent(LucideIcons["File"], "FileIcon");
export const FilePlusIcon = createIconComponent(LucideIcons["FilePlus"], "FilePlusIcon");
export const FileTextIcon = createIconComponent(LucideIcons["FileText"], "FileTextIcon");
export const FilesIcon = createIconComponent(LucideIcons["Files"], "FilesIcon");
export const FilterIcon = createIconComponent(LucideIcons["Filter"], "FilterIcon");
export const FlipHorizontalIcon = createIconComponent(
  LucideIcons["FlipHorizontal"],
  "FlipHorizontalIcon",
);
export const FlipVerticalIcon = createIconComponent(
  LucideIcons["FlipVertical"],
  "FlipVerticalIcon",
);
export const FolderIcon = createIconComponent(LucideIcons["Folder"], "FolderIcon");
export const FolderOpenIcon = createIconComponent(LucideIcons["FolderOpen"], "FolderOpenIcon");
export const FolderPlusIcon = createIconComponent(LucideIcons["FolderPlus"], "FolderPlusIcon");
export const FolderStarIcon = createIconComponent(LucideIcons["FolderCog"], "FolderStarIcon");
export const FunctionIcon = createIconComponent(LucideIcons["Sigma"], "FunctionIcon");
export const GearIcon = createIconComponent(LucideIcons["Cog"], "GearIcon");
export const GitBranchIcon = createIconComponent(LucideIcons["GitBranch"], "GitBranchIcon");
export const GitCommitIcon = createIconComponent(LucideIcons["GitCommit"], "GitCommitIcon");
export const GitDiffIcon = createIconComponent(LucideIcons["GitCompare"], "GitDiffIcon");
export const GitMergeIcon = createIconComponent(LucideIcons["GitMerge"], "GitMergeIcon");
export const GitPullRequestIcon = createIconComponent(
  LucideIcons["GitPullRequest"],
  "GitPullRequestIcon",
);
export const GlobeIcon = createIconComponent(LucideIcons["Globe"], "GlobeIcon");
export const GridIcon = createIconComponent(LucideIcons["Grid"], "GridIcon");
export const HardDrivesIcon = createIconComponent(LucideIcons["HardDrive"], "HardDrivesIcon");
export const HashIcon = createIconComponent(LucideIcons["Hash"], "HashIcon");
export const HistoryIcon = createIconComponent(LucideIcons["History"], "HistoryIcon");
export const HouseIcon = createIconComponent(LucideIcons["House"], "HouseIcon");
export const ImageIcon = createIconComponent(LucideIcons["Image"], "ImageIcon");
export const InboxIcon = createIconComponent(LucideIcons["Inbox"], "InboxIcon");
export const InfoIcon = createIconComponent(LucideIcons["Info"], "InfoIcon");
export const KeyIcon = createIconComponent(LucideIcons["Key"], "KeyIcon");
export const KeyboardIcon = createIconComponent(LucideIcons["Keyboard"], "KeyboardIcon");
export const LaptopIcon = createIconComponent(LucideIcons["Laptop"], "LaptopIcon");
export const LightbulbIcon = createIconComponent(LucideIcons["Lightbulb"], "LightbulbIcon");
export const LinkIcon = createIconComponent(LucideIcons["Link"], "LinkIcon");
export const ListChecksIcon = createIconComponent(LucideIcons["ListChecks"], "ListChecksIcon");
export const ListIcon = createIconComponent(LucideIcons["List"], "ListIcon");
export const LockIcon = createIconComponent(LucideIcons["Lock"], "LockIcon");
export const LockKeyIcon = createIconComponent(LucideIcons["LockKeyhole"], "LockKeyIcon");
export const LockOpenIcon = createIconComponent(LucideIcons["LockOpen"], "LockOpenIcon");
export const MagicWandIcon = createIconComponent(LucideIcons["WandSparkles"], "MagicWandIcon");
export const MegaphoneIcon = createIconComponent(LucideIcons["Megaphone"], "MegaphoneIcon");
export const MicrophoneIcon = createIconComponent(LucideIcons["Mic"], "MicrophoneIcon");
export const MinusCircleIcon = createIconComponent(LucideIcons["MinusCircle"], "MinusCircleIcon");
export const MinusIcon = createIconComponent(LucideIcons["Minus"], "MinusIcon");
export const MonitorIcon = createIconComponent(LucideIcons["Monitor"], "MonitorIcon");
export const MoonIcon = createIconComponent(LucideIcons["Moon"], "MoonIcon");
export const NodesIcon = createIconComponent(LucideIcons["Workflow"], "NodesIcon");
export const OpenExternalIcon = createIconComponent(
  LucideIcons["ExternalLink"],
  "OpenExternalIcon",
);
export const PackageIcon = createIconComponent(LucideIcons["Package"], "PackageIcon");
export const PaintBrushIcon = createIconComponent(LucideIcons["Paintbrush"], "PaintBrushIcon");
export const PaletteIcon = createIconComponent(LucideIcons["Palette"], "PaletteIcon");
export const PaperPlaneIcon = createIconComponent(LucideIcons["Send"], "PaperPlaneIcon");
export const PauseIcon = createIconComponent(LucideIcons["Pause"], "PauseIcon");
export const PenIcon = createIconComponent(LucideIcons["Pen"], "PenIcon");
export const PencilIcon = createIconComponent(LucideIcons["Pencil"], "PencilIcon");
export const PencilLineIcon = createIconComponent(LucideIcons["PencilLine"], "PencilLineIcon");
export const PinIcon = createIconComponent(LucideIcons["Pin"], "PinIcon");
export const PinSlashIcon = createIconComponent(LucideIcons["PinOff"], "PinSlashIcon");
export const PlayCircleIcon = createIconComponent(LucideIcons["PlayCircle"], "PlayCircleIcon");
export const PlayIcon = createIconComponent(LucideIcons["Play"], "PlayIcon");
export const PlugsConnectedIcon = createIconComponent(LucideIcons["PlugZap"], "PlugsConnectedIcon");
export const PlusCircleIcon = createIconComponent(LucideIcons["PlusCircle"], "PlusCircleIcon");
export const PlusIcon = createIconComponent(LucideIcons["Plus"], "PlusIcon");
export const PuzzlePieceIcon = createIconComponent(LucideIcons["Puzzle"], "PuzzlePieceIcon");
export const QuestionIcon = createIconComponent(LucideIcons["CircleHelp"], "QuestionIcon");
export const RemoteIcon = createIconComponent(LucideIcons["MonitorCog"], "RemoteIcon");
export const RocketIcon = createIconComponent(LucideIcons["Rocket"], "RocketIcon");
export const RowsIcon = createIconComponent(LucideIcons["Rows"], "RowsIcon");
export const SaveIcon = createIconComponent(LucideIcons["Save"], "SaveIcon");
export const ScissorsIcon = createIconComponent(LucideIcons["Scissors"], "ScissorsIcon");
export const SearchIcon = createIconComponent(LucideIcons["Search"], "SearchIcon");
export const SettingsIcon = createIconComponent(LucideIcons["Settings"], "SettingsIcon");
export const ShieldCheckIcon = createIconComponent(LucideIcons["ShieldCheck"], "ShieldCheckIcon");
export const ShieldIcon = createIconComponent(LucideIcons["Shield"], "ShieldIcon");
export const SidebarIcon = createIconComponent(LucideIcons["Sidebar"], "SidebarIcon");
export const SidebarRightIcon = createIconComponent(LucideIcons["PanelRight"], "SidebarRightIcon");
export const SignInIcon = createIconComponent(LucideIcons["LogIn"], "SignInIcon");
export const SignOutIcon = createIconComponent(LucideIcons["LogOut"], "SignOutIcon");
export const SitemapIcon = createIconComponent(LucideIcons["Network"], "SitemapIcon");
export const SlidersIcon = createIconComponent(LucideIcons["Sliders"], "SlidersIcon");
export const SparkleIcon = createIconComponent(LucideIcons["Sparkle"], "SparkleIcon");
export const SquareArrowUpIcon = createIconComponent(
  LucideIcons["SquareArrowUp"],
  "SquareArrowUpIcon",
);
export const SquareIcon = createIconComponent(LucideIcons["Square"], "SquareIcon");
export const StackIcon = createIconComponent(LucideIcons["Layers"], "StackIcon");
export const StopIcon = createIconComponent(LucideIcons["CircleStop"], "StopIcon");
export const SunIcon = createIconComponent(LucideIcons["Sun"], "SunIcon");
export const TableIcon = createIconComponent(LucideIcons["Table"], "TableIcon");
export const TagIcon = createIconComponent(LucideIcons["Tag"], "TagIcon");
export const TerminalIcon = createIconComponent(LucideIcons["Terminal"], "TerminalIcon");
export const TerminalWindowIcon = createIconComponent(
  LucideIcons["SquareTerminal"],
  "TerminalWindowIcon",
);
export const TextAlignJustifyIcon = createIconComponent(
  LucideIcons["TextAlignJustify"],
  "TextAlignJustifyIcon",
);
export const TextAlignLeftIcon = createIconComponent(LucideIcons["AlignLeft"], "TextAlignLeftIcon");
export const SelectAllIcon = createIconComponent(LucideIcons["TextSelect"], "SelectAllIcon");
export const TextIcon = createIconComponent(LucideIcons["Text"], "TextIcon");
export const TextIndentIcon = createIconComponent(
  LucideIcons["ListIndentIncrease"],
  "TextIndentIcon",
);
export const TranslateIcon = createIconComponent(LucideIcons["Languages"], "TranslateIcon");
export const TrashIcon = createIconComponent(LucideIcons["Trash"], "TrashIcon");
export const UploadIcon = createIconComponent(LucideIcons["Upload"], "UploadIcon");
export const UserCircleIcon = createIconComponent(LucideIcons["UserCircle"], "UserCircleIcon");
export const UserIcon = createIconComponent(LucideIcons["User"], "UserIcon");
export const UsersIcon = createIconComponent(LucideIcons["Users"], "UsersIcon");
export const WarningCircleIcon = createIconComponent(
  LucideIcons["CircleAlert"],
  "WarningCircleIcon",
);
export const WarningIcon = createIconComponent(LucideIcons["TriangleAlert"], "WarningIcon");
export const WindowExpandIcon = createIconComponent(LucideIcons["AppWindow"], "WindowExpandIcon");
export const WrenchIcon = createIconComponent(LucideIcons["Wrench"], "WrenchIcon");
export const XCircleIcon = createIconComponent(LucideIcons["XCircle"], "XCircleIcon");
export const XIcon = createIconComponent(LucideIcons["X"], "XIcon");
export const ZoomInIcon = createIconComponent(LucideIcons["ZoomIn"], "ZoomInIcon");
export const ZoomOutIcon = createIconComponent(LucideIcons["ZoomOut"], "ZoomOutIcon");
