import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButton } from '@angular/material/button';
import { MatCard, MatCardContent } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { ZoneDto } from '../../../core/api/wms-api';
import { AuthStore } from '../../../core/store';
import { ZoneService } from '../zone.service';
import { WarehouseService } from '../../warehouses/warehouses.service';
import { ZoneDialog } from '../zone-dialog/zone-dialog';
import { ConfirmationService } from '../../../shared/services/confirmation.service';

const DEFAULT_PAGE_SIZE = 10;

const ZONE_TYPE_LABELS: Record<string, string> = {
  Normal: 'Обычная',
  Fridge: 'Холодильник',
  Freezer: 'Морозильник',
};

@Component({
  selector: 'app-zones-list',
  imports: [
    MatButton,
    MatCard,
    MatCardContent,
    MatPaginator,
    MatProgressSpinner,
  ],
  templateUrl: './zones-list.html',
  styleUrls: [
    './zones-list.scss',
    '../../../shared/styles/page.scss',
    '../../../shared/styles/data-table.scss',
  ],
})
export class ZonesList {
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly zoneService = inject(ZoneService);
  private readonly warehouseService = inject(WarehouseService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly authStore = inject(AuthStore);

  protected readonly pageNumber = signal(1);
  protected readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  protected readonly deletingId = signal<number | null>(null);
  protected readonly zoneTypeLabels = ZONE_TYPE_LABELS;

  protected readonly canEdit = computed(() => {
    const roles = this.authStore.user()?.roles ?? [];
    return roles.includes('Manager') || roles.includes('Chief');
  });

  protected readonly zonesResource = rxResource({
    params: () => ({
      pageNumber: this.pageNumber(),
      pageSize: this.pageSize(),
    }),
    stream: ({ params }) =>
      this.zoneService.getPaged(params.pageNumber, params.pageSize),
  });

  protected readonly warehousesResource = rxResource({
    stream: () => this.warehouseService.getAll(),
  });

  protected readonly warehouseMap = computed(() => {
    const list = this.warehousesResource.value() ?? [];
    return new Map(list.map((w) => [w.id!, w.name ?? '']));
  });

  protected readonly items = computed(
    () => this.zonesResource.value()?.items ?? [],
  );
  protected readonly totalCount = computed(
    () => this.zonesResource.value()?.totalCount ?? 0,
  );
  protected readonly isLoading = computed(() => this.zonesResource.isLoading());

  protected onPageChange(event: PageEvent): void {
    this.pageNumber.set(event.pageIndex + 1);
    this.pageSize.set(event.pageSize);
  }

  protected openCreateDialog(): void {
    const ref = this.dialog.open(ZoneDialog);

    ref.componentRef?.setInput('zone', null);
    ref.componentInstance.saved.subscribe(() => {
      this.zonesResource.reload();
      this.snackBar.open('Зона создана', 'Закрыть', { duration: 3000 });
    });
  }

  protected openEditDialog(zone: ZoneDto): void {
    const ref = this.dialog.open(ZoneDialog);

    ref.componentRef?.setInput('zone', zone);
    ref.componentInstance.saved.subscribe(() => {
      this.zonesResource.reload();
      this.snackBar.open('Зона обновлена', 'Закрыть', { duration: 3000 });
    });
  }

  protected async delete(zone: ZoneDto): Promise<void> {
    if (zone.id == null || this.deletingId() != null) {
      return;
    }

    const confirmed = await this.confirmation.confirm({
      title: 'Удаление зоны',
      message: `Удалить «${zone.name ?? ''}»?`,
      confirmText: 'Удалить',
    });

    if (!confirmed) {
      return;
    }

    this.deletingId.set(zone.id);

    try {
      await firstValueFrom(this.zoneService.delete(zone.id));

      if (this.items().length === 1 && this.pageNumber() > 1) {
        this.pageNumber.update((n) => n - 1);
      } else {
        this.zonesResource.reload();
      }

      this.snackBar.open('Зона удалена', 'Закрыть', { duration: 3000 });
    } catch {
      // интерсептор
    } finally {
      this.deletingId.set(null);
    }
  }
}
