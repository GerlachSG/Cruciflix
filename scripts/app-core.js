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
    console.log('✅ Firebase initialized successfully');
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

// Register new user
async function registerUser(email, password, displayName) {
    try {
        const userCredential = await firebaseAuth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        await user.updateProfile({ displayName: displayName });

        await firebaseDB.collection('users').doc(user.uid).set({
            uid: user.uid,
            email: email,
            displayName: displayName,
            role: 'user',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            preferences: { kidsPin: '' }
        });

        console.log('✅ User registered successfully:', user.uid);
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
        console.log('✅ User logged in successfully:', userCredential.user.uid);
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
        console.log('✅ User logged out successfully');
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
        console.log('✅ Password reset email sent');
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

        console.log('✅ Profile updated successfully');
        return { success: true };
    } catch (error) {
        console.error('❌ Profile update error:', error);
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
    updateUserProfile
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
    navigateTo,
    isValidEmail,
    isValidPassword,
    showFormError,
    clearFormErrors,
    getUrlParameter,
    formatTime
};
