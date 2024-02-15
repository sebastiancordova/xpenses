import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  docData,
  doc,
  setDoc
} from '@angular/fire/firestore';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { IUser } from '../models/user';
import { UserCredential, Auth } from '@angular/fire/auth';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private loggedUser = new BehaviorSubject<IUser>({ email: '', image: '', name: '', username: '' });
  private firestore: Firestore = inject(Firestore);
  private afAuth = inject(Auth)
  constructor() {
  }

  set user(user: IUser) {
    this.loggedUser.next(user);
  }

  get currentUser() {
    return this.loggedUser.asObservable();
  }

  get currentUserValue() {
    return this.loggedUser.value;
  }

  currentUser$() {
    this.afAuth.onAuthStateChanged(async user => {
      const docRef = doc(this.firestore, `users/${user?.uid}`);
      const data = await firstValueFrom(docData(docRef, { idField: 'id' }));
      this.user = data as IUser;
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
