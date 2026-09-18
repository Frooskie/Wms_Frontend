import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../auth/auth.service';

/**
 * Функциональный JWT-интерсептор.
 * Добавляет заголовок `Authorization: Bearer <token>` ко всем запросам, кроме публичных эндпоинтов.
 */
export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  const isPublicEndpoint = req.url.includes('/api/Auth/login');

  if (isPublicEndpoint) {
    return next(req);
  }

  const token = authService.getToken();
  if (!token) {
    return next(req);
  }

  const clonedRequest = req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`,
    },
  });

  return next(clonedRequest);
};
