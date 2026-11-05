const MIN_RESPONSIVE_FONT_SIZE = 10;

export function calculateResponsiveFontSize(
  baseFontSize: number,
  availableWidth: number,
  characterWidth: number,
  longestLineLength: number,
): number {
  if (
    !Number.isFinite(baseFontSize) ||
    !Number.isFinite(availableWidth) ||
    !Number.isFinite(characterWidth) ||
    !Number.isFinite(longestLineLength) ||
    baseFontSize <= 0 ||
    availableWidth <= 0 ||
    characterWidth <= 0 ||
    longestLineLength <= 0
  ) {
    return baseFontSize;
  }

  const fitSize = (availableWidth / (longestLineLength * characterWidth)) * baseFontSize;
  return Math.max(MIN_RESPONSIVE_FONT_SIZE, Math.min(baseFontSize, fitSize));
}
