// ============================================
// CRUCIFLIX - APP ADMIN (Netflix-Style)
// Gerenciamento de Filmes, Séries, Tags e Usuários
// ============================================

// ============================================
// GLOBAL STATE
// ============================================
let allTags = [];
let allSeries = [];
let currentSeriesId = null;

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    // Verifica autenticação
    firebase.auth().onAuthStateChanged(async (user) => {
        if (user) {
            // Tentativa de detectar permissão de admin a partir do documento do usuário
            let isAdmin = false;
            try {
                const doc = await firebase.firestore().collection('users').doc(user.uid).get();
                const data = (doc && doc.exists) ? doc.data() : {};

                // Normaliza e verifica vários padrões possíveis de flag de admin
                const roleVal = (data.role || data.ro || '').toString().trim();
                const roleUpper = roleVal ? roleVal.toUpperCase() : '';

                const rolesObj = data.roles || {};

                isAdmin = !!(
                    data.isAdmin === true ||
                    String(data.isAdmin).toLowerCase() === 'true' ||
                    roleUpper === 'ADMIN' ||
                    roleUpper === 'ADM' ||
                    // permissões dentro de um objeto roles: { admin: true }
                    rolesObj.admin === true ||
                    String(rolesObj.admin).toLowerCase() === 'true'
                );
            } catch (err) {
                console.warn('Não foi possível ler dados do usuário para verificação de admin:', err);
            }

            if (!isAdmin) {
                // Ativa modo que oculta todo o conteúdo da página exceto o modal de sem-permissão
                document.body.classList.add('non-admin-mode');
                const span = document.getElementById('no-perm-email');
                if (span) span.textContent = user.email || '-';

                // ligar botões do modal
                const btnLogout = document.getElementById('no-perm-logout');
                if (btnLogout) btnLogout.addEventListener('click', () => firebase.auth().signOut());
                const btnBack = document.getElementById('no-perm-back');
                if (btnBack) btnBack.addEventListener('click', () => { window.location.href = '../pages/dashboard.html'; });

                // Não inicializa funcionalidades administrativas
                return;
            }

            // Usuário é admin: prosseguir normalmente
            document.getElementById('admin-email').textContent = user.email;
            await initializeAdmin();
        } else {
            window.location.href = 'index.html';
        }
    });

    // Setup navigation
    setupNavigation();
    
    // Setup forms
    setupForms();
    
    // Setup search
    setupSearch();
    
    // Logout
    document.getElementById('btn-logout').addEventListener('click', () => {
        firebase.auth().signOut();
    });
});

async function initializeAdmin() {
    // Load tags first (needed for selectors)
    await loadTags();
    
    // Load dashboard stats
    await loadDashboardStats();
    
    // Load initial data based on active section
    await loadMovies();
    
    // Registrar callbacks para atualização automática quando dados mudarem
    if (window.firestoreModule && window.firestoreModule.onDataUpdate) {
        window.firestoreModule.onDataUpdate('movies', (newMovies) => {
            displayMoviesTable(newMovies);
            loadDashboardStats(); // Atualiza estatísticas também
        });
        
        window.firestoreModule.onDataUpdate('series', (newSeries) => {
            allSeries = newSeries;
            displaySeriesTable(newSeries);
            loadDashboardStats();
        });
        
        window.firestoreModule.onDataUpdate('tags', (newTags) => {
            allTags = newTags;
            displayTagsGrid();
        });
    }
}

// ============================================
// NAVIGATION
// ============================================

// Normalize subscription stored in Firestore. Returns uppercase plan string (FREE/BASIC/PREMIUM)
function normalizeSubscription(sub) {
    if (!sub) return 'FREE';
    if (typeof sub === 'string') return sub.toUpperCase();
    if (typeof sub === 'object') {
        if (sub.plan) return String(sub.plan).toUpperCase();
        if (sub.id) return String(sub.id).toUpperCase();
    }
    return 'FREE';
}

function setupNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const section = item.dataset.section;
            
            // Update active nav
            document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
            // Show section
            document.querySelectorAll('.admin-section').forEach(sec => sec.classList.remove('active'));
            document.getElementById(`section-${section}`).classList.add('active');
            
            // Load section data
            loadSectionData(section);
        });
    });
}

async function loadSectionData(section) {
    switch (section) {
        case 'dashboard':
            await loadDashboardStats();
            break;
        case 'movies':
            await loadMovies();
            break;
        case 'series':
            await loadSeries();
            break;
        case 'tags':
            await loadTags();
            break;
        case 'users':
            await loadUsers();
            break;
        case 'subscriptions':
            await loadSubscriptionStats();
            break;
        case 'comments':
            await loadComments();
            break;
        case 'upload':
            await populateUploadForm();
            break;
    }
}

// ============================================
// DASHBOARD
// ============================================

async function loadDashboardStats() {
    try {
        // Total Movies
        const movies = await window.firestoreModule.getAllMovies();
        document.getElementById('total-movies').textContent = movies.length;
        
        // Total Series
        const series = await window.firestoreModule.getAllSeries();
        document.getElementById('total-series').textContent = series.length;
        
        // Total Users
        const usersSnapshot = await firebase.firestore().collection('users').get();
        document.getElementById('total-users').textContent = usersSnapshot.size;
        
        // Premium Users
        let premiumCount = 0;
        usersSnapshot.forEach(doc => {
            const data = doc.data();
            const plan = normalizeSubscription(data.subscription);
            if (plan === 'PREMIUM') premiumCount++;
        });
        document.getElementById('premium-users').textContent = premiumCount;
        
        // Recent content
        await loadRecentContent([...movies, ...series]);
        
        // Recent users
        await loadRecentUsers();
        
    } catch (error) {
        console.error('❌ Error loading dashboard stats:', error);
    }
}

