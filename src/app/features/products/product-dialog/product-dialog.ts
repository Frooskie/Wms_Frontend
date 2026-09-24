import {
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { form, FormField, FormRoot, required } from '@angular/forms/signals';
import { MatButton } from '@angular/material/button';
import {
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatError, MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatProgressSpinner } from '@angular/material/progress-spinner';

import {
  CreateProductRequest,
  ProductDto,
  WmsProblemDetails,
} from '../../../core/api/wms-api';
import { buildServerFieldErrors } from '../../../core/utils/form-errors';
import {
  extractErrorMessage,
  hasFieldErrors,
  toWmsProblemDetails,
} from '../../../core/utils/problem-details';
import { ProductService } from '../product.service';

const PRODUCT_FIELD_MAP = {
  Name: 'name',
  Manufacturer: 'manufacturer',
  Supplier: 'supplier',
  Category: 'category',
  Unit: 'unit',
  MinStockThreshold: 'minStockThreshold',
} as const;

type ProductFormModel = Required<CreateProductRequest>;

const EMPTY_MODEL: ProductFormModel = {
  name: '',
  manufacturer: '',
  supplier: '',
  category: '',
  unit: 'шт',
  minStockThreshold: 0,
};

@Component({
  selector: 'app-product-dialog',
  imports: [
    FormField,
    FormRoot,
    MatButton,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatFormField,
    MatLabel,
    MatError,
    MatInput,
    MatProgressSpinner,
  ],
  templateUrl: './product-dialog.html',
  styleUrls: [
    './product-dialog.scss',
    '../../../shared/styles/form-grid.scss',
    '../../../shared/styles/form-error.scss',
  ],
})
export class ProductDialog {
  readonly product = input<ProductDto | null>(null);
  readonly saved = output<void>();

  private readonly dialogRef = inject(MatDialogRef<ProductDialog>);
  private readonly productService = inject(ProductService);

  protected readonly model = linkedSignal<ProductFormModel>(() => {
    const p = this.product();
    return p
      ? {
        name: p.name ?? '',
        manufacturer: p.manufacturer ?? '',
        supplier: p.supplier ?? '',
        category: p.category ?? '',
        unit: p.unit ?? 'шт',
        minStockThreshold: p.minStockThreshold ?? 0,
      }
      : { ...EMPTY_MODEL };
  });

  protected readonly title = computed(() =>
    this.product() ? 'Редактировать товар' : 'Новый товар',
  );
  protected readonly error = signal<string | null>(null);

  protected readonly productForm = form(
    this.model,
    (schema) => {
      required(schema.name, { message: 'Название обязательно' });
    },
    {
      submission: {
        action: async (field, detail) => {
          this.error.set(null);
          const value = field().value();

          const p = this.product();
          const problem =
            p?.id != null
              ? await this.runMutation(() =>
                this.productService.update(p.id!, value),
              )
              : await this.runMutation(() =>
                this.productService.create(value),
              );

          if (problem) {
            return buildServerFieldErrors(
              problem,
              PRODUCT_FIELD_MAP,
              (name) => detail.root[name],
            );
          }

          this.saved.emit();
          this.dialogRef.close();

          return undefined;
        },
        onInvalid: (field) => {
          field().errorSummary()[0]?.fieldTree().focusBoundControl();
        },
      },
    },
  );

  protected cancel(): void {
    this.dialogRef.close();
  }

  private async runMutation(
    fn: () => Observable<unknown>,
  ): Promise<WmsProblemDetails | null> {
    try {
      await firstValueFrom(fn());

      return null;
    } catch (raw: unknown) {
      const problem = toWmsProblemDetails(raw);

      if (!hasFieldErrors(problem)) {
        this.error.set(extractErrorMessage(raw, 'Ошибка сохранения товара'));
      }

      return problem;
    }
  }
}
