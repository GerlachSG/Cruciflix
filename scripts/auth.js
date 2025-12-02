// Authentication Module for Cruciflix
// Handles user registration, login, logout, and role management

// Register new user
async function registerUser(email, password, displayName) {
    try {
        const userCredential = await firebaseAuth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        // Update display name
        await user.updateProfile({
            displayName: displayName
        });

        // Create user document in Firestore
        await firebaseDB.collection('users').doc(user.uid).set({
            uid: user.uid,
            email: email,
            displayName: displayName,
            role: 'user', // Default role
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            preferences: {
                kidsPin: '' // Empty by default, can be set later
            }
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
        const user = userCredential.user;

        console.log('✅ User logged in successfully:', user.uid);
        return { success: true, user: user };
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
            const userData = userDoc.data();
            return userData.role === 'admin';
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
            // User is signed in
            const isAdmin = await isUserAdmin(user.uid);
            callback({
                loggedIn: true,
                user: user,
                isAdmin: isAdmin
            });
        } else {
            // User is signed out
            callback({
                loggedIn: false,
                user: null,
                isAdmin: false
            });
        }
    });
}

// Protect page (redirect to login if not authenticated)
function requireAuth(redirectUrl = '../pages/index.html') {
    const user = getCurrentUser();
    if (!user) {
        window.location.href = redirectUrl;
        return false;
    }
    return true;
}

// Protect admin page (redirect if not admin)
async function requireAdmin(redirectUrl = '../pages/dashboard.html') {
    const user = getCurrentUser();
    if (!user) {
        window.location.href = '../pages/index.html';
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

        // Update Firebase Auth profile
        if (updates.displayName) {
            await user.updateProfile({ displayName: updates.displayName });
        }

        // Update Firestore document
        await firebaseDB.collection('users').doc(user.uid).update(updates);

        console.log('✅ Profile updated successfully');
        return { success: true };
    } catch (error) {
        console.error('❌ Profile update error:', error);
        return { success: false, error: error.message };
    }
}

// Export functions for use in HTML pages
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
