export const UPLOAD_CHUNK_BYTES = 8 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 25 * 1024 ** 3;
export const MAX_PDF_BYTES = 2 * 1024 ** 3;
export function uploadSizeAllowed(kind, size) {
  const limit = kind === 'video' ? MAX_VIDEO_BYTES : kind === 'pdf' ? MAX_PDF_BYTES : 0;
  return Number.isSafeInteger(size) && size > 0 && size <= limit;
}
export function uploadLimitMessage(kind) {
  return kind === 'video' ? 'วิดีโอต้องมีขนาดไม่เกิน 25 GB' : 'เอกสาร PDF ต้องมีขนาดไม่เกิน 2 GB';
}
