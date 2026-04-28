import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  input
} from '@angular/core';

@Component({
  selector: 'ra-step-progress',
  imports: [],
  templateUrl: './step-progress.html',
  styleUrl: './step-progress.scss',
  encapsulation: ViewEncapsulation.Emulated,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StepProgress {
  readonly steps = input<string[]>([]);
  readonly currentStep = input(1);
}
