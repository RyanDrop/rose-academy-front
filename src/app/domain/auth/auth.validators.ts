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
