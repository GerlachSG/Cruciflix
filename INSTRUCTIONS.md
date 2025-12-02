# INSTRUCTIONS.md - Documentação Técnica do Cruciflix

Documentação técnica completa para desenvolvedores que desejam configurar, modificar ou contribuir com a plataforma Cruciflix.

## 📋 Índice

1. [Visão Geral do Projeto](#visão-geral-do-projeto)
2. [Estrutura do Projeto](#estrutura-do-projeto)
3. [Tecnologias Utilizadas](#tecnologias-utilizadas)
4. [Configuração do Firebase](#configuração-do-firebase)
5. [Estrutura do Firestore](#estrutura-do-firestore)
6. [Conversão de Vídeos para HLS](#conversão-de-vídeos-para-hls)
7. [Deploy no GitHub Pages](#deploy-no-github-pages)
8. [Referência da API JavaScript](#referência-da-api-javascript)
9. [Troubleshooting](#troubleshooting)

---

## 🎯 Visão Geral do Projeto

O Cruciflix é uma plataforma de streaming católica construída com:
- **Frontend**: HTML5, CSS3, JavaScript Vanilla (sem frameworks)
- **Backend**: Firebase (Authentication, Firestore, Storage)
- **Streaming**: HLS (HTTP Live Streaming) via HLS.js
- **Hospedagem**: GitHub Pages (conteúdo estático)

## 📁 Estrutura do Projeto

```
SENAIFLIX/
│
├── pages/                    # Páginas HTML
│   ├── index.html           # Autenticação (login/registro)
│   ├── dashboard.html       # Catálogo principal
│   ├── player.html          # Player de vídeo
│   ├── admin.html           # Painel administrativo
│   ├── kids.html            # Área infantil
│   └── profile.html         # Perfil do usuário
│
├── scripts/                  # Módulos JavaScript
│   ├── firebase-config.js   # Configuração Firebase
│   ├── auth.js              # Autenticação
│   ├── firestore.js         # Operações Firestore
│   ├── player.js            # Player HLS
│   ├── admin.js             # Funções admin
│   └── ui.js                # Utilitários UI
│
├── styles/                   # Estilos CSS
│   ├── main.css             # Estilos principais
│   ├── player.css           # Estilos do player
│   ├── admin.css            # Estilos admin
│   └── responsive.css       # Design responsivo
│
├── README.md                 # Guia do usuário
└── INSTRUCTIONS.md          # Documentação técnica (este arquivo)
```

## 🛠️ Tecnologias Utilizadas

### Frontend
- **HTML5**: Estrutura semântica
- **CSS3**: Estilização com custom properties (variáveis CSS)
- **JavaScript ES6+**: Lógica da aplicação (async/await, modules)

### Libraries
- **Firebase SDK 10.7.1**: Backend as a Service
  - Firebase Auth: Autenticação de usuários
  - Cloud Firestore: Banco de dados NoSQL
  - Firebase Storage: Armazenamento de arquivos
- **HLS.js 1.4.12**: Reprodução de streaming HLS

### Fontes
- **Google Fonts**:
  - Inter: Fonte principal
  - Outfit: Títulos e headings

## ⚙️ Configuração do Firebase

### Passo 1: Criar Projeto Firebase

1. Acesse [Firebase Console](https://console.firebase.google.com)
2. Clique em **"Adicionar projeto"**
3. Nome do projeto: `cruciflix` (ou nome de sua escolha)
4. Desabilite Google Analytics (opcional)
5. Clique em **"Criar projeto"**

### Passo 2: Registrar App Web

1. No painel do projeto, clique no ícone **Web** (`</>`)
2. Apelido do app: `cruciflix-web`
3. **NÃO** marque "Firebase Hosting" (usaremos GitHub Pages)
4. Clique em **"Registrar app"**
5. **COPIE** as credenciais de configuração fornecidas

### Passo 3: Configurar Firebase Authentication

1. No menu lateral, vá para **"Authentication"**
2. Clique em **"Começar"**
3. Clique na aba **"Sign-in method"**
4. Habilite o provedor **"Email/Password"**:
   - Clique em "Email/Password"
   - Ative o toggle
   - Clique em "Salvar"

### Passo 4: Configurar Cloud Firestore

1. No menu lateral, vá para **"Firestore Database"**
2. Clique em **"Criar banco de dados"**
3. Escolha **"Produção"** ou **"Teste"** (recomendado: Produção)
4. Escolha a localização (recomendado: `southamerica-east1` para Brasil)
5. Clique em **"Ativar"**

#### Regras de Segurança do Firestore

Vá para a aba **"Regras"** e substitua o conteúdo por:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Videos - leitura pública, escrita apenas admin
    match /videos/{videoId} {
      allow read: if true;
      allow write: if request.auth != null && 
                     get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    // Users - leitura e escrita apenas próprio usuário ou admin
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == userId || 
                     get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    // Progress - apenas próprio usuário
    match /progress/{progressId} {
      allow read, write: if request.auth != null && 
                           progressId.matches('^' + request.auth.uid + '_.*');
    }
    
    // Comments - usuários autenticados podem criar, admin pode moderar
    match /comments/{commentId} {
      allow read: if true;
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null && 
                              get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
  }
}
```

Clique em **"Publicar"**.

### Passo 5: Configurar Firebase Storage

1. No menu lateral, vá para **"Storage"**
2. Clique em **"Começar"**
3. Escolha **"Produção"** (as regras serão configuradas depois)
4. Escolha a mesma localização do Firestore
5. Clique em **"Concluir"**

#### Regras de Segurança do Storage

Vá para a aba **"Rules"** e substitua por:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /videos/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null && 
                     firestore.get(/databases/(default)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
  }
}
```

Clique em **"Publicar"**.

### Passo 6: Inserir Credenciais no Código

1. Abra o arquivo `scripts/firebase-config.js`
2. Localize o objeto `firebaseConfig`
3. **SUBSTITUA** os valores de placeholder pelas suas credenciais:

```javascript
const firebaseConfig = {
  apiKey: "SUA_API_KEY_AQUI",
  authDomain: "SEU_PROJECT_ID.firebaseapp.com",
  projectId: "SEU_PROJECT_ID",
  storageBucket: "SEU_PROJECT_ID.appspot.com",
  messagingSenderId: "SEU_MESSAGING_SENDER_ID",
  appId: "SEU_APP_ID"
};
```

4. Salve o arquivo

### Passo 7: Criar Primeiro Usuário Admin

1. Abra o projeto no navegador
2. Registre uma conta normalmente
3. No Firebase Console, vá para **"Firestore Database"**
4. Encontre a coleção `users` e seu documento de usuário
5. Edite o campo `role` de `"user"` para `"admin"`
6. Salve
7. Faça logout e login novamente para acessar o painel admin

## 📊 Estrutura do Firestore

### Coleção: `videos`

```javascript
{
  id: "auto-generated-id",              // String
  title: "Nome do Vídeo",               // String
  description: "Descrição completa",    // String
  tags: ["Filme", "Santo", "Medieval"], // Array<String>
  hlsUrl: "https://storage.../video.m3u8", // String (URL do Storage)
  thumbnailUrl: "https://...",          // String (URL da thumbnail)
  duration: 3600,                       // Number (segundos)
  uploadedBy: "user-uid",               // String (UID do admin)
  uploadedAt: Timestamp,                // Timestamp
  viewCount: 125,                       // Number
  isKidsSafe: true                      // Boolean
}
```

### Coleção: `users`

```javascript
{
  uid: "firebase-auth-uid",             // String (mesmo do Auth)
  email: "usuario@email.com",           // String
  displayName: "Nome do Usuário",       // String
  role: "user",                         // String ("user" | "admin")
  createdAt: Timestamp,                 // Timestamp
  preferences: {
    kidsPin: ""                         // String (futuro: PIN parental)
  }
}
```

### Coleção: `progress`

```javascript
{
  id: "userId_videoId",                 // String (compound key)
  userId: "user-uid",                   // String
  videoId: "video-id",                  // String
  watchTime: 1245,                      // Number (segundos)
  completed: false,                     // Boolean
  lastWatched: Timestamp                // Timestamp
}
```

### Coleção: `comments`

```javascript
{
  id: "auto-generated-id",              // String
  videoId: "video-id",                  // String
  userId: "user-uid",                   // String
  userName: "Nome do Usuário",          // String
  content: "Texto do comentário",       // String
  createdAt: Timestamp,                 // Timestamp
  approved: false                       // Boolean (requer moderação)
}
```

## 🎬 Conversão de Vídeos para HLS

### Por que HLS?

HLS (HTTP Live Streaming) permite:
- Streaming adaptativo de qualidade
- Compatibilidade cross-platform
- Melhor performance que MP4 progressivo
- Suporte a múltiplas resoluções

### Pré-requisitos

Instale o **FFmpeg**:

**Windows**: Baixe de [ffmpeg.org](https://ffmpeg.org/download.html)

**macOS**: 
```bash
brew install ffmpeg
```

**Linux (Ubuntu/Debian)**:
```bash
sudo apt update
sudo apt install ffmpeg
```

### Processo de Conversão

#### Passo 1: Converter vídeo para HLS

```bash
ffmpeg -i input.mp4 \
  -codec: copy \
  -start_number 0 \
  -hls_time 10 \
  -hls_list_size 0 \
  -f hls output.m3u8
```

**Explicação dos parâmetros**:
- `-i input.mp4`: Arquivo de entrada
- `-codec: copy`: Copia codec sem re-encodar (rápido)
- `-start_number 0`: Começa numeração dos segments em 0
- `-hls_time 10`: Cada segment tem 10 segundos
- `-hls_list_size 0`: Inclui todos os segments no manifest
- `-f hls`: Formato de saída HLS
- `output.m3u8`: Arquivo manifest de saída

#### Passo 2: (Opcional) Múltiplas Resoluções

Para streaming adaptativo com várias qualidades:

```bash
# 720p
ffmpeg -i input.mp4 -vf scale=1280:720 -c:v libx264 -b:v 3000k \
  -c:a aac -b:a 128k -hls_time 10 -hls_list_size 0 -f hls 720p.m3u8

# 480p
ffmpeg -i input.mp4 -vf scale=854:480 -c:v libx264 -b:v 1500k \
  -c:a aac -b:a 128k -hls_time 10 -hls_list_size 0 -f hls 480p.m3u8

# 360p
ffmpeg -i input.mp4 -vf scale=640:360 -c:v libx264 -b:v 800k \
  -c:a aac -b:a 96k -hls_time 10 -hls_list_size 0 -f hls 360p.m3u8
```

Depois crie um master playlist `master.m3u8`:

```
#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=3200000,RESOLUTION=1280x720
720p.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=1600000,RESOLUTION=854x480
480p.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=900000,RESOLUTION=640x360
360p.m3u8
```

#### Passo 3: Upload para Firebase Storage

1. No Firebase Console, vá para **Storage**
2. Crie uma pasta: `videos/{video-id}/`
3. Faça upload de:
   - `output.m3u8` (ou `master.m3u8`)
   - Todos os arquivos `.ts` gerados
4. Copie a URL pública do arquivo `.m3u8`
5. Use essa URL no formulário de admin ao adicionar o vídeo

**Via CLI Firebase** (opcional):

```bash
# Instalar Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Upload
firebase storage:upload output.m3u8 videos/video-001/output.m3u8
firebase storage:upload *.ts videos/video-001/
```

### Exemplo Completo

```bash
# 1. Converter vídeo
ffmpeg -i meu_video.mp4 -codec: copy -start_number 0 \
  -hls_time 10 -hls_list_size 0 -f hls output.m3u8

# 2. Arquivos gerados:
# - output.m3u8 (manifest)
# - output0.ts, output1.ts, output2.ts, ... (segments)

# 3. Fazer upload manual no Firebase Storage Console
# ou via CLI:
firebase storage:upload output.m3u8 videos/santo-agostinho/output.m3u8
firebase storage:upload output*.ts videos/santo-agostinho/

# 4. Obter URL pública (exemplo):
# https://firebasestorage.googleapis.com/.../videos/santo-agostinho/output.m3u8

# 5. Usar essa URL no painel admin para adicionar o vídeo
```

## 🚀 Deploy no GitHub Pages

### Passo 1: Preparar Repositório

```bash
# Inicializar git (se ainda não foi feito)
cd SENAIFLIX
git init

# Adicionar todos os arquivos
git add .

# Commit inicial
git commit -m "Initial commit - Cruciflix platform"
```

### Passo 2: Criar Repositório no GitHub

1. Acesse [github.com](https://github.com)
2. Clique em **"New repository"**
3. Nome: `cruciflix` (ou nome de sua escolha)
4. Deixe **público** ou **privado**
5. **NÃO** inicialize com README (já temos um)
6. Clique em **"Create repository"**

### Passo 3: Conectar e Push

```bash
# Adicionar remote
git remote add origin https://github.com/SEU_USUARIO/cruciflix.git

# Push para main
git branch -M main
git push -u origin main
```

### Passo 4: Habilitar GitHub Pages

1. No repositório GitHub, vá para **Settings**
2. Na barra lateral, clique em **Pages**
3. Em **"Source"**, selecione:
   - Branch: `main`
   - Folder: `/pages` (se a opção estiver disponível) ou `/ (root)`
4. Clique em **"Save"**
5. Aguarde alguns minutos
6. A URL será exibida: `https://SEU_USUARIO.github.io/cruciflix/`

### Passo 5: Configurar Caminho de Acesso

Se seus arquivos HTML estão em `/pages`, a URL será:
```
https://SEU_USUARIO.github.io/cruciflix/pages/index.html
```

**Opcional**: Adicione um `index.html` na raiz que redireciona:

```html
<!DOCTYPE html>
<html>
<head>
  <meta http-equiv="refresh" content="0;url=pages/index.html">
</head>
<body>
  <p>Redirecionando...</p>
</body>
</html>
```

## 📚 Referência da API JavaScript

### Auth Module (`auth.js`)

```javascript
// Registrar usuário
window.authModule.registerUser(email, password, displayName)
  .then(result => {
    if (result.success) {
      console.log('Usuário criado:', result.user);
    }
  });

// Login
window.authModule.loginUser(email, password)
  .then(result => {
    if (result.success) {
      console.log('Login bem-sucedido');
    }
  });

// Logout
window.authModule.logoutUser();

// Verificar se é admin
const isAdmin = await window.authModule.isUserAdmin(userId);

// Observer de autenticação
window.authModule.onAuthStateChanged((authState) => {
  console.log('Logged in:', authState.loggedIn);
  console.log('Is admin:', authState.isAdmin);
});
```

### Firestore Module (`firestore.js`)

```javascript
// Obter todos os vídeos
const videos = await window.firestoreModule.getAllVideos();

// Filtrar por tags
const filteredVideos = await window.firestoreModule.getVideosByTags(['Filme', 'Santo']);

// Obter vídeo por ID
const video = await window.firestoreModule.getVideoById(videoId);

// Adicionar vídeo (admin)
const result = await window.firestoreModule.addVideo({
  title: "Título",
  description: "Descrição",
  tags: ["Tag1", "Tag2"],
  hlsUrl: "https://...",
  isKidsSafe: false
});

// Salvar progresso
await window.firestoreModule.saveProgress(videoId, currentTime, completed);

// Obter progresso
const progress = await window.firestoreModule.getProgress(videoId);

// Adicionar comentário
const result = await window.firestoreModule.addComment(videoId, "Comentário");

// Obter comentários aprovados
const comments = await window.firestoreModule.getComments(videoId);
```

### Player Module (`player.js`)

```javascript
// Inicializar player
window.playerModule.initPlayer('video-element-id', hlsUrl, videoId);

// Controles
window.playerModule.togglePlayPause();
window.playerModule.setVolume(0.5); // 0-1
window.playerModule.toggleMute();
window.playerModule.toggleFullscreen();
window.playerModule.seekTo(120); // segundos
window.playerModule.skip(10); // avançar/retroceder

// Atalhos de teclado
window.playerModule.setupKeyboardControls();

// Cleanup
window.playerModule.cleanup();
```

### UI Module (`ui.js`)

```javascript
// Criar card de vídeo
const card = window.uiModule.createVideoCard(videoData);
container.appendChild(card);

// Exibir vídeos
window.uiModule.displayVideos(videosArray);

// Filtrar
window.uiModule.setupTagFilter(checkboxElements);
window.uiModule.filterVideos();

// Busca
window.uiModule.setupSearch(inputElement);

// Modals
window.uiModule.showModal('modal-id');
window.uiModule.hideModal('modal-id');

// Toasts
window.uiModule.showToast('Mensagem', 'success'); // success, error, warning, info

// Loading
window.uiModule.showLoading();
window.uiModule.hideLoading();

// Utilitários
const param = window.uiModule.getUrlParameter('v');
const formatted = window.uiModule.formatTime(3661); // "1:01:01"
```

## 🐛 Troubleshooting

### Erro: "Firebase initialization error"

**Causa**: Credenciais incorretas em `firebase-config.js`

**Solução**:
1. Verifique se copiou corretamente do Firebase Console
2. Certifique-se de não ter espaços extras
3. Verifique se o projeto Firebase está ativo

### Erro: "Permission denied" no Firestore

**Causa**: Regras de segurança muito restritivas

**Solução**:
1. Vá para Firestore > Regras
2. Verifique se as regras permitem acesso
3. Para testes, use (TEMPORARIAMENTE):
```javascript
allow read, write: if true;
```

### Vídeo HLS não carrega

**Causa**: URL incorreta ou CORS bloqueado

**Solução**:
1. Verifique se a URL do `.m3u8` está correta
2. No Firebase Storage, vá para Regras
3. Certifique-se que `allow read: if true;` está presente
4. Verifique CORS no Firebase Storage

### GitHub Pages mostra 404

**Causa**: Caminho incorreto

**Solução**:
1. Verifique se os arquivos estão na branch correta
2. Certifique-se de que `index.html` existe
3. Aguarde alguns minutos (deploy pode demorar)
4. Limpe cache do navegador

### Comentários não aparecem

**Causa**: Comentários ainda não aprovados

**Solução**:
- Comentários precisam ser aprovados por admin
- Faça login como admin
- Vá para Painel Admin > Comentários
- Aprove os comentários pendentes

---

## 📞 Suporte Técnico

Para questões técnicas:
- 📧 Email: dev@cruciflix.com.br
- 📚 Consulte a [Documentação do Firebase](https://firebase.google.com/docs)
- 📚 Consulte a [Documentação do HLS.js](https://github.com/video-dev/hls.js/)

---

**Desenvolvido com ❤️ e para a glória de Deus**

*Cruciflix - Streaming Católico*