async function loadRecentContent(content) {
    const container = document.getElementById('recent-content');
    if (!container) return;
    
    const sorted = content.sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || new Date(0);
        const dateB = b.createdAt?.toDate?.() || new Date(0);
        return dateB - dateA;
    }).slice(0, 5);
    
    container.innerHTML = sorted.map(item => `
        <div class="recent-item">
            <img src="${item.thumbnailUrl || 'https://via.placeholder.com/50x75'}" alt="${item.title}">
            <div class="recent-info">
                <span class="recent-title">${item.title}</span>
                <span class="recent-type">${(item.type || '').toLowerCase() === 'series' ? 'Série' : 'Filme'}</span>
            </div>
        </div>
    `).join('');
}

async function loadRecentUsers() {
    const container = document.getElementById('recent-users');
    if (!container) return;
    
    try {
        const snapshot = await firebase.firestore()
            .collection('users')
            .orderBy('createdAt', 'desc')
            .limit(5)
            .get();
        
        container.innerHTML = '';
        snapshot.forEach(doc => {
            const user = doc.data();
            const plan = normalizeSubscription(user.subscription);
            container.innerHTML += `
                <div class="recent-item">
                    <div class="user-avatar"><i class="fas fa-user"></i></div>
                    <div class="recent-info">
                        <span class="recent-title">${user.email}</span>
                        <span class="recent-type">${plan}</span>
                    </div>
                </div>
            `;
        });
    } catch (error) {
        console.error('❌ Error loading recent users:', error);
    }
}

// ============================================
// MOVIES
// ============================================

async function loadMovies() {
    try {
        const movies = await window.firestoreModule.getAllMovies();
        displayMoviesTable(movies);
    } catch (error) {
        console.error('❌ Error loading movies:', error);
    }
}

function displayMoviesTable(movies) {
    const tbody = document.getElementById('movies-list');
    if (!tbody) return;
    
    tbody.innerHTML = movies.map(movie => `
        <tr>
            <td><img src="${movie.thumbnailUrl || 'https://via.placeholder.com/60x90'}" class="table-thumb" alt="${movie.title}"></td>
            <td>${movie.title}</td>
            <td>${movie.year || '-'}</td>
            <td>${renderTagBadges(movie.tags || [])}</td>
            <td><span class="subscription-badge ${(movie.subscriptionLevel || 'FREE').toLowerCase()}">${movie.subscriptionLevel || 'FREE'}</span></td>
            <td>
                <button class="btn-icon" onclick="editMovie('${movie.id}')" title="Editar">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-icon btn-danger" onclick="confirmDeleteMovie('${movie.id}', '${movie.title.replace(/'/g, "\\'")}')" title="Excluir">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function renderTagBadges(tags) {
    if (!tags || tags.length === 0) return '-';
    return tags.slice(0, 3).map(tag => `<span class="tag-badge">${tag}</span>`).join(' ');
}

function openMovieModal(movieId = null) {
    document.getElementById('movie-modal-title').textContent = movieId ? 'Editar Filme' : 'Novo Filme';
    document.getElementById('movie-form').reset();
    document.getElementById('movie-id').value = movieId || '';
    
    populateTagsSelector('movie-tags-selector');
    
    document.getElementById('movie-modal').classList.add('active');
}

function closeMovieModal() {
    document.getElementById('movie-modal').classList.remove('active');
}

async function editMovie(movieId) {
    const movie = await window.firestoreModule.getMovieById(movieId);
    if (!movie) return;
    
    openMovieModal(movieId);
    
    document.getElementById('movie-title').value = movie.title;
    document.getElementById('movie-description').value = movie.description || '';
    document.getElementById('movie-year').value = movie.year || '';
    document.getElementById('movie-duration').value = movie.duration || '';
    document.getElementById('movie-video-url').value = movie.videoUrl || '';
    document.getElementById('movie-thumbnail').value = movie.thumbnailUrl || '';
    document.getElementById('movie-banner').value = movie.bannerUrl || '';
    document.getElementById('movie-rating').value = movie.rating || 'L';
    document.getElementById('movie-is-kids').checked = movie.isKidsSafe || false;
    document.getElementById('movie-subscription-level').value = movie.subscriptionLevel || 'FREE';
    
    // Select tags
    setTimeout(() => {
        (movie.tags || []).forEach(tag => {
            const tagEl = document.querySelector(`#movie-tags-selector .tag-option[data-tag="${tag}"]`);
            if (tagEl) tagEl.classList.add('selected');
        });
    }, 100);
}

async function handleMovieForm(e) {
    e.preventDefault();
    
    const movieId = document.getElementById('movie-id').value;
    const selectedTags = Array.from(document.querySelectorAll('#movie-tags-selector .tag-option.selected'))
        .map(el => el.dataset.tag);
    
    // Handle image file uploads
    const thumbnailFile = document.getElementById('movie-thumbnail-file')?.files?.[0] || null;
    const bannerFile = document.getElementById('movie-banner-file')?.files?.[0] || null;
    
    let thumbnailUrl = document.getElementById('movie-thumbnail').value;
    let bannerUrl = document.getElementById('movie-banner').value;
    
    try {
        showLoading();
        const now = Date.now();
        
        // Upload thumbnail if file provided
        if (thumbnailFile) {
            const thumbPath = `uploads/images/movie_thumb_${now}_${thumbnailFile.name}`;
            thumbnailUrl = await uploadFileToStorage(thumbnailFile, thumbPath);
        }
        
        // Upload banner if file provided
        if (bannerFile) {
            const bannerPath = `uploads/images/movie_banner_${now}_${bannerFile.name}`;
            bannerUrl = await uploadFileToStorage(bannerFile, bannerPath);
        }
        
        const movieData = {
            title: document.getElementById('movie-title').value,
            description: document.getElementById('movie-description').value,
            year: parseInt(document.getElementById('movie-year').value) || null,
            duration: parseInt(document.getElementById('movie-duration').value) || 0,
            videoUrl: document.getElementById('movie-video-url').value,
            thumbnailUrl: thumbnailUrl,
            bannerUrl: bannerUrl,
            rating: document.getElementById('movie-rating').value,
            isKidsSafe: document.getElementById('movie-is-kids').checked,
            tags: selectedTags,
            subscriptionLevel: document.getElementById('movie-subscription-level').value,
            type: 'MOVIE'
        };
        
        let result;
        if (movieId) {
            result = await window.firestoreModule.updateMovie(movieId, movieData);
        } else {
            result = await window.firestoreModule.addMovie(movieData);
        }
        
        hideLoading();
        
        if (result.success) {
            window.uiModule.showToast(movieId ? 'Filme atualizado!' : 'Filme adicionado!', 'success');
            closeMovieModal();
            loadMovies();
        } else {
            window.uiModule.showToast('Erro: ' + result.error, 'error');
        }
    } catch (error) {
        hideLoading();
        console.error('❌ Error saving movie:', error);
        window.uiModule.showToast('Erro ao salvar filme: ' + error.message, 'error');
    }
}

