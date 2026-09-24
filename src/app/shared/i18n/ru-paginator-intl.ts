import { Injectable } from '@angular/core';
import { MatPaginatorIntl } from '@angular/material/paginator';

/**
 * Русская локализация MatPaginator.
 * Заменяет дефолтные английские строки ("Items per page", "1 – 2 of 5" и т. д.)
 */
@Injectable()
export class RuPaginatorIntl extends MatPaginatorIntl {
  override itemsPerPageLabel = 'Строк на странице:';
  override nextPageLabel = 'Следующая страница';
  override previousPageLabel = 'Предыдущая страница';
  override firstPageLabel = 'Первая страница';
  override lastPageLabel = 'Последняя страница';

  override getRangeLabel = (
    page: number,
    pageSize: number,
    length: number,
  ): string => {
    if (length === 0 || pageSize === 0) {
      return `0 из ${length}`;
    }

    const startIndex = page * pageSize;
    const endIndex =
      startIndex < length
        ? Math.min(startIndex + pageSize, length)
        : startIndex + pageSize;

    return `${startIndex + 1} – ${endIndex} из ${length}`;
  };
}
