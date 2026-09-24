import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButton } from '@angular/material/button';
import { MatCard, MatCardContent } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { ShelfDto } from '../../../core/api/wms-api';
import { AuthStore } from '../../../core/store';
import { RackService } from '../../racks/rack.service';
import { ShelfDialog } from '../shelf-dialog/shelf-dialog';
import { ShelfService } from '../shelf.service';
import { ConfirmationService } from '../../../shared/services/confirmation.service';

const DEFAULT_PAGE_SIZE = 10;

@Component({
  selector: 'app-shelves-list',
  imports: [
    MatButton,
    MatCard,
    MatCardContent,
    MatPaginator,
    MatProgressSpinner,
  ],
  templateUrl: './shelves-list.html',
  styleUrls: [
    './shelves-list.scss',
    '../../../shared/styles/page.scss',
    '../../../shared/styles/data-table.scss',
  ],
})
export class ShelvesList {
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly shelfService = inject(ShelfService);
  private readonly rackService = inject(RackService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly authStore = inject(AuthStore);

  protected readonly pageNumber = signal(1);
  protected readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  protected readonly deletingId = signal<number | null>(null);

  protected readonly canEdit = computed(() => {
    const roles = this.authStore.user()?.roles ?? [];
    return roles.includes('Manager') || roles.includes('Chief');
  });

  protected readonly shelvesResource = rxResource({
    params: () => ({
      pageNumber: this.pageNumber(),
      pageSize: this.pageSize(),
    }),
    stream: ({ params }) =>
      this.shelfService.getPaged(params.pageNumber, params.pageSize),
  });

  protected readonly racksResource = rxResource({
    stream: () => this.rackService.getAll(),
  });

  protected readonly rackMap = computed(() => {
    const list = this.racksResource.value() ?? [];
    return new Map(list.map((r) => [r.id!, r.code ?? '']));
  });

  protected readonly items = computed(
    () => this.shelvesResource.value()?.items ?? [],
  );
  protected readonly totalCount = computed(
    () => this.shelvesResource.value()?.totalCount ?? 0,
  );
  protected readonly isLoading = computed(() =>
    this.shelvesResource.isLoading(),
  );

  protected onPageChange(event: PageEvent): void {
    this.pageNumber.set(event.pageIndex + 1);
    this.pageSize.set(event.pageSize);
  }

  protected openCreateDialog(): void {
    const ref = this.dialog.open(ShelfDialog);

    ref.componentRef?.setInput('shelf', null);
    ref.componentInstance.saved.subscribe(() => {
      this.shelvesResource.reload();
      this.snackBar.open('Полка создана', 'Закрыть', { duration: 3000 });
    });
  }

  protected openEditDialog(shelf: ShelfDto): void {
    const ref = this.dialog.open(ShelfDialog);

    ref.componentRef?.setInput('shelf', shelf);
    ref.componentInstance.saved.subscribe(() => {
      this.shelvesResource.reload();
      this.snackBar.open('Полка обновлена', 'Закрыть', { duration: 3000 });
    });
  }

  protected async delete(shelf: ShelfDto): Promise<void> {
    if (shelf.id == null || this.deletingId() != null) {
      return;
    }

    const confirmed = await this.confirmation.confirm({
      title: 'Удаление полки',
      message: `Удалить полку №${shelf.number ?? '?'}?`,
      confirmText: 'Удалить',
    });

    if (!confirmed) {
      return;
    }

    this.deletingId.set(shelf.id);

    try {
      await firstValueFrom(this.shelfService.delete(shelf.id));

      if (this.items().length === 1 && this.pageNumber() > 1) {
        this.pageNumber.update((n) => n - 1);
      } else {
        this.shelvesResource.reload();
      }

      this.snackBar.open('Полка удалена', 'Закрыть', { duration: 3000 });
    } catch {
      // интерсептор
    } finally {
      this.deletingId.set(null);
    }
  }
}
