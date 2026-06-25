import { zValidator as honoZValidator } from '@hono/zod-validator';
import type { ZodSchema } from 'zod';
import type { ValidationTargets } from 'hono';

// Thin wrapper over @hono/zod-validator so every slice returns the SAME shape on
// a validation failure: HTTP 422 with `{ error: 'Validation failed', issues }`.
// Use this instead of importing zValidator directly — uniform errors across the API.

export function zValidator<T extends keyof ValidationTargets, S extends ZodSchema>(
  target: T,
  schema: S,
) {
  return honoZValidator(target, schema, (result, c) => {
    if (!result.success) {
      return c.json(
        { error: 'Validation failed', issues: result.error.issues },
        422,
      );
    }
    return undefined;
  });
}
