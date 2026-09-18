import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
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
import { AuthStore } from '../../../core/store';
import { buildServerFieldErrors } from '../../../core/utils/form-errors';

/** Соответствие серверных имён (C#) и полей формы. */
const LOGIN_FIELD_MAP = {
  Email: 'email',
  Password: 'password',
} as const;

@Component({
  selector: 'app-login',
  imports: [
    FormField,
    FormRoot,
    MatFormField,
    MatLabel,
    MatError,
    MatInput,
    MatButton,
    MatProgressSpinner,
  ],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly model = signal({ email: '', password: '' });

  protected readonly loginForm = form(
    this.model,
    (schema) => {
      required(schema.email, { message: 'Email обязателен' });
      emailValidator(schema.email, { message: 'Некорректный email' });
      required(schema.password, { message: 'Пароль обязателен' });
    },
    {
      submission: {
        action: async (field, detail) => {
          const { email, password } = field().value();
          const problem = await this.authStore.login(email, password);

          return buildServerFieldErrors(
            problem,
            LOGIN_FIELD_MAP,
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
      if (this.authStore.token()) {
        const returnUrl =
          this.route.snapshot.queryParamMap.get('returnUrl') ?? '/dashboard';
        untracked(() => void this.router.navigateByUrl(returnUrl));
      }
    });
  }
}
