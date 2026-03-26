import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-api-reference',
  standalone: true,
  imports: [],
  templateUrl: './api-reference.component.html',
  styleUrl: './api-reference.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApiReferenceComponent {}
