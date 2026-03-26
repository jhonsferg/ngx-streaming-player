import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  StreamingPlayerComponent,
  PlayerConfig,
  NgxPlayerControlService,
} from 'ngx-streaming-player';
import { LazyPlayerDirective } from '../../lazy-player.directive';

export interface PlayerEntry {
  id: string;
  src: string;
  config: PlayerConfig;
}

const SESSION_KEY = 'ngx-sp-demo-players';

@Component({
  selector: 'app-playground',
  standalone: true,
  imports: [StreamingPlayerComponent, FormsModule, LazyPlayerDirective],
  templateUrl: './playground.component.html',
  styleUrl: './playground.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlaygroundComponent {
  readonly playerControl = inject(NgxPlayerControlService);

  urlInput = '';
  readonly players = signal<PlayerEntry[]>(this.restoreFromSession());
  readonly hasPlayers = computed(() => this.players().length > 0);

  readonly presets: Record<string, string> = {
    hls: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    dash: 'https://dash.akamaized.net/akamai/bbb_30fps/bbb_30fps.mpd',
    mp4: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  };

  constructor() {
    effect(() => {
      const list = this.players();
      if (list.length > 0) {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(list.map((p) => p.src)));
      } else {
        sessionStorage.removeItem(SESSION_KEY);
      }
    });
  }

  private restoreFromSession(): PlayerEntry[] {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return [];
      const urls: string[] = JSON.parse(raw);
      return urls.map((src, i) => this.buildEntry(src, i === 0));
    } catch {
      return [];
    }
  }

  private buildEntry(src: string, isFirst: boolean): PlayerEntry {
    return {
      id: `player-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      src,
      config: {
        src,
        autoplay: false,
        muted: false,
        enablePiP: true,
        enableKeyboard: isFirst,
        controlsLayout: { autoHide: true, autoHideDelay: 3000 },
        theme: { primaryColor: '#E76F51', secondaryColor: '#2A9D8F', accentColor: '#F4A261' },
      },
    };
  }

  addPlayer(): void {
    const src = this.urlInput.trim();
    if (!src) return;
    const isFirst = this.players().length === 0;
    this.players.update((list) => [...list, this.buildEntry(src, isFirst)]);
    this.urlInput = '';
  }

  addPreset(key: string): void {
    this.urlInput = this.presets[key];
    this.addPlayer();
  }

  removePlayer(id: string): void {
    this.players.update((list) => list.filter((p) => p.id !== id));
  }

  clearAll(): void {
    this.players.set([]);
  }

  trackById(_: number, entry: PlayerEntry): string {
    return entry.id;
  }
}
