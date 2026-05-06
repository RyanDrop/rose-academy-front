import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

const PASSWORD_COMPLEXITY_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

export function fullNameValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = `${control.value ?? ''}`.trim();

    if (!value) {
      return null;
    }

    const nameParts = value.split(/\s+/).filter(Boolean);
    return nameParts.length >= 2 ? null : { fullName: true };
  };
}

export function passwordComplexityValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = `${control.value ?? ''}`;
    return !value || PASSWORD_COMPLEXITY_REGEX.test(value)
      ? null
      : { passwordComplexity: true };
  };
}

export function matchingFieldsValidator(
  fieldName: string,
  confirmFieldName: string
): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const field = control.get(fieldName);
    const confirmField = control.get(confirmFieldName);

    if (!field || !confirmField) {
      return null;
    }

    const hasMismatch = !!field.value && !!confirmField.value && field.value !== confirmField.value;
    const currentErrors = confirmField.errors ?? {};

    if (hasMismatch) {
      confirmField.setErrors({ ...currentErrors, fieldsMismatch: true });
      return { fieldsMismatch: true };
    }

    if ('fieldsMismatch' in currentErrors) {
      const { fieldsMismatch: _, ...remainingErrors } = currentErrors;
      confirmField.setErrors(Object.keys(remainingErrors).length ? remainingErrors : null);
    }

    return null;
  };
}

export function birthDateValidator(minimumAge = 12): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = `${control.value ?? ''}`;

    if (!value) {
      return null;
    }

    const birthDate = new Date(`${value}T00:00:00`);

    if (Number.isNaN(birthDate.getTime())) {
      return { invalidBirthDate: true };
    }

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age -= 1;
    }

    return age >= minimumAge ? null : { minimumAge: true };
  };
}

export function optionalPhoneValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = `${control.value ?? ''}`.replace(/\D/g, '');

    if (!value) {
      return null;
    }

    return /^\d{10,11}$/.test(value) ? null : { invalidPhone: true };
  };
}

/** CPF brasileiro (11 digitos, com ou sem mascara). */
export function cpfValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const digits = `${control.value ?? ''}`.replace(/\D/g, '');
    if (!digits) {
      return null;
    }
    if (digits.length < 11) {
      return { cpfIncomplete: true };
    }
    return isValidCpfDigits(digits) ? null : { cpf: true };
  };
}

/** Peso, altura, etc. com ngx-mask e sufixo (ex. `85 kg`) — compara pelos digitos. */
export function metricRangeValidator(min: number, max: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const digits = `${control.value ?? ''}`.replace(/\D/g, '');

    if (!digits) {
      return null;
    }

    const n = parseInt(digits, 10);

    if (n < min) {
      return { min: { min, actual: n } };
    }

    if (n > max) {
      return { max: { max, actual: n } };
    }

    return null;
  };
}

function isValidCpfDigits(d: string): boolean {
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) {
    return false;
  }
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(d[i]!, 10) * (10 - i);
  }
  let rest = (sum * 10) % 11;
  if (rest === 10 || rest === 11) {
    rest = 0;
  }
  if (rest !== parseInt(d[9]!, 10)) {
    return false;
  }
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(d[i]!, 10) * (11 - i);
  }
  rest = (sum * 10) % 11;
  if (rest === 10 || rest === 11) {
    rest = 0;
  }
  return rest === parseInt(d[10]!, 10);
}
