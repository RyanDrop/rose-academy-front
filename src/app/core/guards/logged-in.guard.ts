import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthTokenStorageService } from '../../domain/auth/services/auth-token-storage.service';

/** Exige JWT: sem token redireciona para o login (rotas da área logada). */
export const loggedInGuard: CanActivateFn = () => {
  const tokenStorage = inject(AuthTokenStorageService);
  const router = inject(Router);

  if (tokenStorage.hasToken()) {
    return true;
  }
  return router.createUrlTree(['/auth', 'login']);
};
