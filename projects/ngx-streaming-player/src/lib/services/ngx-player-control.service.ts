import { Injectable } from '@angular/core';
import { PlayerConfig } from '../models/player.models';
import { PlayerService } from './player.service';
import { PlayerStateService } from './player-state.service';

/**
 * Public API for controlling any `<ngx-sp-player>` instance from anywhere
 * in the Angular application.
 *
 * `NgxPlayerControlService` maintains an internal registry that maps each
 * player's `playerId` string to its `PlayerService` and `PlayerStateService`
 * instances. This allows code outside the player component tree to drive
 * playback, swap sources, read reactive state, and query player availability.
 *
 * ### Registration lifecycle
 * Each `<ngx-sp-player>` calls `_register()` in `ngAfterViewInit` and
 * `_unregister()` in `ngOnDestroy`. The service is provided at the root
 * level so it persists across route changes.
 *
 * ### Single player (default ID)
 * When only one player is on the page the `playerId` parameter can be omitted
 * everywhere — it defaults to `'default'`.
 *
 * @example
 * // -- app.component.ts -----------------------------------------------------
 * @Component({ … })
 * export class AppComponent {
 *   readonly playerControl = inject(NgxPlayerControlService);
 *
 *   playVideo(): void {
 *     this.playerControl.play();
 *   }
 *
 *   swapSource(): void {
 *     this.playerControl.load('https://example.com/new-stream.m3u8');
 *   }
 *
 *   readState(): void {
 *     const state = this.playerControl.getState();
 *     console.log('Playing?', state?.isPlaying());
 *     console.log('Time:', state?.currentTime());
 *   }
 * }
 *
 * @example
 * // -- Multiple players ------------------------------------------------------
 * // Template:
 * // <ngx-sp-player playerId="cam1" [src]="url1"></ngx-sp-player>
 * // <ngx-sp-player playerId="cam2" [src]="url2"></ngx-sp-player>
 *
 * switchCam2(): void {
 *   this.playerControl.load('https://example.com/cam2-hd.m3u8', {}, 'cam2');
 * }
 *
 * muteAll(): void {
 *   this.playerControl.setMuted(true, 'cam1');
 *   this.playerControl.setMuted(true, 'cam2');
 * }
 */
@Injectable({ providedIn: 'root' })
export class NgxPlayerControlService {
  /**
   * Internal registry mapping each player ID to its service pair.
   * Populated by `_register()` / `_unregister()`.
   */
  private readonly registry = new Map<string, { ps: PlayerService; ss: PlayerStateService }>();

  // -- Internal registration (called by StreamingPlayerComponent) -------------

  /**
   * Registers a player instance so it can be controlled via this service.
   *
   * Called automatically by `StreamingPlayerComponent` in `ngAfterViewInit`.
   * **Do not call this method from application code.**
   *
   * @internal
   * @param id - The player's `playerId` input value.
   * @param ps - The `PlayerService` instance scoped to this player.
   * @param ss - The `PlayerStateService` instance scoped to this player.
   */
  _register(id: string, ps: PlayerService, ss: PlayerStateService): void {
    this.registry.set(id, { ps, ss });
  }

  /**
   * Removes a player instance from the registry.
   *
   * Called automatically by `StreamingPlayerComponent` in `ngOnDestroy`.
   * **Do not call this method from application code.**
   *
   * @internal
   * @param id - The `playerId` of the player being destroyed.
   */
  _unregister(id: string): void {
    this.registry.delete(id);
  }

  /**
   * Resolves the service pair for the given player ID.
   *
   * @param playerId - Target player ID. Defaults to `'default'`.
   * @returns The `{ ps, ss }` pair or `null` if no player with that ID is
   *   registered (e.g. the component has not yet rendered or has been destroyed).
   */
  private resolve(playerId = 'default') {
    return this.registry.get(playerId) ?? null;
  }

  // -- Source control ----------------------------------------------------------

  /**
   * Hot-swaps the media source of the target player.
   *
   * The player resets its playback state and loads the new source while
   * preserving the user's volume and mute preferences. The protocol is
   * auto-detected from the new URL unless `config.protocol` is specified.
   *
   * @param src - New media URL (HLS `.m3u8`, DASH `.mpd`, `.mp4`, YouTube).
   * @param config - Optional partial config overrides applied to the new load.
   * @param playerId - Target player ID. Defaults to `'default'`.
   *
   * @example
   * // Simple source swap
   * playerControl.load('https://example.com/video.mp4');
   *
   * @example
   * // Swap and autoplay, targeting a specific player
   * playerControl.load(
   *   'https://example.com/live.m3u8',
   *   { autoplay: true, muted: true },
   *   'main-player',
   * );
   */
  load(src: string, config: Partial<PlayerConfig> = {}, playerId = 'default'): void {
    this.resolve(playerId)?.ps.loadSource(src, config);
  }

  // -- Playback control --------------------------------------------------------

