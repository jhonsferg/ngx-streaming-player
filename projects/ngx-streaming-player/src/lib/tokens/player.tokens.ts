/**
 * @fileoverview Injection tokens for the ngx-streaming-player provider system.
 *
 * These tokens are populated by the feature functions passed to `providePlayer()`
 * (`withTranslations()`, `withTheme()`, `withDefaults()`) and consumed
 * optionally inside the player sub-components and `StreamingPlayerComponent`.
 *
 * All tokens are optional - components use `inject(TOKEN, { optional: true })`
 * and fall back to built-in defaults when the token has no provider.
 */

import { InjectionToken } from '@angular/core';
import { PlayerTranslations } from '../models/player-translations.model';
import { PlayerTheme, PlayerConfig } from '../models/player.models';

/**
 * Optional injection token that carries a partial UI-string override map.
 *
 * Provided by `withTranslations()` inside `providePlayer()`.
 * Components merge this with `DEFAULT_PLAYER_TRANSLATIONS` at runtime.
 *
 * @example
 * // Inject inside a component
 * private readonly t = inject(PLAYER_TRANSLATIONS, { optional: true });
 */
export const PLAYER_TRANSLATIONS = new InjectionToken<Partial<PlayerTranslations>>(
  'NGX_SP_PLAYER_TRANSLATIONS',
);

/**
 * Optional injection token that carries a global `PlayerTheme` baseline.
 *
 * Provided by `withTheme()` inside `providePlayer()`.
 * Applied as the lowest-priority layer - component-level `[theme]` inputs
 * and `config.theme` objects always win over this global baseline.
 *
 * @example
 * // Inject inside a service
 * private readonly globalTheme = inject(PLAYER_THEME, { optional: true });
 */
export const PLAYER_THEME = new InjectionToken<Partial<PlayerTheme>>('NGX_SP_PLAYER_THEME');

/**
 * Optional injection token that carries global `PlayerConfig` defaults.
 *
 * Provided by `withDefaults()` inside `providePlayer()`.
 * Merged as the lowest-priority layer - component `[config]` and shorthand
 * inputs always override these global defaults.
 *
 * @example
 * // Inject inside StreamingPlayerComponent
 * private readonly globalDefaults = inject(PLAYER_DEFAULTS, { optional: true });
 */
export const PLAYER_DEFAULTS = new InjectionToken<Partial<PlayerConfig>>('NGX_SP_PLAYER_DEFAULTS');
