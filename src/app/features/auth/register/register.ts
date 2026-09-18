import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import {
  email as emailValidator,
  form,
  FormField,
  FormRoot,
  required,
} from '@angular/forms/signals';
import { MatButton } from '@angular/material/button';
import { MatError, MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthStore } from '../../../core/store';
import { buildServerFieldErrors } from '../../../core/utils/form-errors';

const REGISTER_FIELD_MAP = {
  Email: 'email',
  Password: 'password',
  FullName: 'fullName',
  Role: 'role',
} as const;

@Component({
  selector: 'app-register',
  imports: [
    FormField,
    FormRoot,
    MatFormField,
    MatLabel,
    MatError,
    MatInput,
    MatSelect,
    MatOption,
    MatButton,
    MatProgressSpinner,
  ],
  templateUrl: './register.html',
  styleUrl: './register.scss',
})
export class Register {
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly model = signal({
    email: '',
    password: '',
    fullName: '',
    role: 'Worker',
  });

  protected readonly roleOptions = [
    { label: 'Директор магазина (StoreDirector)', value: 'StoreDirector' },
    { label: 'Кладовщик (Worker)', value: 'Worker' },
    { label: 'Менеджер склада (Manager)', value: 'Manager' },
    { label: 'Руководитель склада (Chief)', value: 'Chief' },
  ] as const;

  protected readonly registerForm = form(
    this.model,
    (schema) => {
      required(schema.fullName, { message: 'Полное имя обязательно' });
      required(schema.email, { message: 'Email обязателен' });
      emailValidator(schema.email, { message: 'Некорректный email' });
      required(schema.password, { message: 'Пароль обязателен' });
      required(schema.role, { message: 'Выберите роль' });
    },
    {
      submission: {
        action: async (field, detail) => {
          const { email, password, fullName, role } = field().value();
          const problem = await this.authStore.register(
            email,
            password,
            fullName,
            role,
          );

          return buildServerFieldErrors(
            problem,
            REGISTER_FIELD_MAP,
            (name) => detail.root[name],
          );
        },
        onInvalid: (field) => {
          const firstError = field().errorSummary()[0];
          firstError?.fieldTree().focusBoundControl();
        },
      },
    }
  );

  protected readonly error = computed(() => this.authStore.error());

  constructor() {
    effect(() => {
      if (!this.authStore.registerSuccess()) {
        return;
      }
      untracked(() => {
        this.authStore.clearRegisterSuccess();
        this.snackBar.open('Пользователь зарегистрирован', 'Закрыть', {
          duration: 4000,
        });

        void this.router.navigate(['/dashboard']);
      });
    });
  }

  protected cancel(): void {
    void this.router.navigate(['/dashboard']);
  }
}
