import { createHash, verify } from 'node:crypto';
import { z } from 'zod';

export const EXTERNAL_REGISTRY_MAX_INDEX_BYTES = 256 * 1024;
export const EXTERNAL_REGISTRY_MAX_PACKAGE_BYTES = 96 * 1024;

const entrySchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80),
  version: z.number().int().positive(),
  packageUrl: z.string().url().refine((value) => new URL(value).protocol === 'https:'),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  authorName: z.string().min(1).max(120),
  license: z.string().min(1).max(80),
});
const payloadSchema = z.strictObject({ format: z.literal('zadiag-routine-registry'), version: z.literal(1), generatedAt: z.iso.datetime(), entries: z.array(entrySchema).max(200) });
const signedIndexSchema = z.strictObject({ keyId: z.string().min(1).max(80), payload: z.string(), signature: z.string().base64() });
export type ExternalRegistryPayload = z.infer<typeof payloadSchema>;

export const sha256Hex = (content: string) => createHash('sha256').update(content, 'utf8').digest('hex');

export const verifyExternalRegistryIndex = (content: string, publicKeys: Record<string, string>): ExternalRegistryPayload => {
  if (Buffer.byteLength(content, 'utf8') > EXTERNAL_REGISTRY_MAX_INDEX_BYTES) throw new Error('registry_index_too_large');
  let input: unknown;
  try { input = JSON.parse(content); } catch { throw new Error('registry_index_invalid'); }
  const signed = signedIndexSchema.safeParse(input);
  if (!signed.success) throw new Error('registry_index_invalid');
  const publicKey = publicKeys[signed.data.keyId];
  if (!publicKey || !verify(null, Buffer.from(signed.data.payload), publicKey, Buffer.from(signed.data.signature, 'base64'))) throw new Error('registry_signature_invalid');
  let payload: unknown;
  try { payload = JSON.parse(signed.data.payload); } catch { throw new Error('registry_payload_invalid'); }
  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success || new Set(parsed.data.entries.map((entry) => `${entry.id}:${entry.version}`)).size !== parsed.data.entries.length) throw new Error('registry_payload_invalid');
  return parsed.data;
};

export const assertExternalPackageResponse = (content: string, contentType: string | null, expectedSha256: string) => {
  if (contentType?.split(';')[0] !== 'application/vnd.zadiag.routine+json') throw new Error('registry_package_mime_invalid');
  if (Buffer.byteLength(content, 'utf8') > EXTERNAL_REGISTRY_MAX_PACKAGE_BYTES) throw new Error('registry_package_too_large');
  if (sha256Hex(content) !== expectedSha256) throw new Error('registry_package_checksum_invalid');
};
