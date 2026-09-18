import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatButton } from '@angular/material/button';
import { MatCard, MatCardContent } from '@angular/material/card';
import { AuthStore } from '../../core/store';


@Component({
  selector: 'app-dashboard',
  imports: [MatButton, MatCard, MatCardContent],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  protected readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);

  protected readonly isChief = computed(
    () => this.authStore.user()?.roles?.includes('Chief') ?? false,
  );

  protected logout(): void {
    this.authStore.logout();
    void this.router.navigate(['/login']);
  }

  protected goToRegister(): void {
    void this.router.navigate(['/register']);
  }
}
