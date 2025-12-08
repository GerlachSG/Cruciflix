// ============================================
// CRUCIFLIX - APP CORE
// Firebase + Auth + UI Utilities (Consolidated)
// ============================================

// ============================================
// FIREBASE CONFIGURATION
// ============================================

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
} catch (error) {
    console.error('❌ Firebase initialization error:', error);
    alert('Erro ao conectar com o Firebase. Verifique a configuração.');
}

// Export Firebase references
window.firebaseApp = app;
window.firebaseAuth = auth;
window.firebaseDB = db;
window.firebaseStorage = storage;

// ============================================
// AUTHENTICATION MODULE
// ============================================

// Avatares pré-definidos temáticos
const AVATARS = [
    { id: 'avatar1', url: 'https://api.dicebear.com/7.x/initials/svg?seed=SA&backgroundColor=8b0000', name: 'Santo Agostinho' },
    { id: 'avatar2', url: 'https://api.dicebear.com/7.x/initials/svg?seed=SF&backgroundColor=1a5f7a', name: 'São Francisco' },
    { id: 'avatar3', url: 'https://api.dicebear.com/7.x/initials/svg?seed=MT&backgroundColor=6b4423', name: 'Madre Teresa' },
    { id: 'avatar4', url: 'https://api.dicebear.com/7.x/initials/svg?seed=SJ&backgroundColor=2d4a3e', name: 'São João' },
    { id: 'avatar5', url: 'https://api.dicebear.com/7.x/initials/svg?seed=SP&backgroundColor=4a235a', name: 'São Paulo' },
    { id: 'avatar6', url: 'https://api.dicebear.com/7.x/initials/svg?seed=SM&backgroundColor=1b4f72', name: 'Santa Maria' },
    { id: 'avatar7', url: 'https://api.dicebear.com/7.x/initials/svg?seed=PP&backgroundColor=7b241c', name: 'Papa Pio' },
    { id: 'avatar8', url: 'https://api.dicebear.com/7.x/initials/svg?seed=SB&backgroundColor=0e6655', name: 'São Bento' },
    { id: 'avatar9', url: 'https://api.dicebear.com/7.x/initials/svg?seed=ST&backgroundColor=5b2c6f', name: 'Santa Teresa' },
    { id: 'avatar10', url: 'https://api.dicebear.com/7.x/initials/svg?seed=SL&backgroundColor=784212', name: 'São Lucas' },
    { id: 'kids1', url: 'https://api.dicebear.com/7.x/fun-emoji/svg?seed=angel', name: 'Anjinho' },
    { id: 'kids2', url: 'https://api.dicebear.com/7.x/fun-emoji/svg?seed=star', name: 'Estrelinha' },
    { id: 'kids3', url: 'https://api.dicebear.com/7.x/fun-emoji/svg?seed=heart', name: 'Coração' },
    { id: 'kids4', url: 'https://api.dicebear.com/7.x/fun-emoji/svg?seed=rainbow', name: 'Arco-íris' }
];

// Perfil atual selecionado (armazenado em sessionStorage)
let currentProfile = null;

// Register new user
async function registerUser(email, password, displayName) {
    try {
        const userCredential = await firebaseAuth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        await user.updateProfile({ displayName: displayName });

        // IMPORTANT: Do not create Firestore user document or default profiles here.
        // Creation of the Firestore user record must happen only after the user
        // verifies their email. The verification page will call createUserRecordIfMissing
        // once `user.emailVerified === true`.

        return { success: true, user: user };
    } catch (error) {
        console.error('❌ Registration error:', error);
        return { success: false, error: error.message };
    }
}

// Login existing user
async function loginUser(email, password) {
    try {
        const userCredential = await firebaseAuth.signInWithEmailAndPassword(email, password);
        return { success: true, user: userCredential.user };
    } catch (error) {
        console.error('❌ Login error:', error);
        return { success: false, error: error.message };
    }
}

// Logout user
async function logoutUser() {
    try {
        await firebaseAuth.signOut();
        return { success: true };
    } catch (error) {
        console.error('❌ Logout error:', error);
        return { success: false, error: error.message };
    }
}

// Get current user
function getCurrentUser() {
    return firebaseAuth.currentUser;
}

