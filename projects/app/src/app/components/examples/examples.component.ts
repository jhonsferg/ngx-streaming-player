import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-examples',
  standalone: true,
  imports: [],
  templateUrl: './examples.component.html',
  styleUrl: './examples.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExamplesComponent {}