  /**
   * Starts or resumes playback on the target player.
   *
   * @param playerId - Target player ID. Defaults to `'default'`.
   * @returns A Promise that resolves when playback begins, or resolves
   *   immediately if the player is not registered.
   *
   * @example
   * await playerControl.play();
   */
  play(playerId = 'default'): Promise<void> {
    return this.resolve(playerId)?.ps.play() ?? Promise.resolve();
  }

  /**
   * Pauses playback on the target player.
   *
   * @param playerId - Target player ID. Defaults to `'default'`.
   *
   * @example
   * playerControl.pause();
   */
  pause(playerId = 'default'): void {
    this.resolve(playerId)?.ps.pause();
  }

  /**
   * Seeks to the specified position on the target player.
   *
   * @param time - Target position in seconds.
   * @param playerId - Target player ID. Defaults to `'default'`.
   *
   * @example
   * playerControl.seek(120); // jump to 2:00
   */
  seek(time: number, playerId = 'default'): void {
    this.resolve(playerId)?.ps.seek(time);
  }

  /**
   * Sets the audio volume on the target player.
   *
   * @param volume - Desired volume level in the range `[0, 1]`.
   * @param playerId - Target player ID. Defaults to `'default'`.
   *
   * @example
   * playerControl.setVolume(0.5); // 50 %
   */
  setVolume(volume: number, playerId = 'default'): void {
    this.resolve(playerId)?.ps.setVolume(volume);
  }

  /**
   * Mutes or unmutes audio on the target player.
   *
   * @param muted - `true` to mute, `false` to unmute.
   * @param playerId - Target player ID. Defaults to `'default'`.
   *
   * @example
   * playerControl.setMuted(true);  // mute
   * playerControl.setMuted(false); // unmute
   */
  setMuted(muted: boolean, playerId = 'default'): void {
    this.resolve(playerId)?.ps.setMuted(muted);
  }

  /**
   * Changes the playback speed of the target player.
   *
   * @param rate - Desired playback rate (1 = normal, 0.5 = half, 2 = double).
   * @param playerId - Target player ID. Defaults to `'default'`.
   *
   * @example
   * playerControl.setPlaybackRate(1.5);
   */
  setPlaybackRate(rate: number, playerId = 'default'): void {
    this.resolve(playerId)?.ps.setPlaybackRate(rate);
  }

  /**
   * Switches the quality level of the target player.
   *
   * @param quality - Quality label (e.g. `'1080p'`) or `'auto'` for ABR.
   * @param playerId - Target player ID. Defaults to `'default'`.
   *
   * @example
   * playerControl.setQuality('720p');
   * playerControl.setQuality('auto');
   */
  setQuality(quality: string, playerId = 'default'): void {
    this.resolve(playerId)?.ps.setQuality(quality);
  }

  /**
   * Toggles subtitles on the target player.
   *
   * Activates the first available track when currently disabled, and
   * deactivates all tracks when currently enabled.
   *
   * @param playerId - Target player ID. Defaults to `'default'`.
   *
   * @example
   * playerControl.toggleSubtitles();
   */
  toggleSubtitles(playerId = 'default'): void {
    this.resolve(playerId)?.ps.toggleSubtitles();
  }

  /**
   * Activates a specific subtitle track or disables subtitles entirely.
   *
   * @param id - `SubtitleTrack.id` to activate, or `null` to disable.
   * @param playerId - Target player ID. Defaults to `'default'`.
   *
   * @example
   * playerControl.setSubtitle('en');   // enable English subtitles
   * playerControl.setSubtitle(null);   // disable subtitles
   */
  setSubtitle(id: string | number | null, playerId = 'default'): void {
    this.resolve(playerId)?.ps.setSubtitle(id);
  }

  // -- State access ------------------------------------------------------------

  /**
   * Returns the `PlayerStateService` for the given player, exposing all
   * reactive state signals.
   *
   * All properties on the returned service are read-only Angular Signals.
   * Use them inside `effect()` or directly in templates.
   *
   * Returns `null` if no player with the given ID is currently registered
   * (component not yet rendered or already destroyed).
   *
   * @param playerId - Target player ID. Defaults to `'default'`.
   * @returns The `PlayerStateService` or `null`.
   *
   * @example
   * const state = playerControl.getState();
   * console.log('Is playing:', state?.isPlaying());
   * console.log('Current time:', state?.currentTime());
   * console.log('Volume:', state?.volume());
   *
   * @example
   * // Reactive binding inside an effect:
   * effect(() => {
   *   const s = playerControl.getState('cam1');
   *   if (s?.isLive()) showLiveBadge();
   * });
   */
  getState(playerId = 'default'): PlayerStateService | null {
    return this.resolve(playerId)?.ss ?? null;
  }

  /**
   * Returns `true` if a player with the given ID is currently registered and
   * ready to receive commands.
   *
   * Useful for guard checks before attempting programmatic control.
   *
   * @param playerId - Target player ID. Defaults to `'default'`.
   *
   * @example
   * if (playerControl.isRegistered('main')) {
   *   playerControl.play('main');
   * }
   */
  isRegistered(playerId = 'default'): boolean {
    return this.registry.has(playerId);
  }
}
