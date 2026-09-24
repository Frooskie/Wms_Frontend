import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButton } from '@angular/material/button';
import { MatCard, MatCardContent } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { WarehouseDto } from '../../../core/api/wms-api';
import { AuthStore } from '../../../core/store';
import { WarehouseDialog } from '../warehouse-dialog/warehouse-dialog';
import { WarehouseService } from '../warehouses.service';
import { ConfirmationService } from '../../../shared/services/confirmation.service';


const DEFAULT_PAGE_SIZE = 10;

@Component({
  selector: 'app-warehouses-list',
  imports: [
    MatButton,
    MatCard,
    MatCardContent,
    MatPaginator,
    MatProgressSpinner,
  ],
  templateUrl: './warehouses-list.html',
  styleUrls: [
    './warehouses-list.scss',
    '../../../shared/styles/page.scss',
    '../../../shared/styles/data-table.scss',
  ],
})
export class WarehousesList {
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly warehouseService = inject(WarehouseService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly authStore = inject(AuthStore);

  protected readonly pageNumber = signal(1);
  protected readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  protected readonly deletingId = signal<number | null>(null);

  protected readonly canEdit = computed(() => {
    const roles = this.authStore.user()?.roles ?? [];
    return roles.includes('Manager') || roles.includes('Chief');
  });

  protected readonly warehousesResource = rxResource({
    params: () => ({
      pageNumber: this.pageNumber(),
      pageSize: this.pageSize(),
    }),
    stream: ({ params }) =>
      this.warehouseService.getPaged(params.pageNumber, params.pageSize),
  });

  protected readonly items = computed(
    () => this.warehousesResource.value()?.items ?? [],
  );
  protected readonly totalCount = computed(
    () => this.warehousesResource.value()?.totalCount ?? 0,
  );
  protected readonly isLoading = computed(() =>
    this.warehousesResource.isLoading(),
  );

  protected onPageChange(event: PageEvent): void {
    this.pageNumber.set(event.pageIndex + 1);
    this.pageSize.set(event.pageSize);
  }

  protected openCreateDialog(): void {
    const ref = this.dialog.open(WarehouseDialog);

    ref.componentRef?.setInput('warehouse', null);
    ref.componentInstance.saved.subscribe(() => {
      this.warehousesResource.reload();
      this.snackBar.open('Склад создан', 'Закрыть', { duration: 3000 });
    });
  }

  protected openEditDialog(warehouse: WarehouseDto): void {
    const ref = this.dialog.open(WarehouseDialog);

    ref.componentRef?.setInput('warehouse', warehouse);
    ref.componentInstance.saved.subscribe(() => {
      this.warehousesResource.reload();
      this.snackBar.open('Склад обновлён', 'Закрыть', { duration: 3000 });
    });
  }

  protected async delete(warehouse: WarehouseDto): Promise<void> {
    if (warehouse.id == null || this.deletingId() != null) {
      return;
    }

    const confirmed = await this.confirmation.confirm({
      title: 'Удаление склада',
      message: `Удалить «${warehouse.name ?? ''}»?`,
      confirmText: 'Удалить',
    });

    if (!confirmed) {
      return;
    }

    this.deletingId.set(warehouse.id);

    try {
      await firstValueFrom(this.warehouseService.delete(warehouse.id));

      if (this.items().length === 1 && this.pageNumber() > 1) {
        this.pageNumber.update((n) => n - 1);
      } else {
        this.warehousesResource.reload();
      }

      this.snackBar.open('Склад удалён', 'Закрыть', { duration: 3000 });
    } catch {
      // интерсептор
    } finally {
      this.deletingId.set(null);
    }
  }
}
