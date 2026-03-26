import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-getting-started',
  standalone: true,
  imports: [],
  templateUrl: './getting-started.component.html',
  styleUrl: './getting-started.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GettingStartedComponent {}
