// ============================================
// CRUCIFLIX - APP CATALOG
// Firestore Operations + Video Player (Consolidated)
// ============================================

// ============================================
// LOCAL CACHE CONFIGURATION
// ============================================
const CACHE_CONFIG = {
    MOVIES_KEY: 'cruciflix_movies_cache',
    SERIES_KEY: 'cruciflix_series_cache',
    TAGS_KEY: 'cruciflix_tags_cache',
    CACHE_DURATION: 5 * 60 * 1000, // 5 minutes in milliseconds
    TIMESTAMP_SUFFIX: '_timestamp'
};

// Callbacks para atualização de UI quando cache for revalidado
const revalidateCallbacks = {
    movies: [],
    series: [],
    tags: []
};

// Registrar callback para quando dados forem atualizados
function onDataUpdate(type, callback) {
    if (revalidateCallbacks[type]) {
        revalidateCallbacks[type].push(callback);
    }
}

// Notificar callbacks de atualização
function notifyUpdate(type, data) {
    if (revalidateCallbacks[type]) {
        revalidateCallbacks[type].forEach(cb => {
            try { cb(data); } catch (e) { console.error('Callback error:', e); }
        });
    }
}

// Cache helper functions
function setCache(key, data) {
    try {
        sessionStorage.setItem(key, JSON.stringify(data));
        sessionStorage.setItem(key + CACHE_CONFIG.TIMESTAMP_SUFFIX, Date.now().toString());
    } catch (e) {
        console.warn('Cache write failed:', e);
    }
}

function getCache(key) {
    try {
        const timestamp = sessionStorage.getItem(key + CACHE_CONFIG.TIMESTAMP_SUFFIX);
        if (!timestamp) return null;
        
        const age = Date.now() - parseInt(timestamp);
        if (age > CACHE_CONFIG.CACHE_DURATION) {
            // Cache expired
            sessionStorage.removeItem(key);
            sessionStorage.removeItem(key + CACHE_CONFIG.TIMESTAMP_SUFFIX);
            return null;
        }
        
        const data = sessionStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    } catch (e) {
        console.warn('Cache read failed:', e);
        return null;
    }
}

// Pega cache sem verificar expiração (para stale-while-revalidate)
function getCacheStale(key) {
    try {
        const data = sessionStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    } catch (e) {
        console.warn('Cache read failed:', e);
        return null;
    }
}

function clearCache(key = null) {
    try {
        if (key) {
            sessionStorage.removeItem(key);
            sessionStorage.removeItem(key + CACHE_CONFIG.TIMESTAMP_SUFFIX);
        } else {
            // Clear all cruciflix caches
            Object.values(CACHE_CONFIG).forEach(k => {
                if (typeof k === 'string' && !k.includes('DURATION')) {
                    sessionStorage.removeItem(k);
                    sessionStorage.removeItem(k + CACHE_CONFIG.TIMESTAMP_SUFFIX);
                }
            });
        }
    } catch (e) {
        console.warn('Cache clear failed:', e);
    }
}

// Revalidar dados em background (stale-while-revalidate)
async function revalidateInBackground(type, fetchFn, cacheKey) {
    try {
        const freshData = await fetchFn(true); // forceRefresh = true
        const cachedData = getCacheStale(cacheKey);
        
        // Compara quantidade e IDs para detectar mudanças
        const hasChanges = !cachedData || 
            freshData.length !== cachedData.length ||
            JSON.stringify(freshData.map(d => d.id).sort()) !== JSON.stringify(cachedData.map(d => d.id).sort()) ||
            JSON.stringify(freshData.map(d => d.updatedAt || d.createdAt)) !== JSON.stringify(cachedData.map(d => d.updatedAt || d.createdAt));
        
        if (hasChanges) {
            notifyUpdate(type, freshData);
        }
    } catch (e) {
        console.warn(`Background revalidation failed for ${type}:`, e);
    }
}

// ============================================
// CONTENT TYPE CONSTANTS
// ============================================
const CONTENT_TYPES = {
    MOVIE: 'movie',
    SERIES: 'series'
};

// ============================================
// TAGS OPERATIONS (Dynamic Tags)
// ============================================

