import { Routes } from '@angular/router';

import { loggedInGuard } from '../../core/guards/logged-in.guard';

export const HOME_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    canActivate: [loggedInGuard],
    loadComponent: () =>
      import('./pages/home-page/home-page').then((m) => m.HomePage),
  },
  {
    path: 'sucess',
    loadComponent: () =>
      import('./pages/home-sucess-page/home-sucess-page').then(
        (m) => m.HomeSucessPage,
      ),
  },
];
