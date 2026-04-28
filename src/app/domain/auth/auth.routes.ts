import { Routes } from '@angular/router';

export const AUTH_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'login'
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/login-page/login-page').then((module) => module.LoginPage)
  },
  {
    path: 'criar-conta',
    loadComponent: () =>
      import('./pages/register-page/register-page').then((module) => module.RegisterPage)
  }
];
