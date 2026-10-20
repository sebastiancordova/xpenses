import { Injectable, NgZone, inject } from '@angular/core';
import type { Auth, User } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';
import type { DocumentData, DocumentReference, Query } from 'firebase/firestore';
import { onSnapshot } from 'firebase/firestore';
import { Observable } from 'rxjs';

export function zoneListener<T>(
  zone: NgZone,
  listen: (next: (value: T) => void, error: (error: unknown) => void) => () => void
): Observable<T> {
  return new Observable<T>(subscriber => {
    let teardown: (() => void) | undefined;
    zone.runOutsideAngular(() => {
      teardown = listen(
        value => zone.run(() => subscriber.next(value)),
        error => zone.run(() => subscriber.error(error))
      );
    });
    return () => teardown?.();
  });
}

export function documentValue<T extends DocumentData>(
  exists: boolean,
  data: T | undefined,
  documentId: string,
  idField?: string
): T | undefined {
  if (!exists || data === undefined) return undefined;
  return idField ? { ...data, [idField]: documentId } as T : data;
}

/** RxJS wrappers for Firebase listeners, with Angular change detection and teardown. */
@Injectable({ providedIn: 'root' })
export class FirebaseStreamsService {
  private readonly zone = inject(NgZone);

  authState(auth: Auth): Observable<User | null> {
    return zoneListener(this.zone, (next, error) => onAuthStateChanged(auth, next, error));
  }

  docData<T extends DocumentData>(
    reference: DocumentReference<T>,
    options?: { idField?: string }
  ): Observable<T | undefined> {
    return zoneListener(this.zone, (next, error) => onSnapshot(
      reference,
      snapshot => next(documentValue(snapshot.exists(), snapshot.data(), snapshot.id, options?.idField)),
      error
    ));
  }

  collectionData<T extends DocumentData>(
    reference: Query<T>,
    options?: { idField?: string }
  ): Observable<T[]> {
    return zoneListener(this.zone, (next, error) => onSnapshot(
      reference,
      snapshot => next(snapshot.docs.map(document => documentValue(
        true,
        document.data(),
        document.id,
        options?.idField
      ) as T)),
      error
    ));
  }
}