function confirmDeleteMovie(movieId, title) {
    if (confirm(`Excluir "${title}"?`)) {
        deleteMovie(movieId);
    }
}

async function deleteMovie(movieId) {
    const result = await window.firestoreModule.deleteMovie(movieId);
    if (result.success) {
        window.uiModule.showToast('Filme excluído!', 'success');
        loadMovies();
    } else {
        window.uiModule.showToast('Erro: ' + result.error, 'error');
    }
}

// ============================================
// SERIES
// ============================================

async function loadSeries() {
    try {
        const series = await window.firestoreModule.getAllSeries();
        allSeries = series;
        displaySeriesTable(series);
    } catch (error) {
        console.error('❌ Error loading series:', error);
    }
}

function displaySeriesTable(series) {
    const tbody = document.getElementById('series-list');
    if (!tbody) return;
    
    tbody.innerHTML = series.map(s => `
        <tr>
            <td><img src="${s.thumbnailUrl || 'https://via.placeholder.com/60x90'}" class="table-thumb" alt="${s.title}"></td>
            <td>${s.title}</td>
            <td>${s.totalSeasons || 1}</td>
            <td>${s.episodeCount || 0}</td>
            <td>${renderTagBadges(s.tags || [])}</td>
            <td>
                <button class="btn-icon" onclick="openEpisodesModal('${s.id}', '${s.title.replace(/'/g, "\\'")}')" title="Episódios">
                    <i class="fas fa-list"></i>
                </button>
                <button class="btn-icon" onclick="editSeries('${s.id}')" title="Editar">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-icon btn-danger" onclick="confirmDeleteSeries('${s.id}', '${s.title.replace(/'/g, "\\'")}')" title="Excluir">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function openSeriesModal(seriesId = null) {
    document.getElementById('series-modal-title').textContent = seriesId ? 'Editar Série' : 'Nova Série';
    document.getElementById('series-form').reset();
    document.getElementById('series-id').value = seriesId || '';
    
    populateTagsSelector('series-tags-selector');
    
    document.getElementById('series-modal').classList.add('active');
}

function closeSeriesModal() {
    document.getElementById('series-modal').classList.remove('active');
}

async function editSeries(seriesId) {
    const series = await window.firestoreModule.getSeriesById(seriesId);
    if (!series) return;
    
    openSeriesModal(seriesId);
    
    document.getElementById('series-title').value = series.title;
    document.getElementById('series-description').value = series.description || '';
    document.getElementById('series-year').value = series.year || '';
    document.getElementById('series-seasons').value = series.totalSeasons || 1;
    document.getElementById('series-thumbnail').value = series.thumbnailUrl || '';
    document.getElementById('series-banner').value = series.bannerUrl || '';
    document.getElementById('series-rating').value = series.rating || 'L';
    document.getElementById('series-is-kids').checked = series.isKidsSafe || false;
    document.getElementById('series-subscription-level').value = series.subscriptionLevel || 'FREE';
    
    setTimeout(() => {
        (series.tags || []).forEach(tag => {
            const tagEl = document.querySelector(`#series-tags-selector .tag-option[data-tag="${tag}"]`);
            if (tagEl) tagEl.classList.add('selected');
        });
    }, 100);
}

async function handleSeriesForm(e) {
    e.preventDefault();
    
    const seriesId = document.getElementById('series-id').value;
    const selectedTags = Array.from(document.querySelectorAll('#series-tags-selector .tag-option.selected'))
        .map(el => el.dataset.tag);
    
    // Handle image file uploads
    const thumbnailFile = document.getElementById('series-thumbnail-file')?.files?.[0] || null;
    const bannerFile = document.getElementById('series-banner-file')?.files?.[0] || null;
    
    let thumbnailUrl = document.getElementById('series-thumbnail').value;
    let bannerUrl = document.getElementById('series-banner').value;
    
    try {
        showLoading();
        const now = Date.now();
        
        // Upload thumbnail if file provided
        if (thumbnailFile) {
            const thumbPath = `uploads/images/series_thumb_${now}_${thumbnailFile.name}`;
            thumbnailUrl = await uploadFileToStorage(thumbnailFile, thumbPath);
        }
        
        // Upload banner if file provided
        if (bannerFile) {
            const bannerPath = `uploads/images/series_banner_${now}_${bannerFile.name}`;
            bannerUrl = await uploadFileToStorage(bannerFile, bannerPath);
        }
        
        const seriesData = {
            title: document.getElementById('series-title').value,
            description: document.getElementById('series-description').value,
            year: parseInt(document.getElementById('series-year').value) || null,
            totalSeasons: parseInt(document.getElementById('series-seasons').value) || 1,
            thumbnailUrl: thumbnailUrl,
            bannerUrl: bannerUrl,
            rating: document.getElementById('series-rating').value,
            isKidsSafe: document.getElementById('series-is-kids').checked,
            tags: selectedTags,
            subscriptionLevel: document.getElementById('series-subscription-level').value,
            type: 'SERIES'
        };
        
        let result;
        if (seriesId) {
            result = await window.firestoreModule.updateSeries(seriesId, seriesData);
        } else {
            result = await window.firestoreModule.addSeries(seriesData);
        }
        
        hideLoading();
        
        if (result.success) {
            window.uiModule.showToast(seriesId ? 'Série atualizada!' : 'Série adicionada!', 'success');
            closeSeriesModal();
            loadSeries();
        } else {
            window.uiModule.showToast('Erro: ' + result.error, 'error');
        }
    } catch (error) {
        hideLoading();
        console.error('❌ Error saving series:', error);
        window.uiModule.showToast('Erro ao salvar série: ' + error.message, 'error');
    }
}

