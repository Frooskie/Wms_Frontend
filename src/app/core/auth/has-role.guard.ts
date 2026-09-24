import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStore } from '../store';

/**
 * Фабрика функциональных гардов: пропускает пользователя,
 * если у него есть хотя бы одна из переданных ролей.
 *
 * Предполагает, что `authGuard` уже отработал.
 * При недостатке прав — редирект на /dashboard.
 */
export function hasRoleGuard(...allowedRoles: readonly string[]): CanActivateFn {
  return () => {
    const authStore = inject(AuthStore);
    const router = inject(Router);

    const roles = authStore.user()?.roles ?? [];
    const allowed = allowedRoles.some((role) => roles.includes(role));

    return allowed ? true : router.createUrlTree(['/dashboard']);
  };
}
