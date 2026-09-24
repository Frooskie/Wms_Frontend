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
  CellDto,
  CreateCellRequest,
  WmsProblemDetails,
} from '../../../core/api/wms-api';
import { buildServerFieldErrors } from '../../../core/utils/form-errors';
import {
  extractErrorMessage,
  hasFieldErrors,
  toWmsProblemDetails,
} from '../../../core/utils/problem-details';
import { ShelfService } from '../../shelves/shelf.service';
import { CellService } from '../cell.service';

const CELL_FIELD_MAP = {
  Code: 'code',
  ShelfId: 'shelfId',
} as const;

type CellFormModel = Omit<Required<CreateCellRequest>, 'shelfId'> & {
  shelfId: number | null;
};

const EMPTY_MODEL: CellFormModel = {
  code: '',
  shelfId: null,
};

@Component({
  selector: 'app-cell-dialog',
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
  templateUrl: './cell-dialog.html',
  styleUrls: [
    './cell-dialog.scss',
    '../../../shared/styles/form-grid.scss',
    '../../../shared/styles/form-error.scss',
  ],
})
export class CellDialog {
  readonly cell = input<CellDto | null>(null);
  readonly saved = output<void>();

  private readonly dialogRef = inject(MatDialogRef<CellDialog>);
  private readonly cellService = inject(CellService);
  private readonly shelfService = inject(ShelfService);

  protected readonly shelvesResource = rxResource({
    stream: () => this.shelfService.getAll(),
  });

  protected readonly model = linkedSignal<CellFormModel>(() => {
    const c = this.cell();

    return c
      ? {
        code: c.code ?? '',
        shelfId: c.shelfId ?? null,
      }
      : { ...EMPTY_MODEL };
  });

  protected readonly title = computed(() =>
    this.cell() ? 'Редактировать ячейку' : 'Новая ячейка',
  );
  protected readonly error = signal<string | null>(null);

  protected readonly cellForm = form(
    this.model,
    (schema) => {
      required(schema.code, { message: 'Код обязателен' });
      required(schema.shelfId, { message: 'Полка обязательна' });
    },
    {
      submission: {
        action: async (field, detail) => {
          this.error.set(null);

          const value = field().value();
          if (value.shelfId == null) {
            return undefined;
          }

          const payload: CreateCellRequest = {
            code: value.code,
            shelfId: value.shelfId,
          };

          const c = this.cell();
          const problem =
            c?.id != null
              ? await this.runMutation(() =>
                this.cellService.update(c.id!, payload),
              )
              : await this.runMutation(() => this.cellService.create(payload));

          if (problem) {
            return buildServerFieldErrors(
              problem,
              CELL_FIELD_MAP,
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
        this.error.set(extractErrorMessage(raw, 'Ошибка сохранения ячейки'));
      }

      return problem;
    }
  }
}
