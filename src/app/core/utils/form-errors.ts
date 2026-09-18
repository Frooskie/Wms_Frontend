import type { ValidationError } from '@angular/forms/signals';
import { WmsProblemDetails } from '../api/wms-api';

export type ServerValidationError = ValidationError.WithOptionalFieldTree;
export type ServerFieldTree = NonNullable<ServerValidationError['fieldTree']>;

/**
 * Преобразует `WmsProblemDetails.errors` в массив ошибок, разложенных по полям.
 *
 * @param problem
 * @param serverToFormField
 * @param resolveFieldTree должна возвращать **точно** тот же тип FieldTree,
 *                         что и ожидает `ValidationError.WithOptionalFieldTree`.
 *                         Обычно — `detail.root[field]`.
 */
export function buildServerFieldErrors<K extends string>(
  problem: WmsProblemDetails | null,
  serverToFormField: Record<string, K>,
  resolveFieldTree: (field: K) => ServerFieldTree,
): ServerValidationError[] | undefined {
  if (!problem) {
    return undefined;
  }

  const serverErrors = problem.errors;
  if (!serverErrors || Object.keys(serverErrors).length === 0) {
    return undefined; // store покажет через error()
  }

  const result: ServerValidationError[] = [];

  for (const [serverField, messages] of Object.entries(serverErrors)) {
    const formField = serverToFormField[serverField];

    if (!formField) continue;

    const fieldTree = resolveFieldTree(formField);

    for (const message of messages) {
      result.push({ kind: 'server', message, fieldTree });
    }
  }

  return result.length > 0 ? result : undefined;
}
