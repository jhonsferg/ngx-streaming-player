import { Component, input, output, inject, computed } from '@angular/core';
import { SubtitleTrack } from '../../../../models/player.models';
import { PLAYER_TRANSLATIONS } from '../../../../tokens/player.tokens';
import {
  DEFAULT_PLAYER_TRANSLATIONS,
  PlayerTranslations,
} from '../../../../models/player-translations.model';

/**
 * Settings (gear) menu with hierarchical sub-panels.
 *
 * The menu is a two-level panel:
 * - **Main panel** - shows rows for playback speed, quality, and (when
 *   available) subtitles. Each row displays the current selection and a
 *   chevron to navigate to the corresponding sub-panel.
 * - **Sub-panels** - `'speed'`, `'quality'`, `'subtitles'` - show a list of
 *   options; selecting one emits the appropriate output and navigates back to
 *   `'main'`.
 *
 * The active panel is controlled by the parent (`activeMenu` input), keeping
 * this component purely presentational (all state is owned by
 * `PlayerControlsComponent`).
 *
 * ### Live stream behaviour
 * When `[isLive]="true"` the speed row and speed sub-panel are hidden because
 * changing playback rate on a live stream is generally not meaningful.
 *
 * @example
 * <ngx-sp-settings-menu
 *   [showSettingsMenu]="showSettingsMenu()"
 *   [activeMenu]="activeSettingsTab()"
 *   [playbackRate]="stateService.playbackRate()"
 *   [currentQuality]="currentQuality"
 *   [qualityLevels]="stateService.availableQualities()"
 *   [supportsSubtitles]="stateService.supportsSubtitles()"
 *   [availableSubtitles]="stateService.availableSubtitles()"
 *   [activeSubtitleId]="stateService.activeSubtitleId()"
 *   [isLive]="stateService.isLive()"
 *   (setMenuVisibility)="showSettingsMenu.set($event)"
 *   (navigateMenu)="activeSettingsTab.set($event)"
 *   (setSpeed)="setPlaybackRate($event)"
 *   (setQuality)="setQuality($event)"
 *   (setSubtitle)="setSubtitle($event)"
 * ></ngx-sp-settings-menu>
 */
@Component({
  selector: 'ngx-sp-settings-menu',
  standalone: true,
  templateUrl: './ngx-sp-settings-menu.html',
  styleUrls: ['./ngx-sp-settings-menu.scss'],
})
export class NgxSpSettingsMenu {
  // -- Inputs ------------------------------------------------------------------

  /** Whether the settings panel overlay is currently visible. */
  showSettingsMenu = input.required<boolean>();

  /**
   * Which panel to render.
   *
   * | Value          | Panel displayed                 |
   * |----------------|---------------------------------|
   * | `'main'`       | Main menu with all rows         |
   * | `'speed'`      | Playback speed options list     |
   * | `'quality'`    | Quality level options list      |
   * | `'subtitles'`  | Subtitle track options list     |
   */
  activeMenu = input.required<'main' | 'speed' | 'quality' | 'subtitles'>();

  /** Currently active playback rate (e.g. `1`, `1.5`). */
  playbackRate = input.required<number>();

  /**
   * Human-readable label of the active quality level (e.g. `'1080p'`, `'auto'`).
   * Displayed as the current selection in the quality row.
   */
  currentQuality = input.required<string>();

  /**
   * All quality levels available for the current source.
   * Each element is either a plain string label or a quality-level object
   * with `height` / `bitrate` fields (the latter is handled by `getLevelLabel`).
   *
   * @default []
   */
  qualityLevels = input<any[]>([]);

  /** Whether the current source exposes at least one subtitle track. */
  supportsSubtitles = input.required<boolean>();

  /**
   * All detected subtitle tracks, used to populate the subtitles sub-panel.
   * @default []
   */
  availableSubtitles = input<SubtitleTrack[]>([]);

  /**
   * `SubtitleTrack.id` of the currently active track, or `null` when
   * subtitles are disabled.
   * @default null
   */
  activeSubtitleId = input<string | number | null>(null);

  /**
   * When `true`, hides the playback-speed row and sub-panel because speed
   * changes are not meaningful for live streams.
   * @default false
   */
  isLive = input<boolean>(false);

  // -- Outputs -----------------------------------------------------------------

  /**
   * Emitted to show (`true`) or hide (`false`) the settings panel.
   * Toggled by the gear-icon trigger button.
   */
  setMenuVisibility = output<boolean>();

  /**
   * Emitted when the user clicks a row to navigate to a sub-panel, or the
   * back-chevron to return to `'main'`.
   */
  navigateMenu = output<'main' | 'speed' | 'quality' | 'subtitles'>();

  /**
   * Emitted when the user selects a playback speed in the speed sub-panel.
   * Payload is the raw rate value (e.g. `1.5`).
   */
  setSpeed = output<number>();

  /**
   * Emitted when the user selects a quality level in the quality sub-panel.
   * Payload is the string quality label (e.g. `'1080p'`, `'auto'`).
   */
  setQuality = output<string>();

  /**
   * Emitted when the user selects a subtitle track (or disables subtitles).
   * Payload is the `SubtitleTrack.id` or `null` to disable.
   */
  setSubtitle = output<string | number | null>();

  // -- Translations ------------------------------------------------------------

