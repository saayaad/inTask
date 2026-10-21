# In Task — Foco Diário, Planejamento, Equipes e Metas

Aplicativo web mobile-first e desktop completo de produtividade pessoal e em equipe, com interface 100% em português do Brasil (`pt-BR`) e código estruturado em inglês.

---

## 1. Como rodar e testar

```bash
# Instalar dependências
npm install

# Rodar servidor de desenvolvimento (porta 3000)
npm run dev

# Executar testes unitários das regras de domínio (Vitest)
npx vitest run

# Checar tipagem TypeScript
npm run lint

# Build de produção
npm run build
```

---

## 2. Arquitetura em camadas (`src/`)

- **`src/domain/`**: Regras de negócio puras e independentes de framework:
  - `color.ts`: Cálculo de luminância relativa (WCAG 2.1), razão de contraste AA ($\ge 4.5:1$), geração de `--on-accent`, `--accent-hover`, `--accent-soft` e ajuste dinâmico de `--accent-text` (escurece no modo claro, clareia no modo escuro).
  - `clock.ts`: Relógio injetável (`now()`, `todayStr()`, `advanceSimulatedDay()`) e manipulação segura de datas locais no formato `"YYYY-MM-DD"` sem bugs de fuso horário UTC.
  - `rollover.ts`: Identificação de pendências de dias anteriores (`todo` ou `doing`, excluindo `awaiting_approval` e rotinas) e migração para hoje preservando `originalDueDate` e histórico.
  - `recurrence.ts`: Cálculo de ocorrências diárias, dias úteis (seg–sex), semanais e mensais (com ajuste automático para o último dia em meses curtos, ex.: 31/jan → 28/fev).
  - `permissions.ts`: Módulo único `can(user, action, resource, memberships)` e `taskRequiresApproval(task, memberships)`, compartilhado entre a UI e os repositórios de dados.
  - `progress.ts`: Progresso diário do `/hoje` (onde `awaiting_approval` conta como concluída para o responsável) e progresso reativo de `/metas` (onde tarefas que exigem aprovação só contam após aprovadas pelo Admin).
  - `sanitize.ts`: Sanitização de strings e parser seguro de links clicáveis (`http`/`https`) sem uso de `dangerouslySetInnerHTML`.
- **`src/data/`**: Camada de persistência assíncrona desacoplada da UI:
  - `interfaces.ts`: Contratos `AuthService`, `TaskRepository`, `InboxRepository`, `TagRepository`, `OrgRepository`, `GoalRepository`, `BackupService` e `DataProvider`.
  - `crypto.ts`: Hash de senhas com salt aleatório via Web Crypto API (`SHA-256`) e gerador de códigos de convite de 8 caracteres sem caracteres ambíguos (`0/O`, `1/I/L`).
  - `storageEngine.ts`: Persistência com `schemaVersion`, migrações, escrita com debounce (120ms), tratamento amigável de cota cheia (`QuotaExceededError`) e JSON corrompido, além de sincronização entre abas via evento `storage`.
  - `localStorageAdapter.ts`: Implementação completa da v1 local com suporte a múltiplas contas no mesmo navegador ("Trocar de conta").
  - `firebaseAdapter.ts`: Ponto único de troca para conectar Firebase Auth + Cloud Firestore sem alterar nenhum componente React.
- **`src/theme/`**: Motor de tema dinâmico (`ThemeProvider.tsx`) ligado a variáveis CSS em `:root`, sincronizado com snapshot leve lido por script inline no `index.html` para evitar flash de tema incorreto no carregamento.
- **`src/app/`**: Estado global em Zustand (`store.ts`) que espelha os repositórios assíncronos (sem middleware `persist` acoplado ao `localStorage`).
- **`src/components/` e `src/features/`**: Shell responsivo (Bottom Nav + FAB no mobile, Sidebar recolhida no tablet, Sidebar retrátil + Side Drawer no desktop) e telas de cada domínio.

---

## 3. Decisões e Suposições Registradas

