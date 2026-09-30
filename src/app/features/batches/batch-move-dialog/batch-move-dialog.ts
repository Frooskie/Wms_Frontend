import { Component, computed, inject, input, output, signal } from '@angular/core';
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
import { MatOption, MatSelect } from '@angular/material/select';
import { MatProgressSpinner } from '@angular/material/progress-spinner';

import {
  BatchDto,
  ErrorCodes,
  WmsProblemDetails,
} from '../../../core/api/wms-api';
import { buildServerFieldErrors } from '../../../core/utils/form-errors';
import {
  extractErrorCode,
  extractErrorMessage,
  hasFieldErrors,
  toWmsProblemDetails,
} from '../../../core/utils/problem-details';
import { CellService } from '../../cells/cell.service';
import { BatchService } from '../batch.service';

const MOVE_FIELD_MAP = {
  CellId: 'cellId',
} as const;

type MoveFormModel = { cellId: number | null };

@Component({
  selector: 'app-batch-move-dialog',
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
    MatSelect,
    MatOption,
    MatProgressSpinner,
  ],
  templateUrl: './batch-move-dialog.html',
  styleUrls: [
    './batch-move-dialog.scss',
    '../../../shared/styles/form-grid.scss',
    '../../../shared/styles/form-error.scss',
  ],
})
export class BatchMoveDialog {
  readonly batch = input.required<BatchDto>();
  readonly moved = output<void>();

  private readonly dialogRef = inject(MatDialogRef<BatchMoveDialog>);
  private readonly batchService = inject(BatchService);
  private readonly cellService = inject(CellService);

  protected readonly cellsResource = rxResource({
    stream: () => this.cellService.getAll(),
  });

  protected readonly availableCells = computed(() =>
    (this.cellsResource.value() ?? []).filter((c) => !c.isOccupied),
  );

  protected readonly model = signal<MoveFormModel>({ cellId: null });
  protected readonly error = signal<string | null>(null);

  protected readonly batchForm = form(
    this.model,
    (schema) => {
      required(schema.cellId, { message: 'Ячейка обязательна' });
    },
    {
      submission: {
        action: async (field, detail) => {
          this.error.set(null);
          const value = field().value();
          const b = this.batch();

          if (b.id == null || value.cellId == null) {
            return undefined;
          }

          try {
            await firstValueFrom(
              this.batchService.move(b.id, { cellId: value.cellId }),
            );

            this.moved.emit();
            this.dialogRef.close();

            return undefined;
          } catch (raw: unknown) {
            const problem = toWmsProblemDetails(raw);
            const code = extractErrorCode(raw);

            if (
              code === ErrorCodes.TARGET_CELL_OCCUPIED ||
              code === ErrorCodes.CELL_OCCUPIED
            ) {
              this.error.set(
                extractErrorMessage(raw, 'Целевая ячейка уже занята'),
              );
              this.cellsResource.reload();

              return undefined;
            }

            if (!hasFieldErrors(problem)) {
              this.error.set(
                extractErrorMessage(raw, 'Ошибка перемещения партии'),
              );
            }

            return buildServerFieldErrors(
              problem,
              MOVE_FIELD_MAP,
              (name) => detail.root[name],
            );
          }
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
}
