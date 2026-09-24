import { signalStore, withState, withMethods, patchState } from '@ngrx/signals';
import { inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { AuthResponse, WmsProblemDetails } from '../api/wms-api';
import { extractErrorMessage, hasFieldErrors, toWmsProblemDetails } from '../utils/problem-details';

type AuthState = {
  user: { email: string; fullName: string; roles: string[] } | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  registerSuccess: boolean;
};

const initialState: AuthState = {
  user: null,
  token: null,
  isLoading: false,
  error: null,
  registerSuccess: false,
};

/**
 * Глобальный стор аутентификации.
 */
export const AuthStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store, authService = inject(AuthService)) => ({
    /**
     * Восстанавливает сессию из localStorage при загрузке приложения.
     */
    loadUserFromStorage(): void {
      const token = authService.getToken();
      const user = authService.getUser();

      if (token && user) {
        patchState(store, { token, user, isLoading: false, error: null });
      } else {
        patchState(store, { token: null, user: null });
      }
    },

    clearError(): void {
      patchState(store, { error: null });
    },

    clearRegisterSuccess(): void {
      patchState(store, { registerSuccess: false });
    },

    /**
     * Возвращает `null` при успехе; `WmsProblemDetails` при ошибке —
     * чтобы вызывающий компонент мог разложить полевые ошибки по форме.
     */
    async login(email: string, password: string): Promise<WmsProblemDetails | null> {
      patchState(store, { isLoading: true, error: null });

      try {
        const response: AuthResponse = await firstValueFrom(authService.login(email, password));

        if (!response.token || !response.email) {
          patchState(store, { isLoading: false, error: 'Неверный ответ сервера' });

          return null;
        }

        const user = {
          email: response.email,
          fullName: response.fullName ?? '',
          roles: response.roles ?? [],
        };

        authService.setToken(response.token);
        authService.setUser(user);

        patchState(store, { token: response.token, user, isLoading: false, error: null });

        return null;
      } catch (error: unknown) {
        const problem = toWmsProblemDetails(error);

        // Полевые ошибки разложит форма. Верхний баннер — только для общих.
        patchState(store, {
          isLoading: false,
          error: hasFieldErrors(problem)
            ? null
            : extractErrorMessage(error, 'Ошибка входа'),
        });

        return problem;
      }
    },

    async register(
      email: string,
      password: string,
      fullName: string,
      role: string
    ): Promise<WmsProblemDetails | null> {
      patchState(store, {
        isLoading: true,
        error: null,
        registerSuccess: false,
      });

      try {
        await firstValueFrom(authService.register(email, password, fullName, role));

        patchState(store, {
          isLoading: false,
          error: null,
          registerSuccess: true,
        });

        return null;
      } catch (error: unknown) {
        const problem = toWmsProblemDetails(error);

        patchState(store, {
          isLoading: false,
          error: hasFieldErrors(problem)
            ? null
            : extractErrorMessage(error, 'Ошибка регистрации'),
          registerSuccess: false,
        });

        return problem;
      }
    },

    logout(): void {
      authService.logout();
      patchState(store, {
        user: null,
        token: null,
        isLoading: false,
        error: null,
        registerSuccess: false,
      });
    },
  }))
);