// Check if user is admin
async function isUserAdmin(userId) {
    try {
        const userDoc = await firebaseDB.collection('users').doc(userId).get();
        if (userDoc.exists) {
            return userDoc.data().role === 'admin';
        }
        return false;
    } catch (error) {
        console.error('❌ Error checking admin status:', error);
        return false;
    }
}

// Auth state observer
function onAuthStateChanged(callback) {
    firebaseAuth.onAuthStateChanged(async (user) => {
        if (user) {
            const isAdmin = await isUserAdmin(user.uid);
            callback({ loggedIn: true, user: user, isAdmin: isAdmin });
        } else {
            callback({ loggedIn: false, user: null, isAdmin: false });
        }
    });
}

// Protect page (redirect to login if not authenticated)
function requireAuth(redirectUrl = 'index.html') {
    const user = getCurrentUser();
    if (!user) {
        window.location.href = redirectUrl;
        return false;
    }
    return true;
}

// Protect admin page
async function requireAdmin(redirectUrl = 'dashboard.html') {
    const user = getCurrentUser();
    if (!user) {
        window.location.href = 'index.html';
        return false;
    }
    const isAdmin = await isUserAdmin(user.uid);
    if (!isAdmin) {
        window.location.href = redirectUrl;
        return false;
    }
    return true;
}

// Send password reset email
async function resetPassword(email) {
    try {
        await firebaseAuth.sendPasswordResetEmail(email);
        return { success: true };
    } catch (error) {
        console.error('❌ Password reset error:', error);
        return { success: false, error: error.message };
    }
}

// Update user profile
async function updateUserProfile(updates) {
    try {
        const user = getCurrentUser();
        if (!user) throw new Error('Usuário não autenticado');

        if (updates.displayName) {
            await user.updateProfile({ displayName: updates.displayName });
        }
        await firebaseDB.collection('users').doc(user.uid).update(updates);

        return { success: true };
    } catch (error) {
        console.error('❌ Profile update error:', error);
        return { success: false, error: error.message };
    }
}

// ============================================
// PROFILE MANAGEMENT (Multi-profiles per account)
// ============================================

// Get all profiles for current user
async function getProfiles() {
    try {
        const user = getCurrentUser();
        if (!user) return [];

        const snapshot = await firebaseDB.collection('users').doc(user.uid)
            .collection('profiles').orderBy('createdAt', 'asc').get();

        const profiles = [];
        snapshot.forEach(doc => {
            profiles.push({ id: doc.id, ...doc.data() });
        });

        return profiles;
    } catch (error) {
        console.error('❌ Error fetching profiles:', error);
        return [];
    }
}

