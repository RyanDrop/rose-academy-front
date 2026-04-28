import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  input
} from '@angular/core';

import { AuthHeroMetric } from '../../domain/auth/auth.models';

@Component({
  selector: 'ra-auth-hero-card',
  imports: [],
  templateUrl: './auth-hero-card.html',
  styleUrl: './auth-hero-card.scss',
  encapsulation: ViewEncapsulation.Emulated,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AuthHeroCard {
  readonly eyebrow = input('Rose Academy');
  readonly title = input.required<string>();
  readonly subtitle = input.required<string>();
  readonly badges = input<string[]>([]);
  readonly metrics = input<AuthHeroMetric[]>([]);
  readonly accentLabel = input('Treino em dia');
}
