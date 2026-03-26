/**
 * @fileoverview `providePlayer()` and its companion feature functions.
 *
 * Follow Angular's provider-function pattern (see `provideRouter`,
 * `provideHttpClient`) to configure the player at the application level.
 * Place the call in `app.config.ts` (standalone bootstrap) or in the root
 * `AppModule` providers array.
 *
 * @example
 * // app.config.ts - standalone app
 * import { providePlayer, withTranslations, withTheme, withDefaults } from 'ngx-streaming-player';
 *
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     providePlayer(
 *       withTranslations({ play: 'Reproducir', pause: 'Pausar' }),
 *       withTheme({ primaryColor: '#3b82f6' }),
 *       withDefaults({ autoplay: false, enablePiP: true, enableKeyboard: true }),
 *     ),
 *   ],
 * };
 *
 * @example
 * // app.module.ts - NgModule app
 * import { providePlayer, withTheme } from 'ngx-streaming-player';
 *
 * @NgModule({
 *   providers: [
 *     providePlayer(withTheme({ primaryColor: '#3b82f6' })),
 *   ],
 * })
 * export class AppModule {}
 */

import { EnvironmentProviders, makeEnvironmentProviders, Provider } from '@angular/core';
import { PlayerTranslations } from '../models/player-translations.model';
import { PlayerTheme, PlayerConfig } from '../models/player.models';
import { PLAYER_DEFAULTS, PLAYER_THEME, PLAYER_TRANSLATIONS } from '../tokens/player.tokens';

// ── Feature kind discriminant ────────────────────────────────────────────────

/**
 * Discriminant enum used internally to identify which feature a
 * `PlayerFeature` object represents.
 *
 * The `ɵkind` prefix follows Angular's convention for internal/framework-level
 * fields that are part of the public type but not part of the public API surface.
 */
export enum PlayerFeatureKind {
  /** Feature produced by `withTranslations()`. */
  Translations = 0,
  /** Feature produced by `withTheme()`. */
  Theme = 1,
  /** Feature produced by `withDefaults()`. */
  Defaults = 2,
}

// ── Feature type ─────────────────────────────────────────────────────────────

/**
 * Opaque token returned by every `withXxx()` feature function.
 *
 * Pass one or more instances to `providePlayer()`.  Consumers should never
 * construct this type directly - always use the dedicated factory functions.
 *
 * The `ɵ`-prefixed fields are intentionally not documented in public-facing
 * docs and must not be accessed at runtime.
 */
export interface PlayerFeature<K extends PlayerFeatureKind = PlayerFeatureKind> {
  /** @internal Discriminant used by `providePlayer()` to order providers. */
  ɵkind: K;
  /** @internal Angular providers that implement this feature. */
  ɵproviders: Provider[];
}

// ── providePlayer() ──────────────────────────────────────────────────────────

/**
 * Configures the ngx-streaming-player library for an Angular application.
 *
 * Call this function in `ApplicationConfig.providers` (or in an `NgModule`
 * providers array) and pass any combination of feature functions to opt-in
 * to specific capabilities.
 *
 * Without any features the player works out-of-the-box with English UI text,
 * no global theme, and Angular-defined default config.
 *
 * @param features - Zero or more `PlayerFeature` values created by
 *   `withTranslations()`, `withTheme()`, or `withDefaults()`.
 * @returns An `EnvironmentProviders` bundle compatible with Angular's DI.
 *
 * @example
 * // Minimal - English defaults, no customisation
 * providePlayer()
 *
 * @example
 * // Full configuration
 * providePlayer(
 *   withTranslations({ play: 'Play', pause: 'Pause' }),
 *   withTheme({ primaryColor: '#6366f1', borderRadius: '8px' }),
 *   withDefaults({ enableKeyboard: true, enablePiP: true, autoplay: false }),
 * )
 */
export function providePlayer(...features: PlayerFeature[]): EnvironmentProviders {
  const providers: Provider[] = [];
  for (const feature of features) {
    providers.push(...feature.ɵproviders);
  }
  return makeEnvironmentProviders(providers);
}

// ── withTranslations() ───────────────────────────────────────────────────────

/**
 * Provides a custom UI-string translation map to the player library.
 *
 * Supply any subset of `PlayerTranslations`.  Keys you omit fall back to the
 * built-in English strings defined in `DEFAULT_PLAYER_TRANSLATIONS`.
 *
 * @param translations - Partial translation map.
 * @returns A `PlayerFeature` to pass to `providePlayer()`.
 *
 * @example
 * withTranslations({
 *   play:         'Reproducir',
 *   pause:        'Pausar',
 *   settings:     'Configuración',
 *   quality:      'Calidad',
 *   speed:        'Velocidad',
 *   captionsTracks: 'Subtítulos',
 *   auto:         'Automático',
 *   normalSpeed:  'Normal',
 *   subtitlesOff: 'Desactivado',
 *   live:         'EN VIVO',
 * })
 */
export function withTranslations(
  translations: Partial<PlayerTranslations>,
): PlayerFeature<PlayerFeatureKind.Translations> {
  return {
    ɵkind: PlayerFeatureKind.Translations,
    ɵproviders: [{ provide: PLAYER_TRANSLATIONS, useValue: translations }],
  };
}

// ── withTheme() ──────────────────────────────────────────────────────────────

/**
 * Provides a global baseline `PlayerTheme` applied to every player instance
 * in the application.
 *
 * Individual `[config]` or `[theme]` inputs on `<ngx-sp-player>` take
 * **precedence** over this global baseline, so per-player overrides still work.
 *
 * @param theme - Global theme overrides.  Only the keys you supply are applied.
 * @returns A `PlayerFeature` to pass to `providePlayer()`.
 *
 * @example
 * withTheme({
 *   primaryColor:   '#6366f1',
 *   secondaryColor: '#8b5cf6',
 *   accentColor:    '#a78bfa',
 *   borderRadius:   '8px',
 * })
 */
export function withTheme(theme: Partial<PlayerTheme>): PlayerFeature<PlayerFeatureKind.Theme> {
  return {
    ɵkind: PlayerFeatureKind.Theme,
    ɵproviders: [{ provide: PLAYER_THEME, useValue: theme }],
  };
}

// ── withDefaults() ───────────────────────────────────────────────────────────

/**
 * Provides global `PlayerConfig` defaults applied to every player instance.
 *
 * These defaults are the **lowest-priority** layer: any `[config]` binding or
 * shorthand input (`[autoplay]`, `[muted]`, …) on `<ngx-sp-player>` overrides
 * the matching field here.
 *
 * @param config - Default config values.  Only the keys you supply are applied.
 * @returns A `PlayerFeature` to pass to `providePlayer()`.
 *
 * @example
 * withDefaults({
 *   autoplay:      false,
 *   muted:         false,
 *   enablePiP:     true,
 *   enableKeyboard: true,
 *   playbackRates: [0.5, 1, 1.5, 2],
 *   controlsLayout: { autoHide: true, autoHideDelay: 3000 },
 * })
 */
export function withDefaults(
  config: Partial<PlayerConfig>,
): PlayerFeature<PlayerFeatureKind.Defaults> {
  return {
    ɵkind: PlayerFeatureKind.Defaults,
    ɵproviders: [{ provide: PLAYER_DEFAULTS, useValue: config }],
  };
}
