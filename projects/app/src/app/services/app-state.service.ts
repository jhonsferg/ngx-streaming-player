import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AppStateService {
  readonly isDark = signal(true);
  readonly sidebarOpen = signal(false);
  readonly activeSection = signal('playground');

  toggleTheme(): void {
    this.isDark.update((v) => !v);
  }

  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }
}
