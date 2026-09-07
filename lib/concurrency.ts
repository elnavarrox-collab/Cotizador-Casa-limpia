export function revisionMatches(baseRevision: number, currentRevision: number) {
  return Number.isSafeInteger(baseRevision) && baseRevision >= 0 && baseRevision === currentRevision;
}
