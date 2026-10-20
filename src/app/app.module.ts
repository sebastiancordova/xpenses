import { NgModule, isDevMode } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { ServiceWorkerModule } from '@angular/service-worker';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { enableIndexedDbPersistence, getFirestore } from 'firebase/firestore';
import { environment } from '@environment/environment';
import { Auth, Firestore } from '@core/firebase/firebase.tokens';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { CoreModule } from '@core/core.module';

const getFirebaseApp = () => {
  const defaultApp = getApps().find(app => app.name === '[DEFAULT]');
  return defaultApp ?? initializeApp(environment.firebaseConfig);
};

const createFirestore = () => {
  const firestore = getFirestore(getFirebaseApp());
  enableIndexedDbPersistence(firestore).catch((error: { code?: string }) => {
    if (error.code === 'failed-precondition') {
      console.warn('[Xpenses] Firestore offline persistence unavailable: multiple tabs open.');
    } else if (error.code === 'unimplemented') {
      console.warn('[Xpenses] Firestore offline persistence not supported in this browser.');
    }
  });
  return firestore;
};

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    CoreModule,
    ServiceWorkerModule.register('ngsw-worker.js', {
      enabled: !isDevMode(),
      // Register the ServiceWorker as soon as the application is stable
      // or after 30 seconds (whichever comes first).
      registrationStrategy: 'registerWhenStable:30000'
    })
  ],
  providers: [
    { provide: Auth, useFactory: () => getAuth(getFirebaseApp()) },
    { provide: Firestore, useFactory: createFirestore }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
