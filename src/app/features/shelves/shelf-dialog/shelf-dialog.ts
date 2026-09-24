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
  CreateShelfRequest,
  ShelfDto,
  WmsProblemDetails,
} from '../../../core/api/wms-api';
import { buildServerFieldErrors } from '../../../core/utils/form-errors';
import {
  extractErrorMessage,
  hasFieldErrors,
  toWmsProblemDetails,
} from '../../../core/utils/problem-details';
import { RackService } from '../../racks/rack.service';
import { ShelfService } from '../shelf.service';

const SHELF_FIELD_MAP = {
  Number: 'number',
  RackId: 'rackId',
} as const;

type ShelfFormModel = Omit<
  Required<CreateShelfRequest>,
  'number' | 'rackId'
> & {
  number: number | null;
  rackId: number | null;
};

const EMPTY_MODEL: ShelfFormModel = {
  number: null,
  rackId: null,
};

@Component({
  selector: 'app-shelf-dialog',
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
  templateUrl: './shelf-dialog.html',
  styleUrls: [
    './shelf-dialog.scss',
    '../../../shared/styles/form-grid.scss',
    '../../../shared/styles/form-error.scss',
  ],
})
export class ShelfDialog {
  readonly shelf = input<ShelfDto | null>(null);
  readonly saved = output<void>();

  private readonly dialogRef = inject(MatDialogRef<ShelfDialog>);
  private readonly shelfService = inject(ShelfService);
  private readonly rackService = inject(RackService);

  protected readonly racksResource = rxResource({
    stream: () => this.rackService.getAll(),
  });

  protected readonly model = linkedSignal<ShelfFormModel>(() => {
    const s = this.shelf();
    return s
      ? {
        number: s.number ?? null,
        rackId: s.rackId ?? null,
      }
      : { ...EMPTY_MODEL };
  });

  protected readonly title = computed(() =>
    this.shelf() ? 'Редактировать полку' : 'Новая полка',
  );
  protected readonly error = signal<string | null>(null);

  protected readonly shelfForm = form(
    this.model,
    (schema) => {
      required(schema.number, { message: 'Номер обязателен' });
      required(schema.rackId, { message: 'Стеллаж обязателен' });
    },
    {
      submission: {
        action: async (field, detail) => {
          this.error.set(null);
          const value = field().value();

          if (value.number == null || value.rackId == null) {
            return undefined;
          }

          const payload: CreateShelfRequest = {
            number: value.number,
            rackId: value.rackId,
          };

          const s = this.shelf();
          const problem =
            s?.id != null
              ? await this.runMutation(() =>
                this.shelfService.update(s.id!, payload),
              )
              : await this.runMutation(() => this.shelfService.create(payload));

          if (problem) {
            return buildServerFieldErrors(
              problem,
              SHELF_FIELD_MAP,
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
        this.error.set(extractErrorMessage(raw, 'Ошибка сохранения полки'));
      }

      return problem;
    }
  }
}