// Create new profile
async function createProfile(profileData) {
    try {
        const user = getCurrentUser();
        if (!user) throw new Error('Usuário não autenticado');

        // Verificar limite de perfis (máximo 5)
        const profiles = await getProfiles();
        if (profiles.length >= 5) {
            return { success: false, error: 'Limite máximo de 5 perfis atingido' };
        }

        const newProfile = {
            name: profileData.name,
            avatar: profileData.avatar || AVATARS[0].url,
            isKids: profileData.isKids || false,
            pin: profileData.pin || '',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        const docRef = await firebaseDB.collection('users').doc(user.uid)
            .collection('profiles').add(newProfile);

        return { success: true, id: docRef.id };
    } catch (error) {
        console.error('❌ Error creating profile:', error);
        return { success: false, error: error.message };
    }
}

// Update profile
async function updateProfile(profileId, updates) {
    try {
        const user = getCurrentUser();
        if (!user) throw new Error('Usuário não autenticado');

        await firebaseDB.collection('users').doc(user.uid)
            .collection('profiles').doc(profileId).update(updates);

        return { success: true };
    } catch (error) {
        console.error('❌ Error updating profile:', error);
        return { success: false, error: error.message };
    }
}

// Delete profile
async function deleteProfile(profileId) {
    try {
        const user = getCurrentUser();
        if (!user) throw new Error('Usuário não autenticado');

        // Verificar se é o único perfil
        const profiles = await getProfiles();
        if (profiles.length <= 1) {
            return { success: false, error: 'Não é possível excluir o único perfil' };
        }

        await firebaseDB.collection('users').doc(user.uid)
            .collection('profiles').doc(profileId).delete();

        return { success: true };
    } catch (error) {
        console.error('❌ Error deleting profile:', error);
        return { success: false, error: error.message };
    }
}

// Set current profile (store in sessionStorage)
function setCurrentProfile(profile) {
    currentProfile = profile;
    sessionStorage.setItem('currentProfile', JSON.stringify(profile));
}

// Get current profile
function getCurrentProfile() {
    if (!currentProfile) {
        const stored = sessionStorage.getItem('currentProfile');
        if (stored) {
            currentProfile = JSON.parse(stored);
        }
    }
    return currentProfile;
}

// Clear current profile (on logout or profile switch)
function clearCurrentProfile() {
    currentProfile = null;
    sessionStorage.removeItem('currentProfile');
}

// Verify kids PIN
async function verifyKidsPin(profileId, pin) {
    try {
        const user = getCurrentUser();
        if (!user) return false;

        const doc = await firebaseDB.collection('users').doc(user.uid)
            .collection('profiles').doc(profileId).get();

        if (doc.exists) {
            const profile = doc.data();
            return profile.pin === pin;
        }
        return false;
    } catch (error) {
        console.error('❌ Error verifying PIN:', error);
        return false;
    }
}

// Create Firestore user record and a default profile if missing.
async function createUserRecordIfMissing(user, displayName) {
    try {
        if (!user) return { success: false, error: 'Usuário ausente' };

        const userRef = firebaseDB.collection('users').doc(user.uid);
        const userDoc = await userRef.get();
        if (userDoc.exists) {
            return { success: true, created: false };
        }

        const now = firebase.firestore.FieldValue.serverTimestamp();
        await userRef.set({
            uid: user.uid,
            email: user.email,
            displayName: displayName || user.displayName || '',
            role: 'user',
            subscription: {
                plan: 'free',
                startDate: now,
                endDate: null
            },
            createdAt: now
        });

        // Create a default profile for the user
        const defaultProfile = {
            name: displayName || user.displayName || 'Perfil',
            avatar: AVATARS[0].url,
            isKids: false,
            pin: '',
            createdAt: now
        };

        await userRef.collection('profiles').add(defaultProfile);

        return { success: true, created: true };
    } catch (error) {
        console.error('❌ Error creating user record:', error);
        return { success: false, error: error.message };
    }
}

// Get available avatars
function getAvatars(isKids = false) {
    if (isKids) {
        return AVATARS.filter(a => a.id.startsWith('kids'));
    }
    return AVATARS;
}

// ============================================
// SUBSCRIPTION MANAGEMENT (Visual/Simulation)
// ============================================

const SUBSCRIPTION_PLANS = [
    {
        id: 'free',
        name: 'Gratuito',
        price: 0,
        features: ['Acesso limitado', '1 perfil', 'Qualidade SD', 'Com anúncios'],
        maxProfiles: 1,
        quality: 'SD'
    },
    {
        id: 'basic',
        name: 'Básico',
        price: 19.90,
        features: ['Catálogo completo', '2 perfis', 'Qualidade HD', 'Sem anúncios'],
        maxProfiles: 2,
        quality: 'HD'
    },
    {
        id: 'premium',
        name: 'Premium',
        price: 39.90,
        features: ['Catálogo completo', '5 perfis', 'Qualidade 4K', 'Sem anúncios', 'Download offline', 'Conteúdo exclusivo'],
        maxProfiles: 5,
        quality: '4K'
    }
];

// Get all subscription plans
function getSubscriptionPlans() {
    return SUBSCRIPTION_PLANS;
}

// Get user subscription
async function getUserSubscription() {
    try {
        const user = getCurrentUser();
        if (!user) return null;

        const doc = await firebaseDB.collection('users').doc(user.uid).get();
        if (doc.exists) {
            return doc.data().subscription || { plan: 'free' };
        }
        return { plan: 'free' };
    } catch (error) {
        console.error('❌ Error fetching subscription:', error);
        return { plan: 'free' };
    }
}

// Update subscription (simulation)
async function updateSubscription(planId) {
    try {
        const user = getCurrentUser();
        if (!user) throw new Error('Usuário não autenticado');

        const plan = SUBSCRIPTION_PLANS.find(p => p.id === planId);
        if (!plan) throw new Error('Plano inválido');

        await firebaseDB.collection('users').doc(user.uid).set({
            subscription: {
                plan: planId,
                startDate: firebase.firestore.FieldValue.serverTimestamp(),
                endDate: null // Em produção, calcular data de expiração
            }
        }, { merge: true });

        return { success: true };
    } catch (error) {
        console.error('❌ Error updating subscription:', error);
        return { success: false, error: error.message };
    }
}

// Export auth module
window.authModule = {
    registerUser,
    loginUser,
    logoutUser,
    getCurrentUser,
    isUserAdmin,
    onAuthStateChanged,
    requireAuth,
    requireAdmin,
    resetPassword,
    updateUserProfile,
    // Profile management
    getProfiles,
    createProfile,
    updateProfile,
    deleteProfile,
    setCurrentProfile,
    getCurrentProfile,
    clearCurrentProfile,
    verifyKidsPin,
    getAvatars,
    AVATARS,
    createUserRecordIfMissing,
    // Subscription
    getSubscriptionPlans,
    getUserSubscription,
    updateSubscription,
    SUBSCRIPTION_PLANS
};

// ============================================
// UI UTILITIES MODULE
// ============================================

// --- VIDEO CARD GENERATION ---

function createVideoCard(video, onClickCallback) {
    const card = document.createElement('div');
    card.className = 'video-card';
    card.onclick = () => {
        if (onClickCallback) {
            onClickCallback(video.id);
        } else {
            openVideo(video.id);
        }
    };

    const thumbnail = video.thumbnailUrl || 'https://via.placeholder.com/300x170/1a1a2e/00d9ff?text=' + encodeURIComponent(video.title);

    card.innerHTML = `
        <div class="video-thumbnail" style="background-image: url('${thumbnail}');">
            <div class="play-overlay">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="white">
                    <path d="M8 5v14l11-7z"/>
                </svg>
            </div>
        </div>
        <div class="video-info">
            <h3 class="video-title">${video.title}</h3>
            <p class="video-description">${truncate(video.description, 60)}</p>
            <div class="video-tags">
                ${(video.tags || []).slice(0, 3).map(tag => `<span class="tag">${tag}</span>`).join('')}
            </div>
        </div>
    `;

    return card;
}

function openVideo(videoId) {
    window.location.href = `catalogo.html?v=${videoId}`;
}

function truncate(text, maxLength) {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

// --- TAG FILTERING ---

let selectedTags = [];

function setupTagFilter(tagCheckboxes, onFilterChange) {
    tagCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function () {
            if (this.checked) {
                if (!selectedTags.includes(this.value)) {
                    selectedTags.push(this.value);
                }
            } else {
                selectedTags = selectedTags.filter(tag => tag !== this.value);
            }
            if (onFilterChange) onFilterChange(selectedTags);
        });
    });
}

