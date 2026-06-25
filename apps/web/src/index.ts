// Placeholder. Foundation C builds the Vite/React shell, Tailwind theme tokens,
// the API client, TanStack Query setup, and the Home/Progress section slots.
//
// The import proves cross-workspace raw-TS resolution of @pacer/shared at
// typecheck time (no build/dist step).
import { metersToKm } from '@pacer/shared';

export const placeholder = metersToKm(1000);
