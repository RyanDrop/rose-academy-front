import type {
  ApiUser,
  SubscriptionActiveApiStatus,
} from './api/auth-api.service';
import type { GenderType } from './auth.types';

function readStr(user: ApiUser, ...keys: string[]): string {
  const rec = user as Record<string, unknown>;
  for (const key of keys) {
    const v = rec[key];
    if (typeof v === 'string' && v.trim()) {
      return v.trim();
    }
  }
  return '';
}

function readNum(user: ApiUser, ...keys: string[]): number {
  const rec = user as Record<string, unknown>;
  for (const key of keys) {
    const v = rec[key];
    if (typeof v === 'number' && !Number.isNaN(v)) {
      return v;
    }
    if (typeof v === 'string' && v.trim()) {
      const n = Number(v);
      if (!Number.isNaN(n)) {
        return n;
      }
    }
  }
  return 0;
}

/** Perfil obrigatorio alinhado ao passo 2 do cadastro. */
export function isProfileComplete(user: ApiUser | null): boolean {
  if (!user) {
    return false;
  }
  const gender = readStr(user, 'gender');
  const birth = readStr(user, 'date_birth', 'dateBirth');
  const goal = readStr(user, 'goal_id', 'goalId');
  const h = readNum(user, 'height');
  const w = readNum(user, 'weight');
  return (
    gender.length > 0 &&
    birth.length > 0 &&
    goal.length > 0 &&
    goal !== 'NaN' &&
    h > 0 &&
    w > 0
  );
}

/** Acesso liberado quando `GET /subscriptions/active` retorna `PAID`. */
export function isPaidSubscriptionStatus(
  status: SubscriptionActiveApiStatus,
): boolean {
  return status === 'PAID';
}

export type PostLoginDestination =
  | {
      kind: 'route';
      path: string[];
      queryParams?: Record<string, string>;
    }
  | { kind: 'pending_checkout' };

const API_GENDER_VALUES = new Set<string>([
  'feminino',
  'masculino',
  'outro',
  'prefiro_nao_dizer',
]);

/** Valores antigos do formulario em ingles -> enum PostgreSQL. */
const LEGACY_GENDER_MAP: Record<string, GenderType> = {
  female: 'feminino',
  male: 'masculino',
  'non-binary': 'outro',
  'prefer-not-to-say': 'prefiro_nao_dizer',
};

export function toGenderType(raw: string): GenderType | '' {
  const t = raw.trim().toLowerCase().replace(/\s+/g, '_');
  if (API_GENDER_VALUES.has(t)) {
    return t as GenderType;
  }
  const hyphen = raw.trim().toLowerCase().replace(/\s+/g, '-');
  return LEGACY_GENDER_MAP[hyphen] ?? LEGACY_GENDER_MAP[t] ?? '';
}

/**
 * Destino pos-login usando `GET /subscriptions/active`.
 * `PENDING`: o chamador deve buscar `GET /abacate/subscriptions` e redirecionar.
 */
export function postLoginDestination(
  user: ApiUser | null,
  subscriptionStatus: SubscriptionActiveApiStatus,
): PostLoginDestination {
  if (!isProfileComplete(user)) {
    return {
      kind: 'route',
      path: ['/auth', 'criar-conta'],
      queryParams: { step: '2' },
    };
  }
  if (subscriptionStatus === 'PAID') {
    return { kind: 'route', path: ['/home'] };
  }
  if (subscriptionStatus === 'PENDING') {
    return { kind: 'pending_checkout' };
  }
  return {
    kind: 'route',
    path: ['/auth', 'criar-conta'],
    queryParams: { step: '3' },
  };
}

export function prefillProfileFormFromUser(
  user: ApiUser,
  controls: {
    gender: { setValue: (v: string) => void };
    dateBirth: { setValue: (v: string) => void };
    weight: { setValue: (v: string) => void };
    height: { setValue: (v: string) => void };
    goalId: { setValue: (v: string | null) => void };
    cellphone: { setValue: (v: string) => void };
    profileImg: { setValue: (v: string | null) => void };
  },
): void {
  const g = readStr(user, 'gender');
  if (g) {
    const mapped = toGenderType(g);
    if (mapped) {
      controls.gender.setValue(mapped);
    } else {
      controls.gender.setValue('prefiro_nao_dizer');
    }
  }
  const birth = readStr(user, 'date_birth', 'dateBirth');
  if (birth) {
    controls.dateBirth.setValue(birth.slice(0, 10));
  }
  const w = readNum(user, 'weight');
  if (w > 0) {
    controls.weight.setValue(String(w));
  }
  const h = readNum(user, 'height');
  if (h > 0) {
    controls.height.setValue(String(h));
  }
  const gid = readStr(user, 'goal_id', 'goalId');
  if (gid && gid !== 'NaN') {
    controls.goalId.setValue(gid);
  }
  const phone = readStr(user, 'cellphone');
  if (phone) {
    controls.cellphone.setValue(phone);
  }
  const img = readStr(user, 'profile_img', 'profileImg');
  if (img) {
    controls.profileImg.setValue(img);
  }
}