function confirmDeleteSeries(seriesId, title) {
    if (confirm(`Excluir "${title}" e todos os episódios?`)) {
        deleteSeries(seriesId);
    }
}

async function deleteSeries(seriesId) {
    const result = await window.firestoreModule.deleteSeries(seriesId);
    if (result.success) {
        window.uiModule.showToast('Série excluída!', 'success');
        loadSeries();
    } else {
        window.uiModule.showToast('Erro: ' + result.error, 'error');
    }
}

// ============================================
// EPISODES
// ============================================

async function openEpisodesModal(seriesId, seriesTitle) {
    currentSeriesId = seriesId;
    document.getElementById('episodes-modal-title').textContent = `Episódios - ${seriesTitle}`;
    document.getElementById('episode-series-id').value = seriesId;
    
    // Get series to populate season filter
    const series = await window.firestoreModule.getSeriesById(seriesId);
    const seasonFilter = document.getElementById('season-filter');
    seasonFilter.innerHTML = '<option value="">Todas as temporadas</option>';
    for (let i = 1; i <= (series.totalSeasons || 1); i++) {
        seasonFilter.innerHTML += `<option value="${i}">Temporada ${i}</option>`;
    }
    
    await loadEpisodes(seriesId);
    closeEpisodeForm();
    
    document.getElementById('episodes-modal').classList.add('active');
}

function closeEpisodesModal() {
    document.getElementById('episodes-modal').classList.remove('active');
    currentSeriesId = null;
}

async function loadEpisodes(seriesId, seasonFilter = null) {
    try {
        const episodes = await window.firestoreModule.getEpisodesBySeries(seriesId);
        let filtered = episodes;
        
        if (seasonFilter) {
            filtered = episodes.filter(ep => ep.season === parseInt(seasonFilter));
        }
        
        displayEpisodesList(filtered);
    } catch (error) {
        console.error('❌ Error loading episodes:', error);
    }
}

function displayEpisodesList(episodes) {
    const container = document.getElementById('episodes-list');
    if (!container) return;
    
    if (episodes.length === 0) {
        container.innerHTML = '<p class="empty-message">Nenhum episódio cadastrado.</p>';
        return;
    }
    
    // Group by season
    const grouped = episodes.reduce((acc, ep) => {
        const season = ep.season || 1;
        if (!acc[season]) acc[season] = [];
        acc[season].push(ep);
        return acc;
    }, {});
    
    let html = '';
    Object.keys(grouped).sort((a, b) => a - b).forEach(season => {
        html += `<div class="season-group">
            <h4>Temporada ${season}</h4>
            <div class="episodes-grid">
                ${grouped[season].sort((a, b) => a.episodeNumber - b.episodeNumber).map(ep => `
                    <div class="episode-card">
                        <img src="${ep.thumbnailUrl || 'https://via.placeholder.com/160x90'}" alt="${ep.title}">
                        <div class="episode-info">
                            <span class="episode-number">E${ep.episodeNumber}</span>
                            <span class="episode-title">${ep.title}</span>
                            <span class="episode-duration">${ep.duration || '?'} min</span>
                        </div>
                        <div class="episode-actions">
                            <button onclick="editEpisode('${ep.id}')" title="Editar"><i class="fas fa-edit"></i></button>
                            <button onclick="confirmDeleteEpisode('${ep.id}', '${ep.title.replace(/'/g, "\\'")}')" title="Excluir"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>`;
    });
    
    container.innerHTML = html;
}

function filterEpisodesBySeason() {
    const season = document.getElementById('season-filter').value;
    loadEpisodes(currentSeriesId, season);
}

function openEpisodeForm() {
    document.getElementById('episode-form').reset();
    document.getElementById('episode-id').value = '';
    document.getElementById('episode-form-container').style.display = 'block';
}

function closeEpisodeForm() {
    document.getElementById('episode-form-container').style.display = 'none';
}

async function editEpisode(episodeId) {
    const episode = await window.firestoreModule.getEpisodeById(episodeId);
    if (!episode) return;
    
    openEpisodeForm();
    
    document.getElementById('episode-id').value = episode.id;
    document.getElementById('episode-season').value = episode.season || 1;
    document.getElementById('episode-number').value = episode.episodeNumber || 1;
    document.getElementById('episode-title').value = episode.title;
    document.getElementById('episode-description').value = episode.description || '';
    document.getElementById('episode-video-url').value = episode.videoUrl || '';
    document.getElementById('episode-duration').value = episode.duration || '';
    document.getElementById('episode-thumbnail').value = episode.thumbnailUrl || '';
}

async function handleEpisodeForm(e) {
    e.preventDefault();
    
    const episodeId = document.getElementById('episode-id').value;
    const seriesId = document.getElementById('episode-series-id').value;
    
    // Upload de imagem de thumbnail se fornecido arquivo
    const thumbnailFile = document.getElementById('episode-thumbnail-file').files[0];
    let thumbnailUrl = document.getElementById('episode-thumbnail').value;
    
    if (thumbnailFile) {
        window.uiModule.showLoading();
        try {
            const uploadedUrl = await uploadFileToStorage(thumbnailFile, `thumbnails/episodes/${Date.now()}_${thumbnailFile.name}`);
            if (uploadedUrl) {
                thumbnailUrl = uploadedUrl;
            }
        } catch (err) {
            console.error('Erro ao fazer upload de thumbnail:', err);
            window.uiModule.showToast('Erro ao fazer upload de imagem', 'error');
        }
        window.uiModule.hideLoading();
    }
    
    const episodeData = {
        seriesId: seriesId,
        season: parseInt(document.getElementById('episode-season').value) || 1,
        episodeNumber: parseInt(document.getElementById('episode-number').value) || 1,
        title: document.getElementById('episode-title').value,
        description: document.getElementById('episode-description').value,
        videoUrl: document.getElementById('episode-video-url').value,
        duration: parseInt(document.getElementById('episode-duration').value) || 0,
        thumbnailUrl: thumbnailUrl,
        type: 'EPISODE'
    };
    
    let result;
    if (episodeId) {
        result = await window.firestoreModule.updateEpisode(episodeId, episodeData);
    } else {
        result = await window.firestoreModule.addEpisode(episodeData);
    }
    
    if (result.success) {
        window.uiModule.showToast(episodeId ? 'Episódio atualizado!' : 'Episódio adicionado!', 'success');
        closeEpisodeForm();
        loadEpisodes(seriesId);
        
        // Update episode count
        loadSeries();
    } else {
        window.uiModule.showToast('Erro: ' + result.error, 'error');
    }
}