// Get all tags
async function getAllTags(forceRefresh = false) {
    try {
        // Stale-while-revalidate: retorna cache imediato e revalida em background
        if (!forceRefresh) {
            const cached = getCacheStale(CACHE_CONFIG.TAGS_KEY);
            if (cached) {
                // Revalidar em background
                setTimeout(() => revalidateInBackground('tags', fetchTagsFromDB, CACHE_CONFIG.TAGS_KEY), 100);
                return cached;
            }
        }
        
        return await fetchTagsFromDB(forceRefresh);
    } catch (error) {
        console.error('❌ Error fetching tags:', error);
        return [];
    }
}

// Função interna para buscar tags do banco
async function fetchTagsFromDB(forceRefresh = false) {
    const snapshot = await firebaseDB.collection('tags').orderBy('name', 'asc').get();
    const tags = [];
    snapshot.forEach(doc => {
        tags.push({ id: doc.id, ...doc.data() });
    });
    
    // Store in cache
    setCache(CACHE_CONFIG.TAGS_KEY, tags);
    
    return tags;
}

// Create new tag (admin only)
async function createTag(tagData) {
    try {
        const existingTag = await firebaseDB.collection('tags')
            .where('name', '==', tagData.name).get();
        
        if (!existingTag.empty) {
            return { success: false, error: 'Tag já existe' };
        }

        const docRef = await firebaseDB.collection('tags').add({
            name: tagData.name,
            color: tagData.color || '#00a79e',
            category: tagData.category || 'general',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Clear tags cache
        clearCache(CACHE_CONFIG.TAGS_KEY);
        return { success: true, id: docRef.id };
    } catch (error) {
        console.error('❌ Error creating tag:', error);
        return { success: false, error: error.message };
    }
}

// Add new tag (admin only) - alias for createTag
async function addTag(tagName, category = 'general') {
    return createTag({ name: tagName, category: category });
}

// Update tag (admin only)
async function updateTag(tagId, updates) {
    try {
        await firebaseDB.collection('tags').doc(tagId).update(updates);
        // Clear tags cache
        clearCache(CACHE_CONFIG.TAGS_KEY);
        return { success: true };
    } catch (error) {
        console.error('❌ Error updating tag:', error);
        return { success: false, error: error.message };
    }
}

// Delete tag (admin only)
async function deleteTag(tagId) {
    try {
        await firebaseDB.collection('tags').doc(tagId).delete();
        // Clear tags cache
        clearCache(CACHE_CONFIG.TAGS_KEY);
        return { success: true };
    } catch (error) {
        console.error('❌ Error deleting tag:', error);
        return { success: false, error: error.message };
    }
}

// ============================================
// MOVIES OPERATIONS
// ============================================

// Get all movies
async function getAllMovies(forceRefresh = false) {
    try {
        // Stale-while-revalidate: retorna cache imediato e revalida em background
        if (!forceRefresh) {
            const cached = getCacheStale(CACHE_CONFIG.MOVIES_KEY);
            if (cached) {
                // Revalidar em background
                setTimeout(() => revalidateInBackground('movies', fetchMoviesFromDB, CACHE_CONFIG.MOVIES_KEY), 100);
                return cached;
            }
        }
        
        return await fetchMoviesFromDB(forceRefresh);
    } catch (error) {
        console.error('❌ Error fetching movies:', error);
        return [];
    }
}

// Função interna para buscar filmes do banco
async function fetchMoviesFromDB(forceRefresh = false) {
    const snapshot = await firebaseDB.collection('movies').orderBy('createdAt', 'desc').get();
    const movies = [];
    snapshot.forEach(doc => {
        const data = doc.data();
        // Filter out any documents that aren't movies (safety check)
        if (data.type !== 'EPISODE' && data.type !== 'SERIES') {
            movies.push({ ...data, id: doc.id, type: CONTENT_TYPES.MOVIE });
        }
    });
    
    // Store in cache
    setCache(CACHE_CONFIG.MOVIES_KEY, movies);
    
    return movies;
}

// Get movie by ID
async function getMovieById(movieId) {
    try {
        const doc = await firebaseDB.collection('movies').doc(movieId).get();
        if (doc.exists) {
            return { ...doc.data(), id: doc.id, type: CONTENT_TYPES.MOVIE };
        }
        return null;
    } catch (error) {
        console.error('❌ Error fetching movie:', error);
        return null;
    }
}

// Add movie (admin only)
async function addMovie(movieData) {
    try {
        const user = firebaseAuth.currentUser;
        if (!user) throw new Error('Usuário não autenticado');

        const newMovie = {
            title: movieData.title,
            description: movieData.description,
            tags: movieData.tags || [],
            hlsUrl: movieData.hlsUrl || '',
            videoUrl: movieData.videoUrl || '',
            trailerUrl: movieData.trailerUrl || '',
            thumbnailUrl: movieData.thumbnailUrl || '',
            bannerUrl: movieData.bannerUrl || '',
            duration: movieData.duration || 0,
            durationMinutes: movieData.durationMinutes || 0,
            year: movieData.year || new Date().getFullYear(),
            rating: movieData.rating || 'L',
            subscriptionLevel: movieData.subscriptionLevel || 'FREE',
            uploadedBy: user.uid,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            viewCount: 0,
            isKidsSafe: movieData.isKidsSafe || false,
            isFeatured: movieData.isFeatured || false,
            hlsPending: movieData.hlsPending || false
        };

        const docRef = await firebaseDB.collection('movies').add(newMovie);
        // Clear movies cache
        clearCache(CACHE_CONFIG.MOVIES_KEY);
        return { success: true, id: docRef.id };
    } catch (error) {
        console.error('❌ Error adding movie:', error);
        return { success: false, error: error.message };
    }
}

// Update movie
async function updateMovie(movieId, updates) {
    try {
        await firebaseDB.collection('movies').doc(movieId).update(updates);
        // Clear movies cache
        clearCache(CACHE_CONFIG.MOVIES_KEY);
        return { success: true };
    } catch (error) {
        console.error('❌ Error updating movie:', error);
        return { success: false, error: error.message };
    }
}

// Delete movie
async function deleteMovie(movieId) {
    try {
        await firebaseDB.collection('movies').doc(movieId).delete();
        // Clear movies cache
        clearCache(CACHE_CONFIG.MOVIES_KEY);
        return { success: true };
    } catch (error) {
        console.error('❌ Error deleting movie:', error);
        return { success: false, error: error.message };
    }
}

// ============================================
// SERIES OPERATIONS
// ============================================

// Get all series
async function getAllSeries(forceRefresh = false) {
    try {
        // Stale-while-revalidate: retorna cache imediato e revalida em background
        if (!forceRefresh) {
            const cached = getCacheStale(CACHE_CONFIG.SERIES_KEY);
            if (cached) {
                // Revalidar em background
                setTimeout(() => revalidateInBackground('series', fetchSeriesFromDB, CACHE_CONFIG.SERIES_KEY), 100);
                return cached;
            }
        }
        
        return await fetchSeriesFromDB(forceRefresh);
    } catch (error) {
        console.error('❌ Error fetching series:', error);
        return [];
    }
}

// Função interna para buscar séries do banco
async function fetchSeriesFromDB(forceRefresh = false) {
    const snapshot = await firebaseDB.collection('series').orderBy('createdAt', 'desc').get();
    const series = [];
    snapshot.forEach(doc => {
        series.push({ ...doc.data(), id: doc.id, type: CONTENT_TYPES.SERIES });
    });
    
    // Store in cache
    setCache(CACHE_CONFIG.SERIES_KEY, series);
    
    return series;
}

// Get series by ID
async function getSeriesById(seriesId) {
    try {
        const doc = await firebaseDB.collection('series').doc(seriesId).get();
        
        if (doc.exists) {
            const data = { ...doc.data(), id: doc.id, type: CONTENT_TYPES.SERIES };
            return data;
        }
        return null;
    } catch (error) {
        console.error('❌ Error fetching series:', error);
        return null;
    }
}

// Add series (admin only)
async function addSeries(seriesData) {
    try {
        const user = firebaseAuth.currentUser;
        if (!user) throw new Error('Usuário não autenticado');

        const newSeries = {
            title: seriesData.title,
            description: seriesData.description,
            tags: seriesData.tags || [],
            thumbnailUrl: seriesData.thumbnailUrl || '',
            bannerUrl: seriesData.bannerUrl || '',
            trailerUrl: seriesData.trailerUrl || '',
            year: seriesData.year || new Date().getFullYear(),
            rating: seriesData.rating || 'L',
            totalSeasons: seriesData.totalSeasons || 1,
            uploadedBy: user.uid,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            viewCount: 0,
            isKidsSafe: seriesData.isKidsSafe || false,
            isFeatured: seriesData.isFeatured || false
        };

        const docRef = await firebaseDB.collection('series').add(newSeries);
        // Clear series cache
        clearCache(CACHE_CONFIG.SERIES_KEY);
        return { success: true, id: docRef.id };
    } catch (error) {
        console.error('❌ Error adding series:', error);
        return { success: false, error: error.message };
    }
}

// Update series
async function updateSeries(seriesId, updates) {
    try {
        await firebaseDB.collection('series').doc(seriesId).update(updates);
        // Clear series cache
        clearCache(CACHE_CONFIG.SERIES_KEY);
        return { success: true };
    } catch (error) {
        console.error('❌ Error updating series:', error);
        return { success: false, error: error.message };
    }
}

// Delete series (and all episodes)
async function deleteSeries(seriesId) {
    try {
        // Delete all episodes from the episodes collection that belong to this series
        const episodesSnapshot = await firebaseDB.collection('episodes')
            .where('seriesId', '==', seriesId)
            .get();
        
        if (!episodesSnapshot.empty) {
            const batch = firebaseDB.batch();
            episodesSnapshot.forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();
        }

        // Delete series
        await firebaseDB.collection('series').doc(seriesId).delete();
        // Clear series cache
        clearCache(CACHE_CONFIG.SERIES_KEY);
        return { success: true };
    } catch (error) {
        console.error('❌ Error deleting series:', error);
        return { success: false, error: error.message };
    }
}

// ============================================
// EPISODES OPERATIONS
// ============================================

// Get all episodes of a series
async function getEpisodes(seriesId) {
    try {
        const snapshot = await firebaseDB.collection('episodes')
            .where('seriesId', '==', seriesId)
            .get();
        
        const episodes = [];
        snapshot.forEach(doc => {
            episodes.push({ id: doc.id, ...doc.data() });
        });
        
        // Ordenar no cliente para evitar necessidade de índice composto
        episodes.sort((a, b) => {
            if (a.season !== b.season) return a.season - b.season;
            return a.episodeNumber - b.episodeNumber;
        });
        
        return episodes;
    } catch (error) {
        console.error('❌ Error fetching episodes:', error);
        return [];
    }
}

// Get episodes by series (alias)
async function getEpisodesBySeries(seriesId) {
    return getEpisodes(seriesId);
}

// Get episode by ID
async function getEpisodeById(episodeId) {
    try {
        const doc = await firebaseDB.collection('episodes').doc(episodeId).get();
        if (doc.exists) {
            return { id: doc.id, ...doc.data() };
        }
        return null;
    } catch (error) {
        console.error('❌ Error fetching episode:', error);
        return null;
    }
}

// Get episodes by season
async function getEpisodesBySeason(seriesId, season) {
    try {
        const snapshot = await firebaseDB.collection('episodes')
            .where('seriesId', '==', seriesId)
            .where('season', '==', season)
            .orderBy('episodeNumber', 'asc')
            .get();
        
        const episodes = [];
        snapshot.forEach(doc => {
            episodes.push({ id: doc.id, ...doc.data() });
        });
        return episodes;
    } catch (error) {
        console.error('❌ Error fetching episodes by season:', error);
        return [];
    }
}

// Add episode
async function addEpisode(episodeData) {
    try {
        const newEpisode = {
            seriesId: episodeData.seriesId,
            title: episodeData.title,
            description: episodeData.description || '',
            season: episodeData.season || 1,
            episodeNumber: episodeData.episodeNumber || 1,
            videoUrl: episodeData.videoUrl || episodeData.hlsUrl || '',
            hlsUrl: episodeData.hlsUrl || '',
            thumbnailUrl: episodeData.thumbnailUrl || '',
            duration: episodeData.duration || 0,
            durationMinutes: episodeData.durationMinutes || 0,
            subscriptionLevel: episodeData.subscriptionLevel || 'FREE',
            type: 'EPISODE',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            hlsPending: episodeData.hlsPending || false
        };

        const docRef = await firebaseDB.collection('episodes').add(newEpisode);
        
        // Update episode count on series
        await updateSeriesEpisodeCount(episodeData.seriesId);
        
        return { success: true, id: docRef.id };
    } catch (error) {
        console.error('❌ Error adding episode:', error);
        return { success: false, error: error.message };
    }
}

// Update episode
async function updateEpisode(episodeId, updates) {
    try {
        await firebaseDB.collection('episodes').doc(episodeId).update(updates);
        return { success: true };
    } catch (error) {
        console.error('❌ Error updating episode:', error);
        return { success: false, error: error.message };
    }
}

// Delete episode
async function deleteEpisode(episodeId) {
    try {
        // Get episode to find series
        const episode = await getEpisodeById(episodeId);
        
        await firebaseDB.collection('episodes').doc(episodeId).delete();
        
        // Update episode count on series
        if (episode && episode.seriesId) {
            await updateSeriesEpisodeCount(episode.seriesId);
        }
        
        return { success: true };
    } catch (error) {
        console.error('❌ Error deleting episode:', error);
        return { success: false, error: error.message };
    }
}

// Update series episode count
async function updateSeriesEpisodeCount(seriesId) {
    try {
        const episodes = await getEpisodes(seriesId);
        await firebaseDB.collection('series').doc(seriesId).update({
            episodeCount: episodes.length
        });
    } catch (error) {
        console.error('❌ Error updating series episode count:', error);
    }
}

// ============================================
// COMBINED CONTENT OPERATIONS
// ============================================

// Get all content (movies + series) combined
async function getAllContent() {
    try {
        const [movies, series] = await Promise.all([getAllMovies(), getAllSeries()]);
        const combined = [...movies, ...series];
        
        // Sort by createdAt (most recent first)
        combined.sort((a, b) => {
            const dateA = a.createdAt?.toDate?.() || new Date(0);
            const dateB = b.createdAt?.toDate?.() || new Date(0);
            return dateB - dateA;
        });
        
        return combined;
    } catch (error) {
        console.error('❌ Error fetching all content:', error);
        return [];
    }
}

// Get featured content
async function getFeaturedContent() {
    try {
        const content = await getAllContent();
        return content.filter(item => item.isFeatured);
    } catch (error) {
        console.error('❌ Error fetching featured content:', error);
        return [];
    }
}

// Get kids-safe content
async function getKidsContent() {
    try {
        const content = await getAllContent();
        return content.filter(item => item.isKidsSafe);
    } catch (error) {
        console.error('❌ Error fetching kids content:', error);
        return [];
    }
}

// Get content by tags
async function getContentByTags(tags) {
    try {
        if (!tags || tags.length === 0) {
            return await getAllContent();
        }

        const content = await getAllContent();
        return content.filter(item => {
            return tags.some(tag => item.tags && item.tags.includes(tag));
        });
    } catch (error) {
        console.error('❌ Error fetching content by tags:', error);
        return [];
    }
}

// Search content
async function searchContent(searchTerm) {
    try {
        const content = await getAllContent();
        const searchLower = searchTerm.toLowerCase();
        
        return content.filter(item =>
            item.title.toLowerCase().includes(searchLower) ||
            item.description.toLowerCase().includes(searchLower)
        );
    } catch (error) {
        console.error('❌ Error searching content:', error);
        return [];
    }
}

// Get content by ID (auto-detect type)
async function getContentById(contentId, type) {
    try {
        if (type === CONTENT_TYPES.MOVIE) {
            return await getMovieById(contentId);
        } else if (type === CONTENT_TYPES.SERIES) {
            return await getSeriesById(contentId);
        }
        
        // Try both if type not specified
        let content = await getMovieById(contentId);
        if (!content) {
            content = await getSeriesById(contentId);
        }
        return content;
    } catch (error) {
        console.error('❌ Error fetching content:', error);
        return null;
    }
}

// Increment view count
async function incrementContentViewCount(contentId, type) {
    try {
        const collection = type === CONTENT_TYPES.MOVIE ? 'movies' : 'series';
        await firebaseDB.collection(collection).doc(contentId).update({
            viewCount: firebase.firestore.FieldValue.increment(1)
        });
    } catch (error) {
        console.error('❌ Error incrementing view count:', error);
    }
}

// ============================================
// WATCHLIST (Minha Lista)
// ============================================

// Add to watchlist
async function addToWatchlist(contentId, contentType) {
    try {
        const user = firebaseAuth.currentUser;
        const profile = window.authModule?.getCurrentProfile();
        if (!user || !profile) return { success: false, error: 'Não autenticado' };

        const watchlistId = `${user.uid}_${profile.id}_${contentId}`;
        await firebaseDB.collection('watchlist').doc(watchlistId).set({
            userId: user.uid,
            profileId: profile.id,
            contentId: contentId,
            contentType: contentType,
            addedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        return { success: true };
    } catch (error) {
        console.error('❌ Error adding to watchlist:', error);
        return { success: false, error: error.message };
    }
}

// Remove from watchlist
async function removeFromWatchlist(contentId) {
    try {
        const user = firebaseAuth.currentUser;
        const profile = window.authModule?.getCurrentProfile();
        if (!user || !profile) return { success: false, error: 'Não autenticado' };

        const watchlistId = `${user.uid}_${profile.id}_${contentId}`;
        await firebaseDB.collection('watchlist').doc(watchlistId).delete();

        return { success: true };
    } catch (error) {
        console.error('❌ Error removing from watchlist:', error);
        return { success: false, error: error.message };
    }
}

// Check if in watchlist
async function isInWatchlist(contentId) {
    try {
        const user = firebaseAuth.currentUser;
        const profile = window.authModule?.getCurrentProfile();
        if (!user || !profile) return false;

        const watchlistId = `${user.uid}_${profile.id}_${contentId}`;
        const doc = await firebaseDB.collection('watchlist').doc(watchlistId).get();
        return doc.exists;
    } catch (error) {
        console.error('❌ Error checking watchlist:', error);
        return false;
    }
}

// Get user's watchlist
async function getWatchlist() {
    try {
        const user = firebaseAuth.currentUser;
        const profile = window.authModule?.getCurrentProfile();
        if (!user || !profile) return [];

        const snapshot = await firebaseDB.collection('watchlist')
            .where('userId', '==', user.uid)
            .where('profileId', '==', profile.id)
            .orderBy('addedAt', 'desc')
            .get();

        const watchlistItems = [];
        for (const doc of snapshot.docs) {
            const data = doc.data();
            const content = await getContentById(data.contentId, data.contentType);
            if (content) {
                watchlistItems.push(content);
            }
        }

        return watchlistItems;
    } catch (error) {
        console.error('❌ Error fetching watchlist:', error);
        return [];
    }
}

// ============================================
// USER PROGRESS OPERATIONS
// ============================================

// Save user progress for a video/episode
async function saveProgress(contentId, watchTime, completed = false, episodeId = null) {
    try {
        const user = firebaseAuth.currentUser;
        const profile = window.authModule?.getCurrentProfile();
        if (!user) return;

        const profileId = profile?.id || 'default';
        const progressId = episodeId 
            ? `${user.uid}_${profileId}_${contentId}_${episodeId}`
            : `${user.uid}_${profileId}_${contentId}`;

        await firebaseDB.collection('progress').doc(progressId).set({
            userId: user.uid,
            profileId: profileId,
            contentId: contentId,
            episodeId: episodeId,
            watchTime: watchTime,
            completed: completed,
            lastWatched: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    } catch (error) {
        console.error('❌ Error saving progress:', error);
    }
}

// Get user progress for a video/episode
async function getProgress(contentId, episodeId = null) {
    try {
        const user = firebaseAuth.currentUser;
        const profile = window.authModule?.getCurrentProfile();
        if (!user) return null;

        const profileId = profile?.id || 'default';
        const progressId = episodeId 
            ? `${user.uid}_${profileId}_${contentId}_${episodeId}`
            : `${user.uid}_${profileId}_${contentId}`;

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

// Get all user progress (for profile/dashboard - continue watching)
async function getUserProgress() {
    try {
        const user = firebaseAuth.currentUser;
        const profile = window.authModule?.getCurrentProfile();
        if (!user) return [];

        const profileId = profile?.id || 'default';
        const snapshot = await firebaseDB.collection('progress')
            .where('userId', '==', user.uid)
            .where('profileId', '==', profileId)
            .where('completed', '==', false)
            .orderBy('lastWatched', 'desc')
            .limit(10)
            .get();

        const progressList = [];
        for (const doc of snapshot.docs) {
            const data = doc.data();
            const content = await getContentById(data.contentId, data.contentType);
            if (content) {
                progressList.push({
                    ...data,
                    content: content
                });
            }
        }

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
            approved: false
        });

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
        return { success: true };
    } catch (error) {
        console.error('❌ Error deleting comment:', error);
        return { success: false, error: error.message };
    }
}

// ============================================
// SEARCH OPERATIONS
// ============================================

// Search videos by title/description
async function searchVideos(searchTerm) {
    try {
        const allVideos = await getAllVideos();
        const searchLower = searchTerm.toLowerCase();

        const results = allVideos.filter(video =>
            video.title.toLowerCase().includes(searchLower) ||
            video.description.toLowerCase().includes(searchLower)
        );

        return results;
    } catch (error) {
        console.error('❌ Error searching videos:', error);
        return [];
    }
}

// Export Firestore module
window.firestoreModule = {
    // Content types
    CONTENT_TYPES,
    // Cache functions
    onDataUpdate,
    clearCache,
    // Tags
    getAllTags,
    createTag,
    addTag,
    updateTag,
    deleteTag,
    // Movies
    getAllMovies,
    getMovieById,
    addMovie,
    updateMovie,
    deleteMovie,
    // Series
    getAllSeries,
    getSeriesById,
    addSeries,
    updateSeries,
    deleteSeries,
    // Episodes
    getEpisodes,
    getEpisodesBySeries,
    getEpisodeById,
    getEpisodesBySeason,
    addEpisode,
    updateEpisode,
    deleteEpisode,
    // Combined content
    getAllContent,
    getFeaturedContent,
    getKidsContent,
    getContentByTags,
    searchContent,
    getContentById,
    incrementContentViewCount,
    // Watchlist
    addToWatchlist,
    removeFromWatchlist,
    isInWatchlist,
    getWatchlist,
    // Progress
    saveProgress,
    getProgress,
    getUserProgress,
    // Comments
    addComment,
    getComments,
    getAllComments,
    approveComment,
    deleteComment
};

// ============================================
// HLS VIDEO PLAYER
// ============================================

let hlsPlayer = null;
let currentVideoElement = null;
window.progressSaveInterval = window.progressSaveInterval || null;
let currentVideoId = null;

// Initialize HLS player
function initPlayer(videoElementId, hlsUrl, videoId) {
    currentVideoElement = document.getElementById(videoElementId);
    currentVideoId = videoId;

    if (!currentVideoElement) {
        console.error('❌ Video element not found');
        return;
    }

    // Check if HLS.js is loaded
    if (typeof Hls === 'undefined') {
        console.error('❌ HLS.js not loaded');
        return;
    }

    if (Hls.isSupported()) {
        hlsPlayer = new Hls({
            enableWorker: true,
            lowLatencyMode: false,
        });

        hlsPlayer.loadSource(hlsUrl);
        hlsPlayer.attachMedia(currentVideoElement);

        hlsPlayer.on(Hls.Events.MANIFEST_PARSED, function () {
            loadSavedProgress(videoId);
        });

        hlsPlayer.on(Hls.Events.ERROR, function (event, data) {
            if (data.fatal) {
                console.error('❌ Fatal HLS error:', data);
                switch (data.type) {
                    case Hls.ErrorTypes.NETWORK_ERROR:
                        hlsPlayer.startLoad();
                        break;
                    case Hls.ErrorTypes.MEDIA_ERROR:
                        hlsPlayer.recoverMediaError();
                        break;
                    default:
                        break;
                }
            }
        });
    } else if (currentVideoElement.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari native HLS support
        currentVideoElement.src = hlsUrl;
        currentVideoElement.addEventListener('loadedmetadata', function () {
            loadSavedProgress(videoId);
        });
    } else {
        alert('Este navegador não suporta reprodução HLS.');
    }

    // Start auto-saving progress
    startProgressTracking(videoId);

    // Increment view count
    incrementViewCount(videoId);
}

// Load saved progress and resume playback
async function loadSavedProgress(videoId) {
    const progress = await getProgress(videoId);
    if (progress && progress.watchTime > 0 && !progress.completed) {
        currentVideoElement.currentTime = progress.watchTime;
    }
}

// Start tracking progress (save every 10 seconds)
function startProgressTracking(videoId) {
    if (window.progressSaveInterval) {
        clearInterval(window.progressSaveInterval);
    }

    window.progressSaveInterval = setInterval(() => {
        if (currentVideoElement && !currentVideoElement.paused) {
            const currentTime = currentVideoElement.currentTime;
            const duration = currentVideoElement.duration;
            const completed = (currentTime / duration) > 0.9;

            saveProgress(videoId, currentTime, completed);
        }
    }, 10000);
}

// Stop progress tracking
function stopProgressTracking() {
    if (window.progressSaveInterval) {
        clearInterval(window.progressSaveInterval);
        window.progressSaveInterval = null;
    }
}

// Play/Pause toggle
function togglePlayPause() {
    if (!currentVideoElement) return;
    if (currentVideoElement.paused) {
        currentVideoElement.play();
    } else {
        currentVideoElement.pause();
    }
}

// Set volume (0 to 1)
function setVolume(volume) {
    if (!currentVideoElement) return;
    currentVideoElement.volume = Math.max(0, Math.min(1, volume));
}

// Toggle mute
function toggleMute() {
    if (!currentVideoElement) return;
    currentVideoElement.muted = !currentVideoElement.muted;
}

// Toggle fullscreen
function toggleFullscreen(containerElement) {
    const element = containerElement || currentVideoElement;
    if (!element) return;

    if (!document.fullscreenElement) {
        if (element.requestFullscreen) {
            element.requestFullscreen();
        } else if (element.webkitRequestFullscreen) {
            element.webkitRequestFullscreen();
        } else if (element.mozRequestFullScreen) {
            element.mozRequestFullScreen();
        } else if (element.msRequestFullscreen) {
            element.msRequestFullscreen();
        }
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
}

// Seek to specific time
function seekTo(seconds) {
    if (!currentVideoElement) return;
    currentVideoElement.currentTime = seconds;
}

// Skip forward/backward
function skip(seconds) {
    if (!currentVideoElement) return;
    currentVideoElement.currentTime += seconds;
}

// Get current video element
function getVideoElement() {
    return currentVideoElement;
}

// Keyboard shortcuts
function setupKeyboardControls() {
    document.addEventListener('keydown', function (e) {
        if (!currentVideoElement) return;
        // Don't trigger if user is typing in an input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        switch (e.key) {
            case ' ':
            case 'k':
            case 'K':
                e.preventDefault();
                togglePlayPause();
                break;
            case 'f':
            case 'F':
                e.preventDefault();
                toggleFullscreen();
                break;
            case 'm':
            case 'M':
                e.preventDefault();
                toggleMute();
                break;
            case 'ArrowLeft':
                e.preventDefault();
                skip(-10);
                break;
            case 'ArrowRight':
                e.preventDefault();
                skip(10);
                break;
            case 'ArrowUp':
                e.preventDefault();
                setVolume(currentVideoElement.volume + 0.1);
                break;
            case 'ArrowDown':
                e.preventDefault();
                setVolume(currentVideoElement.volume - 0.1);
                break;
            case 'Escape':
                // Close modal if open
                const modal = document.getElementById('player-modal');
                if (modal && modal.style.display !== 'none') {
                    closePlayerModal();
                }
                break;
        }
    });
}

// Cleanup on page unload
function cleanupPlayer() {
    stopProgressTracking();
    if (hlsPlayer) {
        hlsPlayer.destroy();
        hlsPlayer = null;
    }
    currentVideoElement = null;
    currentVideoId = null;
}

window.addEventListener('beforeunload', cleanupPlayer);

// Close player modal helper
function closePlayerModal() {
    const modal = document.getElementById('player-modal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
    cleanupPlayer();
}

// Export Player module
window.playerModule = {
    initPlayer,
    togglePlayPause,
    setVolume,
    toggleMute,
    toggleFullscreen,
    seekTo,
    skip,
    getVideoElement,
    setupKeyboardControls,
    cleanupPlayer,
    closePlayerModal
};
