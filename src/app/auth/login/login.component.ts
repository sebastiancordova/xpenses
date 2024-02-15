import { Component, inject } from '@angular/core';
import { AbstractControl, Validators, FormBuilder, FormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  public loginForm: FormGroup;
  public loading: boolean;
  private toastr: ToastrService = inject(ToastrService);
  private authService: AuthService = inject(AuthService);
  private fb: FormBuilder = inject(FormBuilder);
  private router: Router = inject(Router);

  constructor() {
      this.loginForm = this.fb.group({
          email: ['', [Validators.required]],
          password: ['', [Validators.required]],
      });
      this.loading = false;
  }

  submit() {
      this.loading = true;
      const { email, password } = this.loginForm.value;
      this.authService.login(email, password)
          .then(x => {
              this.loading = false;
              this.router.navigate(['/']);
          })
          .catch(err => {
            if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
                this.toastr.error('Usuario o contraseña incorrectos.');
            } else {
                this.toastr.error('Ocurrió un error');
            }
            this.loading = false;
        });
  }

  get email(): AbstractControl | null {
      return this.loginForm.get('email');
  }
  get password(): AbstractControl | null {
      return this.loginForm.get('password');
  }
}
