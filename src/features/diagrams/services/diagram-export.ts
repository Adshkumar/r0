import { save } from "@tauri-apps/plugin-dialog";
import { writeFile, writeTextFile } from "@tauri-apps/plugin-fs";

type DiagramExport =
  | { format: "svg"; contents: string; defaultPath: string }
  | { format: "png"; contents: Uint8Array; defaultPath: string };

export async function exportDiagramFile({ format, contents, defaultPath }: DiagramExport) {
  const path = await save({
    defaultPath,
    filters: [
      {
        name: format === "svg" ? "SVG image" : "PNG image",
        extensions: [format],
      },
    ],
  });
  if (!path) return false;
  if (!path.toLowerCase().endsWith(`.${format}`)) {
    throw new Error(`Choose a ${format.toUpperCase()} file name.`);
  }

  if (format === "svg") {
    await writeTextFile(path, contents);
  } else {
    await writeFile(path, contents);
  }
  return true;
}
