/**
 * @fileoverview Controls bar component for ngx-streaming-player.
 */

import {
  Component,
  ChangeDetectionStrategy,
  signal,
  computed,
  HostListener,
  inject,
  input,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { PlayerService } from '../../services/player.service';
import { PlayerStateService } from '../../services/player-state.service';
import { PlayerConfig } from '../../models/player.models';
import { NgxSpButton } from './components/ngx-sp-button/ngx-sp-button';
import { NgxSpTimeDisplay } from './components/ngx-sp-time-display/ngx-sp-time-display';
import { NgxSpVolumeControl } from './components/ngx-sp-volume-control/ngx-sp-volume-control';
import { NgxSpProgressBar } from './components/ngx-sp-progress-bar/ngx-sp-progress-bar';
import { NgxSpSettingsMenu } from './components/ngx-sp-settings-menu/ngx-sp-settings-menu';

/**
 * Full-featured controls bar rendered inside `<ngx-sp-player>`.
 *
 * This component orchestrates all player-control sub-components:
 * - `<ngx-sp-progress-bar>` — seekable timeline with buffered indicator.
 * - `<ngx-sp-button>` — play/pause, skip, subtitle, PiP, fullscreen buttons.
 * - `<ngx-sp-volume-control>` — mute button + volume slider.
 * - `<ngx-sp-time-display>` — current time / total duration.
 * - `<ngx-sp-settings-menu>` — gear menu for speed, quality, and subtitles.
 *
 * `PlayerService` and `PlayerStateService` are injected directly (not passed
 * as `@Input`) because this component is always rendered inside the
 * `StreamingPlayerComponent` provider scope.
 *
 * ### Layout visibility
 * Individual control elements can be hidden by setting the corresponding
 * `showXxx` flags to `false` inside `PlayerConfig.controlsLayout`. The
 * `showControls` computed signal pre-evaluates all flags so the template
 * stays declarative.
 *
 * @example
 * <!-- Rendered automatically inside <ngx-sp-player> — do not use standalone -->
 * <ngx-sp-player-controls [config]="resolvedConfig"></ngx-sp-player-controls>
 */
@Component({
  selector: 'ngx-sp-player-controls',
  standalone: true,
  imports: [
    CommonModule,
    NgxSpButton,
    NgxSpTimeDisplay,
    NgxSpVolumeControl,
    NgxSpSettingsMenu,
    NgxSpProgressBar,
  ],
  templateUrl: './player-controls.component.html',
  styleUrls: ['./player-controls.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayerControlsComponent {
  /**
   * Fully resolved player configuration from the parent
   * `StreamingPlayerComponent`. Used to derive visibility flags,
   * playback rate options, and auto-hide settings.
   */
  config = input.required<PlayerConfig>();

  /** @internal Reactive state service injected from the parent scope. */
  readonly stateService = inject(PlayerStateService);

  /** @internal Player service injected from the parent scope. */
  readonly playerService = inject(PlayerService);

  // -- UI state signals ------------------------------------------------------

  /**
   * `true` while the user is dragging the progress bar handle.
   * Used to prevent the controls bar from hiding during an active drag.
   */
  readonly isDraggingProgress = signal(false);

  /** `true` while the volume slider is expanded and visible. */
  readonly showVolumeSlider = signal(false);

  /** `true` while the settings panel is open. */
  readonly showSettingsMenu = signal(false);

  /**
   * Which sub-panel is active inside the settings menu.
   *
   * | Value        | Panel shown                  |
   * |--------------|------------------------------|
   * | `'main'`     | Main menu (speed/quality/subs rows) |
   * | `'speed'`    | Playback speed options       |
   * | `'quality'`  | Quality level options        |
   * | `'subtitles'`| Subtitle track options       |
   */
  readonly activeSettingsTab = signal<'main' | 'speed' | 'quality' | 'subtitles'>('main');

  /** `true` while the user is dragging the volume slider. */
  readonly isDraggingVolume = signal(false);

  /**
   * Current hover position on the progress bar as a fraction in `[0, 1]`,
   * or `null` when the cursor is not over the bar.
   */
  readonly hoverPercent = signal<number | null>(null);

  /**
   * Formatted time string for the progress-bar hover tooltip.
   * Derived from `hoverPercent` and the current `duration`.
   *
   * @example
   * // hoverPercent = 0.5, duration = 120  →  "01:00"
   */
  readonly hoverTime = computed(() => {
    const percent = this.hoverPercent();
    if (percent === null) return null;
    return this.formatTime(percent * this.stateService.duration());
  });

  /**
   * Available playback rate options, sourced from `config.playbackRates`.
   * Falls back to a sensible default set when the config omits this field.
   */
  readonly playbackRates = computed(
    () => this.config().playbackRates || [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2],
  );

  /**
   * Pre-evaluated visibility flags for every control element.
   * Derived from `PlayerConfig.controlsLayout` so the template stays clean.
   *
   * @example
   * // Template: *ngIf="showControls().fullscreen"
   */
  readonly showControls = computed(() => {
    const layout = this.config().controlsLayout;
    return {
      playPause: layout?.showPlayPause !== false,
      volume: layout?.showVolume !== false,
      progress: layout?.showProgress !== false,
      time: layout?.showTime !== false,
      speed: layout?.showSpeed !== false,
      quality: layout?.showQuality !== false,
      fullscreen: layout?.showFullscreen !== false,
      pip: layout?.showPiP !== false,
      settings: layout?.showSettings !== false,
    };
  });

  // -- Document-level click handler ------------------------------------------

  /**
   * Closes the settings menu when a click is detected outside the
   * `<ngx-sp-settings-menu>` element.
   *
   * @param event - The native `MouseEvent` from the document.
   */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('ngx-sp-settings-menu')) {
      this.showSettingsMenu.set(false);
      this.activeSettingsTab.set('main');
    }
  }

  // -- Playback controls -----------------------------------------------------

  /**
   * Toggles playback between playing and paused states.
   */
  togglePlay(): void {
    if (this.stateService.isPlaying()) {
      this.playerService.pause();
    } else {
      this.playerService.play();
    }
  }

  /**
   * Toggles audio mute state.
   */
  toggleMute(): void {
    this.playerService.setMuted(!this.stateService.muted());
  }

  /**
   * Toggles Picture-in-Picture mode.
   * Requests PiP when not in PiP; exits otherwise.
   */
  togglePiP(): void {
    if (!this.stateService.isPiP()) {
      this.playerService.requestPiP();
    } else {
      this.playerService.exitPiP();
    }
  }

  /**
   * Toggles subtitles on or off using the first available track.
   */
  toggleSubtitles(): void {
    this.playerService.toggleSubtitles();
  }

  /**
   * Activates a specific subtitle track and returns the settings menu to the
   * main panel.
   *
   * @param id - `SubtitleTrack.id` to activate, or `null` to disable subtitles.
   */
  setSubtitle(id: string | number | null): void {
    this.playerService.setSubtitle(id);
    this.activeSettingsTab.set('main');
  }

  /**
   * Seeks backward by the given number of seconds, clamped at 0.
   *
   * @param seconds - Seconds to rewind. Defaults to `10`.
   *
   * @example
   * controls.skipBackward(30); // rewind 30 seconds
   */
  skipBackward(seconds: number = 10): void {
    this.playerService.seek(Math.max(0, this.stateService.currentTime() - seconds));
  }

  /**
   * Seeks forward by the given number of seconds, clamped at `duration`.
   *
   * @param seconds - Seconds to skip ahead. Defaults to `10`.
   *
   * @example
   * controls.skipForward(30); // skip ahead 30 seconds
   */
  skipForward(seconds: number = 10): void {
    this.playerService.seek(
      Math.min(this.stateService.duration(), this.stateService.currentTime() + seconds),
    );
  }

  // -- Progress bar handlers -------------------------------------------------

  /**
   * Initiates a progress-bar drag and seeks to the click position.
   *
   * @param event - The `mousedown` event on the progress bar.
   */
  onProgressMouseDown(event: MouseEvent): void {
    this.isDraggingProgress.set(true);
    this.updateProgressFromEvent(event);
  }

  /**
   * Continues seeking while the mouse button is held during a progress drag.
   *
   * @param event - The `mousemove` event.
   */
  onProgressMouseMove(event: MouseEvent): void {
    if (this.isDraggingProgress()) {
      this.updateProgressFromEvent(event);
    }
  }

  /**
   * Ends a progress-bar drag when the cursor leaves the element.
   */
  onProgressMouseLeave(): void {
    this.isDraggingProgress.set(false);
  }

  /**
   * Seeks to the clicked position on the progress bar.
   *
   * @param event - The `click` event on the progress bar.
   */
  onProgressClick(event: MouseEvent): void {
    this.updateProgressFromEvent(event);
  }

  /**
   * Calculates the target time from a mouse event's position relative to the
   * progress bar element and calls `PlayerService.seek()`.
   *
   * @param event - A mouse event whose `currentTarget` is the progress bar element.
   */
  private updateProgressFromEvent(event: MouseEvent): void {
    const el = event.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const time = percent * this.stateService.duration();
    this.playerService.seek(time);
  }

  /**
   * Seeks to the position emitted by `<ngx-sp-progress-bar>` as a fraction
   * in `[0, 1]`.
   *
   * @param percent - Fractional position (0 = start, 1 = end).
   */
  onSeek(percent: number): void {
    const time = percent * this.stateService.duration();
    this.playerService.seek(time);
  }

  /**
   * Toggles fullscreen on a double-click forwarded from the progress bar.
   */
  onDoubleClick(): void {
    this.toggleFullscreen();
  }

  // -- Settings handlers -----------------------------------------------------

  /**
   * Returns the human-readable label of the currently active quality level.
   * Used by the settings menu to display the current selection.
   */
  get currentQuality(): string {
    return this.stateService.quality();
  }

  /**
   * Changes the playback rate and returns the settings menu to the main panel.
   *
   * @param rate - Desired playback rate (e.g. `1.5`).
   */
  setPlaybackRate(rate: number): void {
    this.playerService.setPlaybackRate(rate);
    this.activeSettingsTab.set('main');
  }

  /**
   * Changes the quality level and returns the settings menu to the main panel.
   *
   * @param quality - Quality label (e.g. `'1080p'`) or `'auto'`.
   */
  setQuality(quality: string): void {
    this.playerService.setQuality(quality);
    this.activeSettingsTab.set('main');
  }

  // -- Volume handlers -------------------------------------------------------

  /**
   * Sets the volume and automatically mutes / unmutes based on the new value.
   *
   * - Volume `0` → mute.
   * - Volume `> 0` while muted → unmute.
   *
   * @param volume - Desired volume level in the range `[0, 1]`.
   */
  setVolume(volume: number): void {
    this.playerService.setVolume(volume);

    if (volume === 0 && !this.stateService.muted()) {
      this.playerService.setMuted(true);
    } else if (volume > 0 && this.stateService.muted()) {
      this.playerService.setMuted(false);
    }
  }

  /**
   * Handles the native `input` event from the volume `<input type="range">`,
   * parsing the string value and forwarding it to `PlayerService`.
   *
   * @param event - The native `Event` from the range input.
   */
  onVolumeChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const volume = parseFloat(target.value);
    this.playerService.setVolume(volume);

    if (volume > 0 && this.stateService.muted()) {
      this.playerService.setMuted(false);
    }
  }

  // -- Fullscreen ------------------------------------------------------------

  /**
   * Toggles browser fullscreen mode via `PlayerService`.
   */
  toggleFullscreen(): void {
    if (this.stateService.isFullscreen()) {
      this.playerService.exitFullscreen();
    } else {
      this.playerService.requestFullscreen();
    }
  }

  // -- Utility ---------------------------------------------------------------

  /**
   * Returns the appropriate Material icon name for the current volume state.
   *
   * | Condition              | Icon returned    |
   * |------------------------|------------------|
   * | Muted or volume = 0    | `'volume_off'`   |
   * | Volume < 30 %          | `'volume_down'`  |
   * | Volume ≥ 30 %          | `'volume_up'`    |
   *
   * @returns Material icon name string.
   */
  getVolumeIcon(): string {
    const volume = this.stateService.volume();
    const muted = this.stateService.muted();

    if (muted || volume === 0) return 'volume_off';
    if (volume < 0.3) return 'volume_down';
    return 'volume_up';
  }

  /**
   * Converts raw seconds to a padded display string.
   *
   * @param seconds - Duration or position in seconds.
   * @returns `'mm:ss'` for durations under one hour, `'h:mm:ss'` otherwise.
   *   Returns `'00:00'` for non-finite values.
   */
  private formatTime(seconds: number): string {
    if (!isFinite(seconds)) return '00:00';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const pad = (num: number) => num.toString().padStart(2, '0');

    if (hours > 0) {
      return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
    }
    return `${pad(minutes)}:${pad(secs)}`;
  }
}
