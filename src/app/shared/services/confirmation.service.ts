import { Service, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { ConfirmDialog } from '../components/confirm-dialog/confirm-dialog';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
}

@Service()
export class ConfirmationService {
  private readonly dialog = inject(MatDialog);

  async confirm(options: ConfirmOptions): Promise<boolean> {
    const ref = this.dialog.open(ConfirmDialog);

    ref.componentRef?.setInput('title', options.title);
    ref.componentRef?.setInput('message', options.message);
    ref.componentRef?.setInput('confirmText', options.confirmText ?? 'OK');

    return (await firstValueFrom(ref.afterClosed())) === true;
  }
}
