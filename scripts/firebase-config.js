// Firebase Configuration for Cruciflix
// IMPORTANT: Replace the firebaseConfig object below with your actual Firebase project credentials
// Get these from: Firebase Console > Project Settings > Your apps > Web app

// Firebase SDK imports (using CDN - included in HTML files)
// Make sure to include these scripts in your HTML before this file:
// <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js"></script>
// <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-auth-compat.js"></script>
// <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js"></script>
// <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-storage-compat.js"></script>

// PLACEHOLDER CONFIG - REPLACE WITH YOUR FIREBASE PROJECT CREDENTIALS
const firebaseConfig = {
  apiKey: "AIzaSyDjSgDdMIKVXyoSjwF4zQ8lVrrdNL6ozv4",
  authDomain: "cruciflix.firebaseapp.com",
  projectId: "cruciflix",
  storageBucket: "cruciflix.firebasestorage.app",
  messagingSenderId: "295469372666",
  appId: "1:295469372666:web:92b29734967b75c6c8e543",
  measurementId: "G-LDZ5QZ1SM9"
};

// Initialize Firebase
let app, auth, db, storage;

try {
  app = firebase.initializeApp(firebaseConfig);
  auth = firebase.auth();
  db = firebase.firestore();
  storage = firebase.storage();

  console.log('✅ Firebase initialized successfully');
} catch (error) {
  console.error('❌ Firebase initialization error:', error);
  alert('Erro ao conectar com o Firebase. Verifique a configuração.');
}

// Export references for use in other modules
window.firebaseApp = app;
window.firebaseAuth = auth;
window.firebaseDB = db;
window.firebaseStorage = storage;
