import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  updateProfile as updateFirebaseProfile,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';
import { DataProvider, AuthService } from './interfaces';
import { LocalStorageAdapter } from './localStorageAdapter';
import { DEFAULT_ACCENT_COLOR } from '../domain/color';

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
 * FirebaseAdapter (Integração real com Firebase Auth e LocalStorage para dados)
 */
export class FirebaseAdapter extends LocalStorageAdapter implements DataProvider {
  public override readonly mode = 'firebase' as any;

  // Propriedade para guardar a referência ao serviço de auth local
  private localAuth: AuthService;

  constructor() {
    super();
    // 1. Guardamos o auth original (do LocalStorageAdapter) nesta variável interna
    this.localAuth = this.auth;

    // 2. Sobrescrevemos o auth público da classe com a versão integrada do Firebase
    this.auth = {
      getCurrentUser: async () => {
        // Aguarda a verificação da sessão local do Firebase antes de avançar
        await auth.authStateReady(); 
        
        const fbUser = auth.currentUser;
        if (!fbUser) return null;
        
        const localAccounts = await this.localAuth.listLocalAccounts();
        let user = localAccounts.find(u => u.email.toLowerCase() === (fbUser.email || '').toLowerCase());
        
        if (!user) {
          user = {
            id: fbUser.uid,
            name: fbUser.displayName || 'Usuário Firebase',
            email: fbUser.email || '',
            createdAt: new Date().toISOString(),
            preferences: {
              accentColor: DEFAULT_ACCENT_COLOR,
              themeMode: 'system',
              rolloverMode: 'ask',
              rolloverHandledDate: null,
              projectsViewMode: 'week',
              sidebarCollapsed: false,
              personalSpaceName: 'Pessoal',
              personalSpaceIcon: '👤',
            },
          };
        }
        return user;
      },

      listLocalAccounts: async () => {
        return this.localAuth.listLocalAccounts();
      },

      register: async (input) => {
        const cred = await createUserWithEmailAndPassword(auth, input.email, input.password);
        if (input.name && cred.user) {
          await updateFirebaseProfile(cred.user, { displayName: input.name });
        }
        return this.localAuth.register(input);
      },

      login: async (input) => {
        // Define a persistência de sessão dependendo da checkbox "Manter-me conectado"
        const persistenceType = input.rememberMe ? browserLocalPersistence : browserSessionPersistence;
        await setPersistence(auth, persistenceType);

        // 1. Valida diretamente no Firebase Authentication
        const cred = await signInWithEmailAndPassword(auth, input.email, input.password);
        const fbUser = cred.user;
        
        const accounts = await this.localAuth.listLocalAccounts();
        let matched = accounts.find(u => u.email.toLowerCase() === input.email.toLowerCase());
        
        // 2. Se a conta local não existir, cria-a apenas no adaptador local sem invocar o Firebase novamente
        if (!matched) {
          matched = await this.localAuth.register({
            name: fbUser.displayName || input.email.split('@')[0],
            email: input.email,
            password: input.password,
          });
        } else {
          await this.localAuth.switchAccount(matched.id);
        }
        return matched;
      },

      switchAccount: async (userId: string) => {
        return this.localAuth.switchAccount(userId);
      },

      logout: async () => {
        await signOut(auth);
        await this.localAuth.logout();
      },

      updateProfile: async (userId: string, updates) => {
        const updated = await this.localAuth.updateProfile(userId, updates);
        if (auth.currentUser && updates.name) {
          await updateFirebaseProfile(auth.currentUser, { displayName: updates.name });
        }
        return updated;
      },
    };
  }
}

export const dataProvider: DataProvider = new FirebaseAdapter();