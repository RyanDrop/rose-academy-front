import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  inject,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthTokenStorageService } from '../../../auth/services/auth-token-storage.service';

@Component({
  selector: 'ra-home-sucess-page',
  imports: [RouterLink],
  templateUrl: './home-sucess-page.html',
  styleUrl: './home-sucess-page.scss',
  encapsulation: ViewEncapsulation.Emulated,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeSucessPage {
  private readonly authTokenStorage = inject(AuthTokenStorageService);

  hasToken(): boolean {
    return this.authTokenStorage.hasToken();
  }
}
