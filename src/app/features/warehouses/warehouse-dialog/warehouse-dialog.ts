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
  CreateWarehouseRequest,
  WarehouseDto,
  WmsProblemDetails,
} from '../../../core/api/wms-api';
import { buildServerFieldErrors } from '../../../core/utils/form-errors';
import {
  extractErrorMessage,
  hasFieldErrors,
  toWmsProblemDetails,
} from '../../../core/utils/problem-details';
import { WarehouseService } from '../warehouses.service';


const WAREHOUSE_FIELD_MAP = {
  Name: 'name',
  Address: 'address',
  ContactPhone: 'contactPhone',
} as const;

type WarehouseFormModel = Required<CreateWarehouseRequest>;

const EMPTY_MODEL: WarehouseFormModel = {
  name: '',
  address: '',
  contactPhone: '',
};

@Component({
  selector: 'app-warehouse-dialog',
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
  templateUrl: './warehouse-dialog.html',
  styleUrls: [
    './warehouse-dialog.scss',
    '../../../shared/styles/form-grid.scss',
    '../../../shared/styles/form-error.scss',
  ],
})
export class WarehouseDialog {
  readonly warehouse = input<WarehouseDto | null>(null);
  readonly saved = output<void>();

  private readonly dialogRef = inject(MatDialogRef<WarehouseDialog>);
  private readonly warehouseService = inject(WarehouseService);

  protected readonly model = linkedSignal<WarehouseFormModel>(() => {
    const w = this.warehouse();
    return w
      ? {
        name: w.name ?? '',
        address: w.address ?? '',
        contactPhone: w.contactPhone ?? '',
      }
      : { ...EMPTY_MODEL };
  });

  protected readonly title = computed(() =>
    this.warehouse() ? 'Редактировать склад' : 'Новый склад',
  );
  protected readonly error = signal<string | null>(null);

  protected readonly warehouseForm = form(
    this.model,
    (schema) => {
      required(schema.name, { message: 'Название обязательно' });
    },
    {
      submission: {
        action: async (field, detail) => {
          this.error.set(null);
          const value = field().value();

          const w = this.warehouse();
          const problem =
            w?.id != null
              ? await this.runMutation(() =>
                this.warehouseService.update(w.id!, value),
              )
              : await this.runMutation(() =>
                this.warehouseService.create(value),
              );

          if (problem) {
            return buildServerFieldErrors(
              problem,
              WAREHOUSE_FIELD_MAP,
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
        this.error.set(extractErrorMessage(raw, 'Ошибка сохранения склада'));
      }

      return problem;
    }
  }
}
