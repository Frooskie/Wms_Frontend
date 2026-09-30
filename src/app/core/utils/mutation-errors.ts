import { MatSnackBar } from '@angular/material/snack-bar';
import { extractErrorMessage } from './problem-details';

/**
 * Показывает SnackBar с сообщением об ошибке мутации (DELETE, а также
 * любые операции вне формы/стора).
 *
 * Когда использовать:
 * - в `catch` методов удаления из списков (`XxxList.delete`);
 * - в любых мутациях, у которых нет `submission.action` Signal Forms,
 *   способного разложить ошибку по полям.
 *
 * Когда НЕ использовать:
 * - внутри `submission.action` формы — там ошибка уходит в
 *   `buildServerFieldErrors` или в локальный баннер;
 * - для глобальных ошибок (5xx, сеть) — их показывает `errorInterceptor`.
 *
 * Параметры SnackBar синхронизированы с `errorInterceptor` — единый
 * визуальный стиль для всех ошибок в приложении.
 */
export function showMutationError(
  snackBar: MatSnackBar,
  raw: unknown,
  fallback: string,
): void {
  snackBar.open(extractErrorMessage(raw, fallback), 'Закрыть', {
    duration: 5000,
    panelClass: 'error-snackbar',
    horizontalPosition: 'end',
    verticalPosition: 'top',
  });
}
