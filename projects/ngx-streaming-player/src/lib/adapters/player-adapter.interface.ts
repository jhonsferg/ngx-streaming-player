/**
 * @fileoverview Re-exports the `IPlayerAdapter` interface from the central
 * models file as a convenience path for consumers that only need the adapter
 * contract (e.g. when building a custom adapter without importing the full
 * model set).
 *
 * @example
 * import type { IPlayerAdapter } from 'ngx-streaming-player';
 */
export type { IPlayerAdapter } from '../models/player.models';
