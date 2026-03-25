<div align="center">

# ngx-streaming-player

**Professional adaptive streaming player for Angular 17+**

[![Angular](https://img.shields.io/badge/Angular-21+-DD0031?style=flat-square&logo=angular&logoColor=white)](https://angular.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![HLS.js](https://img.shields.io/badge/HLS.js-1.x-FF6B6B?style=flat-square)](https://github.com/video-dev/hls.js)
[![dash.js](https://img.shields.io/badge/dash.js-4.x-4ECDC4?style=flat-square)](https://github.com/Dash-IF/dash.js)
[![License: MIT](https://img.shields.io/badge/License-MIT-F4A261?style=flat-square)](LICENSE)
[![npm](https://img.shields.io/badge/npm-0.0.1-E76F51?style=flat-square&logo=npm&logoColor=white)](https://www.npmjs.com/package/ngx-streaming-player)
[![Standalone](https://img.shields.io/badge/Angular-Standalone-DD0031?style=flat-square&logo=angular)](https://angular.dev/guide/components/importing)
[![Signals](https://img.shields.io/badge/Angular-Signals-7C3AED?style=flat-square&logo=angular)](https://angular.dev/guide/signals)

A unified, **plug-and-play** video player component that handles **HLS**, **DASH**, **MP4**, and **YouTube** through a single API - with hot-swap source switching, live stream detection, multi-player support, PiP, subtitles, and full CSS theming.

[**Live Demo →**](https://jhonsferg.github.io/ngx-streaming-player)&nbsp;&nbsp;·&nbsp;&nbsp;[Report Bug](https://github.com/jhonsferg/ngx-streaming-player/issues)&nbsp;&nbsp;·&nbsp;&nbsp;[Request Feature](https://github.com/jhonsferg/ngx-streaming-player/issues)

</div>

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
  - [Individual Inputs](#individual-inputs)
  - [Config Object](#config-object)
  - [Hot-swap Binding](#hot-swap-binding)
- [Protocol Support](#protocol-support)
  - [HLS Streaming](#hls-streaming)
  - [DASH Streaming](#dash-streaming)
  - [MP4 / Native](#mp4--native)
  - [YouTube](#youtube)
- [Live Streaming](#live-streaming)
- [Multi-player](#multi-player)
- [Programmatic Control](#programmatic-control)
- [Events & Reactive State](#events--reactive-state)
- [Theming](#theming)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [API Reference](#api-reference)
- [Comparison](#comparison)
- [Browser Support](#browser-support)
- [Project Structure](#project-structure)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

`ngx-streaming-player` solves one specific problem: **you should not need a different component for every video protocol**. Whether the source is an HLS live stream, a DASH VOD file, a plain MP4, or a YouTube video, the template stays identical - only the URL changes.

```html
<!-- Same component, any protocol - auto-detected from the URL -->
<ngx-sp-player [src]="anyUrl"></ngx-sp-player>
```

| Source URL                          | Auto-detected protocol |
| ----------------------------------- | ---------------------- |
| `https://example.com/stream.m3u8`   | HLS via hls.js         |
| `https://example.com/manifest.mpd`  | DASH via dash.js       |
| `https://example.com/video.mp4`     | Native HTML5 video     |
| `https://www.youtube.com/watch?v=…` | YouTube IFrame API     |
| `https://youtu.be/…`                | YouTube IFrame API     |

---

## Architecture

The library uses an **Adapter Pattern** to isolate protocol-specific code from the component tree. `PlayerService` acts as the orchestrator - it selects the right adapter, initialises it, and exposes a unified reactive state via `PlayerStateService`.

```mermaid
graph TD
    A["&lt;ngx-sp-player&gt;\nComponent"] -->|"config / src"| B["PlayerService\n(orchestrator)"]
    B -->|"detectProtocol()"| C{Protocol}
    C -->|hls| D["HlsAdapter\n(hls.js)"]
    C -->|dash| E["DashAdapter\n(dash.js)"]
    C -->|native| F["NativeAdapter\n(HTMLVideoElement)"]
    C -->|youtube| G["YouTubeAdapter\n(IFrame API)"]
    D & E & F & G -->|"state events"| H["PlayerStateService\n(Signals)"]
    H -->|"isPlaying · isLive\nprogress · volume…"| A
    A -->|"inject()"| I["player-controls\nComponent"]
    I -->|"NgxPlayerControlService"| J["External Control\n(any component)"]

    style A fill:#E76F51,color:#fff,stroke:none
    style B fill:#264653,color:#fff,stroke:none
    style H fill:#2A9D8F,color:#fff,stroke:none
    style J fill:#F4A261,color:#fff,stroke:none
```

### Hot-swap Flow

```mermaid
sequenceDiagram
    participant App as Your Component
    participant PS as PlayerService
    participant OA as Old Adapter
    participant NA as New Adapter
    participant ST as PlayerStateService

    App->>PS: load(newUrl, { autoplay: true })
    PS->>OA: destroy() - aborts all event listeners
    OA-->>PS: done
    PS->>ST: reset() - clears isLive, progress, quality…
    Note over PS: Volume & mute are preserved
    PS->>NA: new Adapter(detectedProtocol)
    NA->>ST: initialize - fires isPlaying, isBuffering…
    ST-->>App: Signals update → Angular re-renders
```

### Live Detection Flow

```mermaid
flowchart LR
    A[Source loaded] --> B{Protocol?}
    B -->|HLS| C["LEVEL_LOADED event\ndetails.live === true"]
    B -->|DASH| D["isDynamic() on manifest"]
    B -->|Native| E["duration === Infinity\nor duration > 86400"]
    B -->|YouTube| F["Not supported\nalways false"]
    C & D & E & F --> G{isLive?}
    G -->|true| H["Hide progress bar\nHide skip buttons\nHide speed control\nShow LIVE badge"]
    G -->|false| I["Show full controls\nEnable speed menu\nShow time display"]
```

---

## Installation

```bash
npm install ngx-streaming-player hls.js dashjs
```

> **Peer dependencies** - `@angular/core ^21`, `@angular/common ^21`, `hls.js ^1`, `dashjs ^4`

---

## Quick Start

```typescript
// app.component.ts
import { Component } from '@angular/core';
import { StreamingPlayerComponent } from 'ngx-streaming-player';

@Component({
  standalone: true,
  imports: [StreamingPlayerComponent],
  template: `<ngx-sp-player [src]="streamUrl"></ngx-sp-player>`,
})
export class AppComponent {
  streamUrl = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';
}
```

That's it. The component auto-detects HLS, loads hls.js, and renders a fully featured player with controls, PiP, quality selector, settings menu, and keyboard shortcuts.

---

## Configuration

### Individual Inputs

The simplest API - pass only what you need:

```html
<ngx-sp-player
  src="https://example.com/stream.m3u8"
  [autoplay]="false"
  [muted]="false"
  [volume]="0.8"
  poster="https://example.com/thumbnail.jpg"
>
</ngx-sp-player>
```

### Config Object

For full control, use a `PlayerConfig` object:

```typescript
import { PlayerConfig } from 'ngx-streaming-player';

playerConfig: PlayerConfig = {
  src: 'https://example.com/stream.m3u8',

  // Playback
  autoplay: false,
  muted: false,
  volume: 1.0, // 0.0 – 1.0
  poster: 'https://example.com/thumb.jpg',
  playbackRates: [0.5, 0.75, 1, 1.25, 1.5, 2],

  // Protocol (optional - auto-detected from URL)
  protocol: 'hls', // 'hls' | 'dash' | 'native' | 'youtube'

  // Features
  enablePiP: true,
  enableKeyboard: true,

  // Controls behaviour
  controlsLayout: {
    autoHide: true,
    autoHideDelay: 3000, // ms
  },

  // Theming
  theme: {
    primaryColor: '#E76F51',
    secondaryColor: '#2A9D8F',
    accentColor: '#F4A261',
    backgroundColor: '#264653',
    textColor: '#F4F1DE',
    borderRadius: '10px',
    controlSize: '44px',
  },
};
```

```html
<ngx-sp-player
  [config]="playerConfig"
  playerId="main-player"
  (ready)="onReady()"
  (stateChange)="onState($event)"
  (error)="onError($event)"
>
</ngx-sp-player>
```

### Hot-swap Binding

Change `[src]` or call `NgxPlayerControlService.load()` at runtime - no component recreation:

```typescript
// Reactive binding - changing the signal triggers hot-swap automatically
currentSrc = signal('https://stream1.m3u8');

switchChannel(url: string): void {
  this.currentSrc.set(url);
}
```

```html
<ngx-sp-player [src]="currentSrc()" [config]="baseConfig"></ngx-sp-player>

<button (click)="switchChannel('https://stream2.mpd')">Switch to DASH</button>
<button (click)="switchChannel('https://cdn.example.com/video.mp4')">Switch to MP4</button>
```

> **Preserved on hot-swap:** volume level and mute state.
> **Resets on hot-swap:** playback position, buffered ranges, quality levels, live state, subtitle tracks.

---

## Protocol Support

### HLS Streaming

```typescript
hlsConfig: PlayerConfig = {
  src: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
  // protocol auto-detected from .m3u8 extension
  autoplay: false,
  enablePiP: true,
};
```

**HLS-specific behaviour:**

- Uses `hls.js` with `lowLatencyMode: false` by default
- `lowLatencyMode` is **automatically enabled** once `LEVEL_LOADED` confirms a live stream (`details.live === true`)
- Quality levels populated from `MANIFEST_PARSED` event
- ABR enabled by default; override with `setQuality()`
- Event listeners cleaned up via `AbortController` on hot-swap

### DASH Streaming

```typescript
dashConfig: PlayerConfig = {
  src: 'https://dash.akamaized.net/akamai/bbb_30fps/bbb_30fps.mpd',
  // protocol auto-detected from .mpd extension
};
```

**DASH-specific behaviour:**

- Uses `dash.js` with ABR enabled
- Quality levels from `QUALITY_CHANGE_RENDERED` event
- Live detection via `isDynamic()` on the `MediaPlayer` instance
- Subtitle tracks from `getTracksFor('text')` after `STREAM_INITIALIZED`

### MP4 / Native

```typescript
mp4Config: PlayerConfig = {
  src: 'https://cdn.example.com/video.mp4',
  protocol: 'native', // or auto-detected for any non-HLS/DASH/YouTube URL
  poster: 'https://cdn.example.com/poster.jpg',
};
```

**Native-specific behaviour:**

- Uses the browser's native `HTMLVideoElement` directly - zero overhead
- Subtitle tracks auto-detected on `loadedmetadata` via `textTracks`
- Live detection via infinite duration fallback

### YouTube

```typescript
// All YouTube URL formats are auto-detected:
// https://www.youtube.com/watch?v=VIDEO_ID
// https://youtu.be/VIDEO_ID
// https://www.youtube.com/embed/VIDEO_ID

ytConfig: PlayerConfig = {
  src: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
};

// Force YouTube with a bare video ID:
ytByIdConfig: PlayerConfig = {
  src: 'dQw4w9WgXcQ',
  protocol: 'youtube',
};
```

> **YouTube limitations**
> No Picture-in-Picture - IFrame API blocks the browser PiP API; the button is hidden automatically.
> Quality is suggested, not guaranteed - the IFrame API does not enforce quality levels.
> Autoplay requires `muted: true` in most browser contexts.

---

## Live Streaming

No configuration needed - live detection is fully automatic.

```typescript
liveConfig: PlayerConfig = {
  src: 'https://live-channel.m3u8',
  autoplay: true,
  muted: true, // required for browser autoplay policies
};
```

**When `isLive()` becomes `true`, the UI automatically adapts:**

| Control                      |    VOD    |   Live    |
| ---------------------------- | :-------: | :-------: |
| Progress bar (scrubber)      | ✅ Shown  | ❌ Hidden |
| Skip ±10 s buttons           | ✅ Shown  | ❌ Hidden |
| Time display `00:00 / 12:34` | ✅ Shown  | ❌ Hidden |
| Speed control in settings    | ✅ Shown  | ❌ Hidden |
| Animated LIVE badge          | ❌ Hidden | ✅ Shown  |

```typescript
// Read live state anywhere in your application
const state = this.playerControl.getState('live-player');

effect(() => {
  if (state?.isLive()) {
    console.log('Live stream detected');
    console.log('Duration:', state.duration()); // Infinity
  }
});
```

---

## Multi-player

Each `<ngx-sp-player>` with a unique `playerId` gets its own isolated `PlayerService` and `PlayerStateService` scope - instances do not share state:

```typescript
cameras = [
  { id: 'cam1', src: 'https://stream1.m3u8', label: 'Main Stage' },
  { id: 'cam2', src: 'https://stream2.m3u8', label: 'Side Stage' },
  { id: 'cam3', src: 'https://stream3.m3u8', label: 'Backstage' },
  { id: 'cam4', src: 'https://vod.example.com/replay.mpd', label: 'Replay' },
];
```

```html
<div class="camera-grid">
  @for (cam of cameras; track cam.id) {
  <ngx-sp-player [playerId]="cam.id" [src]="cam.src" [config]="{ autoplay: true, muted: true }">
  </ngx-sp-player>
  }
</div>
```

```typescript
// Control each player by its unique ID
muteAll(): void {
  this.cameras.forEach(c => this.ctrl.setMuted(true, c.id));
}

focusOn(id: string): void {
  this.cameras.forEach(c => {
    if (c.id !== id) this.ctrl.pause(c.id);
  });
  this.ctrl.play(id);
}

replaceStream(id: string, newUrl: string): void {
  this.ctrl.load(newUrl, { autoplay: true }, id);
}
```

> **Performance tip:** Use `IntersectionObserver` to lazily mount players only when they enter the viewport. Players outside the visible area don't consume CPU, memory, or network bandwidth.

---

## Programmatic Control

`NgxPlayerControlService` is injectable anywhere in your application tree:

```typescript
import { NgxPlayerControlService } from 'ngx-streaming-player';

@Component({ ... })
export class VideoController {
  private ctrl = inject(NgxPlayerControlService);

  // -- Playback ----------------------------------------------
  play()          { this.ctrl.play();              }
  pause()         { this.ctrl.pause();             }
  seek(s: number) { this.ctrl.seek(s);             }

  // -- Audio -------------------------------------------------
  mute()          { this.ctrl.setMuted(true);      }
  setVol(v)       { this.ctrl.setVolume(v);        } // 0.0 – 1.0

  // -- Quality & Speed ---------------------------------------
  hd()            { this.ctrl.setQuality('1080p'); }
  slow()          { this.ctrl.setPlaybackRate(0.5); }

  // -- Hot-swap ----------------------------------------------
  switchTo(url: string): void {
    this.ctrl.load(url, { autoplay: true }, 'my-player');
  }

  // -- Multi-player by ID ------------------------------------
  muteAll(ids: string[]): void {
    ids.forEach(id => this.ctrl.setMuted(true, id));
  }
}
```

### Reading Reactive State

All state is exposed as Angular Signals - no `subscribe()` or `async` pipes needed:

```typescript
@Component({
  template: `
    <p>{{ playing() ? 'Playing' : 'Paused' }}</p>
    <p>{{ timeDisplay() }}</p>
    <p>{{ state?.isLive() ? 'LIVE' : 'VOD' }}</p>
  `,
})
export class PlayerStatus {
  private ctrl = inject(NgxPlayerControlService);
  readonly state = this.ctrl.getState('my-player');

  readonly playing = computed(() => this.state?.isPlaying() ?? false);
  readonly timeDisplay = computed(() => {
    const t = this.state?.formattedCurrentTime() ?? '0:00';
    const d = this.state?.formattedDuration() ?? '0:00';
    return `${t} / ${d}`;
  });
}
```

---

## Events & Reactive State

### Component Outputs

```html
<ngx-sp-player
  [config]="playerConfig"
  playerId="main"
  (ready)="onReady()"
  (stateChange)="onState($event)"
  (error)="onError($event)"
>
</ngx-sp-player>
```

```typescript
onReady(): void {
  // Player has finished initialising - safe to call ctrl.play() here
  this.ctrl.play('main');
}

onState(state: PlayerState): void {
  if (state.isLive)      this.showLiveBadge = true;
  if (state.isBuffering) this.spinnerVisible = true;
}

onError(err: unknown): void {
  console.error('Playback error:', err);
  this.showFallback = true;
}
```

### Available State Signals

| Signal                   | Type                   | Description                                     |
| ------------------------ | ---------------------- | ----------------------------------------------- |
| `isPlaying()`            | `boolean`              | Whether the player is currently playing         |
| `isBuffering()`          | `boolean`              | Whether the player is buffering                 |
| `isLive()`               | `boolean`              | Whether the current source is a live stream     |
| `isPiP()`                | `boolean`              | Whether Picture-in-Picture is active            |
| `isFullscreen()`         | `boolean`              | Whether fullscreen mode is active               |
| `currentTime()`          | `number`               | Current playback position in seconds            |
| `duration()`             | `number`               | Total duration in seconds (`Infinity` for live) |
| `progress()`             | `number`               | Playback progress as 0–100                      |
| `bufferedPercentage()`   | `number`               | Buffered amount as 0–100                        |
| `formattedCurrentTime()` | `string`               | Human-readable time e.g. `"1:23:45"`            |
| `formattedDuration()`    | `string`               | Human-readable duration                         |
| `volume()`               | `number`               | Current volume 0.0–1.0                          |
| `muted()`                | `boolean`              | Whether audio is muted                          |
| `playbackRate()`         | `number`               | Current playback speed multiplier               |
| `currentQuality()`       | `string`               | Active quality label e.g. `"1080p"` or `"auto"` |
| `availableQualities()`   | `QualityLevel[]`       | All quality levels from the manifest            |
| `supportsSubtitles()`    | `boolean`              | Whether subtitle tracks are available           |
| `availableSubtitles()`   | `SubtitleTrack[]`      | All detected subtitle tracks                    |
| `activeSubtitleId()`     | `string\|number\|null` | Active subtitle track ID, or `null`             |
| `supportsPiP()`          | `boolean`              | Whether PiP is available (false for YouTube)    |
| `isYouTube()`            | `boolean`              | Whether the active adapter is YouTube           |

---

## Theming

### Via the `theme` Input

```typescript
playerConfig: PlayerConfig = {
  src: '...',
  theme: {
    primaryColor: '#7C3AED', // Progress bar, seek thumb, active buttons
    secondaryColor: '#06B6D4', // Secondary accents
    accentColor: '#A78BFA', // Highlights, ripple effects, hover states
    backgroundColor: '#1e1b4b', // Player container background
    textColor: '#EDE9FE', // Text & icon colour
    borderRadius: '6px', // Container and control border radius
    controlSize: '40px', // Button hit-area size
  },
};
```

### Via CSS Custom Properties

```css
/* Scope to a specific player */
ngx-sp-player#my-player {
  --ngx-sp-primary: #7c3aed;
  --ngx-sp-secondary: #06b6d4;
  --ngx-sp-accent: #a78bfa;
  --ngx-sp-bg-dark: #1e1b4b;
  --ngx-sp-text-light: #ede9fe;
  --ngx-sp-radius: 6px;
  --ngx-sp-control-size: 40px;
}

/* Override globally */
:root {
  --ngx-sp-primary: #7c3aed;
}
```

### CSS Variable Reference

| Variable                  | Default                     | Maps to `PlayerTheme` |
| ------------------------- | --------------------------- | --------------------- |
| `--ngx-sp-primary`        | `#E76F51`                   | `primaryColor`        |
| `--ngx-sp-secondary`      | `#2A9D8F`                   | `secondaryColor`      |
| `--ngx-sp-accent`         | `#F4A261`                   | `accentColor`         |
| `--ngx-sp-bg-dark`        | `#1a1a2e`                   | `backgroundColor`     |
| `--ngx-sp-text-light`     | `#F4F1DE`                   | `textColor`           |
| `--ngx-sp-text-dark`      | `#1a1a2e`                   | -                     |
| `--ngx-sp-overlay-bg`     | `rgba(0,0,0,0.6)`           | -                     |
| `--ngx-sp-control-size`   | `44px`                      | `controlSize`         |
| `--ngx-sp-radius`         | `8px`                       | `borderRadius`        |
| `--ngx-sp-ease`           | `cubic-bezier(0.4,0,0.2,1)` | -                     |
| `--ngx-sp-font-display`   | system-ui                   | -                     |
| `--ngx-sp-font-body`      | system-ui                   | -                     |
| `--ngx-sp-font-mono`      | monospace                   | -                     |
| `--ngx-sp-primary-shadow` | auto                        | -                     |
| `--ngx-sp-primary-glow`   | auto                        | -                     |

---

## Keyboard Shortcuts

Enabled by default (`enableKeyboard: true`). Active when the player container is focused.

| Key           | Action                                     |
| ------------- | ------------------------------------------ |
| `Space` / `K` | Toggle play / pause                        |
| `←`           | Seek backward 5 s                          |
| `→`           | Seek forward 5 s                           |
| `J`           | Seek backward 10 s                         |
| `L`           | Seek forward 10 s                          |
| `↑`           | Volume up 10%                              |
| `↓`           | Volume down 10%                            |
| `M`           | Toggle mute                                |
| `F`           | Toggle fullscreen                          |
| `I`           | Toggle Picture-in-Picture                  |
| `C`           | Toggle subtitles (cycles available tracks) |

---

## API Reference

### `<ngx-sp-player>` Inputs

| Input      | Type           | Default     | Description                                                  |
| ---------- | -------------- | ----------- | ------------------------------------------------------------ |
| `config`   | `PlayerConfig` | -           | Full configuration object                                    |
| `src`      | `string`       | -           | Media URL - overrides `config.src`. Changes trigger hot-swap |
| `autoplay` | `boolean`      | `false`     | Start playback on load                                       |
| `muted`    | `boolean`      | `false`     | Start with audio muted                                       |
| `volume`   | `number`       | `1.0`       | Initial volume (0.0–1.0)                                     |
| `poster`   | `string`       | -           | Poster image URL shown before playback                       |
| `theme`    | `PlayerTheme`  | -           | Theme overrides - merged with `config.theme`                 |
| `playerId` | `string`       | `'default'` | Unique ID - required for multi-player setups                 |

### `<ngx-sp-player>` Outputs

| Output        | Payload       | When                                                          |
| ------------- | ------------- | ------------------------------------------------------------- |
| `ready`       | `void`        | Player finished initialising and is ready to play             |
| `stateChange` | `PlayerState` | Any state change (play, pause, buffer, seek, error recovery…) |
| `error`       | `unknown`     | Fatal playback error from the adapter                         |

### `PlayerConfig` Interface

```typescript
interface PlayerConfig {
  src: string;
  protocol?: 'hls' | 'dash' | 'native' | 'youtube';
  autoplay?: boolean; // default: false
  muted?: boolean; // default: false
  volume?: number; // default: 1.0
  poster?: string;
  playbackRates?: number[]; // default: [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]
  enablePiP?: boolean; // default: true
  enableKeyboard?: boolean; // default: true
  controlsLayout?: {
    autoHide?: boolean; // default: true
    autoHideDelay?: number; // default: 3000 (ms)
  };
  theme?: PlayerTheme;
}
```

### `PlayerTheme` Interface

```typescript
interface PlayerTheme {
  primaryColor?: string; // --ngx-sp-primary
  secondaryColor?: string; // --ngx-sp-secondary
  accentColor?: string; // --ngx-sp-accent
  backgroundColor?: string; // --ngx-sp-bg-dark
  textColor?: string; // --ngx-sp-text-light
  borderRadius?: string; // --ngx-sp-radius
  controlSize?: string; // --ngx-sp-control-size
}
```

### `NgxPlayerControlService` Methods

| Method              | Signature                                      | Description                                                                     |
| ------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------- |
| `load()`            | `(src, overrides?, playerId?) => void`         | Hot-swap source - destroys current adapter, resets state, preserves volume/mute |
| `play()`            | `(playerId?) => void`                          | Start playback                                                                  |
| `pause()`           | `(playerId?) => void`                          | Pause playback                                                                  |
| `seek()`            | `(time, playerId?) => void`                    | Jump to time in seconds                                                         |
| `setVolume()`       | `(vol, playerId?) => void`                     | Set volume 0.0–1.0                                                              |
| `setMuted()`        | `(muted, playerId?) => void`                   | Mute or unmute                                                                  |
| `setPlaybackRate()` | `(rate, playerId?) => void`                    | Change speed (ignored on live streams)                                          |
| `setQuality()`      | `(quality, playerId?) => void`                 | Force quality level or `'auto'`                                                 |
| `setSubtitle()`     | `(id\|null, playerId?) => void`                | Activate a subtitle track, or `null` to disable                                 |
| `getState()`        | `(playerId?) => PlayerStateService\|undefined` | Returns the full reactive state service                                         |
| `isRegistered()`    | `(playerId?) => boolean`                       | Check if a player with this ID is active                                        |

### `SubtitleTrack` Interface

```typescript
interface SubtitleTrack {
  id: string | number;
  label: string;
  language: string;
}
```

---

## Comparison

| Feature               | **ngx-streaming-player** | VG Player | Video.js Angular | Plain `<video>` |
| --------------------- | :----------------------: | :-------: | :--------------: | :-------------: |
| Angular Signals API   |            ✅            |    ❌     |        ❌        |       ❌        |
| Standalone component  |            ✅            |    ⚠️     |        ⚠️        |       ✅        |
| HLS (hls.js)          |            ✅            |    ✅     |        ✅        |       ❌        |
| DASH (dash.js)        |            ✅            |    ⚠️     |        ⚠️        |       ❌        |
| YouTube IFrame        |            ✅            |    ❌     |        ⚠️        |       ❌        |
| Hot-swap protocol     |            ✅            |    ❌     |        ❌        |       ❌        |
| Auto live detection   |            ✅            |    ⚠️     |        ⚠️        |       ❌        |
| Speed hidden on live  |            ✅            |    ❌     |        ❌        |       ❌        |
| Multi-player isolated |            ✅            |    ⚠️     |        ⚠️        |       ✅        |
| Picture-in-Picture    |            ✅            |    ❌     |        ⚠️        |       ✅        |
| Subtitle tracks       |            ✅            |    ⚠️     |        ✅        |       ✅        |
| CSS variable theming  |            ✅            |    ⚠️     |        ⚠️        |       ❌        |
| OnPush compatible     |            ✅            |    ❌     |        ❌        |       ✅        |
| TypeScript-first      |            ✅            |    ✅     |        ⚠️        |       ✅        |
| Angular 17+ support   |            ✅            |    ⚠️     |        ⚠️        |       ✅        |
| Programmatic service  |            ✅            |    ⚠️     |        ⚠️        |       ❌        |

> ✅ Full support &nbsp;·&nbsp; ⚠️ Partial or requires extra configuration &nbsp;·&nbsp; ❌ Not supported

---

## Browser Support

| Browser        | HLS | DASH | Native MP4 | YouTube | PiP |
| -------------- | :-: | :--: | :--------: | :-----: | :-: |
| Chrome 90+     | ✅  |  ✅  |     ✅     |   ✅    | ✅  |
| Firefox 88+    | ✅  |  ✅  |     ✅     |   ✅    | ✅  |
| Safari 14+     | ✅  |  ✅  |     ✅     |   ✅    | ✅  |
| Edge 90+       | ✅  |  ✅  |     ✅     |   ✅    | ✅  |
| iOS Safari 14+ | ✅  |  ⚠️  |     ✅     |   ✅    | ⚠️  |
| Android Chrome | ✅  |  ✅  |     ✅     |   ✅    | ✅  |

> Safari natively supports HLS - hls.js detects `Hls.isSupported()` and falls back to native playback automatically.

---

## Project Structure

```
ngx-streaming-player/
├-- projects/
│   ├-- ngx-streaming-player/        ← Library source
│   │   └-- src/lib/
│   │       ├-- adapters/
│   │       │   ├-- native/          ← HTMLVideoElement adapter
│   │       │   ├-- hls/             ← hls.js adapter
│   │       │   ├-- dash/            ← dash.js adapter
│   │       │   └-- youtube/         ← YouTube IFrame API adapter
│   │       ├-- components/
│   │       │   ├-- streaming-player/   ← Main public component
│   │       │   └-- player-controls/    ← Controls bar + sub-components
│   │       │       ├-- ngx-sp-button/
│   │       │       ├-- ngx-sp-progress-bar/
│   │       │       ├-- ngx-sp-volume-control/
│   │       │       ├-- ngx-sp-settings-menu/
│   │       │       └-- ngx-sp-time-display/
│   │       ├-- services/
│   │       │   ├-- player.service.ts         ← Orchestrator + adapter factory
│   │       │   └-- player-state.service.ts   ← Reactive state (Signals)
│   │       └-- models/
│   │           └-- player.models.ts          ← Interfaces & types
│   └-- demo/                        ← Demo app (GitHub Pages)
├-- dist/                            ← Built library output
└-- README.md
```

### Adapter Class Diagram

```mermaid
classDiagram
    class IPlayerAdapter {
        <<interface>>
        +initialize(config PlayerConfig) void
        +play() void
        +pause() void
        +seek(time number) void
        +setVolume(vol number) void
        +setMuted(muted boolean) void
        +setPlaybackRate(rate number) void
        +setQuality(quality string) void
        +setSubtitle(id string|number|null) void
        +requestPiP() Promise
        +destroy() void
    }

    class NativeAdapter {
        -videoElement HTMLVideoElement
        -abortController AbortController
    }

    class HlsAdapter {
        -hls Hls
        -abortController AbortController
    }

    class DashAdapter {
        -dash MediaPlayerClass
        -abortController AbortController
    }

    class YouTubeAdapter {
        -player YT.Player
        +Injectable providedIn root
    }

    IPlayerAdapter <|.. NativeAdapter
    IPlayerAdapter <|.. HlsAdapter
    IPlayerAdapter <|.. DashAdapter
    IPlayerAdapter <|.. YouTubeAdapter
```

---

## Contributing

Contributions are welcome. Please follow these steps:

1. **Fork** the repository and create a feature branch: `git checkout -b feat/my-feature`
2. **Install** dependencies: `npm install`
3. **Start** the dev server: `npm start`
4. **Build** the library: `npm run build:lib`
5. **Commit** using [Conventional Commits](https://www.conventionalcommits.org/): `feat: …`, `fix: …`, `docs: …`
6. Open a **Pull Request** with a clear description

### Development Commands

```bash
npm start            # Start demo app with library in watch mode
npm run build:lib    # Build library → dist/ngx-streaming-player
npm run build:demo   # Build demo app for production
npm test             # Run unit tests
```

### Adding a New Adapter

1. Create `projects/ngx-streaming-player/src/lib/adapters/myprotocol/myprotocol.adapter.ts`
2. Implement `IPlayerAdapter`
3. Add detection logic in `player.service.ts` → `detectProtocol()` and `createAdapter()`
4. Export from `src/public-api.ts` if it needs to be injectable externally

---

## License

MIT © [jhonsferg](https://github.com/jhonsferg)

---

<div align="center">

Built with [Angular](https://angular.dev) &nbsp;·&nbsp; [hls.js](https://github.com/video-dev/hls.js) &nbsp;·&nbsp; [dash.js](https://github.com/Dash-IF/dash.js)

</div>
