import {
  File, FileArchive, FileAudio2, FileCode2, FileCog, FileImage,
  FileText, FileType2, FileVideo2, Folder, FolderCode, FolderCog, FolderGit2,
  FolderKanban, FolderOpen, Package, Terminal, Database,
} from 'lucide-react';
import type { IconType } from '@icons-pack/react-simple-icons';
import SiAngular from '@icons-pack/react-simple-icons/icons/SiAngular';
import SiAstro from '@icons-pack/react-simple-icons/icons/SiAstro';
import SiC from '@icons-pack/react-simple-icons/icons/SiC';
import SiCplusplus from '@icons-pack/react-simple-icons/icons/SiCplusplus';
import SiCss from '@icons-pack/react-simple-icons/icons/SiCss';
import SiDart from '@icons-pack/react-simple-icons/icons/SiDart';
import SiDocker from '@icons-pack/react-simple-icons/icons/SiDocker';
import SiFlutter from '@icons-pack/react-simple-icons/icons/SiFlutter';
import SiGit from '@icons-pack/react-simple-icons/icons/SiGit';
import SiGo from '@icons-pack/react-simple-icons/icons/SiGo';
import SiGnubash from '@icons-pack/react-simple-icons/icons/SiGnubash';
import SiGraphql from '@icons-pack/react-simple-icons/icons/SiGraphql';
import SiHtml5 from '@icons-pack/react-simple-icons/icons/SiHtml5';
import SiJest from '@icons-pack/react-simple-icons/icons/SiJest';
import SiJavascript from '@icons-pack/react-simple-icons/icons/SiJavascript';
import SiJson from '@icons-pack/react-simple-icons/icons/SiJson';
import SiKotlin from '@icons-pack/react-simple-icons/icons/SiKotlin';
import SiMarkdown from '@icons-pack/react-simple-icons/icons/SiMarkdown';
import SiMdx from '@icons-pack/react-simple-icons/icons/SiMdx';
import SiMysql from '@icons-pack/react-simple-icons/icons/SiMysql';
import SiNodedotjs from '@icons-pack/react-simple-icons/icons/SiNodedotjs';
import SiOpenjdk from '@icons-pack/react-simple-icons/icons/SiOpenjdk';
import SiPhp from '@icons-pack/react-simple-icons/icons/SiPhp';
import SiPython from '@icons-pack/react-simple-icons/icons/SiPython';
import SiReact from '@icons-pack/react-simple-icons/icons/SiReact';
import SiRuby from '@icons-pack/react-simple-icons/icons/SiRuby';
import SiRust from '@icons-pack/react-simple-icons/icons/SiRust';
import SiSass from '@icons-pack/react-simple-icons/icons/SiSass';
import SiSvelte from '@icons-pack/react-simple-icons/icons/SiSvelte';
import SiSwift from '@icons-pack/react-simple-icons/icons/SiSwift';
import SiToml from '@icons-pack/react-simple-icons/icons/SiToml';
import SiTypescript from '@icons-pack/react-simple-icons/icons/SiTypescript';
import SiVite from '@icons-pack/react-simple-icons/icons/SiVite';
import SiVitest from '@icons-pack/react-simple-icons/icons/SiVitest';
import SiVuedotjs from '@icons-pack/react-simple-icons/icons/SiVuedotjs';
import SiWebassembly from '@icons-pack/react-simple-icons/icons/SiWebassembly';
import SiXml from '@icons-pack/react-simple-icons/icons/SiXml';
import SiYaml from '@icons-pack/react-simple-icons/icons/SiYaml';
import type { FileIconTheme } from './fileIconTheme';

interface IconRecord {
  icon: IconType;
  color: string;
}

const brand = (icon: IconType, color: string): IconRecord => ({ icon, color });
const basic = (icon: IconType, color = '#8b91a0'): IconRecord => ({ icon, color });

