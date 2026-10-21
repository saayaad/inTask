import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';
import { DataProvider } from './interfaces';
import { LocalStorageAdapter } from './localStorageAdapter';

const firebaseConfig = {
  apiKey: "AIzaSyCi_Qcq7WXEbBAIBqkaaQFMU59QoaKyaK4",
  authDomain: "in-task-e2ad4.firebaseapp.com",
  projectId: "in-task-e2ad4",
  storageBucket: "in-task-e2ad4.firebasestorage.app",
  messagingSenderId: "874269399102",
  appId: "1:874269399102:web:f2a03277d47c3191f1196f",
  measurementId: "G-GB4ZKLC1QZ"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const analytics = getAnalytics(app);

/**
 * FirebaseAdapter (Structural Adapter for Phase 2 Cloud Migration)
 *
 * Atualmente herda de LocalStorageAdapter garantindo que `dataProvider` exista e funcione.
 */
export class FirebaseAdapter extends LocalStorageAdapter implements DataProvider {
  public override readonly mode = 'firebase' as any;
}

// EXPORTAÇÃO OBRIGATÓRIA QUE ESTAVA FALTANDO E CAUSANDO O ERRO NO STORE.TS
export const dataProvider: DataProvider = new LocalStorageAdapter();