function confirmDeleteEpisode(episodeId, title) {
    if (confirm(`Excluir "${title}"?`)) {
        deleteEpisode(episodeId);
    }
}

async function deleteEpisode(episodeId) {
    const result = await window.firestoreModule.deleteEpisode(episodeId);
    if (result.success) {
        window.uiModule.showToast('Episódio excluído!', 'success');
        loadEpisodes(currentSeriesId);
        loadSeries();
    } else {
        window.uiModule.showToast('Erro: ' + result.error, 'error');
    }
}

// ============================================
// TAGS
// ============================================

async function loadTags() {
    try {
        allTags = await window.firestoreModule.getAllTags();
        displayTagsGrid();
    } catch (error) {
        console.error('❌ Error loading tags:', error);
    }
}

function displayTagsGrid() {
    const container = document.getElementById('tags-list');
    if (!container) return;
    
    if (allTags.length === 0) {
        container.innerHTML = '<p class="empty-message">Nenhuma tag cadastrada. Crie tags para categorizar seu conteúdo.</p>';
        return;
    }
    
    container.innerHTML = allTags.map(tag => `
        <div class="tag-card" style="border-color: ${tag.color || '#e50914'}">
            <span class="tag-name" style="color: ${tag.color || '#e50914'}">${tag.name}</span>
            <div class="tag-actions">
                <button onclick="editTag('${tag.id}', '${tag.name}', '${tag.color || '#e50914'}')" title="Editar">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="confirmDeleteTag('${tag.id}', '${tag.name}')" title="Excluir">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
}

function populateTagsSelector(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    if (allTags.length === 0) {
        container.innerHTML = '<span class="no-tags">Nenhuma tag disponível. <a href="#" onclick="navigateToTags()">Criar tags</a></span>';
        return;
    }
    
    container.innerHTML = allTags.map(tag => `
        <span class="tag-option" data-tag="${tag.name}" style="--tag-color: ${tag.color || '#e50914'}" onclick="toggleTagSelection(this)">
            ${tag.name}
        </span>
    `).join('');
}

function toggleTagSelection(element) {
    element.classList.toggle('selected');
}

function navigateToTags() {
    document.querySelector('.nav-item[data-section="tags"]').click();
}

function openTagModal(tagId = null) {
    document.getElementById('tag-modal-title').textContent = tagId ? 'Editar Tag' : 'Nova Tag';
    document.getElementById('tag-form').reset();
    document.getElementById('tag-id').value = tagId || '';

    // Color input + preview setup
    const defaultColor = '#e50914';
    const colorInput = document.getElementById('tag-color');
    const colorPreview = document.getElementById('tag-color-preview');
    const colorHex = document.getElementById('tag-color-hex');

    if (colorInput) {
        // ensure a value
        const v = colorInput.value || defaultColor;
        colorInput.value = v;
        if (colorPreview) colorPreview.style.background = v;
        if (colorHex) colorHex.value = v;

        // remove old handlers if present
        if (window._tagColorInputHandler) colorInput.removeEventListener('input', window._tagColorInputHandler);
        window._tagColorInputHandler = (e) => {
            const val = e.target.value;
            if (colorPreview) colorPreview.style.background = val;
            if (colorHex) colorHex.value = val;
        };
        colorInput.addEventListener('input', window._tagColorInputHandler);
    }

    if (colorHex) {
        if (window._tagColorHexHandler) colorHex.removeEventListener('input', window._tagColorHexHandler);
        window._tagColorHexHandler = (e) => {
            const v = e.target.value.trim();
            if (/^#([0-9A-Fa-f]{3}){1,2}$/.test(v)) {
                if (colorInput) colorInput.value = v;
                if (colorPreview) colorPreview.style.background = v;
            }
        };
        colorHex.addEventListener('input', window._tagColorHexHandler);
    }

    document.getElementById('tag-modal').classList.add('active');
}

function closeTagModal() {
    document.getElementById('tag-modal').classList.remove('active');
}

function editTag(tagId, name, color) {
    openTagModal(tagId);
    document.getElementById('tag-name').value = name;
    const colorInput = document.getElementById('tag-color');
    const colorPreview = document.getElementById('tag-color-preview');
    const colorHex = document.getElementById('tag-color-hex');
    const c = color || '#e50914';
    if (colorInput) colorInput.value = c;
    if (colorPreview) colorPreview.style.background = c;
    if (colorHex) colorHex.value = c;
}

async function handleTagForm(e) {
    e.preventDefault();
    
    const tagId = document.getElementById('tag-id').value;
    const tagData = {
        name: document.getElementById('tag-name').value,
        color: document.getElementById('tag-color').value
    };
    
    let result;
    if (tagId) {
        result = await window.firestoreModule.updateTag(tagId, tagData);
    } else {
        result = await window.firestoreModule.createTag(tagData);
    }
    
    if (result.success) {
        window.uiModule.showToast(tagId ? 'Tag atualizada!' : 'Tag criada!', 'success');
        closeTagModal();
        loadTags();
    } else {
        window.uiModule.showToast('Erro: ' + result.error, 'error');
    }
}

function confirmDeleteTag(tagId, name) {
    if (confirm(`Excluir tag "${name}"?`)) {
        deleteTag(tagId);
    }
}

async function deleteTag(tagId) {
    const result = await window.firestoreModule.deleteTag(tagId);
    if (result.success) {
        window.uiModule.showToast('Tag excluída!', 'success');
        loadTags();
    } else {
        window.uiModule.showToast('Erro: ' + result.error, 'error');
    }
}

// ============================================
// USERS
// ============================================

async function loadUsers() {
    try {
        const snapshot = await firebase.firestore().collection('users').get();
        const users = [];
        
        for (const doc of snapshot.docs) {
            const userData = { id: doc.id, ...doc.data() };
            
            // Get profile count
            const profilesSnapshot = await firebase.firestore()
                .collection('users').doc(doc.id)
                .collection('profiles').get();
            userData.profileCount = profilesSnapshot.size;
            
            users.push(userData);
        }
        
        displayUsersTable(users);
    } catch (error) {
        console.error('❌ Error loading users:', error);
    }
}

function displayUsersTable(users) {
    const tbody = document.getElementById('users-list');
    if (!tbody) return;
    
    tbody.innerHTML = users.map(user => {
        const createdDate = user.createdAt?.toDate?.() 
            ? user.createdAt.toDate().toLocaleDateString('pt-BR') 
            : '-';

        const plan = normalizeSubscription(user.subscription);
        const planClass = String(plan).toLowerCase();

        return `
            <tr>
                <td><div class="user-avatar-small"><i class="fas fa-user"></i></div></td>
                <td>${user.email || '-'}</td>
                <td>${user.profileCount || 0}</td>
                <td><span class="subscription-badge ${planClass}">${plan}</span></td>
                <td>${createdDate}</td>
                <td>
                    <button class="btn-icon" onclick="changeUserSubscription('${user.id}')" title="Alterar Plano">
                        <i class="fas fa-crown"></i>
                    </button>
                    <button class="btn-icon btn-danger" onclick="confirmDeleteUser('${user.id}', '${user.email}')" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

async function changeUserSubscription(userId) {
    const newPlan = prompt('Novo plano (FREE, BASIC ou PREMIUM):');
    if (!newPlan) return;
    
    const validPlans = ['FREE', 'BASIC', 'PREMIUM'];
    if (!validPlans.includes(newPlan.toUpperCase())) {
        window.uiModule.showToast('Plano inválido!', 'error');
        return;
    }
    
    try {
        // Store subscription as an object with `plan` to match other parts of the app
        await firebase.firestore().collection('users').doc(userId).update({
            subscription: {
                plan: newPlan.toUpperCase(),
                startDate: firebase.firestore.FieldValue.serverTimestamp(),
                endDate: null
            }
        });
        window.uiModule.showToast('Plano atualizado!', 'success');
        loadUsers();
        loadSubscriptionStats();
    } catch (error) {
        window.uiModule.showToast('Erro ao atualizar plano', 'error');
    }
}

function confirmDeleteUser(userId, email) {
    if (confirm(`Excluir usuário "${email}" e todos os seus dados?`)) {
        deleteUser(userId);
    }
}

async function deleteUser(userId) {
    try {
        // Delete profiles subcollection
        const profilesSnapshot = await firebase.firestore()
            .collection('users').doc(userId)
            .collection('profiles').get();
        
        const batch = firebase.firestore().batch();
        profilesSnapshot.forEach(doc => batch.delete(doc.ref));
        
        // Delete user document
        batch.delete(firebase.firestore().collection('users').doc(userId));
        
        await batch.commit();
        
        window.uiModule.showToast('Usuário excluído!', 'success');
        loadUsers();
    } catch (error) {
        console.error('❌ Error deleting user:', error);
        window.uiModule.showToast('Erro ao excluir usuário', 'error');
    }
}

// ============================================
// SUBSCRIPTIONS
// ============================================

async function loadSubscriptionStats() {
    try {
        const snapshot = await firebase.firestore().collection('users').get();
        
        let freeCount = 0, basicCount = 0, premiumCount = 0;
        
        snapshot.forEach(doc => {
            const sub = normalizeSubscription(doc.data().subscription);
            if (sub === 'FREE') freeCount++;
            else if (sub === 'BASIC') basicCount++;
            else if (sub === 'PREMIUM') premiumCount++;
        });
        
        document.getElementById('free-users-count').textContent = freeCount;
        document.getElementById('basic-users-count').textContent = basicCount;
        document.getElementById('premium-users-count').textContent = premiumCount;
        
    } catch (error) {
        console.error('❌ Error loading subscription stats:', error);
    }
}

// ============================================
// COMMENTS
// ============================================

async function loadComments() {
    try {
        const filter = document.getElementById('filter-comments')?.value || 'pending';
        const comments = await window.firestoreModule.getAllComments();
        
        let filtered = comments;
        if (filter === 'pending') {
            filtered = comments.filter(c => !c.approved);
        } else if (filter === 'approved') {
            filtered = comments.filter(c => c.approved);
        }
        
        displayCommentsList(filtered);
    } catch (error) {
        console.error('❌ Error loading comments:', error);
    }
}

function displayCommentsList(comments) {
    const container = document.getElementById('comments-list');
    if (!container) return;
    
    if (comments.length === 0) {
        container.innerHTML = '<p class="empty-message">Nenhum comentário encontrado.</p>';
        return;
    }
    
    container.innerHTML = comments.map(comment => `
        <div class="comment-card ${comment.approved ? 'approved' : 'pending'}">
            <div class="comment-header">
                <span class="comment-user">${comment.userName || 'Anônimo'}</span>
                <span class="comment-status ${comment.approved ? 'approved' : 'pending'}">
                    ${comment.approved ? 'Aprovado' : 'Pendente'}
                </span>
            </div>
            <p class="comment-content">${comment.content}</p>
            <div class="comment-footer">
                <span class="comment-video">Vídeo: ${comment.videoTitle || comment.videoId}</span>
                <div class="comment-actions">
                    ${!comment.approved ? `
                        <button class="btn-approve" onclick="approveComment('${comment.id}')">
                            <i class="fas fa-check"></i> Aprovar
                        </button>
                    ` : ''}
                    <button class="btn-delete" onclick="confirmDeleteComment('${comment.id}')">
                        <i class="fas fa-trash"></i> Excluir
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

async function approveComment(commentId) {
    const result = await window.firestoreModule.approveComment(commentId);
    if (result.success) {
        window.uiModule.showToast('Comentário aprovado!', 'success');
        loadComments();
    } else {
        window.uiModule.showToast('Erro ao aprovar', 'error');
    }
}

function confirmDeleteComment(commentId) {
    if (confirm('Excluir este comentário?')) {
        deleteComment(commentId);
    }
}

async function deleteComment(commentId) {
    const result = await window.firestoreModule.deleteComment(commentId);
    if (result.success) {
        window.uiModule.showToast('Comentário excluído!', 'success');
        loadComments();
    } else {
        window.uiModule.showToast('Erro ao excluir', 'error');
    }
}

// ============================================
// UPLOAD FORM
// ============================================

async function populateUploadForm() {
    // Populate tags selector
    populateTagsSelector('upload-tags-selector');
    
    // Sempre carregar séries do Firestore para garantir lista atualizada
    try {
        const series = await window.firestoreModule.getAllSeries();
        allSeries = series; // atualiza cache global também
    } catch (err) {
        console.warn('Erro ao carregar séries para upload:', err);
    }
    
    // Populate series selector
    const seriesSelect = document.getElementById('upload-series-id');
    if (seriesSelect) {
        seriesSelect.innerHTML = '<option value="">Selecione a série</option>';
        allSeries.forEach(s => {
            seriesSelect.innerHTML += `<option value="${s.id}">${s.title}</option>`;
        });
    }
}

function toggleEpisodeFields() {
    const contentType = document.getElementById('upload-content-type').value;
    const isEpisode = contentType === 'EPISODE';
    
    document.getElementById('series-select-group').style.display = isEpisode ? 'block' : 'none';
    document.querySelectorAll('.episode-fields').forEach(el => {
        el.style.display = isEpisode ? 'flex' : 'none';
    });
}

async function handleUploadForm(e) {
    e.preventDefault();
    const contentType = document.getElementById('upload-content-type').value;
    const selectedTags = Array.from(document.querySelectorAll('#upload-tags-selector .tag-option.selected'))
        .map(el => el.dataset.tag);

    // Files
    const videoFile = document.getElementById('upload-video-file')?.files?.[0] || null;
    const thumbFile = document.getElementById('upload-thumbnail-file')?.files?.[0] || null;
    const bannerFile = document.getElementById('upload-banner-file')?.files?.[0] || null;

    // Fallback inputs
    const hlsUrlInput = document.getElementById('hls-url').value.trim();
    const thumbnailUrlInput = document.getElementById('upload-thumbnail').value.trim();

    try {
        showLoading();

        // Determine duration (in seconds) and minutes
        let durationSeconds = 0;
        let durationMinutes = 0;

        if (videoFile) {
            durationSeconds = await getVideoDurationFromFile(videoFile);
            durationMinutes = Math.ceil(durationSeconds / 60);
            // populate duration input for admin convenience
            document.getElementById('upload-duration').value = durationMinutes;
        } else if (hlsUrlInput) {
            // We cannot reliably compute duration for remote HLS from client without loading manifest; leave as 0
            durationSeconds = 0;
            durationMinutes = parseInt(document.getElementById('upload-duration').value) || 0;
        }

        // Upload assets to Firebase Storage if files provided
        const uploads = {};
        const now = Date.now();

        if (thumbFile) {
            const thumbPath = `uploads/images/thumb_${now}_${thumbFile.name}`;
            uploads.thumbnailUrl = await uploadFileToStorage(thumbFile, thumbPath);
        } else if (thumbnailUrlInput) {
            uploads.thumbnailUrl = thumbnailUrlInput;
        }

        if (bannerFile) {
            const bannerPath = `uploads/images/banner_${now}_${bannerFile.name}`;
            uploads.bannerUrl = await uploadFileToStorage(bannerFile, bannerPath);
        }

        let finalVideoUrl = hlsUrlInput || '';
        let awaitingTranscode = false;

        if (videoFile) {
            // Upload original video file and create a transcode job in Firestore so a Cloud Function can convert to HLS
            const videoPath = `uploads/videos/original_${now}_${videoFile.name}`;
            const uploadedUrl = await uploadFileToStorage(videoFile, videoPath);
            // create transcode job in Firestore so backend/cloud function can convert to HLS
            const jobRef = await firebase.firestore().collection('transcode_jobs').add({
                storagePath: videoPath,
                outputPrefix: `hls/videos/${now}_${videoFile.name}`,
                status: 'pending',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                createdBy: (firebase.auth().currentUser && firebase.auth().currentUser.uid) || null
            });
            awaitingTranscode = true;
            finalVideoUrl = uploadedUrl; // temporary URL until HLS is available
        }

        // Build data object
        const baseData = {
            title: document.getElementById('upload-title').value,
            description: document.getElementById('upload-description').value,
            videoUrl: finalVideoUrl,
            thumbnailUrl: uploads.thumbnailUrl || thumbnailUrlInput || '',
            bannerUrl: uploads.bannerUrl || '',
            duration: Math.floor(durationSeconds), // seconds (used by player/progress)
            durationMinutes: durationMinutes, // convenience for displays
            tags: selectedTags,
            subscriptionLevel: document.getElementById('upload-subscription-level').value,
            hlsPending: awaitingTranscode
        };

        let result;
        let videoDocPath = null;

        if (contentType === 'EPISODE') {
            const episodeData = {
                ...baseData,
                seriesId: document.getElementById('upload-series-id').value,
                season: parseInt(document.getElementById('upload-season').value) || 1,
                episodeNumber: parseInt(document.getElementById('upload-episode').value) || 1,
                type: 'EPISODE'
            };
            result = await window.firestoreModule.addEpisode(episodeData);
            if (result.success && result.id) {
                videoDocPath = `episodes/${result.id}`;
            }
        } else {
            const movieData = {
                ...baseData,
                type: 'MOVIE'
            };
            result = await window.firestoreModule.addMovie(movieData);
            if (result.success && result.id) {
                videoDocPath = `movies/${result.id}`;
            }
        }

        // If we have a transcode job pending and got the video doc path, update the job
        if (awaitingTranscode && videoDocPath) {
            // Find and update the most recent pending job created by this user
            try {
                const user = firebase.auth().currentUser;
                const jobsQuery = await firebase.firestore().collection('transcode_jobs')
                    .where('createdBy', '==', user.uid)
                    .where('status', '==', 'pending')
                    .orderBy('createdAt', 'desc')
                    .limit(1)
                    .get();
                
                if (!jobsQuery.empty) {
                    await jobsQuery.docs[0].ref.update({
                        videoDocPath: videoDocPath,
                        videoCollection: contentType === 'EPISODE' ? 'episodes' : 'movies',
                        videoDocId: result.id
                    });
                }
            } catch (jobErr) {
                console.warn('Could not update transcode job with videoDocPath:', jobErr);
            }
        }

        hideLoading();

        if (result.success) {
            window.uiModule.showToast('Conteúdo adicionado com sucesso!' + (awaitingTranscode ? ' O vídeo será processado em breve.' : ''), 'success');
            document.getElementById('upload-form').reset();
            loadMovies();
            loadSeries();
        } else {
            window.uiModule.showToast('Erro: ' + result.error, 'error');
        }

    } catch (error) {
        hideLoading();
        console.error('❌ Error during upload flow:', error);
        window.uiModule.showToast('Erro no upload: ' + error.message, 'error');
    }
}


// Upload a File object to Firebase Storage and return downloadURL
async function uploadFileToStorage(file, path) {
    try {
        const ref = firebase.storage().ref().child(path);
        const snapshot = await ref.put(file);
        const url = await snapshot.ref.getDownloadURL();
        return url;
    } catch (error) {
        console.error('❌ Error uploading file to storage:', error);
        throw error;
    }
}

// Get video duration (seconds) from a File using a temporary video element
function getVideoDurationFromFile(file) {
    return new Promise((resolve, reject) => {
        try {
            const url = URL.createObjectURL(file);
            const video = document.createElement('video');
            video.preload = 'metadata';
            video.src = url;
            // Some browsers require adding to DOM; try without first
            video.addEventListener('loadedmetadata', function () {
                const duration = video.duration || 0;
                URL.revokeObjectURL(url);
                resolve(Math.floor(duration));
            });
            video.addEventListener('error', function (e) {
                URL.revokeObjectURL(url);
                reject(new Error('Não foi possível ler metadados do vídeo'));
            });
        } catch (err) {
            reject(err);
        }
    });
}

// ============================================
// SEARCH
// ============================================

function setupSearch() {
    // Movies search
    document.getElementById('search-movies')?.addEventListener('input', async (e) => {
        const query = e.target.value.toLowerCase();
        const movies = await window.firestoreModule.getAllMovies();
        const filtered = movies.filter(m => m.title.toLowerCase().includes(query));
        displayMoviesTable(filtered);
    });
    
    // Series search
    document.getElementById('search-series')?.addEventListener('input', async (e) => {
        const query = e.target.value.toLowerCase();
        const filtered = allSeries.filter(s => s.title.toLowerCase().includes(query));
        displaySeriesTable(filtered);
    });
    
    // Users search
    document.getElementById('search-users')?.addEventListener('input', async (e) => {
        const query = e.target.value.toLowerCase();
        loadUsers(); // Reload with filter
    });
    
    // Comments filter
    document.getElementById('filter-comments')?.addEventListener('change', () => {
        loadComments();
    });
    
    // Subscription filter
    document.getElementById('filter-subscription')?.addEventListener('change', async (e) => {
        const filter = e.target.value;
        const snapshot = await firebase.firestore().collection('users').get();
        const users = [];

        for (const doc of snapshot.docs) {
            const userData = { id: doc.id, ...doc.data() };
            const userPlan = normalizeSubscription(userData.subscription);
            if (!filter || userPlan === filter || (!userData.subscription && filter === 'FREE')) {
                const profilesSnapshot = await firebase.firestore()
                    .collection('users').doc(doc.id)
                    .collection('profiles').get();
                userData.profileCount = profilesSnapshot.size;
                users.push(userData);
            }
        }

        displayUsersTable(users);
    });
}

// ============================================
// FORMS SETUP
// ============================================

function setupForms() {
    document.getElementById('movie-form')?.addEventListener('submit', handleMovieForm);
    document.getElementById('series-form')?.addEventListener('submit', handleSeriesForm);
    document.getElementById('episode-form')?.addEventListener('submit', handleEpisodeForm);
    document.getElementById('tag-form')?.addEventListener('submit', handleTagForm);
    document.getElementById('upload-form')?.addEventListener('submit', handleUploadForm);
}

// ============================================
// GLOBAL FUNCTIONS (for onclick)
// ============================================

window.openMovieModal = openMovieModal;
window.closeMovieModal = closeMovieModal;
window.editMovie = editMovie;
window.confirmDeleteMovie = confirmDeleteMovie;

window.openSeriesModal = openSeriesModal;
window.closeSeriesModal = closeSeriesModal;
window.editSeries = editSeries;
window.confirmDeleteSeries = confirmDeleteSeries;

window.openEpisodesModal = openEpisodesModal;
window.closeEpisodesModal = closeEpisodesModal;
window.openEpisodeForm = openEpisodeForm;
window.closeEpisodeForm = closeEpisodeForm;
window.editEpisode = editEpisode;
window.confirmDeleteEpisode = confirmDeleteEpisode;
window.filterEpisodesBySeason = filterEpisodesBySeason;

window.openTagModal = openTagModal;
window.closeTagModal = closeTagModal;
window.editTag = editTag;
window.confirmDeleteTag = confirmDeleteTag;
window.toggleTagSelection = toggleTagSelection;
window.navigateToTags = navigateToTags;

window.changeUserSubscription = changeUserSubscription;
window.confirmDeleteUser = confirmDeleteUser;

window.approveComment = approveComment;
window.confirmDeleteComment = confirmDeleteComment;

window.toggleEpisodeFields = toggleEpisodeFields;
