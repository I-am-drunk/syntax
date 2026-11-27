import { z } from 'zod'

export const CloudExtensionEntrySchema = z.object({
  id: z.string().min(3).max(64),
  manifestUrl: z
    .string()
    .url()
    .max(320)
    .refine(u => u.startsWith('https://') || u.startsWith('http://')),
  enabled: z.boolean(),
})

export type CloudExtensionEntry = z.infer<typeof CloudExtensionEntrySchema>

/**
 * Compact schema stored inside Clerk `user.unsafeMetadata.syntaxCloudV1`.
 * Strictly kept well under Clerk's 8 KB unsafeMetadata ceiling.
 */
export const SyntaxCloudPayloadSchema = z.object({
  v: z.literal(1),
  updatedAt: z.string(),
  theme: z.enum(['light', 'dark']).optional(),
  soundOn: z.boolean().optional(),
  prefs: z
    .object({
      onboarded: z.boolean().optional(),
      logoClickTarget: z.enum(['library', 'home']).optional(),
      semaShape: z.string().max(32).optional(),
      semaTail: z.string().max(32).optional(),
      semaExpression: z.string().max(32).optional(),
    })
    .optional(),
  extensions: z.array(CloudExtensionEntrySchema).max(30).optional(),
  extensionSettings: z
    .record(
      z.string().max(64),
      z.record(
        z.string().max(64),
        z.union([z.boolean(), z.string().max(240), z.number().finite()]),
      ),
    )
    .optional(),
})

export type SyntaxCloudPayload = z.infer<typeof SyntaxCloudPayloadSchema>

export function extractRemoteCloudPayload(
  unsafeMetadata: Record<string, unknown> | null | undefined,
): SyntaxCloudPayload | null {
  if (!unsafeMetadata || typeof unsafeMetadata !== 'object') return null
  const raw = unsafeMetadata.syntaxCloudV1
  const parsed = SyntaxCloudPayloadSchema.safeParse(raw)
  return parsed.success ? parsed.data : null
}

/** Fingerprint ignoring `updatedAt` so identical snapshots don't spam Clerk API writes. */
export function fingerprintCloudPayload(payload: SyntaxCloudPayload): string {
  const { updatedAt: _ignored, ...rest } = payload
  return JSON.stringify(rest)
}
