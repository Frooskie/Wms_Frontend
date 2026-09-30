import { Component, computed, inject, output, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
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
import { MatOption, MatSelect } from '@angular/material/select';
import { MatProgressSpinner } from '@angular/material/progress-spinner';

import {
  CreateBatchRequest,
  WmsProblemDetails,
} from '../../../core/api/wms-api';
import { buildServerFieldErrors } from '../../../core/utils/form-errors';
import {
  extractErrorMessage,
  hasFieldErrors,
  toWmsProblemDetails,
} from '../../../core/utils/problem-details';
import { CellService } from '../../cells/cell.service';
import { ProductService } from '../../products/product.service';
import { BatchService } from '../batch.service';

const BATCH_FIELD_MAP = {
  ProductId: 'productId',
  CellId: 'cellId',
  Quantity: 'quantity',
  PurchasePrice: 'purchasePrice',
  ProductionDate: 'productionDate',
  ExpiryDate: 'expiryDate',
} as const;

type BatchFormModel = Omit<
  Required<CreateBatchRequest>,
  'productId' | 'cellId'
> & {
  productId: number | null;
  cellId: number | null;
};

const EMPTY_MODEL: BatchFormModel = {
  productId: null,
  cellId: null,
  quantity: 0,
  purchasePrice: 0,
  productionDate: '',
  expiryDate: '',
};

@Component({
  selector: 'app-batch-dialog',
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
    MatSelect,
    MatOption,
    MatProgressSpinner,
  ],
  templateUrl: './batch-dialog.html',
  styleUrls: [
    './batch-dialog.scss',
    '../../../shared/styles/form-grid.scss',
    '../../../shared/styles/form-error.scss',
  ],
})
export class BatchDialog {
  readonly saved = output<void>();

  private readonly dialogRef = inject(MatDialogRef<BatchDialog>);
  private readonly batchService = inject(BatchService);
  private readonly productService = inject(ProductService);
  private readonly cellService = inject(CellService);

  protected readonly productsResource = rxResource({
    stream: () => this.productService.getAll(),
  });

  protected readonly cellsResource = rxResource({
    stream: () => this.cellService.getAll(),
  });

  protected readonly availableCells = computed(() =>
    (this.cellsResource.value() ?? []).filter((c) => !c.isOccupied),
  );

  protected readonly model = signal<BatchFormModel>({ ...EMPTY_MODEL });
  protected readonly error = signal<string | null>(null);

  protected readonly batchForm = form(
    this.model,
    (schema) => {
      required(schema.productId, { message: 'Товар обязателен' });
      required(schema.cellId, { message: 'Ячейка обязательна' });
      required(schema.quantity, { message: 'Количество обязательно' });
      required(schema.purchasePrice, { message: 'Цена обязательна' });
      required(schema.productionDate, {
        message: 'Дата производства обязательна',
      });
      required(schema.expiryDate, { message: 'Срок годности обязателен' });
    },
    {
      submission: {
        action: async (field, detail) => {
          this.error.set(null);
          const value = field().value();

          if (value.productId == null || value.cellId == null) {
            return undefined;
          }

          const payload: CreateBatchRequest = {
            productId: value.productId,
            cellId: value.cellId,
            quantity: value.quantity,
            purchasePrice: value.purchasePrice,
            productionDate: value.productionDate,
            expiryDate: value.expiryDate,
          };

          const problem = await this.runMutation(() =>
            this.batchService.create(payload),
          );

          if (problem) {
            return buildServerFieldErrors(
              problem,
              BATCH_FIELD_MAP,
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
        this.error.set(extractErrorMessage(raw, 'Ошибка сохранения партии'));
      }

      return problem;
    }
  }
}
