import { describe, expect, it } from 'vitest';
import { resolveFileIcon } from '../fileIcons';

const iconSamples: Record<string, string> = {
  javascript: 'example.js',
  react: 'example.jsx',
  typescript: 'example.ts',
  html: 'example.html',
  css: 'example.css',
  sass: 'example.scss',
  json: 'example.json',
  markdown: 'example.md',
  mdx: 'example.mdx',
  python: 'example.py',
  rust: 'example.rs',
  go: 'example.go',
  java: 'example.java',
  cpp: 'example.cpp',
  code: 'example.cs',
  php: 'example.php',
  ruby: 'example.rb',
  swift: 'example.swift',
  kotlin: 'example.kt',
  dart: 'example.dart',
  vue: 'example.vue',
  svelte: 'example.svelte',
  astro: 'example.astro',
  angular: 'angular.json',
  vite: 'vite.config.ts',
  docker: 'compose.yaml',
  package: 'package.json',
  yaml: 'example.yaml',
  toml: 'example.toml',
  xml: 'example.xml',
  sql: 'example.sql',
  terminal: 'example.ps1',
  graphql: 'example.graphql',
  wasm: 'example.wasm',
  image: 'example.webp',
  font: 'example.woff2',
  audio: 'example.mp3',
  video: 'example.mp4',
  text: 'example.pdf',
};

describe('file icon resolution', () => {
  it.each([
    ['app.js', 'javascript'],
    ['app.jsx', 'react'],
    ['app.ts', 'typescript'],
    ['app.tsx', 'react'],
    ['index.html', 'html'],
    ['styles.css', 'css'],
    ['styles.scss', 'sass'],
    ['data.jsonc', 'json'],
    ['README.mdx', 'mdx'],
    ['main.py', 'python'],
    ['main.rs', 'rust'],
    ['main.go', 'go'],
    ['Main.java', 'java'],
    ['main.cpp', 'cpp'],
    ['Main.cs', 'code'],
    ['index.php', 'php'],
    ['main.rb', 'ruby'],
    ['App.swift', 'swift'],
    ['App.kt', 'kotlin'],
    ['main.dart', 'dart'],
    ['App.vue', 'vue'],
    ['App.svelte', 'svelte'],
    ['Page.astro', 'astro'],
    ['app.component.ts', 'angular'],
    ['config.yaml', 'yaml'],
    ['config.toml', 'toml'],
    ['schema.xml', 'xml'],
    ['query.sql', 'sql'],
    ['build.ps1', 'terminal'],
    ['query.graphql', 'graphql'],
    ['module.wasm', 'wasm'],
    ['photo.webp', 'image'],
    ['font.woff2', 'font'],
    ['song.mp3', 'audio'],
    ['movie.mp4', 'video'],
    ['report.pdf', 'text'],
  ])('recognizes %s from its extension', (name, expectedTheme) => {
    const resolved = resolveFileIcon(name, false, false, 'vscode');
    const repeated = resolveFileIcon(`${name.toUpperCase()}`, false, false, 'vscode');
    const reference = iconSamples[expectedTheme];
    expect(resolved.icon).toBe(resolveFileIcon(reference, false, false, 'vscode').icon);
    expect(repeated.icon).toBe(resolved.icon);
  });

  it.each([
    ['package', 'package-lock.json'],
    ['package', 'pnpm-lock.yaml'],
    ['typescript', 'tsconfig.json'],
    ['javascript', 'jsconfig.json'],
    ['vite', 'vite.config.ts'],
    ['rust', 'Cargo.toml'],
    ['rust', 'Cargo.lock'],
    ['docker', 'Dockerfile'],
    ['docker', 'docker-compose.yml'],
    ['git', '.gitignore'],
    ['config', '.env'],
    ['config', '.env.local'],
    ['text', 'LICENSE'],
    ['markdown', 'README'],
  ])('uses the special association for %s / %s', (expected, name) => {
    const special = resolveFileIcon(name, false, false, 'vscode');
    const sample = iconSamples[expected] ?? ({
      package: 'package.json',
      git: '.gitattributes',
      config: '.editorconfig',
      markdown: 'notes.md',
    }[expected]);
    expect(special.icon).toBe(resolveFileIcon(sample, false, false, 'vscode').icon);
  });

  it('resolves compound extensions before their final extension', () => {
    const spec = resolveFileIcon('button.spec.tsx', false, false, 'vscode');
    const test = resolveFileIcon('button.test.ts', false, false, 'vscode');
    const declaration = resolveFileIcon('index.d.ts', false, false, 'vscode');
    expect(spec.icon).toBe(test.icon);
    expect(declaration.icon).toBe(resolveFileIcon('index.ts', false, false, 'vscode').icon);
    expect(resolveFileIcon('button.test.tsx.backup', false, false, 'vscode').icon)
      .toBe(resolveFileIcon('unknown.backup', false, false, 'vscode').icon);
  });

  it('distinguishes Flutter project configuration from Dart source files', () => {
    expect(resolveFileIcon('pubspec.yaml', false, false, 'vscode').icon)
      .not.toBe(resolveFileIcon('main.dart', false, false, 'vscode').icon);
  });

  it('uses meaningful open and closed folder icons and recognizes special folders case-insensitively', () => {
    const closed = resolveFileIcon('__TESTS__', true, false, 'r0');
    const open = resolveFileIcon('__tests__', true, true, 'r0');
    expect(open.icon).not.toBe(closed.icon);
    expect(closed.color).toBe('#89d185');
    expect(resolveFileIcon('components', true, false, 'r0').color).toBe('#61dafb');
  });

  it('uses one neutral color for minimal file and folder icons', () => {
    const color = 'var(--r0-fg-muted)';
    expect(resolveFileIcon('main.rs', false, false, 'minimal').color).toBe(color);
    expect(resolveFileIcon('src', true, false, 'minimal').color).toBe(color);
  });

  it('keeps r0 and VS Code-style palettes distinct', () => {
    expect(resolveFileIcon('App.tsx', false, false, 'r0').color)
      .not.toBe(resolveFileIcon('App.tsx', false, false, 'vscode').color);
    expect(resolveFileIcon('components', true, false, 'r0').color)
      .not.toBe(resolveFileIcon('components', true, false, 'vscode').color);
  });

  it('uses a generic file icon for unknown extensions and extensionless names', () => {
    const unknown = resolveFileIcon('unknown.xyz', false, false, 'r0');
    expect(resolveFileIcon('notes', false, false, 'r0').icon).toBe(unknown.icon);
    expect(resolveFileIcon('file.javascript-backup', false, false, 'r0').icon).toBe(unknown.icon);
  });
});
