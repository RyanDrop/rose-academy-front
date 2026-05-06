import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

import { AuthTokenStorageService } from '../../domain/auth/services/auth-token-storage.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authTokenStorage = inject(AuthTokenStorageService);
  const accessToken = authTokenStorage.getToken();

  if (accessToken) {
    req = req.clone({
      headers: req.headers.set('Authorization', `Bearer ${accessToken}`),
    });
  }
  return next(req);
};
