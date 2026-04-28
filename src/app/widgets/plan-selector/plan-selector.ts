import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  input,
  output
} from '@angular/core';
import { CurrencyPipe } from '@angular/common';

import { AuthPlan } from '../../domain/auth/auth.models';

@Component({
  selector: 'ra-plan-selector',
  imports: [CurrencyPipe],
  templateUrl: './plan-selector.html',
  styleUrl: './plan-selector.scss',
  encapsulation: ViewEncapsulation.Emulated,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PlanSelector {
  readonly plans = input.required<AuthPlan[]>();
  readonly selectedTaxId = input<string | null>(null);
  readonly selectedTaxIdChange = output<string>();

  selectPlan(taxId: string): void {
    this.selectedTaxIdChange.emit(taxId);
  }
}
