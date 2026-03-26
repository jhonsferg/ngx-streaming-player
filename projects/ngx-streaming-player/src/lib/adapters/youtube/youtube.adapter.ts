import { Injectable, inject } from '@angular/core';
import { PlayerStateService } from '../../services/player-state.service';
import { IPlayerAdapter, PlayerConfig, SubtitleTrack } from '../../models/player.models';

/**
 * Maps YouTube's internal quality key strings to human-readable labels.
 *
 * YouTube exposes qualities as opaque keys (e.g. `'hd1080'`). This map
 * converts them to the same label format used by HLS and DASH adapters
 * (e.g. `'1080p'`) so the settings menu renders consistently.
 *
 * @internal
 */
const QUALITY_MAP: Record<string, string> = {
  highres: '4K',
  hd2160: '2160p',
  hd1440: '1440p',
  hd1080: '1080p',
  hd720: '720p',
  large: '480p',
  medium: '360p',
  small: '240p',
  tiny: '144p',
};

/**
 * Adapter for YouTube video playback using the **YouTube IFrame Player API**.
 *
 * Unlike the other adapters, `YouTubeAdapter` is an Angular `@Injectable`
 * service because it is shared across the component tree (provided in the
 * `StreamingPlayerComponent` providers array) and needs DI for
 * `PlayerStateService`. It renders a YouTube iframe inside a dedicated
 * container element that is separate from the native `<video>` element.
 *
 * ### Key design decisions
 *
 * **API loading strategy** — The YouTube IFrame API script is injected into
 * the document once. A chain-safe `onYouTubeIframeAPIReady` callback is used
 * (it preserves any previously registered handler) so that multiple player
 * instances on the same page do not race each other.
 *
 * **Container / API race condition** — `setContainer()` and `initialize()` can
 * arrive in any order. Each one checks whether the other pre-condition is met
 * and calls `createPlayer()` when both are available.
 *
 * **Time polling** — The IFrame API does not fire DOM-style `timeupdate`
 * events. A 250 ms `setInterval` polls `getCurrentTime()` and
 * `getVideoLoadedFraction()` while the player is in the PLAYING state.
 *
 * **Two-phase quality change** — YouTube's bandwidth probe during the BUFFERING
 * state can silently downgrade a user-selected quality. The adapter uses a
 * two-phase approach:
 * 1. Phase 1 (`setQuality`): calls `loadVideoById` with `suggestedQuality`
 *    and stores the target key in `pendingYtQuality`.
 * 2. Phase 2 (`onPlayerStateChange / PLAYING`): asserts `setPlaybackQuality`
 *    again once the player enters the PLAYING state, overriding any downgrade.
 *
 * **PiP** — The YouTube iframe renders in a sandboxed `<iframe>`. The browser
 * PiP API is not available for iframe content, so `setSupportsPiP(false)` is
 * called unconditionally.
 *
 * **Subtitles** — Subtitle tracks are discovered by loading the `'captions'`
 * module and querying `getOption('captions', 'tracklist')` after a 1 500 ms
 * delay (the module populates the tracklist asynchronously). The module is
 * unloaded again if subtitles are currently off to avoid showing the YouTube
 * native caption overlay.
 *
 * @implements {IPlayerAdapter}
 *
 * @example
 * // YouTubeAdapter is selected automatically for YouTube URLs:
 * // <ngx-sp-player src="https://www.youtube.com/watch?v=dQw4w9WgXcQ">
 * // </ngx-sp-player>
 *
 * @example
 * // Short URL format is also supported:
 * const config: PlayerConfig = {
 *   src: 'https://youtu.be/dQw4w9WgXcQ',
 *   protocol: 'youtube',
 *   autoplay: false,
 *   muted: false,
 * };
 */
@Injectable({ providedIn: 'root' })
export class YouTubeAdapter implements IPlayerAdapter {
  /** The `YT.Player` instance created by the IFrame API. */
  private ytPlayer: any;

  /** Host element into which the YouTube iframe is injected. */
  private ytContainer!: HTMLElement;

  /**
   * Interval ID for the 250 ms time-polling loop that runs while the
   * video is in the PLAYING state.
   */
  private ytTimePollInterval: any;

  /** Resolved player configuration stored during `initialize()`. */
  private config!: PlayerConfig;

  /** `true` after `initialize()` has been called. */
  private _isReady = false;

