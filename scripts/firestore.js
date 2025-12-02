// Firestore Database Operations for Cruciflix
// Handles all database interactions for videos, comments, progress, and user data

// ============================================
// VIDEO OPERATIONS
// ============================================

// Get all videos
async function getAllVideos() {
    try {
        const snapshot = await firebaseDB.collection('videos').orderBy('uploadedAt', 'desc').get();
        const videos = [];
        snapshot.forEach(doc => {
            videos.push({ id: doc.id, ...doc.data() });
        });
        console.log(`✅ Fetched ${videos.length} videos`);
        return videos;
    } catch (error) {
        console.error('❌ Error fetching videos:', error);
        return [];
    }
}

// Get videos by tags (supports multiple tags - AND logic)
async function getVideosByTags(tags) {
    try {
        if (!tags || tags.length === 0) {
            return await getAllVideos();
        }

        const snapshot = await firebaseDB.collection('videos')
            .where('tags', 'array-contains-any', tags)
            .orderBy('uploadedAt', 'desc')
            .get();

        const videos = [];
        snapshot.forEach(doc => {
            const videoData = { id: doc.id, ...doc.data() };
            // Filter to ensure ALL tags are present (array-contains-any is OR logic)
            const hasAllTags = tags.every(tag => videoData.tags.includes(tag));
            if (hasAllTags || tags.length === 1) {
                videos.push(videoData);
            }
        });

        console.log(`✅ Fetched ${videos.length} videos with tags:`, tags);
        return videos;
    } catch (error) {
        console.error('❌ Error fetching videos by tags:', error);
        return [];
    }
}

// Get kids-safe videos only
async function getKidsVideos() {
    try {
        const snapshot = await firebaseDB.collection('videos')
            .where('isKidsSafe', '==', true)
            .orderBy('uploadedAt', 'desc')
            .get();

        const videos = [];
        snapshot.forEach(doc => {
            videos.push({ id: doc.id, ...doc.data() });
        });

        console.log(`✅ Fetched ${videos.length} kids-safe videos`);
        return videos;
    } catch (error) {
        console.error('❌ Error fetching kids videos:', error);
        return [];
    }
}

// Get single video by ID
async function getVideoById(videoId) {
    try {
        const doc = await firebaseDB.collection('videos').doc(videoId).get();
        if (doc.exists) {
            return { id: doc.id, ...doc.data() };
        } else {
            console.warn('⚠️ Video not found:', videoId);
            return null;
        }
    } catch (error) {
        console.error('❌ Error fetching video:', error);
        return null;
    }
}

// Add new video (admin only)
async function addVideo(videoData) {
    try {
        const user = firebaseAuth.currentUser;
        if (!user) throw new Error('Usuário não autenticado');

        const newVideo = {
            title: videoData.title,
            description: videoData.description,
            tags: videoData.tags || [],
            hlsUrl: videoData.hlsUrl,
            thumbnailUrl: videoData.thumbnailUrl || '',
            duration: videoData.duration || 0,
            uploadedBy: user.uid,
            uploadedAt: firebase.firestore.FieldValue.serverTimestamp(),
            viewCount: 0,
            isKidsSafe: videoData.isKidsSafe || false
        };

        const docRef = await firebaseDB.collection('videos').add(newVideo);
        console.log('✅ Video added successfully:', docRef.id);
        return { success: true, id: docRef.id };
    } catch (error) {
        console.error('❌ Error adding video:', error);
        return { success: false, error: error.message };
    }
}

// Update video (admin only)
async function updateVideo(videoId, updates) {
    try {
        await firebaseDB.collection('videos').doc(videoId).update(updates);
        console.log('✅ Video updated successfully:', videoId);
        return { success: true };
    } catch (error) {
        console.error('❌ Error updating video:', error);
        return { success: false, error: error.message };
    }
}

// Delete video (admin only)
async function deleteVideo(videoId) {
    try {
        await firebaseDB.collection('videos').doc(videoId).delete();
        console.log('✅ Video deleted successfully:', videoId);
        return { success: true };
    } catch (error) {
        console.error('❌ Error deleting video:', error);
        return { success: false, error: error.message };
    }
}

// Increment view count
async function incrementViewCount(videoId) {
    try {
        await firebaseDB.collection('videos').doc(videoId).update({
            viewCount: firebase.firestore.FieldValue.increment(1)
        });
    } catch (error) {
        console.error('❌ Error incrementing view count:', error);
    }
}

// ============================================
// USER PROGRESS OPERATIONS
// ============================================

