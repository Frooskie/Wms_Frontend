import { Component, computed, inject, inputBinding, outputBinding, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButton } from '@angular/material/button';
import { MatCard, MatCardContent } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { RackDto } from '../../../core/api/wms-api';
import { AuthStore } from '../../../core/store';
import { ZoneService } from '../../zones/zone.service';
import { RackDialog } from '../rack-dialog/rack-dialog';
import { RackService } from '../rack.service';
import { ConfirmationService } from '../../../shared/services/confirmation.service';
import { showMutationError } from '../../../core/utils/mutation-errors';

const DEFAULT_PAGE_SIZE = 10;

@Component({
  selector: 'app-racks-list',
  imports: [
    MatButton,
    MatCard,
    MatCardContent,
    MatPaginator,
    MatProgressSpinner,
  ],
  templateUrl: './racks-list.html',
  styleUrls: [
    './racks-list.scss',
    '../../../shared/styles/page.scss',
    '../../../shared/styles/data-table.scss',
  ],
})
export class RacksList {
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly rackService = inject(RackService);
  private readonly zoneService = inject(ZoneService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly authStore = inject(AuthStore);

  protected readonly pageNumber = signal(1);
  protected readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  protected readonly deletingId = signal<number | null>(null);

  protected readonly canEdit = computed(() => {
    const roles = this.authStore.user()?.roles ?? [];
    return roles.includes('Manager') || roles.includes('Chief');
  });

  protected readonly racksResource = rxResource({
    params: () => ({
      pageNumber: this.pageNumber(),
      pageSize: this.pageSize(),
    }),
    stream: ({ params }) =>
      this.rackService.getPaged(params.pageNumber, params.pageSize),
  });

  protected readonly zonesResource = rxResource({
    stream: () => this.zoneService.getAll(),
  });

  protected readonly zoneMap = computed(() => {
    const list = this.zonesResource.value() ?? [];
    return new Map(list.map((z) => [z.id!, z.name ?? '']));
  });

  protected readonly items = computed(
    () => this.racksResource.value()?.items ?? [],
  );
  protected readonly totalCount = computed(
    () => this.racksResource.value()?.totalCount ?? 0,
  );
  protected readonly isLoading = this.racksResource.isLoading;

  protected onPageChange(event: PageEvent): void {
    this.pageNumber.set(event.pageIndex + 1);
    this.pageSize.set(event.pageSize);
  }

  protected openCreateDialog(): void {
    this.dialog.open(RackDialog, {
      bindings: [
        inputBinding('rack', () => null),
        outputBinding<void>('saved', () => {
          this.racksResource.reload();
          this.snackBar.open('Стеллаж создан', 'Закрыть', { duration: 3000 });
        }),
      ],
    });
  }

  protected openEditDialog(rack: RackDto): void {
    this.dialog.open(RackDialog, {
      bindings: [
        inputBinding('rack', () => rack),
        outputBinding<void>('saved', () => {
          this.racksResource.reload();
          this.snackBar.open('Стеллаж обновлён', 'Закрыть', { duration: 3000 });
        }),
      ],
    });
  }

  protected async delete(rack: RackDto): Promise<void> {
    if (rack.id == null || this.deletingId() != null) {
      return;
    }

    const confirmed = await this.confirmation.confirm({
      title: 'Удаление стеллажа',
      message: `Удалить «${rack.code ?? ''}»?`,
      confirmText: 'Удалить',
    });

    if (!confirmed) {
      return;
    }

    this.deletingId.set(rack.id);

    try {
      await firstValueFrom(this.rackService.delete(rack.id));

      if (this.items().length === 1 && this.pageNumber() > 1) {
        this.pageNumber.update((n) => n - 1);
      } else {
        this.racksResource.reload();
      }

      this.snackBar.open('Стеллаж удалён', 'Закрыть', { duration: 3000 });
    } catch (raw: unknown) {
      showMutationError(this.snackBar, raw, 'Не удалось удалить стеллаж');
    } finally {
      this.deletingId.set(null);
    }
  }
}
