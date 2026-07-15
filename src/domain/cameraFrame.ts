export interface CameraFrameGeometry {
  sourceX: number;
  sourceY: number;
  sourceWidth: number;
  sourceHeight: number;
  outputWidth: number;
  outputHeight: number;
}

export const cameraFrameGeometry = (
  sourceWidth: number,
  sourceHeight: number,
  viewportWidth: number,
  viewportHeight: number,
  maxOutputSide = 1600,
): CameraFrameGeometry => {
  const safeViewportWidth = viewportWidth > 0 ? viewportWidth : sourceWidth;
  const safeViewportHeight = viewportHeight > 0 ? viewportHeight : sourceHeight;
  const sourceRatio = sourceWidth / sourceHeight;
  const viewportRatio = safeViewportWidth / safeViewportHeight;
  const sourceCropWidth = sourceRatio > viewportRatio ? sourceHeight * viewportRatio : sourceWidth;
  const sourceCropHeight = sourceRatio > viewportRatio ? sourceHeight : sourceWidth / viewportRatio;
  const scale = Math.min(1, maxOutputSide / Math.max(sourceCropWidth, sourceCropHeight));

  return {
    sourceX: (sourceWidth - sourceCropWidth) / 2,
    sourceY: (sourceHeight - sourceCropHeight) / 2,
    sourceWidth: sourceCropWidth,
    sourceHeight: sourceCropHeight,
    outputWidth: Math.max(1, Math.round(sourceCropWidth * scale)),
    outputHeight: Math.max(1, Math.round(sourceCropHeight * scale)),
  };
};