// Save user progress for a video
async function saveProgress(videoId, watchTime, completed = false) {
    try {
        const user = firebaseAuth.currentUser;
        if (!user) return;

        const progressId = `${user.uid}_${videoId}`;
        await firebaseDB.collection('progress').doc(progressId).set({
            userId: user.uid,
            videoId: videoId,
            watchTime: watchTime,
            completed: completed,
            lastWatched: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        console.log('✅ Progress saved:', progressId);
    } catch (error) {
        console.error('❌ Error saving progress:', error);
    }
}

// Get user progress for a video
async function getProgress(videoId) {
    try {
        const user = firebaseAuth.currentUser;
        if (!user) return null;

        const progressId = `${user.uid}_${videoId}`;
        const doc = await firebaseDB.collection('progress').doc(progressId).get();

        if (doc.exists) {
            return doc.data();
        }
        return null;
    } catch (error) {
        console.error('❌ Error fetching progress:', error);
        return null;
    }
}

// Get all user progress (for profile page)
async function getUserProgress() {
    try {
        const user = firebaseAuth.currentUser;
        if (!user) return [];

        const snapshot = await firebaseDB.collection('progress')
            .where('userId', '==', user.uid)
            .orderBy('lastWatched', 'desc')
            .get();

        const progressList = [];
        snapshot.forEach(doc => {
            progressList.push(doc.data());
        });

        return progressList;
    } catch (error) {
        console.error('❌ Error fetching user progress:', error);
        return [];
    }
}

// ============================================
// COMMENT OPERATIONS
// ============================================

// Add comment
async function addComment(videoId, content) {
    try {
        const user = firebaseAuth.currentUser;
        if (!user) throw new Error('Usuário não autenticado');

        const userDoc = await firebaseDB.collection('users').doc(user.uid).get();
        const userData = userDoc.data();

        await firebaseDB.collection('comments').add({
            videoId: videoId,
            userId: user.uid,
            userName: userData.displayName || user.email,
            content: content,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            approved: false // Requires moderation
        });

        console.log('✅ Comment added (pending approval)');
        return { success: true };
    } catch (error) {
        console.error('❌ Error adding comment:', error);
        return { success: false, error: error.message };
    }
}

// Get approved comments for a video
async function getComments(videoId) {
    try {
        const snapshot = await firebaseDB.collection('comments')
            .where('videoId', '==', videoId)
            .where('approved', '==', true)
            .orderBy('createdAt', 'desc')
            .get();

        const comments = [];
        snapshot.forEach(doc => {
            comments.push({ id: doc.id, ...doc.data() });
        });

        return comments;
    } catch (error) {
        console.error('❌ Error fetching comments:', error);
        return [];
    }
}

// Get all comments for moderation (admin only)
async function getAllComments() {
    try {
        const snapshot = await firebaseDB.collection('comments')
            .orderBy('createdAt', 'desc')
            .get();

        const comments = [];
        snapshot.forEach(doc => {
            comments.push({ id: doc.id, ...doc.data() });
        });

        return comments;
    } catch (error) {
        console.error('❌ Error fetching all comments:', error);
        return [];
    }
}

// Approve comment (admin only)
async function approveComment(commentId) {
    try {
        await firebaseDB.collection('comments').doc(commentId).update({
            approved: true
        });
        console.log('✅ Comment approved:', commentId);
        return { success: true };
    } catch (error) {
        console.error('❌ Error approving comment:', error);
        return { success: false, error: error.message };
    }
}

// Delete comment (admin only)
async function deleteComment(commentId) {
    try {
        await firebaseDB.collection('comments').doc(commentId).delete();
        console.log('✅ Comment deleted:', commentId);
        return { success: true };
    } catch (error) {
        console.error('❌ Error deleting comment:', error);
        return { success: false, error: error.message };
    }
}

// ============================================
// SEARCH OPERATIONS
// ============================================

// Search videos by title
async function searchVideos(searchTerm) {
    try {
        const allVideos = await getAllVideos();
        const searchLower = searchTerm.toLowerCase();

        const results = allVideos.filter(video =>
            video.title.toLowerCase().includes(searchLower) ||
            video.description.toLowerCase().includes(searchLower)
        );

        console.log(`✅ Found ${results.length} videos matching "${searchTerm}"`);
        return results;
    } catch (error) {
        console.error('❌ Error searching videos:', error);
        return [];
    }
}

// Export functions
window.firestoreModule = {
    getAllVideos,
    getVideosByTags,
    getKidsVideos,
    getVideoById,
    addVideo,
    updateVideo,
    deleteVideo,
    incrementViewCount,
    saveProgress,
    getProgress,
    getUserProgress,
    addComment,
    getComments,
    getAllComments,
    approveComment,
    deleteComment,
    searchVideos
};
