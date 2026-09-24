import {
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
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
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatOption, MatSelect } from '@angular/material/select';
import {
  CreateRackRequest,
  RackDto,
  WmsProblemDetails,
} from '../../../core/api/wms-api';
import { buildServerFieldErrors } from '../../../core/utils/form-errors';
import {
  extractErrorMessage,
  hasFieldErrors,
  toWmsProblemDetails,
} from '../../../core/utils/problem-details';
import { ZoneService } from '../../zones/zone.service';
import { RackService } from '../rack.service';

const RACK_FIELD_MAP = {
  Code: 'code',
  ZoneId: 'zoneId',
} as const;

type RackFormModel = Omit<Required<CreateRackRequest>, 'zoneId'> & {
  zoneId: number | null;
};

const EMPTY_MODEL: RackFormModel = {
  code: '',
  zoneId: null,
};

@Component({
  selector: 'app-rack-dialog',
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
  templateUrl: './rack-dialog.html',
  styleUrls: [
    './rack-dialog.scss',
    '../../../shared/styles/form-grid.scss',
    '../../../shared/styles/form-error.scss',
  ],
})
export class RackDialog {
  readonly rack = input<RackDto | null>(null);
  readonly saved = output<void>();

  private readonly dialogRef = inject(MatDialogRef<RackDialog>);
  private readonly rackService = inject(RackService);
  private readonly zoneService = inject(ZoneService);

  protected readonly zonesResource = rxResource({
    stream: () => this.zoneService.getAll(),
  });

  protected readonly model = linkedSignal<RackFormModel>(() => {
    const r = this.rack();
    return r
      ? {
        code: r.code ?? '',
        zoneId: r.zoneId ?? null,
      }
      : { ...EMPTY_MODEL };
  });

  protected readonly title = computed(() =>
    this.rack() ? 'Редактировать стеллаж' : 'Новый стеллаж',
  );
  protected readonly error = signal<string | null>(null);

  protected readonly rackForm = form(
    this.model,
    (schema) => {
      required(schema.code, { message: 'Код обязателен' });
      required(schema.zoneId, { message: 'Зона обязательна' });
    },
    {
      submission: {
        action: async (field, detail) => {
          this.error.set(null);
          const value = field().value();

          if (value.zoneId == null) {
            return undefined;
          }
          const payload: CreateRackRequest = {
            code: value.code,
            zoneId: value.zoneId,
          };

          const r = this.rack();
          const problem =
            r?.id != null
              ? await this.runMutation(() =>
                this.rackService.update(r.id!, payload),
              )
              : await this.runMutation(() => this.rackService.create(payload));

          if (problem) {
            return buildServerFieldErrors(
              problem,
              RACK_FIELD_MAP,
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
        this.error.set(extractErrorMessage(raw, 'Ошибка сохранения стеллажа'));
      }

      return problem;
    }
  }
}
