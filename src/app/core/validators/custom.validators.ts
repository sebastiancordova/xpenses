import { AbstractControl, ValidationErrors } from '@angular/forms';

export class CustomValidator {
    static confirmPassword(control: AbstractControl): ValidationErrors | null {
        if (!control.parent || !control) {
            return null;
        }

        const password = control.parent.get('password');
        const confirmPassword = control.parent.get('confirmPassword');

        if (!password || !confirmPassword) {
            return null;
        }

        if (confirmPassword.value === '') {
            return null;
        }

        if (password.value !== confirmPassword.value) {
            return {
                passwordsNotMatch: true,
            };
        }
        return null
    }
}
