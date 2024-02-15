import { Component, inject } from '@angular/core';
import { AbstractControl, Validators, FormBuilder, FormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import {UserCredential, createUserWithEmailAndPassword} from '@angular/fire/auth'
import { UserService } from '@core/services/user.service';
import { CustomValidator } from '@core/validators/custom.validators';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss']
})
export class RegisterComponent {
  public registerForm: FormGroup;
  public loading: boolean;
  private userService: UserService = inject(UserService);
  private authService: AuthService = inject(AuthService);
  private fb: FormBuilder = inject(FormBuilder);
  private router: Router = inject(Router);

  constructor() {
      this.registerForm = this.fb.group({
          name: ['', Validators.required],
          email: ['', [Validators.required, Validators.email]],
          password: ['', [Validators.required]],
          confirmPassword: ['', [Validators.required, CustomValidator.confirmPassword]],
      });
      this.loading = false;
  }

  submit() {
      this.loading = true;
      const { email, password, name } = this.registerForm.value;

      this.authService.register(email, password)
          .then((user: UserCredential) => {
            console.log(user)
              this.loading = false;
              this.userService.storeUser(name, user);
              this.router.navigate(['/']);
          })
          .catch((err: any) => {
              if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
                  console.log('Usuario o contraseña incorrectos.');
              } else {
                  console.log('Ocurrió un error');
              }
              this.loading = false;
          });
  }

  get email(): AbstractControl | null {
      return this.registerForm.get('email');
  }
  get password(): AbstractControl | null {
      return this.registerForm.get('password');
  }
  get confirmPassword(): AbstractControl | null {
      return this.registerForm.get('confirmPassword');
  }
  get name(): AbstractControl | null {
      return this.registerForm.get('name');
  }
}
