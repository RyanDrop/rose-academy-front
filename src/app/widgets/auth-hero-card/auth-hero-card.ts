import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  computed,
  input,
  output,
  signal,
} from '@angular/core';

import { AuthHeroMetric } from '../../domain/auth/auth.models';

@Component({
  selector: 'ra-auth-hero-card',
  imports: [],
  templateUrl: './auth-hero-card.html',
  styleUrl: './auth-hero-card.scss',
  encapsulation: ViewEncapsulation.Emulated,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthHeroCard {
  readonly eyebrow = input('Rosi Nascimento Personal');
  readonly title = input.required<string>();
  readonly subtitle = input.required<string>();
  readonly badges = input<string[]>([]);
  readonly metrics = input<AuthHeroMetric[]>([]);
  readonly accentLabel = input('Treino em dia');
  readonly showStartSlider = input(false);
  readonly startHint = input('Arraste para abrir o login');
  readonly journeyStart = output<void>();

  readonly dragOffset = signal(0);
  readonly isDraggingStart = signal(false);
  private dragStartX = 0;
  private dragBaseOffset = 0;
  private dragMax = 220;

  readonly dragProgress = computed(() =>
    Math.min(this.dragOffset() / this.dragMax, 1),
  );

  startDrag(event: PointerEvent): void {
    const thumb = event.currentTarget as HTMLElement | null;
    const track = thumb?.parentElement;
    if (thumb && track) {
      this.dragMax = Math.max(track.clientWidth - thumb.clientWidth - 16, 0);
    }

    thumb?.setPointerCapture?.(event.pointerId);
    this.isDraggingStart.set(true);
    this.dragStartX = event.clientX;
    this.dragBaseOffset = this.dragOffset();
  }

  onDrag(event: PointerEvent): void {
    if (!this.isDraggingStart()) {
      return;
    }

    const nextOffset = this.dragBaseOffset + (event.clientX - this.dragStartX);
    this.dragOffset.set(clamp(nextOffset, 0, this.dragMax));
  }

  endDrag(): void {
    if (!this.isDraggingStart()) {
      return;
    }

    this.isDraggingStart.set(false);

    if (this.dragProgress() >= 0.92) {
      this.dragOffset.set(this.dragMax);
      this.journeyStart.emit();
      queueMicrotask(() => this.dragOffset.set(0));
      return;
    }

    this.dragOffset.set(0);
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
