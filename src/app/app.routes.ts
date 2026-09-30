import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { hasRoleGuard } from './core/auth/has-role.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login').then((m) => m.Login),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./features/auth/register/register').then((m) => m.Register),
    canActivate: [authGuard, hasRoleGuard('Chief')],
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./features/dashboard/dashboard').then((m) => m.Dashboard),
    canActivate: [authGuard],
  },

  // Справочники
  {
    path: 'products',
    loadComponent: () =>
      import('./features/products/products-list/products-list').then((m) => m.ProductsList,),
    canActivate: [authGuard],
  },
  {
    path: 'warehouses',
    loadComponent: () =>
      import('./features/warehouses/warehouses-list/warehouses-list').then((m) => m.WarehousesList,),
    canActivate: [authGuard],
  },
  {
    path: 'zones',
    loadComponent: () =>
      import('./features/zones/zones-list/zones-list').then((m) => m.ZonesList),
    canActivate: [authGuard],
  },
  {
    path: 'racks',
    loadComponent: () =>
      import('./features/racks/racks-list/racks-list').then((m) => m.RacksList),
    canActivate: [authGuard],
  },
  {
    path: 'shelves',
    loadComponent: () =>
      import('./features/shelves/shelves-list/shelves-list').then((m) => m.ShelvesList,),
    canActivate: [authGuard],
  },
  {
    path: 'cells',
    loadComponent: () =>
      import('./features/cells/cells-list/cells-list').then((m) => m.CellsList),
    canActivate: [authGuard],
  },
  {
    path: 'batches',
    loadComponent: () =>
      import('./features/batches/batches-list/batches-list').then(
        (m) => m.BatchesList,
      ),
    canActivate: [authGuard],
  },

  { path: '**', redirectTo: 'dashboard' },
];
