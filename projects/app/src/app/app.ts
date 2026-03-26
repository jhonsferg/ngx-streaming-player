import {
  Component,
  AfterViewInit,
  OnDestroy,
  inject,
  effect,
} from '@angular/core';
import hljs from 'highlight.js/lib/core';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import bash from 'highlight.js/lib/languages/bash';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { AppStateService } from './services/app-state.service';
import { NavComponent } from './components/nav/nav.component';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { HeroComponent } from './components/hero/hero.component';
import { PlaygroundComponent } from './components/playground/playground.component';
import { DemoComponent } from './components/demo/demo.component';
import { FeaturesComponent } from './components/features/features.component';
import { GettingStartedComponent } from './components/getting-started/getting-started.component';
import { ExamplesComponent } from './components/examples/examples.component';
import { ApiReferenceComponent } from './components/api-reference/api-reference.component';
import { FooterComponent } from './components/footer/footer.component';

hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('css', css);
hljs.registerLanguage('bash', bash);
gsap.registerPlugin(ScrollTrigger);

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    NavComponent,
    SidebarComponent,
    HeroComponent,
    PlaygroundComponent,
    DemoComponent,
    FeaturesComponent,
    GettingStartedComponent,
    ExamplesComponent,
    ApiReferenceComponent,
    FooterComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements AfterViewInit, OnDestroy {
  readonly state = inject(AppStateService);
  private sectionObserver!: IntersectionObserver;

  constructor() {
    effect(() => {
      document.body.classList.toggle('light', !this.state.isDark());
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

  // -- Section observer (sidebar active state) ---------------------------------
  private initSectionObserver(): void {
    const sections = document.querySelectorAll('section[id]');
    this.sectionObserver = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) {
          this.state.activeSection.set(visible[0].target.id);
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
