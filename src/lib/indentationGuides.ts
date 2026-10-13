import { Decoration, ViewPlugin } from '@codemirror/view';
import type { DecorationSet, EditorView, ViewUpdate } from '@codemirror/view';
import { getIndentUnit } from '@codemirror/language';

const guideMark = Decoration.mark({ class: 'cm-indent-guide' });

function buildGuides(view: EditorView): DecorationSet {
  const ranges = [];
  const step = Math.max(1, getIndentUnit(view.state));
  view.dom.style.setProperty(
    '--r0-indent-guide-step',
    `${view.defaultCharacterWidth * step}px`,
  );

  for (const visibleRange of view.visibleRanges) {
    let lineNumber = view.state.doc.lineAt(visibleRange.from).number;
    const lastLine = view.state.doc.lineAt(visibleRange.to).number;
    while (lineNumber <= lastLine) {
      const line = view.state.doc.line(lineNumber);
      const indentation = /^[\t ]+/.exec(line.text)?.[0];
      if (indentation) {
        const columns = Array.from(indentation).reduce(
          (column, character) => character === '\t' ? column + (4 - column % 4) : column + 1,
          0,
        );
        if (columns >= step) ranges.push(guideMark.range(line.from, line.from + indentation.length));
      }
      lineNumber++;
    }
  }
  return Decoration.set(ranges, true);
}

export const indentationGuides = ViewPlugin.fromClass(class {
  decorations: DecorationSet;

  constructor(view: EditorView) {
    this.decorations = buildGuides(view);
  }

  update(update: ViewUpdate) {
    if (update.docChanged || update.viewportChanged || update.geometryChanged) {
      this.decorations = buildGuides(update.view);
    }
  }
}, {
  decorations: value => value.decorations,
});
