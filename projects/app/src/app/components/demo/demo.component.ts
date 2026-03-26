import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  StreamingPlayerComponent,
  PlayerConfig,
  NgxPlayerControlService,
} from '@jhonsferg/ngx-streaming-player';

@Component({
  selector: 'app-demo',
  standalone: true,
  imports: [StreamingPlayerComponent],
  templateUrl: './demo.component.html',
  styleUrl: './demo.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DemoComponent {
  readonly playerControl = inject(NgxPlayerControlService);

  hlsConfig: PlayerConfig = {
    src: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    autoplay: false,
    muted: false,
    controls: false,
    volume: 1.0,
    playbackRates: [0.5, 0.75, 1, 1.25, 1.5, 2],
    enablePiP: true,
    enableKeyboard: true,
    controlsLayout: { autoHide: true, autoHideDelay: 3000 },
    theme: { primaryColor: '#E76F51', secondaryColor: '#2A9D8F', accentColor: '#F4A261' },
  };

  dashConfig: PlayerConfig = {
    src: 'https://dash.akamaized.net/akamai/bbb_30fps/bbb_30fps.mpd',
    protocol: 'dash',
    autoplay: false,
    controls: false,
    theme: { primaryColor: '#E76F51', secondaryColor: '#2A9D8F', accentColor: '#F4A261' },
  };

  mp4Config: PlayerConfig = {
    src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    protocol: 'native',
    poster: 'https://peach.blender.org/wp-content/uploads/title_anouncement.jpg?x11217',
    autoplay: false,
    controls: false,
    theme: { primaryColor: '#E76F51', secondaryColor: '#2A9D8F', accentColor: '#F4A261' },
  };

  currentConfig = this.hlsConfig;

  switchToHLS(): void {
    this.currentConfig = this.hlsConfig;
  }

  switchToDASH(): void {
    this.currentConfig = this.dashConfig;
  }

  switchToMP4(): void {
    this.currentConfig = this.mp4Config;
  }

  onPlayerReady(): void {
    console.log('[Demo] Player ready. State:', this.playerControl.getState());
  }

  onStateChange(state: unknown): void {
    console.log('[Demo] State:', state);
  }

  onError(error: unknown): void {
    console.error('[Demo] Error:', error);
  }
}
