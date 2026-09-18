import { Service as ApiClient } from '../api/wms-api';
import { Service, inject } from '@angular/core';

/**
 * Сервис-обёртка над сгенерированным API-клиентом.
 * Отвечает за аутентификацию и хранение токена/пользователя в localStorage.
 */
@Service()
export class AuthService {
  private readonly apiClient = inject(ApiClient);

  private readonly TOKEN_KEY = 'access_token';
  private readonly USER_KEY = 'user_data';

  /**
   * Вход в систему.
   * @returns Observable<AuthResponse>
   */
  login(email: string, password: string) {
    return this.apiClient.login({email, password});
  }

  /**
   * Регистрация нового пользователя.
   * @returns Observable<RegisterResponse>
   */
  register(email: string, password: string, fullName: string, role: string) {
    return this.apiClient.register({email, password, fullName, role});
  }

  logout(): void {
    this.clearToken();
    this.clearUser();
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  setToken(token: string): void {
    localStorage.setItem(this.TOKEN_KEY, token);
  }

  clearToken(): void {
    localStorage.removeItem(this.TOKEN_KEY);
  }

  getUser(): { email: string; fullName: string; roles: string[] } | null {
    const data = localStorage.getItem(this.USER_KEY);
    if (data) {
      try {
        return JSON.parse(data);
      } catch {
        return null;
      }
    }
    return null;
  }

  setUser(user: { email: string; fullName: string; roles: string[] }): void {
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
  }

  clearUser(): void {
    localStorage.removeItem(this.USER_KEY);
  }
}
