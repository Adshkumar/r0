import { extensionRegistry } from "@/extensions/registry/extension-registry";
import { languageProviderRegistry } from "@/extensions/languages/language-provider-registry";
import {
  ANGULAR_TEMPLATE_LANGUAGE_ID,
  isAngularTemplatePath,
} from "@/features/editor/utils/angular-template";

/**
 * Detect programming language from file extension using the extension registry
 */
export function detectLanguageFromPath(filePath: string): string {
  if (isAngularTemplatePath(filePath)) {
    return ANGULAR_TEMPLATE_LANGUAGE_ID;
  }

  const fromRegistry = extensionRegistry.getLanguageId(filePath);
  if (fromRegistry) {
    return fromRegistry;
  }

  const normalizedPath = filePath.replace(/\\/g, "/");
  const extension = normalizedPath.toLowerCase().split(".").pop() || "";

  const languageProvider = languageProviderRegistry.get(extension);
  if (languageProvider) {
    return languageProvider.id;
  }

  // Fallback to static map for unsupported languages
  const languageMap: Record<string, string> = {
    // Unsupported languages that might be added in the future
    tsx: "typescriptreact",
    jsx: "javascriptreact",
    js: "javascript",
    ts: "typescript",
    json: "json",
    html: "html",
    css: "css",
    scss: "scss",
    sass: "sass",
    less: "less",
    md: "markdown",
    py: "python",
    java: "java",
    cpp: "cpp",
    c: "c",
    rs: "rust",
    go: "go",
    php: "php",
    vue: "vue",
    svelte: "svelte",
    yaml: "yaml",
    yml: "yaml",
    xml: "xml",
    svg: "xml",
    sh: "shell",
    bash: "shell",
    zsh: "shell",
    sql: "sql",
    env: "dotenv",
    dockerignore: "gitignore",
    gitattributes: "gitattributes",
    gitignore: "gitignore",
    ignore: "gitignore",
    lock: "lockfile",
    zig: "zig",
    el: "elisp",
    rst: "restructuredtext",
    tex: "latex",
    scala: "scala",
    hs: "haskell",
    ml: "ocaml",
    fs: "fsharp",
    clj: "clojure",
    lisp: "lisp",
    scm: "scheme",
    fish: "shell",
    ps1: "powershell",
    bat: "batch",
    cmd: "batch",
    ini: "ini",
    cfg: "ini",
    conf: "ini",
    csv: "csv",
    dockerfile: "dockerfile",
    makefile: "makefile",
    ipy: "python",
    r: "r",
    rmd: "rmarkdown",
    ipynb: "jupyter-notebook",
    lua: "lua",
    vim: "vim",
    elm: "elm",
    astro: "astro",
  };

  return languageMap[extension] || "text";
}

/**
 * Detect language from file name (handles special cases like Dockerfile, Makefile)
 */
export function detectLanguageFromFileName(fileName: string): string {
  const normalizedPath = fileName.replace(/\\/g, "/");
  const name = normalizedPath.split("/").pop() ?? normalizedPath;
  const lowercaseName = name.toLowerCase();

  if (lowercaseName === ".env" || lowercaseName.startsWith(".env.")) {
    return "dotenv";
  }

  // Special files without extensions
  if (lowercaseName === "dockerfile" || lowercaseName.startsWith("dockerfile.")) {
    return "dockerfile";
  }

  if (lowercaseName === "makefile" || lowercaseName.startsWith("makefile.")) {
    return "makefile";
  }

  if (lowercaseName === "cmakelists.txt") {
    return "cmake";
  }

  if (normalizedPath.endsWith("/.git/info/exclude")) {
    return "gitignore";
  }

  if (normalizedPath.endsWith("/.git/info/attributes")) {
    return "gitattributes";
  }

  if (
    lowercaseName === ".gitignore" ||
    lowercaseName === ".dockerignore" ||
    lowercaseName === ".ignore" ||
    lowercaseName === ".npmignore" ||
    lowercaseName === ".eslintignore" ||
    lowercaseName === ".prettierignore" ||
    lowercaseName === ".stylelintignore" ||
    lowercaseName === ".vscodeignore" ||
    lowercaseName === ".rgignore" ||
    lowercaseName === ".fdignore"
  ) {
    return "gitignore";
  }

  if (lowercaseName === ".gitattributes") {
    return "gitattributes";
  }

  if (lowercaseName === ".rprofile") {
    return "r";
  }

  return detectLanguageFromPath(fileName);
}