  /** `true` once the YouTube IFrame API script has loaded and `YT` is available. */
  private _apiLoaded = false;

  /**
   * YouTube quality key (e.g. `'hd1080'`) to assert on the next PLAYING event.
   * Set in Phase 1 of the two-phase quality change and cleared in Phase 2.
   */
  private pendingYtQuality: string | null = null;

  /** @internal Shared state service injected via Angular's inject() function. */
  private readonly stateService = inject(PlayerStateService);

  /**
   * Sets the DOM container element into which the YouTube iframe will be
   * rendered.
   *
   * This method is called by `PlayerService.setYouTubeContainer()` after
   * `ngAfterViewInit`. If the IFrame API has already loaded by the time this
   * is called, `createPlayer()` is triggered immediately — solving the race
   * condition where `initialize()` fires before the container is in the DOM.
   *
   * @param container - Host element for the YouTube iframe.
   */
  setContainer(container: HTMLElement): void {
    this.ytContainer = container;
    if (this._apiLoaded && this.config) {
      this.createPlayer(this.extractYouTubeId(this.config.src)!);
    }
  }

  /**
   * Initialises the YouTube adapter.
   *
   * If `window.YT` is not yet available, the IFrame API script is injected
   * into the document and a chain-safe `onYouTubeIframeAPIReady` callback is
   * registered. If the API is already present (e.g. second player on the
   * page), `createPlayer()` is called via `setTimeout` to yield to the event
   * loop so that Angular's change detection has time to render the container.
   *
   * @param config - Resolved player configuration.
   * @throws Sets an error state via `PlayerStateService.setError()` if the
   *   YouTube video ID cannot be extracted from `config.src`.
   */
  initialize(config: PlayerConfig): void {
    this.config = config;
    this.stateService.setYouTube(true);
    // YouTube renders in an iframe — browser PiP API is not available.
    this.stateService.setSupportsPiP(false);

    const videoId = this.extractYouTubeId(config.src);
    if (!videoId) {
      this.stateService.setError('Invalid YouTube URL');
      return;
    }

    if (!(window as any)['YT']) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScript = document.getElementsByTagName('script')[0];
      if (firstScript && firstScript.parentNode) {
        firstScript.parentNode.insertBefore(tag, firstScript);
      } else {
        document.head.appendChild(tag);
      }

      // Chain-safe callback: preserve any previously registered handler so
      // that multiple players on the same page do not clobber each other.
      const prev = (window as any)['onYouTubeIframeAPIReady'];
      (window as any)['onYouTubeIframeAPIReady'] = () => {
        if (prev) prev();
        this._apiLoaded = true;
        if (this.ytContainer) {
          this.createPlayer(videoId);
        }
        // If the container is not yet set, setContainer() will call createPlayer().
      };
    } else {
      this._apiLoaded = true;
      if (this.ytContainer) {
        setTimeout(() => this.createPlayer(videoId), 0);
      }
    }
  }

  /**
   * Extracts an 11-character YouTube video ID from a full or short URL.
   *
   * Supports the following URL formats:
   * - `https://www.youtube.com/watch?v=<id>`
   * - `https://youtu.be/<id>`
   * - `https://www.youtube.com/embed/<id>`
   *
   * @param url - Raw YouTube URL.
   * @returns The 11-character video ID, or `null` if the URL is invalid.
   */
  private extractYouTubeId(url: string): string | null {
    const regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  }

  /**
   * Creates a `YT.Player` instance inside `ytContainer`.
   *
   * The player is configured with native YouTube controls disabled
   * (`controls: 0`), keyboard disabled (`disablekb: 1`), and fullscreen
   * disabled (`fs: 0`) because the custom player UI handles all of this.
   *
   * @param videoId - The 11-character YouTube video ID to load.
   */
  private createPlayer(videoId: string): void {
    if (!this.ytContainer) {
      this.stateService.setError('YouTube container not provided');
      return;
    }

    this.ytPlayer = new (window as any).YT.Player(this.ytContainer, {
      videoId,
      width: '100%',
      height: '100%',
      playerVars: {
        autoplay: this.config.autoplay ? 1 : 0,
        controls: 0,
        disablekb: 1,
        fs: 0,
        rel: 0,
        modestbranding: 1,
        origin: window.location.origin,
      },
      events: {
        onReady: (event: any) => this.onPlayerReady(event),
        onStateChange: (event: any) => this.onPlayerStateChange(event),
        onPlaybackQualityChange: (event: any) => {
          // While a two-phase quality change is in flight, the first event
          // carries the OLD quality (from loadVideoById starting). Ignore it
          // so the optimistic UI update is not overwritten. Phase 2 clears
          // pendingYtQuality before calling setPlaybackQuality, so the
          // authoritative confirmation event always passes this guard.
          if (this.pendingYtQuality) return;
          const ytQ = event.data as string;
          const readable = ytQ === 'default' || ytQ === 'auto' ? 'auto' : QUALITY_MAP[ytQ] || ytQ;
          this.stateService.setQuality(readable);
        },
        onError: (event: any) => this.stateService.setError('YouTube Error: ' + event.data),
      },
    });
  }

  /**
   * Called when the YouTube player is fully initialised and ready to receive
   * API calls.
   *
   * Syncs initial volume, muted state, duration, and available quality levels
   * to `PlayerStateService`, then starts subtitle detection.
   *
   * @param _event - The `onReady` event object (unused).
   */
  private onPlayerReady(_event: any): void {
    this._isReady = true;

    if (this.config.volume !== undefined) {
      this.setVolume(this.config.volume);
    }
    if (this.config.muted) {
      this.setMuted(true);
    }

    this.stateService.setDuration(this.ytPlayer.getDuration());
    this.updateAvailableQualities();
    this.detectSubtitleTracks();
  }

  /**
   * Detects available subtitle tracks by loading the YouTube `'captions'`
   * module and querying the tracklist after a 1 500 ms delay.
   *
   * The delay is necessary because the captions module populates its tracklist
   * asynchronously. If no tracks are found (or an error occurs), subtitles are
   * marked as unsupported. The captions module is unloaded after detection if
   * subtitles are not currently active, to prevent the native YouTube caption
   * overlay from appearing.
   */
  private detectSubtitleTracks(): void {
    try {
      this.ytPlayer.loadModule('captions');
    } catch {
      // intentionally swallowed — YouTube IFrame API may throw on unavailable methods
    }

    setTimeout(() => {
      try {
        const tracklist: any[] = this.ytPlayer?.getOption?.('captions', 'tracklist') || [];
        if (tracklist.length > 0) {
          const tracks: SubtitleTrack[] = tracklist.map((t: any) => ({
            id: t.languageCode || t.id || t.displayName,
            label: t.displayName || t.languageName || t.languageCode || 'Unknown',
            language: t.languageCode || '',
          }));
          this.stateService.setAvailableSubtitles(tracks);
          this.stateService.setSupportsSubtitles(true);
        } else {
          this.stateService.setSupportsSubtitles(false);
        }
      } catch {
        this.stateService.setSupportsSubtitles(false);
      }
      // Unload the captions module if subtitles are not active to prevent
      // the native YouTube caption overlay from appearing.
      if (!this.stateService.subtitlesEnabled()) {
        try {
          this.ytPlayer?.unloadModule('captions');
        } catch {
          // intentionally swallowed — YouTube IFrame API may throw on unavailable methods
        }
      }
    }, 1500);
  }

  /**
   * Handles YouTube `onStateChange` events and maps them to player state.
   *
   * On the `PLAYING` state:
   * - Starts the 250 ms time-polling loop.
   * - Updates duration and live-stream detection.
   * - Executes Phase 2 of the two-phase quality change if `pendingYtQuality`
   *   is set (see class-level documentation for the rationale).
   *
   * @param event - The YouTube `onStateChange` event containing `event.data`.
   */
  private onPlayerStateChange(event: any): void {
    const YT = (window as any).YT;
    switch (event.data) {
      case YT.PlayerState.PLAYING: {
        this.stateService.setPlaying(true);
        this.stateService.setBuffering(false);
        this.startTimePolling();

        const duration = this.ytPlayer.getDuration();
        this.stateService.setDuration(duration);

        const videoData = this.ytPlayer.getVideoData ? this.ytPlayer.getVideoData() : null;
        this.stateService.setLive((videoData && videoData.isLive) || duration === 0);

        if (this.pendingYtQuality) {
          // Phase 2: assert the desired quality now that the player is in
          // PLAYING state. YouTube's bandwidth probe during BUFFERING may
          // downgrade the suggestedQuality set in Phase 1; asserting here
          // overrides that before new segments are fetched.
          // IMPORTANT: clear pendingYtQuality BEFORE calling setPlaybackQuality
          // so the resulting onPlaybackQualityChange event is NOT skipped by
          // the guard in the event handler — that event carries the confirmed quality.
          const q = this.pendingYtQuality;
          this.pendingYtQuality = null;
          this.ytPlayer.setPlaybackQuality(q);
        } else {
          this.updateAvailableQualities();
        }
        break;
      }

      case YT.PlayerState.PAUSED:
        this.stateService.setPlaying(false);
        this.stopTimePolling();
        break;

      case YT.PlayerState.BUFFERING:
        this.stateService.setBuffering(true);
        break;

      case YT.PlayerState.ENDED:
        this.stateService.setPlaying(false);
        this.stateService.setEnded(true);
        this.stopTimePolling();
        break;
    }
  }

  /**
   * Starts a 250 ms polling interval to sync current time and buffered
   * percentage from the YouTube IFrame API to `PlayerStateService`.
   *
   * The IFrame API does not fire `timeupdate` DOM events, so polling is
   * the only way to keep the progress bar in sync.
   */
  private startTimePolling(): void {
    if (this.ytTimePollInterval) clearInterval(this.ytTimePollInterval);
    this.ytTimePollInterval = setInterval(() => {
      if (this.ytPlayer && this.ytPlayer.getCurrentTime) {
        this.stateService.setCurrentTime(this.ytPlayer.getCurrentTime());
        const loadedFraction = this.ytPlayer.getVideoLoadedFraction();
        this.stateService.setBufferedPercentage(loadedFraction * 100);
      }
    }, 250);
  }

  /**
   * Stops the time-polling interval when the player pauses or ends.
   */
  private stopTimePolling(): void {
    if (this.ytTimePollInterval) {
      clearInterval(this.ytTimePollInterval);
      this.ytTimePollInterval = null;
    }
  }

  /**
   * Reads available quality levels from the YouTube IFrame API and syncs
   * them to `PlayerStateService`.
   *
   * `'auto'` and `'default'` keys are filtered out from the raw level list
   * and `'auto'` is prepended as the first option. The current quality is
   * intentionally **not** read here — `onPlaybackQualityChange` is the sole
   * authority on the active quality to avoid race conditions with Phase 2 of
   * the quality-change flow.
   */
  private updateAvailableQualities(): void {
    if (this.ytPlayer && typeof this.ytPlayer.getAvailableQualityLevels === 'function') {
      const levels: string[] = this.ytPlayer.getAvailableQualityLevels();
      if (levels && levels.length > 0) {
        const readable = levels
          .filter((q) => q !== 'auto' && q !== 'default')
          .map((q) => QUALITY_MAP[q] || q);

        if (!readable.includes('auto')) readable.unshift('auto');
        this.stateService.setAvailableQualities(readable);
      }
    }
  }

  /**
   * Starts or resumes YouTube video playback.
   *
   * @returns Always resolves immediately — the IFrame API does not return a
   *   Promise from `playVideo()`.
   */
  play(): Promise<void> {
    if (this.ytPlayer) this.ytPlayer.playVideo();
    return Promise.resolve();
  }

  /** Pauses the YouTube player. */
  pause(): void {
    if (this.ytPlayer) this.ytPlayer.pauseVideo();
  }

  /**
   * Seeks to the specified position.
   *
   * The second argument `true` tells the IFrame API to allow seeking ahead of
   * the buffered range (causing a re-buffer if necessary).
   *
   * @param time - Target position in seconds.
   */
  seek(time: number): void {
    if (this.ytPlayer) this.ytPlayer.seekTo(time, true);
  }

  /**
   * Sets the YouTube player volume.
   *
   * Converts the `[0, 1]` range to YouTube's `[0, 100]` scale and
   * immediately syncs the value back to `PlayerStateService`.
   *
   * @param volume - Desired volume in the range `[0, 1]`.
   */
  setVolume(volume: number): void {
    if (this.ytPlayer) {
      const v = Math.max(0, Math.min(1, volume));
      this.ytPlayer.setVolume(v * 100);
      this.stateService.setVolume(v);
    }
  }

  /**
   * Mutes or unmutes the YouTube player.
   *
   * On unmute, the stored volume is re-synced to `PlayerStateService`
   * because `unMute()` restores YouTube's internal volume (which may differ
   * from the value stored in state if the user muted via the keyboard).
   *
   * @param muted - `true` to mute, `false` to unmute.
   */
  setMuted(muted: boolean): void {
    if (this.ytPlayer) {
      if (muted) {
        this.ytPlayer.mute();
      } else {
        this.ytPlayer.unMute();
        // Re-sync volume state: unMute() restores the internal volume.
        this.stateService.setVolume(this.ytPlayer.getVolume() / 100);
      }
      this.stateService.setMuted(muted);
    }
  }

  /**
   * Changes the YouTube player's playback rate and immediately syncs the
   * value to `PlayerStateService`.
   *
   * @param rate - Desired playback rate (e.g. `1.5`).
   */
  setPlaybackRate(rate: number): void {
    if (this.ytPlayer) {
      this.ytPlayer.setPlaybackRate(rate);
      this.stateService.setPlaybackRate(rate);
    }
  }

  /**
   * Initiates a **two-phase quality change** for VOD content.
   *
   * **Phase 1** (this method):
   * - Stores the target YouTube quality key in `pendingYtQuality`.
   * - Calls `loadVideoById` with `suggestedQuality` to flush the buffer and
   *   reload from the current position at the requested quality.
   *
   * **Phase 2** (`onPlayerStateChange` — PLAYING case):
   * - Asserts `setPlaybackQuality` once the player enters PLAYING state to
   *   override any downgrade that YouTube's bandwidth probe may have applied
   *   during the BUFFERING phase.
   *
   * For live streams or when `video_id` is unavailable, falls back to the
   * best-effort `setPlaybackQuality` call.
   *
   * @param quality - Human-readable quality label (e.g. `'1080p'`) or `'auto'`.
   */
  setQuality(quality: string): void {
    if (!this.ytPlayer) return;

    const ytQuality =
      quality === 'auto'
        ? 'default'
        : Object.entries(QUALITY_MAP).find(([, v]) => v === quality)?.[0] || quality;

    // Optimistic UI update; onPlaybackQualityChange will confirm the actual value.
    this.stateService.setQuality(quality);

    try {
      if (!this.stateService.isLive()) {
        const videoId: string | undefined = this.ytPlayer.getVideoData?.()?.video_id;
        const currentTime: number = this.ytPlayer.getCurrentTime?.() ?? 0;

        if (videoId) {
          this.pendingYtQuality = ytQuality;
          this.ytPlayer.loadVideoById({
            videoId,
            startSeconds: currentTime,
            suggestedQuality: ytQuality,
          });
          return;
        }
      }

      // Fallback for live streams or missing videoId.
      this.ytPlayer.setPlaybackQuality(ytQuality);
    } catch (e) {
      console.warn('[YouTubeAdapter] setQuality failed:', e);
    }
  }

  /**
   * Activates a subtitle track or disables all captions.
   *
   * Uses the YouTube `'captions'` module: loads it and sets the track via
   * `setOption('captions', 'track', { languageCode })` to enable, or calls
   * `unloadModule('captions')` to disable.
   *
   * @param id - BCP-47 language code (e.g. `'en'`) to activate, or `null`
   *   to disable all captions.
   */
  setSubtitle(id: string | number | null): void {
    if (!this.ytPlayer) return;
    if (id === null) {
      try {
        this.ytPlayer.unloadModule('captions');
      } catch {
        // intentionally swallowed — YouTube IFrame API may throw on unavailable methods
      }
      this.stateService.setSubtitles(false);
      this.stateService.setActiveSubtitleId(null);
    } else {
      try {
        this.ytPlayer.loadModule('captions');
        this.ytPlayer.setOption('captions', 'track', { languageCode: String(id) });
      } catch {
        // intentionally swallowed — YouTube IFrame API may throw on unavailable methods
      }
      this.stateService.setSubtitles(true);
      this.stateService.setActiveSubtitleId(id);
    }
  }

  /**
   * Returns `true` once the `onReady` callback has fired from the IFrame API.
   */
  isReady(): boolean {
    return this._isReady;
  }

  /**
   * Destroys the YouTube player and cleans up all resources.
   *
   * Stops time polling, clears the pending quality flag, calls
   * `ytPlayer.destroy()` to remove the iframe from the DOM, and resets all
   * internal flags so the adapter can be safely garbage-collected.
   */
  destroy(): void {
    this.stopTimePolling();
    this.pendingYtQuality = null;
    if (this.ytPlayer) {
      this.ytPlayer.destroy();
      this.ytPlayer = null;
    }
    this._isReady = false;
    this._apiLoaded = false;
  }
}