const icons = {
  javascript: brand(SiJavascript, '#e8c900'),
  typescript: brand(SiTypescript, '#3178c6'),
  react: brand(SiReact, '#61dafb'),
  html: brand(SiHtml5, '#e34f26'),
  css: brand(SiCss, '#663399'),
  sass: brand(SiSass, '#cc6699'),
  json: brand(SiJson, '#f5a623'),
  markdown: brand(SiMarkdown, '#8b91a0'),
  mdx: brand(SiMdx, '#f9ac00'),
  python: brand(SiPython, '#3776ab'),
  rust: brand(SiRust, '#dea584'),
  go: brand(SiGo, '#00add8'),
  java: brand(SiOpenjdk, '#ed8b00'),
  c: brand(SiC, '#a8b9cc'),
  cpp: brand(SiCplusplus, '#00599c'),
  php: brand(SiPhp, '#777bb4'),
  ruby: brand(SiRuby, '#cc342d'),
  swift: brand(SiSwift, '#f05138'),
  kotlin: brand(SiKotlin, '#7f52ff'),
  dart: brand(SiDart, '#0175c2'),
  flutter: brand(SiFlutter, '#54c5f8'),
  vue: brand(SiVuedotjs, '#4fc08d'),
  svelte: brand(SiSvelte, '#ff3e00'),
  astro: brand(SiAstro, '#ff5d01'),
  angular: brand(SiAngular, '#dd0031'),
  yaml: brand(SiYaml, '#cb171e'),
  toml: brand(SiToml, '#9c4221'),
  xml: brand(SiXml, '#e37933'),
  sql: brand(SiMysql, '#4479a1'),
  shell: brand(SiGnubash, '#4eaa25'),
  graphql: brand(SiGraphql, '#e10098'),
  wasm: brand(SiWebassembly, '#654ff0'),
  docker: brand(SiDocker, '#2496ed'),
  vite: brand(SiVite, '#646cff'),
  test: brand(SiVitest, '#6e9f18'),
  jest: brand(SiJest, '#c21325'),
  git: brand(SiGit, '#f05032'),
  file: basic(File),
  text: basic(FileText),
  font: basic(FileType2, '#e2c08d'),
  code: basic(FileCode2, '#6b83b5'),
  config: basic(FileCog, '#a78bfa'),
  lock: basic(FileType2, '#8b91a0'),
  image: basic(FileImage, '#a855f7'),
  audio: basic(FileAudio2, '#ec4899'),
  video: basic(FileVideo2, '#ef4444'),
  archive: basic(FileArchive, '#d4a017'),
  database: basic(Database, '#4479a1'),
  terminal: basic(Terminal, '#4eaa25'),
  package: brand(SiNodedotjs, '#83cd29'),
} satisfies Record<string, IconRecord>;

const exactFiles: Record<string, keyof typeof icons> = {
  'package.json': 'package',
  'package-lock.json': 'package',
  'npm-shrinkwrap.json': 'package',
  'pnpm-lock.yaml': 'package',
  'yarn.lock': 'package',
  'bun.lock': 'package',
  'bun.lockb': 'package',
  'tsconfig.json': 'typescript',
  'jsconfig.json': 'javascript',
  'cargo.toml': 'rust',
  'cargo.lock': 'rust',
  'dockerfile': 'docker',
  'docker-compose.yml': 'docker',
  'docker-compose.yaml': 'docker',
  'compose.yml': 'docker',
  'compose.yaml': 'docker',
  'vite.config.js': 'vite',
  'vite.config.ts': 'vite',
  'vite.config.mjs': 'vite',
  'vite.config.mts': 'vite',
  'angular.json': 'angular',
  'pubspec.yaml': 'flutter',
  'readme': 'markdown',
  'readme.md': 'markdown',
  'readme.mdx': 'mdx',
  'license': 'text',
  'license.md': 'text',
  'copying': 'text',
  '.gitignore': 'git',
  '.gitattributes': 'git',
  '.gitmodules': 'git',
  '.editorconfig': 'config',
  '.env': 'config',
  '.npmrc': 'package',
  '.nvmrc': 'javascript',
  '.dockerignore': 'docker',
  'makefile': 'terminal',
};

const compoundExtensions: Array<[string, keyof typeof icons]> = [
  ['.spec.tsx', 'test'], ['.test.tsx', 'test'],
  ['.spec.jsx', 'jest'], ['.test.jsx', 'jest'],
  ['.spec.ts', 'test'], ['.test.ts', 'test'],
  ['.spec.js', 'jest'], ['.test.js', 'jest'],
  ['.d.ts', 'typescript'],
  ['.component.ts', 'angular'],
  ['.module.ts', 'angular'],
  ['.service.ts', 'angular'],
  ['.directive.ts', 'angular'],
  ['.pipe.ts', 'angular'],
  ['.controller.ts', 'angular'],
  ['.stories.tsx', 'react'],
  ['.stories.jsx', 'react'],
];

const r0ColorOverrides: Partial<Record<keyof typeof icons, string>> = {
  javascript: '#e5c07b',
  typescript: '#79a9e8',
  react: '#56b6c2',
  html: '#e06c75',
  css: '#c678dd',
  sass: '#c678dd',
  json: '#e5c07b',
  python: '#61afef',
  rust: '#e5c07b',
  go: '#56b6c2',
  java: '#e5c07b',
  vue: '#89ca78',
  svelte: '#e06c75',
  astro: '#c678dd',
  angular: '#e06c75',
};

