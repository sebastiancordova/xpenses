import { InjectionToken } from '@angular/core';
import type { Auth as FirebaseAuth } from 'firebase/auth';
import type { Firestore as FirebaseFirestore } from 'firebase/firestore';

/** Firebase SDK service types and their Angular DI tokens. */
export type Auth = FirebaseAuth;
export const Auth = new InjectionToken<Auth>('Firebase Auth');

export type Firestore = FirebaseFirestore;
export const Firestore = new InjectionToken<Firestore>('Firebase Firestore');
