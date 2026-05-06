import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthTokenStorageService } from '../../domain/auth/services/auth-token-storage.service';

/** Só para visitante: com token redireciona para a home (login / cadastro). */
export const guestGuard: CanActivateFn = () => {
  const tokenStorage = inject(AuthTokenStorageService);
  const router = inject(Router);

  if (!tokenStorage.hasToken()) {
    return true;
  }
  return router.createUrlTree(['/home']);
};
