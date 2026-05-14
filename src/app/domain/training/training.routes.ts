import { Routes } from '@angular/router';

import { loggedInGuard } from '../../core/guards/logged-in.guard';

export const TRAINING_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    canActivate: [loggedInGuard],
    loadComponent: () =>
      import('./pages/training-plan-page/training-plan-page').then(
        (m) => m.TrainingPlanPage,
      ),
  },
  {
    path: 'mes/:monthId',
    canActivate: [loggedInGuard],
    loadComponent: () =>
      import('./pages/month-detail-page/month-detail-page').then(
        (m) => m.MonthDetailPage,
      ),
  },
  {
    path: 'mes/:monthId/treino/:workoutId',
    canActivate: [loggedInGuard],
    loadComponent: () =>
      import('./pages/workout-detail-page/workout-detail-page').then(
        (m) => m.WorkoutDetailPage,
      ),
  },
];
