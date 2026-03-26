/*
 * Public API Surface of ngx-streaming-player
 */

// Main component
export * from './lib/components/streaming-player/streaming-player.component';

// Models and interfaces
export * from './lib/models/player.models';
export * from './lib/models/player-translations.model';

// Provider function and feature functions
export * from './lib/providers/player.providers';

// Injection tokens (for advanced consumers that want to inject them directly)
export * from './lib/tokens/player.tokens';

// Services
export * from './lib/services/player.service';
export * from './lib/services/player-state.service';
export * from './lib/services/ngx-player-control.service';

// Components
export * from './lib/components/player-controls/player-controls.component';

// Adapters
export * from './lib/adapters/player-adapter.interface';
export * from './lib/adapters/youtube/youtube.adapter';
