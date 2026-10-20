import { Auth, Firestore } from '@core/firebase/firebase.tokens';
import { FirebaseStreamsService } from '@core/firebase/firebase-streams.service';
import { UserCredential } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { Injectable, inject } from '@angular/core';

import { BehaviorSubject, Subscription, catchError, of, switchMap } from 'rxjs';
import { IUser } from '../models/user';


@Injectable({
  providedIn: 'root',
})
export class UserService {
  private readonly firebaseStreams = inject(FirebaseStreamsService);
  private loggedUser = new BehaviorSubject<IUser>({ email: '', image: '', name: '', username: '' });
  private firestore: Firestore = inject(Firestore);
  private afAuth = inject(Auth)
  constructor() {
  }

  set user(user: IUser) {
    this.loggedUser.next(user);
    localStorage.setItem('currentUser', JSON.stringify(user));
  }

  get currentUser() {
    const currentUser = localStorage.getItem('currentUser');
    if (currentUser) {
      this.loggedUser.next(JSON.parse(currentUser));
    }
    return this.loggedUser.asObservable();
  }

  get currentUserValue() {
    return this.loggedUser.value;
  }

  currentUser$(): Subscription {
    return this.firebaseStreams.authState(this.afAuth).pipe(
      switchMap(user => user?.uid
        ? this.firebaseStreams.docData(doc(this.firestore, `users/${user.uid}`), { idField: 'id' }).pipe(
          catchError(() => of(undefined))
        )
        : of(undefined))
    ).subscribe(data => {
      if (data) {
        this.user = data as IUser;
      } else {
        this.loggedUser.next({ email: '', image: '', name: '', username: '' });
        localStorage.removeItem('currentUser');
      }
    });
  }

  storeUser(name: string, userCredential: UserCredential, nombre?: string) {
    if (!userCredential) return;

    const userEmail = userCredential.user.email || '';
    const userName = userEmail.slice(0, userEmail.lastIndexOf('@'));
    const docRef = doc(this.firestore, `users/${userCredential.user?.uid}`);
    const data: IUser = {
      image: '',
      name,
      username: userName,
      email: userEmail,
      uid: userCredential.user.uid,
      createdAt: new Date(),
    };

    return setDoc(docRef, <IUser>data);
  }
}
