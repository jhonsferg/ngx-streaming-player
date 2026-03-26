/**
 * @fileoverview Player UI text translations interface and English defaults.
 *
 * Pass a `Partial<PlayerTranslations>` to `withTranslations()` inside
 * `providePlayer()` to localise every visible string in the player UI.
 * Any key you omit falls back to the English default defined in
 * `DEFAULT_PLAYER_TRANSLATIONS`.
 *
 * @example
 * // app.config.ts — Spanish locale
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     providePlayer(
 *       withTranslations({
 *         play:         'Reproducir (k)',
 *         pause:        'Pausar (k)',
 *         settings:     'Configuración',
 *         quality:      'Calidad',
 *         speed:        'Velocidad',
 *         subtitles:    'Subtítulos',
 *         auto:         'Automático',
 *         normalSpeed:  'Normal',
 *         subtitlesOff: 'Desactivado',
 *         live:         'EN VIVO',
 *       }),
 *     ),
 *   ],
 * };
 */

/**
 * Complete set of translatable strings used by the player UI.
 *
 * Every property maps to a visible label, tooltip, or status string rendered
 * by one of the player sub-components.  Supply a `Partial<PlayerTranslations>`
 * to `withTranslations()` — missing keys fall back to `DEFAULT_PLAYER_TRANSLATIONS`.
 */
export interface PlayerTranslations {
  // ── Controls bar — button tooltips ─────────────────────────────────────────

  /** Tooltip shown on the play button when the player is paused. */
  play: string;

  /** Tooltip shown on the pause button when the player is playing. */
  pause: string;

  /** Tooltip for the subtitles toggle button. */
  subtitles: string;

  /** Tooltip for the Picture-in-Picture entry button. */
  pip: string;

  /** Tooltip for the enter-fullscreen button. */
  fullscreen: string;

  /** Tooltip for the exit-fullscreen button. */
  exitFullscreen: string;

  /** Title / tooltip for the "Watch on YouTube" link shown during YT playback. */
  watchOnYouTube: string;

  // ── Controls bar — status labels ───────────────────────────────────────────

  /** Text of the live-stream badge shown in place of the time display. */
  live: string;

  // ── Settings panel ─────────────────────────────────────────────────────────

  /** Header label at the top of the settings panel. */
  settings: string;

  /** Row label and sub-panel heading for the quality selector. */
  quality: string;

  /** Row label and sub-panel heading for the playback-speed selector. */
  speed: string;

  /** Row label and sub-panel heading for the subtitle track selector. */
  captionsTracks: string;

  // ── Quality sub-panel ──────────────────────────────────────────────────────

  /**
   * Label for the "Automatic / ABR" quality option.
   * Also used by `getLevelLabel()` for quality objects with `level === 'auto'`.
   */
  auto: string;

  // ── Speed sub-panel ────────────────────────────────────────────────────────

  /** Label for the `1×` speed option displayed in the speed sub-panel. */
  normalSpeed: string;

  // ── Subtitles sub-panel ────────────────────────────────────────────────────

  /** Label for the "turn off subtitles" option and the disabled status badge. */
  subtitlesOff: string;

  /**
   * Fallback label displayed in the settings row when subtitles are active
   * but no matching track label can be found in `availableSubtitles`.
   */
  subtitlesEnabled: string;
}

/**
 * English default translations used when `withTranslations()` is not called
 * or when individual keys are omitted from the supplied partial object.
 *
 * All keyboard shortcut hints (e.g. `(k)`, `(f)`) are included in the defaults
 * to match the standard YouTube-like UX. Override them if your app exposes
 * different shortcuts or if you want to remove the hint.
 */
export const DEFAULT_PLAYER_TRANSLATIONS: PlayerTranslations = {
  play: 'Play (k)',
  pause: 'Pause (k)',
  subtitles: 'Subtitles (c)',
  pip: 'Picture in picture (i)',
  fullscreen: 'Fullscreen (f)',
  exitFullscreen: 'Exit fullscreen (f)',
  watchOnYouTube: 'Watch on YouTube',
  live: 'LIVE',
  settings: 'Settings',
  quality: 'Quality',
  speed: 'Speed',
  captionsTracks: 'Subtitles',
  auto: 'Auto',
  normalSpeed: 'Normal',
  subtitlesOff: 'Off',
  subtitlesEnabled: 'On',
};