const extensions: Record<string, keyof typeof icons> = {
  js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'react',
  ts: 'typescript', mts: 'typescript', cts: 'typescript', tsx: 'react',
  html: 'html', htm: 'html', xhtml: 'html',
  css: 'css', less: 'css', scss: 'sass', sass: 'sass',
  json: 'json', jsonc: 'json', json5: 'json',
  md: 'markdown', markdown: 'markdown', mdx: 'mdx', rst: 'markdown',
  py: 'python', pyw: 'python', pyx: 'python', pyi: 'python',
  rs: 'rust', go: 'go',
  c: 'c', h: 'c', i: 'c', cpp: 'cpp', cc: 'cpp', cxx: 'cpp', hpp: 'cpp', hh: 'cpp', hxx: 'cpp',
  cs: 'code',   java: 'java', jar: 'archive', php: 'php', rb: 'ruby', swift: 'swift',
  kt: 'kotlin', kts: 'kotlin', dart: 'dart',
  vue: 'vue', svelte: 'svelte', astro: 'astro',
  yaml: 'yaml', yml: 'yaml', toml: 'toml', xml: 'xml', xsd: 'xml', xsl: 'xml',
  sql: 'sql', psql: 'sql', graphql: 'graphql', gql: 'graphql',
  sh: 'shell', bash: 'shell', zsh: 'shell', fish: 'shell',
  ps1: 'terminal', psm1: 'terminal', psd1: 'terminal',
  wasm: 'wasm', wat: 'wasm',
  png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', avif: 'image',
  bmp: 'image', ico: 'image', tiff: 'image', tif: 'image', svg: 'image',
  woff: 'font', woff2: 'font', ttf: 'font', otf: 'font', eot: 'font',
  mp3: 'audio', wav: 'audio', ogg: 'audio', flac: 'audio', aac: 'audio', m4a: 'audio',
  mp4: 'video', mov: 'video', webm: 'video', avi: 'video', mkv: 'video',
  zip: 'archive', tar: 'archive', gz: 'archive', bz2: 'archive', xz: 'archive', '7z': 'archive',
  pdf: 'text', doc: 'text', docx: 'text', odt: 'text', rtf: 'text',
  xls: 'text', xlsx: 'text', csv: 'text', ppt: 'text', pptx: 'text',
  db: 'database', sqlite: 'database', sqlite3: 'database',
  lock: 'lock', log: 'text', txt: 'text',
  dockerfile: 'docker',
};

const folders: Record<string, { icon: IconType; color: string }> = {
  src: { icon: FolderCode, color: '#64b5f6' },
  components: { icon: FolderCode, color: '#61dafb' },
  assets: { icon: FolderOpen, color: '#e2c08d' },
  public: { icon: FolderOpen, color: '#89d185' },
  pages: { icon: FolderKanban, color: '#c586c0' },
  hooks: { icon: FolderCode, color: '#61dafb' },
  flutter: { icon: FolderCode, color: '#54c5f8' },
  utils: { icon: FolderCog, color: '#a78bfa' },
  lib: { icon: FolderCode, color: '#a78bfa' },
  services: { icon: FolderCog, color: '#a78bfa' },
  api: { icon: FolderCode, color: '#4daafc' },
  routes: { icon: FolderKanban, color: '#c586c0' },
  models: { icon: FolderCode, color: '#89d185' },
  controllers: { icon: FolderCode, color: '#89d185' },
  middleware: { icon: FolderCog, color: '#a78bfa' },
  config: { icon: FolderCog, color: '#a78bfa' },
  tests: { icon: FolderGit2, color: '#89d185' },
  __tests__: { icon: FolderGit2, color: '#89d185' },
  test: { icon: FolderGit2, color: '#89d185' },
  docs: { icon: FolderOpen, color: '#e2c08d' },
  scripts: { icon: FolderCog, color: '#4eaa25' },
  styles: { icon: FolderCode, color: '#cc6699' },
  fonts: { icon: FolderOpen, color: '#e2c08d' },
  images: { icon: FolderOpen, color: '#a855f7' },
  locales: { icon: FolderOpen, color: '#e2c08d' },
  migrations: { icon: FolderCog, color: '#4479a1' },
  node_modules: { icon: Package, color: '#83cd29' },
  '.git': { icon: FolderGit2, color: '#f05032' },
  '.github': { icon: FolderGit2, color: '#8b91a0' },
  '.vscode': { icon: FolderCog, color: '#007acc' },
};

export interface ResolvedFileIcon {
  icon: IconType;
  color: string;
}

export function resolveFileIcon(
  name: string,
  isDirectory: boolean,
  isOpen: boolean,
  theme: FileIconTheme,
): ResolvedFileIcon {
  if (isDirectory) {
    const folder = folders[name.toLowerCase()];
    const icon = isOpen ? FolderOpen : folder?.icon ?? Folder;
    const color = theme === 'minimal'
      ? 'var(--r0-fg-muted)'
      : theme === 'vscode'
        ? name.toLowerCase() === 'node_modules' ? '#83cd29' : '#dcb67a'
        : folder?.color ?? '#e2c08d';
    return { icon, color };
  }

  const normalized = name.toLowerCase();
  let key: keyof typeof icons | undefined = exactFiles[normalized];
  if (!key && normalized.startsWith('.env.')) key = 'config';
  if (!key) {
    const compound = compoundExtensions.find(([suffix]) => normalized.endsWith(suffix));
    key = compound?.[1];
  }
  if (!key) {
    const extension = normalized.includes('.') ? normalized.slice(normalized.lastIndexOf('.') + 1) : '';
    key = extensions[extension] ?? (extension === 'dockerfile' ? 'docker' : undefined);
  }

  const iconKey = key ?? 'file';
  const resolved = icons[iconKey];
  return {
    icon: resolved.icon,
    color: theme === 'minimal'
      ? 'var(--r0-fg-muted)'
      : theme === 'r0'
        ? r0ColorOverrides[iconKey] ?? resolved.color
        : resolved.color,
  };
}
