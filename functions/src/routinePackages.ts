import { z } from 'zod';
import { parseRoutineDraftPackage, RoutineDraftInputError, type RoutineDraftPackage } from './routineDrafts.js';

export const ROUTINE_PACKAGE_MIME = 'application/vnd.zadiag.routine+json';
export const ROUTINE_PACKAGE_MAX_BYTES = 96 * 1024;

const envelopeSchema = z.strictObject({
  format: z.literal('zadiag-routine-package'),
  formatVersion: z.literal(1),
  contentType: z.literal(ROUTINE_PACKAGE_MIME),
  path: z.literal('routine.json'),
  provenance: z.strictObject({ source: z.literal('zadiag'), exportedAt: z.iso.datetime(), sourceDraftId: z.string().min(1).max(128), sourceRevision: z.number().int().positive() }),
  package: z.unknown(),
});

export interface RoutinePackageEnvelope { format: 'zadiag-routine-package'; formatVersion: 1; contentType: typeof ROUTINE_PACKAGE_MIME; path: 'routine.json'; provenance: { source: 'zadiag'; exportedAt: string; sourceDraftId: string; sourceRevision: number }; package: RoutineDraftPackage }

export const serializeRoutinePackage = (draftId: string, revision: number, updatedAt: string, routinePackage: RoutineDraftPackage) => JSON.stringify({
  format: 'zadiag-routine-package', formatVersion: 1, contentType: ROUTINE_PACKAGE_MIME, path: 'routine.json',
  provenance: { source: 'zadiag', exportedAt: updatedAt, sourceDraftId: draftId, sourceRevision: revision }, package: routinePackage,
});

export const parseRoutinePackageEnvelope = (content: unknown, mimeType: unknown): RoutinePackageEnvelope => {
  if (mimeType !== ROUTINE_PACKAGE_MIME || typeof content !== 'string' || Buffer.byteLength(content, 'utf8') > ROUTINE_PACKAGE_MAX_BYTES) throw new RoutineDraftInputError('invalid_package_file');
  let decoded: unknown;
  try { decoded = JSON.parse(content); } catch { throw new RoutineDraftInputError('invalid_package_file'); }
  const envelope = envelopeSchema.safeParse(decoded);
  if (!envelope.success) throw new RoutineDraftInputError('invalid_package_file');
  const text = JSON.stringify(envelope.data.package).toLowerCase();
  if (text.includes('<script') || text.includes('javascript:') || text.includes('data:text/html')) throw new RoutineDraftInputError('executable_content');
  const parsed = parseRoutineDraftPackage(envelope.data.package);
  return { ...envelope.data, package: parsed.package };
};
