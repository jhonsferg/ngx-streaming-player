import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { DemoComponent } from './components/demo/demo.component';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    })
      // DemoComponent renders a real ngx-sp-player pointed at a remote HLS
      // stream. Initializing it here leaves pending zone macrotasks (network
      // retries) that never stabilize under jsdom, hanging whenStable().
      // App-level tests only care that the shell renders, so stub it out.
      .overrideComponent(DemoComponent, { set: { template: '' } })
      .compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the hero title', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('ngx-streaming-player');
  });
});
