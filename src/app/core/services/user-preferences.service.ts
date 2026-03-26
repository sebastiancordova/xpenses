import { Injectable, inject } from '@angular/core';
import { Firestore, doc, docData, setDoc } from '@angular/fire/firestore';
import { Observable, of, switchMap, map } from 'rxjs';
import { DEFAULT_PREFERENCES, UserPreferences } from '@core/models/user-preferences';
import { UserService } from './user.service';

@Injectable({
  providedIn: 'root'
})
export class UserPreferencesService {
  private firestore = inject(Firestore);
  private userService = inject(UserService);

  getPreferences(): Observable<UserPreferences> {
    return this.userService.currentUser.pipe(
      switchMap(user => {
        if (!user?.uid) return of(DEFAULT_PREFERENCES);
        const docRef = doc(this.firestore, `users/${user.uid}/settings/preferences`);
        return (docData(docRef) as Observable<Partial<UserPreferences> | undefined>).pipe(
          map(data => data ? { ...DEFAULT_PREFERENCES, ...data } : { ...DEFAULT_PREFERENCES })
        );
      })
    );
  }

  savePreferences(prefs: UserPreferences): Promise<void> {
    const uid = this.userService.currentUserValue.uid;
    const docRef = doc(this.firestore, `users/${uid}/settings/preferences`);
    return setDoc(docRef, prefs);
  }
}
