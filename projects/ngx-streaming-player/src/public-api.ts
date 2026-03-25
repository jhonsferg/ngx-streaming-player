/*
 * Public API Surface of ngx-streaming-player
 */

// Main component
export * from './lib/components/streaming-player/streaming-player.component';

// Models and interfaces
export * from './lib/models/player.models';

// Services
export * from './lib/services/player.service';
export * from './lib/services/player-state.service';
export * from './lib/services/ngx-player-control.service';

// Components
export * from './lib/components/player-controls/player-controls.component';

// Adapters
export * from './lib/adapters/player-adapter.interface';
export * from './lib/adapters/youtube/youtube.adapter';
