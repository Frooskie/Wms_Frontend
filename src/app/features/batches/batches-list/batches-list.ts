import { DatePipe } from '@angular/common';
import { Component, computed, inject, inputBinding, outputBinding, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButton } from '@angular/material/button';
import { MatCard, MatCardContent } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';

import { BatchDto } from '../../../core/api/wms-api';
import { AuthStore } from '../../../core/store';
import { CellService } from '../../cells/cell.service';
import { ProductService } from '../../products/product.service';
import { BatchDialog } from '../batch-dialog/batch-dialog';
import { BatchMoveDialog } from '../batch-move-dialog/batch-move-dialog';
import { BatchService } from '../batch.service';

const DEFAULT_PAGE_SIZE = 10;

@Component({
  selector: 'app-batches-list',
  imports: [
    MatButton,
    MatCard,
    MatCardContent,
    MatFormField,
    MatLabel,
    MatInput,
    MatSelect,
    MatOption,
    MatPaginator,
    MatProgressSpinner,
    DatePipe,
  ],
  templateUrl: './batches-list.html',
  styleUrls: [
    './batches-list.scss',
    '../../../shared/styles/page.scss',
    '../../../shared/styles/data-table.scss',
  ],
})
export class BatchesList {
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly batchService = inject(BatchService);
  private readonly productService = inject(ProductService);
  private readonly cellService = inject(CellService);
  private readonly authStore = inject(AuthStore);

  protected readonly productId = signal<number | null>(null);
  protected readonly cellId = signal<number | null>(null);
  protected readonly expiryFrom = signal<string>('');
  protected readonly expiryTo = signal<string>('');

  protected readonly pageNumber = signal(1);
  protected readonly pageSize = signal(DEFAULT_PAGE_SIZE);

  protected readonly canEdit = computed(() => {
    const roles = this.authStore.user()?.roles ?? [];
    return roles.includes('Manager') || roles.includes('Chief');
  });

  protected readonly productsResource = rxResource({
    stream: () => this.productService.getAll(),
  });

  protected readonly cellsResource = rxResource({
    stream: () => this.cellService.getAll(),
  });

  protected readonly batchesResource = rxResource({
    params: () => ({
      productId: this.productId() ?? undefined,
      cellId: this.cellId() ?? undefined,
      expiryFrom: this.expiryFrom() || undefined,
      expiryTo: this.expiryTo() || undefined,
      pageNumber: this.pageNumber(),
      pageSize: this.pageSize(),
    }),
    stream: ({ params }) =>
      this.batchService.getPaged(
        {
          productId: params.productId,
          cellId: params.cellId,
          expiryFrom: params.expiryFrom,
          expiryTo: params.expiryTo,
        },
        params.pageNumber,
        params.pageSize,
      ),
  });

  protected readonly items = computed(
    () => this.batchesResource.value()?.items ?? [],
  );
  protected readonly totalCount = computed(
    () => this.batchesResource.value()?.totalCount ?? 0,
  );
  protected readonly isLoading = this.batchesResource.isLoading;

  protected readonly hasActiveFilters = computed(
    () =>
      this.productId() !== null ||
      this.cellId() !== null ||
      this.expiryFrom() !== '' ||
      this.expiryTo() !== '',
  );

  protected onPageChange(event: PageEvent): void {
    this.pageNumber.set(event.pageIndex + 1);
    this.pageSize.set(event.pageSize);
  }

  protected onProductFilterChange(value: number | null): void {
    this.productId.set(value);
    this.pageNumber.set(1);
  }

  protected onCellFilterChange(value: number | null): void {
    this.cellId.set(value);
    this.pageNumber.set(1);
  }

  protected onExpiryFromChange(value: string): void {
    this.expiryFrom.set(value);
    this.pageNumber.set(1);
  }

  protected onExpiryToChange(value: string): void {
    this.expiryTo.set(value);
    this.pageNumber.set(1);
  }

  protected resetFilters(): void {
    this.productId.set(null);
    this.cellId.set(null);
    this.expiryFrom.set('');
    this.expiryTo.set('');
    this.pageNumber.set(1);
  }

  protected openCreateDialog(): void {
    this.dialog.open(BatchDialog, {
      bindings: [
        inputBinding('batch', () => null),
        outputBinding<void>('saved', () => {
          this.batchesResource.reload();
          this.snackBar.open('Партия создана', 'Закрыть', { duration: 3000 });
        }),
      ],
    });
  }

  protected openMoveDialog(batch: BatchDto): void {
    if (batch.id == null) {
      return;
    }

    this.dialog.open(BatchMoveDialog, {
      bindings: [
        inputBinding('batch', () => batch),
        outputBinding<void>('moved', () => {
          this.batchesResource.reload();
          this.snackBar.open('Партия перемещена', 'Закрыть', { duration: 3000 });
        }),
      ],
    });
  }
}
