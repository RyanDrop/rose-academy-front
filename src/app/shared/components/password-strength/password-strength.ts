import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  computed,
  input
} from '@angular/core';

@Component({
  selector: 'ra-password-strength',
  imports: [],
  templateUrl: './password-strength.html',
  styleUrl: './password-strength.scss',
  encapsulation: ViewEncapsulation.Emulated,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PasswordStrength {
  readonly password = input('');

  readonly checks = computed(() => {
    const password = this.password();

    return [
      { label: '8+ caracteres', valid: password.length >= 8 },
      { label: 'Maiuscula e minuscula', valid: /(?=.*[a-z])(?=.*[A-Z])/.test(password) },
      { label: 'Numero', valid: /\d/.test(password) },
      { label: 'Caractere especial', valid: /[^A-Za-z\d]/.test(password) }
    ];
  });

  readonly score = computed(() => this.checks().filter((item) => item.valid).length);

  readonly label = computed(() => {
    const score = this.score();

    if (score <= 1) {
      return 'Fraca';
    }

    if (score <= 3) {
      return 'Media';
    }

    return 'Forte';
  });
}
