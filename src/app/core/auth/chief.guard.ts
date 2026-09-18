import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStore } from '../store';

/** Роль, которой разрешена регистрация пользователей. */
const CHIEF_ROLE = 'Chief';

/**
 * Функциональный гард: пропускает только пользователей с ролью Chief.
 * Предполагает, что authGuard уже отработал и пользователь аутентифицирован.
 * При недостатке прав — редирект на /dashboard.
 */
export const chiefGuard: CanActivateFn = () => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  const roles = authStore.user()?.roles ?? [];
  if (roles.includes(CHIEF_ROLE)) {
    return true;
  }

  return router.createUrlTree(['/dashboard']);
};
