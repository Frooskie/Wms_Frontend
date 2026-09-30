import { Component, computed, inject, input, linkedSignal, output, signal, } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { firstValueFrom, Observable } from 'rxjs';
import { form, FormField, FormRoot, required } from '@angular/forms/signals';
import { MatButton } from '@angular/material/button';
import { MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle, } from '@angular/material/dialog';
import { MatError, MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatOption, MatSelect } from '@angular/material/select';
import { CreateZoneRequest, WmsProblemDetails, ZoneDto, ZoneType, } from '../../../core/api/wms-api';
import { buildServerFieldErrors } from '../../../core/utils/form-errors';
import { extractErrorMessage, hasFieldErrors, toWmsProblemDetails, } from '../../../core/utils/problem-details';
import { ZoneService } from '../zone.service';
import { WarehouseService } from '../../warehouses/warehouses.service';

const ZONE_FIELD_MAP = {
  Name: 'name',
  Type: 'type',
  WarehouseId: 'warehouseId',
} as const;

const ZONE_TYPE_OPTIONS = [
  { label: 'Обычная', value: 'Normal' },
  { label: 'Холодильник', value: 'Fridge' },
  { label: 'Морозильник', value: 'Freezer' },
] as const;

type ZoneFormModel = Omit<Required<CreateZoneRequest>, 'warehouseId'> & {
  warehouseId: number | null;
};

const EMPTY_MODEL: ZoneFormModel = {
  name: '',
  type: ZoneType.Normal,
  warehouseId: null,
};

@Component({
  selector: 'app-zone-dialog',
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
  templateUrl: './zone-dialog.html',
  styleUrls: [
    './zone-dialog.scss',
    '../../../shared/styles/form-grid.scss',
    '../../../shared/styles/form-error.scss',
  ],
})
export class ZoneDialog {
  readonly zone = input<ZoneDto | null>(null);
  readonly saved = output<void>();

  private readonly dialogRef = inject(MatDialogRef<ZoneDialog>);
  private readonly zoneService = inject(ZoneService);
  private readonly warehouseService = inject(WarehouseService);

  protected readonly zoneTypeOptions = ZONE_TYPE_OPTIONS;

  protected readonly warehousesResource = rxResource({
    stream: () => this.warehouseService.getAll(),
  });

  protected readonly model = linkedSignal<ZoneFormModel>(() => {
    const z = this.zone();
    return z
      ? {
        name: z.name ?? '',
        type: z.type ?? ZoneType.Normal,
        warehouseId: z.warehouseId ?? null,
      }
      : { ...EMPTY_MODEL };
  });

  protected readonly title = computed(() =>
    this.zone() ? 'Редактировать зону' : 'Новая зона',
  );
  protected readonly error = signal<string | null>(null);

  protected readonly zoneForm = form(
    this.model,
    (schema) => {
      required(schema.name, { message: 'Название обязательно' });
      required(schema.type, { message: 'Тип обязателен' });
      required(schema.warehouseId, { message: 'Склад обязателен' });
    },
    {
      submission: {
        action: async (field, detail) => {
          this.error.set(null);
          const value = field().value();

          if (value.warehouseId == null) {
            return undefined;
          }

          const payload: CreateZoneRequest = {
            name: value.name,
            type: value.type,
            warehouseId: value.warehouseId,
          };

          const z = this.zone();
          const problem =
            z?.id != null
              ? await this.runMutation(() =>
                this.zoneService.update(z.id!, payload),
              )
              : await this.runMutation(() => this.zoneService.create(payload));

          if (problem) {
            return buildServerFieldErrors(
              problem,
              ZONE_FIELD_MAP,
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
        this.error.set(extractErrorMessage(raw, 'Ошибка сохранения зоны'));
      }

      return problem;
    }
  }
}