  /** @internal Optional translation overrides injected from `withTranslations()`. */
  private readonly customTranslations = inject(PLAYER_TRANSLATIONS, { optional: true });

  /**
   * Merged translation map: English defaults overridden by any keys supplied
   * via `withTranslations()`.  Use `i18n().xxx` in the template.
   */
  readonly i18n = computed<PlayerTranslations>(() => ({
    ...DEFAULT_PLAYER_TRANSLATIONS,
    ...(this.customTranslations ?? {}),
  }));

  // -- Static data -------------------------------------------------------------

  /**
   * Fixed list of playback speed options shown in the speed sub-panel.
   * Ordered from slowest to fastest.
   */
  playbackSpeeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

  // -- Quality helpers ----------------------------------------------------------

  /**
   * Returns the display label for a quality string.
   * Capitalises `'auto'`; returns all other strings unchanged.
   *
   * @param quality - Quality string (e.g. `'auto'`, `'1080p'`).
   * @returns Human-readable label.
   */
  getQualityLabel(quality: string): string {
    if (quality === 'auto') return 'Auto';
    return quality;
  }

  /**
   * Returns `true` when the current quality is set to ABR (`'auto'`).
   */
  isAutoQuality(): boolean {
    return this.currentQuality() === 'auto';
  }

  /**
   * Returns `true` when the given quality level matches the currently active
   * quality. Handles both plain string labels and level objects.
   *
   * @param level - String quality label or quality-level object with `height` / `id`.
   */
  isActiveQuality(level: any): boolean {
    const current = this.currentQuality();
    if (typeof level === 'string') return current === level;
    return current === `${level.height}p` || current === String(level.id);
  }

  /**
   * Returns a human-readable label for any quality-level representation.
   *
   * | Input type           | Output example |
   * |----------------------|----------------|
   * | `'auto'` string      | `'Automático'` |
   * | other string         | the string itself |
   * | object with `height` | `'720p'`       |
   * | object with `bitrate`| `'2500kbps'`   |
   * | anything else        | `'Unknown'`    |
   *
   * @param level - Quality level value from `qualityLevels`.
   */
  getLevelLabel(level: any): string {
    if (level === 'auto') return this.i18n().auto;
    if (typeof level === 'string') return level;
    if (level.height) return `${level.height}p`;
    if (level.bitrate) return `${Math.round(level.bitrate / 1000)}kbps`;
    return 'Unknown';
  }

  /**
   * Handles quality selection for both string labels and quality-level
   * objects. Delegates to `onSetQuality` after normalising the value.
   *
   * @param level - String quality label or quality-level object.
   */
  onSetQualityObject(level: any): void {
    if (typeof level === 'string') {
      this.onSetQuality(level);
      return;
    }
    this.onSetQuality(String(level.id ?? level.height));
  }

  // -- Output emitters ----------------------------------------------------------

  /**
   * Emits `setMenuVisibility` to show or hide the panel.
   *
   * @param show - `true` to open, `false` to close.
   */
  onSetMenuVisibility(show: boolean): void {
    this.setMenuVisibility.emit(show);
  }

  /**
   * Emits `navigateMenu` to switch the active sub-panel.
   *
   * @param menu - Target panel identifier.
   */
  onNavigateMenu(menu: 'main' | 'speed' | 'quality' | 'subtitles'): void {
    this.navigateMenu.emit(menu);
  }

  /**
   * Emits `setSpeed` with the selected playback rate.
   *
   * @param speed - Selected rate (e.g. `1.5`).
   */
  onSetSpeed(speed: number): void {
    this.setSpeed.emit(speed);
  }

  /**
   * Emits `setQuality` with the selected quality string label.
   *
   * @param qualityId - Quality label or `'auto'`.
   */
  onSetQuality(qualityId: string): void {
    this.setQuality.emit(qualityId);
  }

  // -- Subtitle helpers ---------------------------------------------------------

  /**
   * Returns a display string for the currently active subtitle selection.
   *
   * | Active subtitle state       | Returned string        |
   * |-----------------------------|------------------------|
   * | No active track (disabled)  | `'Desactivado'`        |
   * | Track with a matching label | The track's `label`    |
   * | Active but no matching track| `'Activado'`           |
   *
   * @returns Human-readable subtitle state string.
   */
  getSubtitleLabel(): string {
    const id = this.activeSubtitleId();
    if (id === null) return this.i18n().subtitlesOff;
    const track = this.availableSubtitles().find((t) => String(t.id) === String(id));
    return track?.label || this.i18n().subtitlesEnabled;
  }

  /**
   * Returns `true` when the given track is the currently active subtitle track.
   *
   * @param track - The `SubtitleTrack` to test.
   */
  isActiveSubtitle(track: SubtitleTrack): boolean {
    const id = this.activeSubtitleId();
    return id !== null && String(id) === String(track.id);
  }

  /**
   * Emits `setSubtitle` to activate a track or disable subtitles.
   *
   * @param id - Track ID to activate, or `null` to disable.
   */
  onSetSubtitle(id: string | number | null): void {
    this.setSubtitle.emit(id);
  }

  /**
   * Alias for `onNavigateMenu` - provides explicit typing at call sites
   * where the menu name is inferred from a string literal.
   *
   * @param menu - Target panel identifier.
   */
  onNavigateMenuTyped(menu: 'main' | 'speed' | 'quality' | 'subtitles'): void {
    this.navigateMenu.emit(menu);
  }
}
