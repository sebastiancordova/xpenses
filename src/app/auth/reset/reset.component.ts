import { Component, inject } from '@angular/core';
import { AbstractControl, Validators, FormBuilder, FormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-reset',
  templateUrl: './reset.component.html',
  styleUrls: ['./reset.component.scss']
})
export class ResetComponent {
  public resetForm: FormGroup;
  public loading: boolean;
  private toastr: ToastrService = inject(ToastrService)
  private authService: AuthService = inject(AuthService);
  private fb: FormBuilder = inject(FormBuilder);
  private router: Router = inject(Router);

  constructor() {
      this.resetForm = this.fb.group({
          email: ['', [Validators.required, Validators.email]]
      });
      this.loading = false;
  }

  submit() {
      this.loading = true;
      const { email } = this.resetForm.value;
      this.authService.resetPassword(email)
          .then(x => {
              this.toastr.success(`Se ha enviado un email a ${email} con indicaciones para restaurar tu contraseña`, '', {tapToDismiss: true, disableTimeOut: true});
              this.router.navigate(['/']);
          })
          .catch(() => this.toastr.error('Ocurrió un error'))
          .finally(() => this.loading = false);
  }

  get email(): AbstractControl | null {
      return this.resetForm.get('email');
  }
}
