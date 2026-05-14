import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'auth/login',
  },
  {
    path: 'auth',
    loadChildren: () =>
      import('./domain/auth/auth.routes').then((module) => module.AUTH_ROUTES),
  },
  {
    path: 'home',
    loadChildren: () =>
      import('./domain/home/home.routes').then((module) => module.HOME_ROUTES),
  },
  {
    path: 'treinos',
    loadChildren: () =>
      import('./domain/training/training.routes').then(
        (module) => module.TRAINING_ROUTES,
      ),
  },
  {
    path: '**',
    redirectTo: 'auth/login',
  },
];
