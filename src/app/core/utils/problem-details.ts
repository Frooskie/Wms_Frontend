import { HttpErrorResponse } from '@angular/common/http';
import { ErrorCodes, WmsProblemDetails } from '../api/wms-api';

/**
 * Проверяет, что объект соответствует форме WmsProblemDetails.
 * Из-за `additionalProperties: {}` в схеме сгенерированный интерфейс
 * содержит `[key: string]: any` — этот guard даёт надёжное сужение типа.
 */
export function isWmsProblemDetails(value: unknown): value is WmsProblemDetails {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const v = value as Record<string, unknown>;
  return typeof v['title'] === 'string' || typeof v['status'] === 'number';
}

/**
 * Нормализует любую ошибку (WmsProblemDetails, HttpErrorResponse,
 * SwaggerException, строка, сетевой сбой) в единый WmsProblemDetails.
 * Возвращает `null`, если восстановить не удалось.
 */
export function toWmsProblemDetails(error: unknown): WmsProblemDetails | null {
  // WmsProblemDetails (NSwag бросает его напрямую)
  if (isWmsProblemDetails(error)) {
    return error;
  }

  // Стандартная ошибка HttpClient (сеть, 5xx без тела)
  if (error instanceof HttpErrorResponse) {
    if (isWmsProblemDetails(error.error)) {
      return error.error;
    }
    return {
      title: error.message,
      status: error.status,
    };
  }

  // NSwag SwaggerException (когда result === null на бэке)
  if (error instanceof Error) {
    return { title: error.message };
  }

  return null;
}

/** Удобный шорткат для извлечения человекочитаемого сообщения. */
export function extractErrorMessage(
  error: unknown,
  fallback = 'Неизвестная ошибка'
): string {
  const problem = toWmsProblemDetails(error);
  return problem?.title ?? problem?.detail ?? fallback;
}

/** Удобный шорткат для извлечения кода ошибки. */
export function extractErrorCode(error: unknown): ErrorCodes | undefined {
  return toWmsProblemDetails(error)?.code;
}

/**
 * Проверяет есть ли у `WmsProblemDetails` полевые ошибки (`errors`)
 */
export function hasFieldErrors(problem: WmsProblemDetails | null): boolean {
  return !!problem?.errors && Object.keys(problem.errors).length > 0;
}
