import {
  Component,
  AfterViewInit,
  OnDestroy,
  inject,
  signal,
  computed,
  effect,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  StreamingPlayerComponent,
  PlayerConfig,
  NgxPlayerControlService,
} from 'ngx-streaming-player';
import { LazyPlayerDirective } from './lazy-player.directive';
import hljs from 'highlight.js/lib/core';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import bash from 'highlight.js/lib/languages/bash';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('css', css);
hljs.registerLanguage('bash', bash);
gsap.registerPlugin(ScrollTrigger);

export interface PlayerEntry {
  id: string;
  src: string;
  config: PlayerConfig;
}

const SESSION_KEY = 'ngx-sp-demo-players';

@Component({
  selector: 'app-root',
  imports: [StreamingPlayerComponent, FormsModule, LazyPlayerDirective],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements AfterViewInit, OnDestroy {
  readonly playerControl = inject(NgxPlayerControlService);

  // -- Theme ------------------------------------------------------------------
  readonly isDark = signal(true);

  // -- Sidebar ----------------------------------------------------------------
  readonly sidebarOpen = signal(false);
  readonly activeSection = signal('playground');
  private sectionObserver!: IntersectionObserver;

  constructor() {
    effect(() => {
      document.body.classList.toggle('light', !this.isDark());
    });

    // Persist playground players to sessionStorage whenever the list changes
    effect(() => {
      const list = this.players();
      if (list.length > 0) {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(list.map((p) => p.src)));
      } else {
        sessionStorage.removeItem(SESSION_KEY);
      }
    });
  }

  ngAfterViewInit(): void {
    hljs.highlightAll();
    this.initSectionObserver();
    this.initGsapAnimations();
  }

  ngOnDestroy(): void {
    this.sectionObserver?.disconnect();
    ScrollTrigger.killAll();
  }

  toggleTheme(): void {
    this.isDark.update((v) => !v);
  }

  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  // -- Dynamic playground -----------------------------------------------------
  urlInput = '';
  readonly players = signal<PlayerEntry[]>(this.restoreFromSession());
  readonly hasPlayers = computed(() => this.players().length > 0);

  readonly presets: Record<string, string> = {
    hls: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    dash: 'https://dash.akamaized.net/akamai/bbb_30fps/bbb_30fps.mpd',
    mp4: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  };

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

  // -- Single demo player -----------------------------------------------------
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

  onStateChange(state: any): void {
    console.log('[Demo] State:', state);
  }

  onError(error: any): void {
    console.error('[Demo] Error:', error);
  }

  // -- Section observer (sidebar active state) ---------------------------------
  private initSectionObserver(): void {
    const sections = document.querySelectorAll('section[id]');
    this.sectionObserver = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) {
          this.activeSection.set(visible[0].target.id);
        }
      },
      { rootMargin: '-5% 0px -80% 0px' },
    );
    sections.forEach((s) => this.sectionObserver.observe(s));
  }

  // -- GSAP scroll animations --------------------------------------------------
  private initGsapAnimations(): void {
    this.animateOnEnter('.features-grid', '.feat-card', { y: 36, stagger: 0.07, duration: 0.55 });
    this.animateOnEnter('.doc-steps', '.doc-step', { x: -24, stagger: 0.12, duration: 0.5 });
    this.animateOnEnter('#api', '.api-group', { y: 28, stagger: 0.1, duration: 0.5 });

    document.querySelectorAll<HTMLElement>('.example-section').forEach((el) => {
      const header = el.querySelector<HTMLElement>('.section__header');
      if (header) this.animateEl(el, header, { y: 22, duration: 0.5 });

      const blocks = Array.from(
        el.querySelectorAll<HTMLElement>('.code-block, .example-callout, .example-grid'),
      );
      if (blocks.length) this.animateEl(el, blocks, { y: 18, stagger: 0.1, duration: 0.45 });
    });
  }

  /** Set initial hidden state on targets, then animate them to visible when trigger enters viewport. */
  private animateOnEnter(triggerSel: string, targetSel: string, vars: gsap.TweenVars): void {
    const trigger = document.querySelector(triggerSel);
    if (!trigger) return;
    const targets = document.querySelectorAll<HTMLElement>(targetSel);
    if (!targets.length) return;

    gsap.set(targets, { opacity: 0, y: (vars['y'] as number) ?? 0, x: (vars['x'] as number) ?? 0 });
    ScrollTrigger.create({
      trigger,
      start: 'top 88%',
      once: true,
      onEnter: () => gsap.to(targets, { opacity: 1, y: 0, x: 0, ease: 'power2.out', ...vars }),
    });
  }

  private animateEl(
    trigger: Element,
    targets: Element | Element[] | NodeListOf<Element>,
    vars: gsap.TweenVars,
  ): void {
    const els = targets instanceof Element ? [targets] : Array.from(targets as Iterable<Element>);
    if (!els.length) return;
    gsap.set(els, { opacity: 0, y: (vars['y'] as number) ?? 0 });
    ScrollTrigger.create({
      trigger,
      start: 'top 88%',
      once: true,
      onEnter: () => gsap.to(els, { opacity: 1, y: 0, ease: 'power2.out', ...vars }),
    });
  }
}
