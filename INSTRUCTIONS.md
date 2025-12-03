# INSTRUCTIONS - Guia para Admin/Devs

Documentação técnica para administradores e desenvolvedores do Cruciflix.

---

## 📁 Estrutura do Projeto

```
Cruciflix/
├── pages/
│   ├── index.html       # Login/Cadastro
│   ├── dashboard.html   # Menu principal + Perfil
│   ├── catalogo.html    # Catálogo + Player modal
│   └── admin.html       # Painel administrativo
├── scripts/
│   ├── app-core.js      # Firebase + Auth + UI
│   ├── app-catalog.js   # Firestore + Player
│   └── app-admin.js     # Admin + Upload HLS
├── styles/
│   ├── main.css         # Estilos principais
│   ├── admin.css        # Estilos do admin
│   └── responsive.css   # Responsividade
└── firestore.rules      # Regras de segurança
```

---

## ⚙️ Configuração Firebase

### 1. Criar Projeto
1. Acesse [Firebase Console](https://console.firebase.google.com)
2. Crie um novo projeto
3. Registre um app Web

### 2. Habilitar Serviços
- **Authentication**: Ativar Email/Password
- **Firestore**: Criar banco de dados
- **Storage**: Ativar armazenamento

### 3. Configurar Credenciais
Edite `scripts/app-core.js` e substitua as credenciais:

```javascript
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_PROJECT.firebaseapp.com",
  projectId: "SEU_PROJECT",
  storageBucket: "SEU_PROJECT.appspot.com",
  messagingSenderId: "SEU_ID",
  appId: "SEU_APP_ID"
};
```

### 4. Criar Admin
1. Registre uma conta normal
2. No Firestore, encontre o usuário em `users`
3. Altere o campo `role` de `"user"` para `"admin"`

---

## 🎬 Adicionar Vídeos

### Via Painel Admin
1. Login como admin
2. Acesse Admin > Vídeos
3. Preencha o formulário:
   - **Título**: Nome do vídeo
   - **URL HLS**: Link do `.m3u8`
   - **Descrição**: Descrição do conteúdo
   - **Tags**: Separadas por vírgula
   - **Kids Safe**: Marcar se apropriado para crianças

### Converter Vídeo para HLS
Use FFmpeg para converter MP4 para HLS:

```bash
ffmpeg -i video.mp4 -codec: copy -start_number 0 -hls_time 10 -hls_list_size 0 -f hls output.m3u8
```

Upload os arquivos `.m3u8` e `.ts` para Firebase Storage.

---

## 👥 Gerenciar Usuários

No painel Admin > Usuários:
- **Promover**: Tornar usuário admin
- **Rebaixar**: Remover permissão admin
- **Excluir**: Remover conta (irreversível)

---

## 💬 Moderar Comentários

No painel Admin > Comentários:
- **Aprovar**: Liberar comentário para exibição
- **Excluir**: Remover comentário inadequado

---

## 📊 Estrutura do Firestore

### Coleção `videos`
```javascript
{
  title: "Título",
  description: "Descrição",
  tags: ["Tag1", "Tag2"],
  hlsUrl: "https://.../video.m3u8",
  thumbnailUrl: "https://.../thumb.jpg",
  duration: 3600,  // segundos
  isKidsSafe: true,
  viewCount: 0,
  uploadedAt: Timestamp
}
```

### Coleção `users`
```javascript
{
  uid: "firebase-uid",
  email: "email@exemplo.com",
  displayName: "Nome",
  role: "user" | "admin",
  createdAt: Timestamp
}
```

### Coleção `comments`
```javascript
{
  videoId: "video-id",
  userId: "user-id",
  userName: "Nome",
  content: "Texto do comentário",
  approved: false,
  createdAt: Timestamp
}
```

---

## 🚀 Deploy

### GitHub Pages
1. Push para o repositório
2. Settings > Pages
3. Source: `main` branch
4. Pasta: `/pages` ou `/ (root)`

---

## 🐛 Troubleshooting

| Erro | Solução |
|------|---------|
| Firebase error | Verificar credenciais em `app-core.js` |
| Permission denied | Verificar regras do Firestore |
| Vídeo não carrega | Verificar URL do HLS e CORS |
| 404 no GitHub Pages | Verificar branch e pasta configurada |

---

**Cruciflix** - Desenvolvido para a glória de Deus 🙏