function getSelectedTags() {
    return selectedTags;
}

function resetFilters() {
    selectedTags = [];
    const checkboxes = document.querySelectorAll('.tag-filter input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = false);
}

// --- SEARCH FUNCTIONALITY ---

let searchDebounceTimer = null;

function setupSearch(searchInput, onSearch) {
    searchInput.addEventListener('input', function () {
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => {
            const searchTerm = this.value.trim();
            if (onSearch) onSearch(searchTerm);
        }, 500);
    });
}

// --- MODAL MANAGEMENT ---

function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

function setupModalCloseOnOutsideClick() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', function (e) {
            if (e.target === this) {
                hideModal(this.id);
            }
        });
    });
}

// --- TOAST NOTIFICATIONS ---

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// --- LOADING SPINNER ---

function showLoading() {
    let loader = document.getElementById('loading-spinner');
    if (!loader) {
        loader = document.createElement('div');
        loader.id = 'loading-spinner';
        loader.className = 'loading-spinner';
        loader.innerHTML = '<div class="spinner"></div>';
        document.body.appendChild(loader);
    }
    loader.style.display = 'flex';
}

function hideLoading() {
    const loader = document.getElementById('loading-spinner');
    if (loader) {
        loader.style.display = 'none';
    }
}

// --- UPGRADE PROMPT ---
function showUpgradeModal(content, requiredPlan, currentPlan) {
    try {
        // Remove existing modal to ensure fresh state
        let existingModal = document.getElementById('upgrade-modal');
        if (existingModal) {
            existingModal.remove();
        }

    let modal = document.createElement('div');
    modal.id = 'upgrade-modal';
    modal.className = 'modal';

    // Check if we should hide the header (for profile limit modal)
    const hideHeader = content && content.hideHeader === true;
    
    // Inject styles
    if (!document.getElementById('upgrade-modal-styles')) {
        const styleEl = document.createElement('style');
        styleEl.id = 'upgrade-modal-styles';
        styleEl.textContent = `
            #upgrade-modal {
                position: fixed;
                left: 0;
                top: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.65);
                backdrop-filter: blur(6px);
                -webkit-backdrop-filter: blur(6px);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 99999;
                animation: upgradeModalFadeIn 0.3s ease;
            }
            @keyframes upgradeModalFadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes upgradeModalSlideIn {
                from { opacity: 0; transform: scale(0.9) translateY(20px); }
                to { opacity: 1; transform: scale(1) translateY(0); }
            }
            .upgrade-modal-content {
                max-width: 500px;
                width: 92%;
                background: linear-gradient(145deg, #1a1a2e 0%, #16213e 100%);
                border-radius: 16px;
                box-shadow: 0 25px 80px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255,255,255,0.1);
                overflow: hidden;
                animation: upgradeModalSlideIn 0.4s ease;
                max-height: 90vh;
                overflow-y: auto;
            }
            .upgrade-modal-header {
                background: linear-gradient(135deg, #00a79e 0%, #007d77 100%);
                padding: 24px 24px 20px;
                text-align: center;
            }
            .upgrade-modal-icon {
                font-size: 40px;
                margin-bottom: 8px;
            }
            .upgrade-modal-header h2 {
                margin: 0;
                color: #fff;
                font-size: 1.4rem;
                font-weight: 700;
            }
            .upgrade-modal-body {
                padding: 24px;
                text-align: center;
            }
            .upgrade-modal-thumbnail {
                width: 100px;
                height: 60px;
                object-fit: cover;
                border-radius: 8px;
                margin-bottom: 16px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            }
            .upgrade-modal-title {
                color: #fff;
                font-size: 1rem;
                font-weight: 600;
                margin-bottom: 8px;
            }
            .upgrade-modal-msg {
                color: #a0a0a0;
                font-size: 0.9rem;
                line-height: 1.5;
                margin-bottom: 20px;
            }
            .upgrade-modal-plans-list {
                display: flex;
                flex-direction: column;
                gap: 10px;
                margin-bottom: 20px;
            }
            .upgrade-plan-option {
                background: rgba(255, 255, 255, 0.05);
                border: 2px solid rgba(255, 255, 255, 0.1);
                border-radius: 12px;
                padding: 14px 16px;
                cursor: pointer;
                transition: all 0.3s ease;
                text-align: left;
                position: relative;
            }
            .upgrade-plan-option:hover:not(.disabled-plan) {
                border-color: rgba(0, 167, 158, 0.5);
                background: rgba(0, 167, 158, 0.1);
            }
            .upgrade-plan-option.selected {
                border-color: #00a79e;
                background: rgba(0, 167, 158, 0.15);
                box-shadow: 0 0 20px rgba(0, 167, 158, 0.2);
            }
            .upgrade-plan-option.disabled-plan {
                opacity: 0.4;
                cursor: not-allowed;
            }
            .upgrade-plan-option .current-badge {
                position: absolute;
                bottom: 8px;
                right: 8px;
                background: rgba(0, 0, 0, 0.45);
                padding: 4px 8px;
                border-radius: 10px;
                font-size: 0.75rem;
                color: #e6f7f3;
                backdrop-filter: blur(4px);
            }
            .upgrade-plan-option.recommended::before {
                content: '⭐ Recomendado';
                position: absolute;
                top: -10px;
                left: 50%;
                transform: translateX(-50%);
                background: linear-gradient(135deg, #00a79e, #00c4b8);
                padding: 3px 10px;
                border-radius: 20px;
                font-size: 0.65rem;
                color: #fff;
                font-weight: 600;
            }
            .upgrade-plan-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 4px;
            }
            .upgrade-plan-name {
                font-size: 1rem;
                font-weight: 600;
                color: #fff;
            }
            .upgrade-plan-price {
                font-size: 0.95rem;
                font-weight: 700;
                color: #00a79e;
            }
            .upgrade-plan-features {
                font-size: 0.8rem;
                color: rgba(255,255,255,0.5);
            }
            .upgrade-modal-buttons {
                display: flex;
                gap: 10px;
                margin-top: 16px;
            }
            .upgrade-modal-btn {
                flex: 1;
                padding: 12px 16px;
                border-radius: 10px;
                font-size: 0.9rem;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
                border: none;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 6px;
            }
            .upgrade-modal-btn.cancel {
                background: rgba(255,255,255,0.08);
                color: #aaa;
                border: 1px solid rgba(255,255,255,0.1);
            }
            .upgrade-modal-btn.cancel:hover {
                background: rgba(255,255,255,0.12);
                color: #fff;
            }
            .upgrade-modal-btn.primary {
                background: linear-gradient(135deg, #00a79e 0%, #00c4b8 100%);
                color: #fff;
                box-shadow: 0 4px 15px rgba(0, 167, 158, 0.3);
            }
            .upgrade-modal-btn.primary:hover:not(:disabled) {
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(0, 167, 158, 0.4);
            }
            .upgrade-modal-btn.primary:disabled {
                opacity: 0.5;
                cursor: not-allowed;
                transform: none;
            }
            @media (max-width: 480px) {
                .upgrade-modal-content { width: 95%; }
                .upgrade-modal-body { padding: 20px 16px; }
                .upgrade-modal-buttons { flex-direction: column; }
                .upgrade-modal-btn { width: 100%; }
            }
        `;
        document.head.appendChild(styleEl);
    }

    const planNames = {
        'free': 'Gratuito',
        'basic': 'Básico',
        'premium': 'Premium'
    };

    const planPrices = {
        'free': 'R$ 0',
        'basic': 'R$ 19,90/mês',
        'premium': 'R$ 39,90/mês'
    };

    const planFeatures = {
        'free': 'Conteúdo limitado • 1 perfil • SD',
        'basic': 'Todo conteúdo • 2 perfis • HD',
        'premium': 'Todo conteúdo • 5 perfis • 4K • Downloads'
    };

    const reqPlan = (requiredPlan || 'basic').toString().toLowerCase();
    const curPlan = (currentPlan || 'free').toString().toLowerCase();
    const contentTitle = (content && content.title) || 'este conteúdo';
    // Prefer banner when available for header background, fallback to thumbnail
    const bannerUrl = (content && (content.bannerUrl || content.thumbnailUrl)) || '';

    const planOrder = ['free', 'basic', 'premium'];
    const ranks = { free: 0, basic: 1, premium: 2 };

    const plansHtml = planOrder.map(planId => {
        const isCurrent = planId === curPlan;
        const isRecommended = planId === reqPlan && !isCurrent;
        const isDisabled = ranks[planId] <= ranks[curPlan];
        
        return `
            <div class="upgrade-plan-option ${isDisabled ? 'disabled-plan' : ''} ${isRecommended ? 'recommended' : ''}" 
                 data-plan="${planId}">
                ${isCurrent ? '<span class="current-badge">Seu plano</span>' : ''}
                <div class="upgrade-plan-header">
                    <span class="upgrade-plan-name">${planNames[planId]}</span>
                    <span class="upgrade-plan-price">${planPrices[planId]}</span>
                </div>
                <div class="upgrade-plan-features">${planFeatures[planId]}</div>
            </div>
        `;
    }).join('');

    modal.innerHTML = `
        <div class="upgrade-modal-content">
            ${hideHeader ? '' : '<div class="upgrade-modal-header"></div>'}
            <div class="upgrade-modal-body">
                ${!hideHeader && bannerUrl ? '' : (!hideHeader && content && content.thumbnailUrl ? `<img class="upgrade-modal-thumbnail" src="${content.thumbnailUrl}" alt="">` : '')}
                <div class="upgrade-modal-title">${contentTitle}</div>
                <p class="upgrade-modal-msg">${hideHeader ? 'Você atingiu o limite de perfis do seu plano. Faça upgrade para criar mais perfis:' : 'Escolha um plano para assistir este conteúdo:'}</p>
                <div class="upgrade-modal-plans-list">
                    ${plansHtml}
                </div>
                <div class="upgrade-modal-buttons">
                    <button id="upgrade-modal-cancel" class="upgrade-modal-btn cancel">Voltar</button>
                    <button id="upgrade-modal-action" class="upgrade-modal-btn primary" disabled>
                        <span>✨</span> Fazer Upgrade
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // If we have a banner, use it as the header background and remove small thumbnail
    if (bannerUrl && !hideHeader) {
        const headerEl = modal.querySelector('.upgrade-modal-header');
        if (headerEl) {
            headerEl.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.35), rgba(0,0,0,0.35)), url('${bannerUrl}')`;
            headerEl.style.backgroundSize = 'cover';
            headerEl.style.backgroundPosition = 'center';
        }
        const thumbImg = modal.querySelector('.upgrade-modal-thumbnail');
        if (thumbImg) thumbImg.remove();
    }

    // Close handlers
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
            document.body.style.overflow = 'auto';
        }
    });

    document.getElementById('upgrade-modal-cancel').addEventListener('click', () => {
        modal.remove();
        document.body.style.overflow = 'auto';
    });

    // Plan selection
    let selectedPlan = null;
    const actionBtn = document.getElementById('upgrade-modal-action');

    modal.querySelectorAll('.upgrade-plan-option').forEach(option => {
        if (option.classList.contains('disabled-plan')) return;
        
        option.addEventListener('click', () => {
            modal.querySelectorAll('.upgrade-plan-option').forEach(o => o.classList.remove('selected'));
            option.classList.add('selected');
            selectedPlan = option.dataset.plan;
            actionBtn.disabled = false;
        });
    });

    // Action button - upgrade subscription
    actionBtn.addEventListener('click', async () => {
        if (!selectedPlan) return;
        
        actionBtn.disabled = true;
        actionBtn.innerHTML = '<span>⏳</span> Processando...';
        
        try {
            await window.authModule.updateSubscription(selectedPlan);
            
            if (window.uiModule && window.uiModule.showToast) {
                window.uiModule.showToast(`Plano atualizado para ${planNames[selectedPlan]}!`, 'success');
            }
            
            modal.remove();
            document.body.style.overflow = 'auto';
            
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } catch (error) {
            console.error('Erro ao atualizar plano:', error);
            if (window.uiModule && window.uiModule.showToast) {
                window.uiModule.showToast('Erro ao atualizar plano. Tente novamente.', 'error');
            }
            actionBtn.disabled = false;
            actionBtn.innerHTML = '<span>✨</span> Fazer Upgrade';
        }
    });

    document.body.style.overflow = 'hidden';
    } catch (err) {
        // Silent fail
    }
}

