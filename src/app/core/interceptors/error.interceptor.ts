import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { ErrorCodes } from '../api/wms-api';
import { extractErrorMessage, toWmsProblemDetails } from '../utils/problem-details';
import { AuthService } from '../auth/auth.service';

/**
 * Функциональный интерсептор ошибок.
 *
 * Стратегия:
 * - 401 UNAUTHORIZED → авто-logout + redirect на /login (кроме текущего /login);
 * - 4xx (400/403/404) → не показываем snackbar, обработка на уровне форм/стора;
 * - 5xx и сетевые сбои → snackbar с общим сообщением.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const snackBar = inject(MatSnackBar);
  const router = inject(Router);
  const authService = inject(AuthService);

  return next(req).pipe(
    catchError((error: unknown) => {
      const problem = toWmsProblemDetails(error);

      // 401 — сессия истекла или невалидна
      if (problem?.status === 401 || problem?.code === ErrorCodes.UNAUTHORIZED) {
        const onLoginPage = router.url.startsWith('/login');
        authService.logout();

        if (!onLoginPage) {
          void router.navigate(['/login']);
        }

        return throwError(() => error);
      }

      // 4xx — клиентские ошибки, показывают формы или стор
      const isClientError =
        error instanceof HttpErrorResponse &&
        error.status >= 400 &&
        error.status < 500;
      const isServerError =
        error instanceof HttpErrorResponse && error.status >= 500;
      const isNetworkError =
        error instanceof HttpErrorResponse && error.status === 0;

      // Показываем snackbar только для неожиданных ошибок (5xx, сеть).
      if (isServerError || isNetworkError || !isClientError) {
        snackBar.open(extractErrorMessage(error), 'Закрыть', {
          duration: 5000,
          panelClass: 'error-snackbar',
          horizontalPosition: 'end',
          verticalPosition: 'top',
        });
      }

      return throwError(() => error);
    })
  );
};
