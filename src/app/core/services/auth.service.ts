import { Auth } from '@core/firebase/firebase.tokens';
import { FirebaseStreamsService } from '@core/firebase/firebase-streams.service';
import { User, UserCredential, createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth';
import { Injectable, inject } from '@angular/core';

import { environment } from '@environment/environment';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly firebaseStreams = inject(FirebaseStreamsService);
  private afAuth = inject(Auth)

  constructor() { }

  isAuthenticated(): Observable<User | null> {
    return this.firebaseStreams.authState(this.afAuth);
  }

  login(email: string, password: string) {
    return signInWithEmailAndPassword(this.afAuth, email, password);
  }

  resetPassword(email: string) {
    const actionCodeSettings = {
      url: environment.appUrl + 'login',
      handleCodeInApp: false,
    };
    return sendPasswordResetEmail(
      this.afAuth,
      email,
      actionCodeSettings
    );
  }

  register(email:string, password: string): Promise<UserCredential> {
    return new Promise(async (resolve, reject) => {
      try {
        const userCrdentials = await createUserWithEmailAndPassword(this.afAuth, email, password);
        await sendEmailVerification(userCrdentials.user, {url: environment.appUrl});
        resolve(userCrdentials);
      } catch (error) {
        reject(error)
      }
    })
  }

  logout() {
    localStorage.clear();
    return this.afAuth.signOut();
  }
}