// --- NAVIGATION ---

function setupMobileMenu() {
    const menuToggle = document.getElementById('mobile-menu-toggle');
    const nav = document.querySelector('.main-nav');
    if (menuToggle && nav) {
        menuToggle.addEventListener('click', () => nav.classList.toggle('active'));
    }
}

function navigateTo(page) {
    window.location.href = page;
}

function setupUserMenu() {
    const userMenuBtn = document.getElementById('user-menu-btn');
    const userMenuDropdown = document.getElementById('user-menu-dropdown');

    if (userMenuBtn && userMenuDropdown) {
        userMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            userMenuDropdown.classList.toggle('active');
        });
        document.addEventListener('click', () => userMenuDropdown.classList.remove('active'));
    }
}

// --- FORM VALIDATION ---

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPassword(password) {
    return password.length >= 6;
}

function showFormError(inputElement, message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'form-error';
    errorDiv.textContent = message;

    const existingError = inputElement.parentElement.querySelector('.form-error');
    if (existingError) existingError.remove();

    inputElement.parentElement.appendChild(errorDiv);
    inputElement.classList.add('error');
}

function clearFormErrors(formElement) {
    formElement.querySelectorAll('.form-error').forEach(error => error.remove());
    formElement.querySelectorAll('.error').forEach(input => input.classList.remove('error'));
}

// --- URL PARAMETERS ---

function getUrlParameter(name) {
    return new URLSearchParams(window.location.search).get(name);
}

// --- FORMAT TIME ---

function formatTime(seconds) {
    if (isNaN(seconds)) return '00:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hrs > 0) {
        return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// --- INITIALIZATION ---

function initCommonUI() {
    setupMobileMenu();
    setupUserMenu();
    setupModalCloseOnOutsideClick();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCommonUI);
} else {
    initCommonUI();
}

// Export UI module
window.uiModule = {
    createVideoCard,
    openVideo,
    truncate,
    setupTagFilter,
    getSelectedTags,
    resetFilters,
    setupSearch,
    showModal,
    hideModal,
    showToast,
    showLoading,
    hideLoading,
    showUpgradeModal,
    navigateTo,
    isValidEmail,
    isValidPassword,
    showFormError,
    clearFormErrors,
    getUrlParameter,
    formatTime
};
