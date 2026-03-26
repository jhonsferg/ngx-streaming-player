# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-03-26

First stable release of `ngx-streaming-player`.

### Added

#### Core architecture
- Adapter pattern isolating protocol-specific logic from the component tree (`IPlayerAdapter` interface)
- `PlayerService` as the orchestrator: detects protocol, creates the right adapter, and exposes a unified API
- `PlayerStateService` with fully reactive state via Angular Signals (`signal`, `computed`)
- `NgxPlayerControlService` for programmatic control from anywhere in the app

#### Protocol adapters
- **HlsAdapter** - HLS streaming via `hls.js` with quality levels, live detection via `LEVEL_LOADED`, and subtitle track support via `SUBTITLE_TRACKS_UPDATED`
- **DashAdapter** - DASH streaming via `dash.js` with quality levels, live detection via `isDynamic()`, and subtitle track support via `getTracksFor('text')`
- **NativeAdapter** - MP4 / native browser video with WebVTT subtitle detection via `loadedmetadata`
- **YouTubeAdapter** - YouTube iFrame API with quality sync, captions module, PiP guard (iframe API restriction)

#### Angular provider pattern
- `providePlayer(...features)` - configure the player globally in `app.config.ts` using `makeEnvironmentProviders()`
- `withTheme(theme)` - set a global `PlayerTheme` applied to every `<ngx-sp-player>` in the app
- `withDefaults(config)` - set global `PlayerConfig` defaults; per-player `[config]` and shorthand inputs take priority
- `withTranslations(translations)` - localise all UI strings; any key omitted keeps its English default

#### Component inputs
- `[src]`, `[config]`, `[theme]`, `[autoplay]`, `[muted]`, `[volume]`, `[playbackRates]`, `[enablePiP]`, `[enableKeyboard]`, `[playerId]`, `[controlsLayout]`
- Priority layering: `withDefaults()` < `[config]` < shorthand inputs; `withTheme()` < `config.theme` < `[theme]`

#### Component outputs
- `(playerReady)`, `(play)`, `(pause)`, `(ended)`, `(timeUpdate)`, `(volumeChange)`, `(error)`, `(fullscreenChange)`, `(pipChange)`, `(qualityChange)`, `(subtitleChange)`

#### UI components
- `<ngx-sp-player>` main player with 3-ring counter-rotating loading spinner and pulsing play button
- `PlayerControlsComponent` with left/right control groups, separator, and `hasSettings` guard
- `NgxSpButtonComponent` - ripple effect, tooltip with arrow, modifier classes for play/pause/skip/PiP/active states
- `NgxSpProgressBarComponent` - hover tooltip with time preview, drag-outside-bounds support via `document:mousemove`
- `NgxSpVolumeControlComponent` - custom CSS gradient fill via `--vol` property, volume badge on hover
- `NgxSpSettingsMenuComponent` - gear spin animation, quality / speed / subtitles sub-panels
- `NgxSpTimeDisplayComponent` - tabular-nums, current / total with opacity contrast
- Quality row hidden automatically when no quality levels are available

#### Subtitles system
- `SubtitleTrack` model (`id`, `label`, `language`)
- `setSubtitle(id)` on `PlayerService` delegates to the active adapter
- Language selector in the settings menu, conditional on `supportsSubtitles()`

#### Picture-in-Picture
- Native browser PiP API guarded by `readyState >= 1`
- `supportsPiP` signal; YouTube automatically sets it to `false`

#### Hot-swap source
- Changing `[src]` or calling `NgxPlayerControlService.load()` tears down the current adapter and initialises a new one; volume and mute state are preserved

#### Live stream
- Animated LIVE badge, speed selector hidden, progress bar hidden for live streams

#### CSS theming
- `--ngx-sp-*` CSS custom property system (primary, secondary, accent, bg, text, radius, control-size, fonts, shadows)
- `applyTheme()` scopes variables to the container element, never the document root

#### Keyboard shortcuts
- `k` / `Space` - play/pause, `ArrowLeft` / `ArrowRight` - seek -5s / +5s, `ArrowUp` / `ArrowDown` - volume, `m` - mute toggle, `f` - fullscreen, `p` - PiP

#### Multi-player
- Each `<ngx-sp-player>` instance gets its own `PlayerService` and `PlayerStateService` via component-level `providers`

#### Documentation
- Live showcase app deployed to GitHub Pages
- Full API reference with tables for all inputs, outputs, `PlayerConfig`, `PlayerTheme`, `PlayerTranslations`, `providePlayer()`, `NgxPlayerControlService`, and CSS variables

---

[1.0.0]: https://github.com/jhonsferg/ngx-streaming-player/releases/tag/v1.0.0
