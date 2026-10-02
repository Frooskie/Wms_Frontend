import { Component, computed, inject, inputBinding, outputBinding, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButton } from '@angular/material/button';
import { MatCard, MatCardContent } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { ProductDto } from '../../../core/api/wms-api';
import { AuthStore } from '../../../core/store';
import { ConfirmationService } from '../../../shared/services/confirmation.service';
import { ProductDialog } from '../product-dialog/product-dialog';
import { ProductService } from '../product.service';
import { showMutationError } from '../../../core/utils/mutation-errors';

const DEFAULT_PAGE_SIZE = 10;

@Component({
  selector: 'app-products-list',
  imports: [
    MatButton,
    MatCard,
    MatCardContent,
    MatPaginator,
    MatProgressSpinner,
  ],
  templateUrl: './products-list.html',
  styleUrls: [
    './products-list.scss',
    '../../../shared/styles/page.scss',
    '../../../shared/styles/data-table.scss',
  ],
})
export class ProductsList {
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly confirmation = inject(ConfirmationService);
  private readonly productService = inject(ProductService);
  private readonly authStore = inject(AuthStore);

  protected readonly pageNumber = signal(1);
  protected readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  protected readonly deletingId = signal<number | null>(null);

  protected readonly canEdit = computed(() => {
    const roles = this.authStore.user()?.roles ?? [];
    return roles.includes('Manager') || roles.includes('Chief');
  });

  protected readonly productsResource = rxResource({
    params: () => ({
      pageNumber: this.pageNumber(),
      pageSize: this.pageSize(),
    }),
    stream: ({ params }) =>
      this.productService.getPaged(params.pageNumber, params.pageSize),
  });

  protected readonly items = computed(
    () => this.productsResource.value()?.items ?? [],
  );
  protected readonly totalCount = computed(
    () => this.productsResource.value()?.totalCount ?? 0,
  );
  protected readonly isLoading = this.productsResource.isLoading;

  protected onPageChange(event: PageEvent): void {
    this.pageNumber.set(event.pageIndex + 1);
    this.pageSize.set(event.pageSize);
  }

  protected openCreateDialog(): void {
    this.dialog.open(ProductDialog, {
      bindings: [
        inputBinding('product', () => null),
        outputBinding<void>('saved', () => {
          this.productsResource.reload();
          this.snackBar.open('Товар создан', 'Закрыть', { duration: 3000 });
        }),
      ],
    });
  }

  protected openEditDialog(product: ProductDto): void {
    this.dialog.open(ProductDialog, {
      bindings: [
        inputBinding('product', () => product),
        outputBinding<void>('saved', () => {
          this.productsResource.reload();
          this.snackBar.open('Товар обновлён', 'Закрыть', { duration: 3000 });
        }),
      ],
    });
  }

  protected async delete(product: ProductDto): Promise<void> {
    if (product.id == null || this.deletingId() != null) {
      return;
    }

    const confirmed = await this.confirmation.confirm({
      title: 'Удаление товара',
      message: `Удалить «${product.name ?? ''}»?`,
      confirmText: 'Удалить',
    });

    if (!confirmed) {
      return;
    }

    this.deletingId.set(product.id);

    try {
      await firstValueFrom(this.productService.delete(product.id));

      if (this.items().length === 1 && this.pageNumber() > 1) {
        this.pageNumber.update((n) => n - 1);
      } else {
        this.productsResource.reload();
      }

      this.snackBar.open('Товар удалён', 'Закрыть', { duration: 3000 });
    } catch (raw: unknown) {
      showMutationError(this.snackBar, raw, 'Не удалось удалить товар');
    } finally {
      this.deletingId.set(null);
    }
  }
}
