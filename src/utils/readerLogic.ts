export interface BookSpread {
  leftPage: number | null;
  rightPage: number | null;
}

/**
 * Conventional book pagination for double-page spread:
 * - Without coverSpreadOffset (standard book):
 *     Page 1 is on the right with a blank left side.
 *     Pages (2, 3), (4, 5), (6, 7), etc.
 * - With coverSpreadOffset (for PDFs where cover+front matter shifts pairing):
 *     Pages (1, 2), (3, 4), (5, 6), etc.
 */
export function computeDoublePageSpread(
  currentPage: number,
  totalPages: number,
  coverSpreadOffset = false
): BookSpread {
  if (totalPages <= 0) {
    return { leftPage: null, rightPage: null };
  }
  const safePage = Math.max(1, Math.min(currentPage, totalPages));

  if (!coverSpreadOffset) {
    if (safePage === 1) {
      return { leftPage: null, rightPage: 1 };
    }
    const leftPage = safePage % 2 === 0 ? safePage : safePage - 1;
    const rightPage = leftPage + 1 <= totalPages ? leftPage + 1 : null;
    return { leftPage, rightPage };
  } else {
    const leftPage = safePage % 2 === 1 ? safePage : safePage - 1;
    const rightPage = leftPage + 1 <= totalPages ? leftPage + 1 : null;
    return { leftPage, rightPage };
  }
}

export function computeNextSpreadPage(
  currentPage: number,
  totalPages: number,
  isDoublePage: boolean,
  coverSpreadOffset = false
): number {
  if (totalPages <= 0) return 1;
  const safePage = Math.max(1, Math.min(currentPage, totalPages));
  if (!isDoublePage) {
    return Math.min(totalPages, safePage + 1);
  }
  const spread = computeDoublePageSpread(safePage, totalPages, coverSpreadOffset);
  const highestShown = spread.rightPage ?? spread.leftPage ?? safePage;
  return Math.min(totalPages, highestShown + 1);
}

export function computePrevSpreadPage(
  currentPage: number,
  totalPages: number,
  isDoublePage: boolean,
  coverSpreadOffset = false
): number {
  if (totalPages <= 0) return 1;
  const safePage = Math.max(1, Math.min(currentPage, totalPages));
  if (!isDoublePage) {
    return Math.max(1, safePage - 1);
  }
  const spread = computeDoublePageSpread(safePage, totalPages, coverSpreadOffset);
  const lowestShown = spread.leftPage ?? spread.rightPage ?? safePage;
  if (lowestShown <= 1) return 1;
  return Math.max(1, lowestShown - 1);
}
