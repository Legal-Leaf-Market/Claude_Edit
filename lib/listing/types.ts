export type PublishResult =
  | { ok: true; externalId: string | null; externalUrl: string | null }
  | { ok: false; reason: string }
