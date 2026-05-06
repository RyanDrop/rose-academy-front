import { Injectable } from '@angular/core';

import type { ApiUser } from '../api/auth-api.service';

const TOKEN_KEY = 'rose-academy.auth.access-token';
const ME_KEY = 'rose-academy.auth.me';

@Injectable({
  providedIn: 'root',
})
export class AuthTokenStorageService {
  /**
   * Grava o JWT. `persistent` true usa `localStorage`; false usa `sessionStorage`
   * (encerra ao fechar a aba).
   */
  setToken(token: string, persistent: boolean): void {
    this.clear();
    const target = persistent ? localStorage : sessionStorage;
    target.setItem(TOKEN_KEY, token);
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY);
  }

  /** Resposta em cache de `GET /auth/me` (mesmo storage do token). */
  setCachedMe(user: ApiUser): void {
    const target = this.storageForActiveSession();
    if (!target) {
      return;
    }
    try {
      target.setItem(ME_KEY, JSON.stringify(user));
    } catch {
      /* quota ou ambiente restrito */
    }
  }

  getCachedMe(): ApiUser | null {
    const raw =
      localStorage.getItem(ME_KEY) ?? sessionStorage.getItem(ME_KEY);
    if (!raw) {
      return null;
    }
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') {
        return null;
      }
      return parsed as ApiUser;
    } catch {
      return null;
    }
  }

  clear(): void {
    for (const store of [localStorage, sessionStorage]) {
      store.removeItem(TOKEN_KEY);
      store.removeItem(ME_KEY);
    }
  }

  hasToken(): boolean {
    return this.getToken() !== null;
  }

  private storageForActiveSession(): Storage | null {
    if (localStorage.getItem(TOKEN_KEY)) {
      return localStorage;
    }
    if (sessionStorage.getItem(TOKEN_KEY)) {
      return sessionStorage;
    }
    return null;
  }
}
