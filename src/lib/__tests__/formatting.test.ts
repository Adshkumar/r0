import { describe, expect, it } from 'vitest';
import { canFormat, formatSource } from '../formatting';

describe('document formatting', () => {
  it.each([
    ['app.js', 'const total={a:1};', 'const total = { a: 1 };\n'],
    ['app.tsx', 'const App=()=> <div>ok</div>;', 'const App = () => <div>ok</div>;\n'],
    ['data.json', '{"items":[1,2]}', '{ "items": [1, 2] }\n'],
    ['index.html', '<main><h1>Hello</h1></main>', '<main><h1>Hello</h1></main>\n'],
    ['site.css', 'main{color:red}', 'main {\n  color: red;\n}\n'],
    ['README.md', '# Heading\n\n  text', '# Heading\n\ntext\n'],
  ])('formats %s', async (path, source, expected) => {
    const result = await formatSource(source, path);
    expect(result.text).toBe(expected);
  });

  it('formats only the selected range and rejects unsupported languages', async () => {
    const source = 'const a={x:1};\nconst b={y:2};\n';
    const result = await formatSource(source, 'app.js', { from: 0, to: 14 });

    expect(result.text).toContain('const a = { x: 1 };');
    expect(result.text).toContain('const b={y:2};');
    expect(canFormat('main.rs')).toBe(true);
    expect(canFormat('script.py')).toBe(true);
    expect(canFormat('script.ps1')).toBe(false);
    await expect(formatSource('fn main(){}', 'main.rs')).rejects.toThrow(/No bundled formatter/);
  });

  it('repairs mismatched heading tags before formatting HTML', async () => {
    const result = await formatSource(
      '<html><body><h5>Apps</h3><p>Some text</p></body></html>',
      'apple.html',
    );

    expect(result.repairedHtmlHeadings).toBe(true);
    expect(result.text).toContain('<h3>Apps</h3>');
    expect(result.text).toContain('<p>Some text</p>');
  });

  it.each([
    ['component.vue', '<template><div>{{name}}</div></template>'],
    ['query.graphql', 'query User{name}'],
    ['README.mdx', '# Title\n\n<Thing value={1}/>'],
  ])('formats %s', async (path, source) => {
    const result = await formatSource(source, path);
    expect(result.text.length).toBeGreaterThan(source.length);
  });

  it('offers formatting for supported language-server languages', () => {
    expect(canFormat('main.rs')).toBe(true);
    expect(canFormat('script.py')).toBe(true);
  });

  it('does not silently repair mismatched non-heading HTML tags', async () => {
    await expect(formatSource('<div>Text</span>', 'apple.html')).rejects.toThrow(
      /Unexpected closing tag/,
    );
  });
});
