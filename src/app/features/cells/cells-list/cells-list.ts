import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButton } from '@angular/material/button';
import { MatCard, MatCardContent } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { CellDto } from '../../../core/api/wms-api';
import { AuthStore } from '../../../core/store';
import { ShelfService } from '../../shelves/shelf.service';
import { CellDialog } from '../cell-dialog/cell-dialog';
import { CellService } from '../cell.service';
import { ConfirmationService } from '../../../shared/services/confirmation.service';

const DEFAULT_PAGE_SIZE = 10;

@Component({
  selector: 'app-cells-list',
  imports: [
    MatButton,
    MatCard,
    MatCardContent,
    MatPaginator,
    MatProgressSpinner,
  ],
  templateUrl: './cells-list.html',
  styleUrls: [
    './cells-list.scss',
    '../../../shared/styles/page.scss',
    '../../../shared/styles/data-table.scss',
  ],
})
export class CellsList {
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly cellService = inject(CellService);
  private readonly shelfService = inject(ShelfService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly authStore = inject(AuthStore);

  protected readonly pageNumber = signal(1);
  protected readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  protected readonly deletingId = signal<number | null>(null);

  protected readonly canEdit = computed(() => {
    const roles = this.authStore.user()?.roles ?? [];
    return roles.includes('Manager') || roles.includes('Chief');
  });

  protected readonly cellsResource = rxResource({
    params: () => ({
      pageNumber: this.pageNumber(),
      pageSize: this.pageSize(),
    }),
    stream: ({ params }) =>
      this.cellService.getPaged(params.pageNumber, params.pageSize),
  });

  protected readonly shelvesResource = rxResource({
    stream: () => this.shelfService.getAll(),
  });

  protected readonly shelfMap = computed(() => {
    const list = this.shelvesResource.value() ?? [];
    return new Map(list.map((s) => [s.id!, s.number ?? 0]));
  });

  protected readonly items = computed(
    () => this.cellsResource.value()?.items ?? [],
  );
  protected readonly totalCount = computed(
    () => this.cellsResource.value()?.totalCount ?? 0,
  );
  protected readonly isLoading = computed(() => this.cellsResource.isLoading());

  protected onPageChange(event: PageEvent): void {
    this.pageNumber.set(event.pageIndex + 1);
    this.pageSize.set(event.pageSize);
  }

  protected openCreateDialog(): void {
    const ref = this.dialog.open(CellDialog);

    ref.componentRef?.setInput('cell', null);
    ref.componentInstance.saved.subscribe(() => {
      this.cellsResource.reload();
      this.snackBar.open('Ячейка создана', 'Закрыть', { duration: 3000 });
    });
  }

  protected openEditDialog(cell: CellDto): void {
    const ref = this.dialog.open(CellDialog);

    ref.componentRef?.setInput('cell', cell);
    ref.componentInstance.saved.subscribe(() => {
      this.cellsResource.reload();
      this.snackBar.open('Ячейка обновлена', 'Закрыть', { duration: 3000 });
    });
  }

  protected async delete(cell: CellDto): Promise<void> {
    if (cell.id == null || this.deletingId() != null) {
      return;
    }

    const confirmed = await this.confirmation.confirm({
      title: 'Удаление ячейки',
      message: `Удалить «${cell.code ?? ''}»?`,
      confirmText: 'Удалить',
    });

    if (!confirmed) {
      return;
    }

    this.deletingId.set(cell.id);

    try {
      await firstValueFrom(this.cellService.delete(cell.id));

      if (this.items().length === 1 && this.pageNumber() > 1) {
        this.pageNumber.update((n) => n - 1);
      } else {
        this.cellsResource.reload();
      }

      this.snackBar.open('Ячейка удалена', 'Закрыть', { duration: 3000 });
    } catch {
      // интерсептор
    } finally {
      this.deletingId.set(null);
    }
  }
}