1. **Primeiro acesso com dados de demonstração prontos**: Ao abrir o app pela primeira vez sem nenhuma conta no navegador, o `LocalStorageAdapter` inicializa automaticamente duas contas locais demonstrativas (**Marina Costa — Admin** e **Lucas Mendes — Membro Convidado**) para permitir testar imediatamente todos os 7 critérios de aceite (inclusive troca de conta no cabeçalho, delegação, envio para aprovação e virada de dia). O usuário também pode sair (`/auth`), criar novas contas ou limpar os dados em `/configuracoes`.
2. **Uma tag principal por seletor rápido, suporte a múltiplas no modelo**: O modelo `Task.tagIds` suporta array de IDs; nos seletores rápidos priorizamos a escolha direta de 1 tag de projeto/espaço para manter a fluidez mobile-first.
3. **Kanban "Concluído" últimos 7 dias**: Conforme especificado, a coluna "Concluído" do Kanban filtra tarefas concluídas nos últimos 7 dias em relação ao relógio atual (`currentTodayStr`).

---

## 4. Plano de Migração para Firebase (Auth + Cloud Firestore)

Para migrar do `LocalStorageAdapter` para o `FirebaseAdapter`:

### Coleções do Firestore
- `/users/{userId}`: `{ name, email, createdAt, preferences }` (senhas passam a ser gerenciadas exclusivamente pelo Firebase Authentication, incluindo login social com Google).
- `/organizations/{orgId}`: `{ name, createdBy, createdAt }`
- `/memberships/{orgId_userId}`: `{ orgId, userId, role, joinedAt }`
- `/invites/{inviteId}`: `{ orgId, code, email, status, createdBy, createdAt }`
- `/tags/{tagId}`: `{ spaceId, name, color }`
- `/tasks/{taskId}`: `{ title, status, priority, spaceId, createdBy, assigneeId, tagIds, dueDate, originalDueDate, notes, subtasks, recurrence, completions, goalId, approval, history, createdAt, updatedAt }`
- `/inboxItems/{itemId}`: `{ ownerId, text, createdAt }`
- `/goals/{goalId}`: `{ title, spaceId, createdBy, period, deadline, createdAt }`

### Esboço das Regras de Segurança (`firestore.rules`)
Espelhando diretamente o módulo `can(user, action, resource)` de `src/domain/permissions.ts`:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isSignedIn() {
      return request.auth != null;
    }

    function getMembership(orgId) {
      return get(/databases/$(database)/documents/memberships/$(orgId + '_' + request.auth.uid)).data;
    }

    function isOrgMember(orgId) {
      return isSignedIn() && exists(/databases/$(database)/documents/memberships/$(orgId + '_' + request.auth.uid));
    }

    function isOrgAdmin(orgId) {
      return isOrgMember(orgId) && getMembership(orgId).role == 'admin';
    }

    function canAccessSpace(spaceId) {
      return isSignedIn() && (
        spaceId == ('personal:' + request.auth.uid) ||
        isOrgMember(spaceId)
      );
    }

    match /users/{userId} {
      allow read: if isSignedIn();
      allow write: if isSignedIn() && request.auth.uid == userId;
    }

    match /inboxItems/{itemId} {
      allow read, write: if isSignedIn() && resource.data.ownerId == request.auth.uid;
      allow create: if isSignedIn() && request.resource.data.ownerId == request.auth.uid;
    }

    match /tasks/{taskId} {
      allow read: if canAccessSpace(resource.data.spaceId);
      allow create: if canAccessSpace(request.resource.data.spaceId);
      allow update: if canAccessSpace(resource.data.spaceId) && (
        resource.data.spaceId == ('personal:' + request.auth.uid) ||
        isOrgAdmin(resource.data.spaceId) ||
        (resource.data.assigneeId == request.auth.uid && request.resource.data.status != 'done')
      );
      allow delete: if resource.data.spaceId == ('personal:' + request.auth.uid) ||
        isOrgAdmin(resource.data.spaceId) ||
        resource.data.createdBy == request.auth.uid;
    }

    match /goals/{goalId} {
      allow read: if canAccessSpace(resource.data.spaceId);
      allow write: if resource.data.spaceId == ('personal:' + request.auth.uid) ||
        isOrgAdmin(resource.data.spaceId);
    }
  }
}
```
