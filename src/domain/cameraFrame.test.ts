import { describe, expect, it } from 'vitest';
import { cameraFrameGeometry } from './cameraFrame';

describe('camera frame geometry', () => {
  it('crops a landscape sensor to the portrait area visible in the camera', () => {
    const frame = cameraFrameGeometry(1920, 1080, 360, 560);

    expect(frame.sourceX).toBeCloseTo(612.86);
    expect(frame.sourceY).toBe(0);
    expect(frame.sourceWidth).toBeCloseTo(694.29);
    expect(frame.sourceHeight).toBe(1080);
    expect([frame.outputWidth, frame.outputHeight]).toEqual([694, 1080]);
  });

  it('crops a portrait sensor vertically for a wider visible frame', () => {
    const frame = cameraFrameGeometry(1080, 1920, 560, 360);

    expect(frame.sourceX).toBe(0);
    expect(frame.sourceY).toBeCloseTo(612.86);
    expect(frame.sourceWidth).toBe(1080);
    expect(frame.sourceHeight).toBeCloseTo(694.29);
    expect([frame.outputWidth, frame.outputHeight]).toEqual([1080, 694]);
  });

  it('keeps matching aspect ratios and caps the output size', () => {
    expect(cameraFrameGeometry(2400, 1600, 600, 400)).toEqual({
      sourceX: 0,
      sourceY: 0,
      sourceWidth: 2400,
      sourceHeight: 1600,
      outputWidth: 1600,
      outputHeight: 1067,
    });
  });
});
