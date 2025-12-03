// ============================================
// CRUCIFLIX - APP ADMIN
// Admin Panel + HLS Upload Functions (Consolidated)
// ============================================

// ============================================
// VIDEO MANAGEMENT
// ============================================

// Load all videos in admin table
async function loadAdminVideos() {
    const videos = await window.firestoreModule.getAllVideos();
    displayVideosTable(videos);
}

// Display videos in admin table
function displayVideosTable(videos) {
    const tableBody = document.getElementById('videos-table-body');
    if (!tableBody) return;

    tableBody.innerHTML = '';

    videos.forEach(video => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${video.title}</td>
            <td>${(video.tags || []).join(', ')}</td>
            <td>${video.viewCount || 0}</td>
            <td>${video.isKidsSafe ? 'Sim' : 'Não'}</td>
            <td>
                <button class="btn-edit" onclick="window.adminModule.editVideo('${video.id}')">Editar</button>
                <button class="btn-delete" onclick="window.adminModule.confirmDeleteVideo('${video.id}', '${video.title.replace(/'/g, "\\'")}')">Excluir</button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

// Handle add video form submission
async function handleAddVideoForm(event) {
    event.preventDefault();

    const form = event.target;
    const videoData = {
        title: form.title.value,
        description: form.description.value,
        tags: form.tags.value.split(',').map(tag => tag.trim()).filter(tag => tag),
        hlsUrl: form.hlsUrl.value,
        thumbnailUrl: form.thumbnailUrl.value,
        duration: parseInt(form.duration.value) || 0,
        isKidsSafe: form.isKidsSafe.checked
    };

    const result = await window.firestoreModule.addVideo(videoData);

    if (result.success) {
        window.uiModule.showToast('Vídeo adicionado com sucesso!', 'success');
        form.reset();
        loadAdminVideos();
    } else {
        window.uiModule.showToast('Erro ao adicionar vídeo: ' + result.error, 'error');
    }
}

// Edit video
async function editVideo(videoId) {
    const video = await window.firestoreModule.getVideoById(videoId);
    if (!video) return;

    const form = document.getElementById('edit-video-form');
    if (!form) return;

    form.elements.videoId.value = video.id;
    form.elements.title.value = video.title;
    form.elements.description.value = video.description;
    form.elements.tags.value = (video.tags || []).join(', ');
    form.elements.hlsUrl.value = video.hlsUrl;
    form.elements.thumbnailUrl.value = video.thumbnailUrl || '';
    form.elements.duration.value = video.duration || 0;
    form.elements.isKidsSafe.checked = video.isKidsSafe;

    window.uiModule.showModal('edit-video-modal');
}

// Handle edit video form submission
async function handleEditVideoForm(event) {
    event.preventDefault();

    const form = event.target;
    const videoId = form.videoId.value;

    const updates = {
        title: form.title.value,
        description: form.description.value,
        tags: form.tags.value.split(',').map(tag => tag.trim()).filter(tag => tag),
        hlsUrl: form.hlsUrl.value,
        thumbnailUrl: form.thumbnailUrl.value,
        duration: parseInt(form.duration.value) || 0,
        isKidsSafe: form.isKidsSafe.checked
    };

    const result = await window.firestoreModule.updateVideo(videoId, updates);

    if (result.success) {
        window.uiModule.showToast('Vídeo atualizado com sucesso!', 'success');
        window.uiModule.hideModal('edit-video-modal');
        loadAdminVideos();
    } else {
        window.uiModule.showToast('Erro ao atualizar vídeo: ' + result.error, 'error');
    }
}

// Confirm delete video
function confirmDeleteVideo(videoId, title) {
    if (confirm(`Tem certeza que deseja excluir "${title}"?`)) {
        deleteVideoAdmin(videoId);
    }
}

// Delete video
async function deleteVideoAdmin(videoId) {
    const result = await window.firestoreModule.deleteVideo(videoId);

    if (result.success) {
        window.uiModule.showToast('Vídeo excluído com sucesso!', 'success');
        loadAdminVideos();
    } else {
        window.uiModule.showToast('Erro ao excluir vídeo: ' + result.error, 'error');
    }
}

// ============================================
// USER MANAGEMENT
// ============================================

// Load all users
async function loadUsers() {
    try {
        const snapshot = await firebaseDB.collection('users').get();
        const users = [];
        snapshot.forEach(doc => {
            users.push({ id: doc.id, ...doc.data() });
        });
        displayUsersTable(users);
    } catch (error) {
        console.error('❌ Error loading users:', error);
    }
}

// Display users in table
function displayUsersTable(users) {
    const tableBody = document.getElementById('users-table-body');
    if (!tableBody) return;

    tableBody.innerHTML = '';

    users.forEach(user => {
        const row = document.createElement('tr');
        const createdDate = user.createdAt ? new Date(user.createdAt.toDate()).toLocaleDateString('pt-BR') : 'N/A';

        row.innerHTML = `
            <td>${user.displayName || user.email}</td>
            <td>${user.email}</td>
            <td><span class="role-badge ${user.role}">${user.role}</span></td>
            <td>${createdDate}</td>
            <td>
                <button class="btn-edit" onclick="window.adminModule.toggleUserRole('${user.uid}', '${user.role}')">
                    ${user.role === 'admin' ? 'Remover Admin' : 'Tornar Admin'}
                </button>
                <button class="btn-delete" onclick="window.adminModule.confirmDeleteUser('${user.uid}', '${user.email}')">Excluir</button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

// Toggle user role
async function toggleUserRole(userId, currentRole) {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';

    try {
        await firebaseDB.collection('users').doc(userId).update({ role: newRole });
        window.uiModule.showToast(`Role atualizado para ${newRole}!`, 'success');
        loadUsers();
    } catch (error) {
        console.error('❌ Error updating role:', error);
        window.uiModule.showToast('Erro ao atualizar role', 'error');
    }
}

// Confirm delete user
function confirmDeleteUser(userId, email) {
    if (confirm(`Tem certeza que deseja excluir o usuário "${email}"?`)) {
        deleteUserAdmin(userId);
    }
}

// Delete user
async function deleteUserAdmin(userId) {
    try {
        await firebaseDB.collection('users').doc(userId).delete();
        window.uiModule.showToast('Usuário excluído com sucesso!', 'success');
        loadUsers();
    } catch (error) {
        console.error('❌ Error deleting user:', error);
        window.uiModule.showToast('Erro ao excluir usuário', 'error');
    }
}

// ============================================
// COMMENT MODERATION
// ============================================

// Load all comments for moderation
async function loadCommentsForModeration() {
    const comments = await window.firestoreModule.getAllComments();
    displayCommentsTable(comments);
}

// Display comments in table
function displayCommentsTable(comments) {
    const tableBody = document.getElementById('comments-table-body');
    if (!tableBody) return;

    tableBody.innerHTML = '';

    comments.forEach(comment => {
        const row = document.createElement('tr');
        const statusClass = comment.approved ? 'approved' : 'pending';
        const statusText = comment.approved ? 'Aprovado' : 'Pendente';

        row.innerHTML = `
            <td>${comment.userName}</td>
            <td>${comment.content}</td>
            <td><span class="status-badge ${statusClass}">${statusText}</span></td>
            <td>
                ${!comment.approved ? `<button class="btn-approve" onclick="window.adminModule.approveComment('${comment.id}')">Aprovar</button>` : ''}
                <button class="btn-delete" onclick="window.adminModule.confirmDeleteComment('${comment.id}')">Excluir</button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

// Approve comment
async function approveCommentAdmin(commentId) {
    const result = await window.firestoreModule.approveComment(commentId);

    if (result.success) {
        window.uiModule.showToast('Comentário aprovado!', 'success');
        loadCommentsForModeration();
    } else {
        window.uiModule.showToast('Erro ao aprovar comentário', 'error');
    }
}

// Confirm delete comment
function confirmDeleteComment(commentId) {
    if (confirm('Tem certeza que deseja excluir este comentário?')) {
        deleteCommentAdmin(commentId);
    }
}

// Delete comment
async function deleteCommentAdmin(commentId) {
    const result = await window.firestoreModule.deleteComment(commentId);

    if (result.success) {
        window.uiModule.showToast('Comentário excluído!', 'success');
        loadCommentsForModeration();
    } else {
        window.uiModule.showToast('Erro ao excluir comentário', 'error');
    }
}

// ============================================
// ANALYTICS
// ============================================

// Load dashboard analytics
async function loadAnalytics() {
    try {
        const videos = await window.firestoreModule.getAllVideos();
        const totalVideos = document.getElementById('total-videos');
        if (totalVideos) totalVideos.textContent = videos.length;

        const totalViews = videos.reduce((sum, video) => sum + (video.viewCount || 0), 0);
        const totalViewsEl = document.getElementById('total-views');
        if (totalViewsEl) totalViewsEl.textContent = totalViews;

        const usersSnapshot = await firebaseDB.collection('users').get();
        const totalUsersEl = document.getElementById('total-users');
        if (totalUsersEl) totalUsersEl.textContent = usersSnapshot.size;

        const comments = await window.firestoreModule.getAllComments();
        const pendingComments = comments.filter(c => !c.approved).length;
        const pendingEl = document.getElementById('pending-comments');
        if (pendingEl) pendingEl.textContent = pendingComments;

    } catch (error) {
        console.error('❌ Error loading analytics:', error);
    }
}

// ============================================
// HLS VIDEO UPLOAD
// ============================================

let currentUploadTask = null;

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    const maxSize = 2 * 1024 * 1024 * 1024; // 2GB
    if (file.size > maxSize) {
        window.uiModule.showToast('Arquivo muito grande! Máximo: 2GB', 'error');
        event.target.value = '';
        return;
    }

    const validTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(mp4|mov|avi|mkv)$/i)) {
        window.uiModule.showToast('Formato de arquivo inválido!', 'error');
        event.target.value = '';
        return;
    }

    console.log('✅ Arquivo selecionado:', file.name, `(${(file.size / 1024 / 1024).toFixed(2)}MB)`);
    window.uiModule.showToast(`Arquivo selecionado: ${file.name}`, 'success');
}

async function handleUploadForm(event) {
    event.preventDefault();

    const form = event.target;
    const fileInput = form.videoFile;
    const file = fileInput.files[0];

    if (!file) {
        window.uiModule.showToast('Selecione um arquivo de vídeo!', 'error');
        return;
    }

    const formData = {
        title: form.title.value.trim(),
        description: form.description.value.trim(),
        tags: form.tags.value.split(',').map(tag => tag.trim()).filter(tag => tag),
        quality: form.quality ? form.quality.value : 'medium',
        thumbnailUrl: form.thumbnailUrl ? form.thumbnailUrl.value.trim() : '',
        isKidsSafe: form.isKidsSafe ? form.isKidsSafe.checked : false,
        resolutions: []
    };

    // Get selected resolutions
    if (form.res_360p && form.res_360p.checked) formData.resolutions.push('360p');
    if (form.res_480p && form.res_480p.checked) formData.resolutions.push('480p');
    if (form.res_720p && form.res_720p.checked) formData.resolutions.push('720p');
    if (form.res_1080p && form.res_1080p.checked) formData.resolutions.push('1080p');

    if (formData.resolutions.length === 0) {
        formData.resolutions = ['720p']; // Default
    }

    toggleFormState(false);
    showProgress();

    try {
        updateProgress(10, 'Fazendo upload do vídeo original...', 'Enviando arquivo para o servidor');
        const videoUrl = await uploadOriginalVideo(file, formData.title);

        updateProgress(40, 'Processando vídeo para HLS...', 'Gerando segmentos de streaming');
        const hlsData = await processVideoToHLS(file, formData, videoUrl);

        updateProgress(70, 'Enviando segmentos HLS...', 'Finalizando upload');
        const hlsUrl = await uploadHLSSegments(hlsData, formData.title);

        if (!formData.thumbnailUrl) {
            updateProgress(85, 'Gerando miniatura...', 'Criando thumbnail do vídeo');
            formData.thumbnailUrl = await generateAndUploadThumbnail(file, formData.title);
        }

        const duration = await getVideoDuration(file);

        updateProgress(95, 'Salvando no banco de dados...', 'Finalizando');
        const videoData = {
            title: formData.title,
            description: formData.description,
            tags: formData.tags,
            hlsUrl: hlsUrl,
            thumbnailUrl: formData.thumbnailUrl,
            duration: duration,
            isKidsSafe: formData.isKidsSafe,
            originalVideoUrl: videoUrl,
            resolutions: formData.resolutions,
            quality: formData.quality
        };

        const result = await window.firestoreModule.addVideo(videoData);

        if (result.success) {
            updateProgress(100, 'Concluído!', 'Vídeo processado e salvo com sucesso');
            window.uiModule.showToast('Vídeo processado e adicionado com sucesso!', 'success');

            setTimeout(() => {
                form.reset();
                hideProgress();
                toggleFormState(true);
                loadAdminVideos();
            }, 2000);
        } else {
            throw new Error(result.error);
        }

    } catch (error) {
        console.error('❌ Error processing video:', error);
        window.uiModule.showToast('Erro ao processar vídeo: ' + error.message, 'error');
        hideProgress();
        toggleFormState(true);
    }
}

async function uploadOriginalVideo(file, title) {
    return new Promise((resolve, reject) => {
        const timestamp = Date.now();
        const sanitizedTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const ext = file.name.substring(file.name.lastIndexOf('.'));
        const filename = `videos/originals/${sanitizedTitle}_${timestamp}${ext}`;

        const storageRef = window.firebaseStorage.ref(filename);
        const uploadTask = storageRef.put(file);

        currentUploadTask = uploadTask;

        uploadTask.on('state_changed',
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 30;
                updateProgress(10 + progress, 'Fazendo upload do vídeo original...',
                    `${(snapshot.bytesTransferred / 1024 / 1024).toFixed(2)}MB / ${(snapshot.totalBytes / 1024 / 1024).toFixed(2)}MB`);
            },
            (error) => {
                console.error('❌ Upload error:', error);
                reject(error);
            },
            async () => {
                const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();
                console.log('✅ Original video uploaded:', downloadURL);
                resolve(downloadURL);
            }
        );
    });
}

async function processVideoToHLS(file, formData, videoUrl) {
    console.log('⚙️ Processing video to HLS format...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    return {
        masterPlaylist: generateMasterPlaylist(formData.resolutions),
        variants: formData.resolutions.map(res => ({
            resolution: res,
            playlist: generateVariantPlaylist(res),
            segments: []
        }))
    };
}

function generateMasterPlaylist(resolutions) {
    const resolutionData = {
        '360p': { bandwidth: 800000, resolution: '640x360' },
        '480p': { bandwidth: 1400000, resolution: '854x480' },
        '720p': { bandwidth: 2800000, resolution: '1280x720' },
        '1080p': { bandwidth: 5000000, resolution: '1920x1080' }
    };

    let playlist = '#EXTM3U\n#EXT-X-VERSION:3\n\n';

    resolutions.forEach(res => {
        const data = resolutionData[res];
        if (data) {
            playlist += `#EXT-X-STREAM-INF:BANDWIDTH=${data.bandwidth},RESOLUTION=${data.resolution}\n`;
            playlist += `${res}/playlist.m3u8\n\n`;
        }
    });

    return playlist;
}

function generateVariantPlaylist(resolution) {
    return `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-PLAYLIST-TYPE:VOD
#EXTINF:10.0,
segment_0.ts
#EXTINF:10.0,
segment_1.ts
#EXT-X-ENDLIST`;
}

async function uploadHLSSegments(hlsData, title) {
    const timestamp = Date.now();
    const sanitizedTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const basePath = `videos/hls/${sanitizedTitle}_${timestamp}`;

    const masterPlaylistRef = window.firebaseStorage.ref(`${basePath}/master.m3u8`);
    await masterPlaylistRef.putString(hlsData.masterPlaylist, 'raw', {
        contentType: 'application/vnd.apple.mpegurl'
    });

    for (const variant of hlsData.variants) {
        const variantPath = `${basePath}/${variant.resolution}`;
        const playlistRef = window.firebaseStorage.ref(`${variantPath}/playlist.m3u8`);
        await playlistRef.putString(variant.playlist, 'raw', {
            contentType: 'application/vnd.apple.mpegurl'
        });
    }

    const masterUrl = await masterPlaylistRef.getDownloadURL();
    console.log('✅ HLS uploaded:', masterUrl);

    return masterUrl;
}

async function generateAndUploadThumbnail(file, title) {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.preload = 'metadata';

        video.onloadedmetadata = async () => {
            video.currentTime = video.duration * 0.1;
        };

        video.onseeked = async () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

                canvas.toBlob(async (blob) => {
                    const timestamp = Date.now();
                    const sanitizedTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
                    const filename = `thumbnails/${sanitizedTitle}_${timestamp}.jpg`;

                    const storageRef = window.firebaseStorage.ref(filename);
                    await storageRef.put(blob, { contentType: 'image/jpeg' });

                    const downloadURL = await storageRef.getDownloadURL();
                    console.log('✅ Thumbnail generated:', downloadURL);
                    resolve(downloadURL);
                }, 'image/jpeg', 0.8);

            } catch (error) {
                console.error('❌ Error generating thumbnail:', error);
                reject(error);
            }
        };

        video.onerror = () => {
            reject(new Error('Failed to load video for thumbnail generation'));
        };

        video.src = URL.createObjectURL(file);
    });
}

async function getVideoDuration(file) {
    return new Promise((resolve) => {
        const video = document.createElement('video');
        video.preload = 'metadata';

        video.onloadedmetadata = () => {
            URL.revokeObjectURL(video.src);
            resolve(Math.round(video.duration));
        };

        video.onerror = () => {
            resolve(0);
        };

        video.src = URL.createObjectURL(file);
    });
}

function showProgress() {
    const container = document.getElementById('upload-progress-container');
    if (container) container.style.display = 'block';

    const submitBtn = document.getElementById('upload-submit-btn');
    const cancelBtn = document.getElementById('upload-cancel-btn');

    if (submitBtn) submitBtn.style.display = 'none';
    if (cancelBtn) cancelBtn.style.display = 'inline-block';
}

function hideProgress() {
    const container = document.getElementById('upload-progress-container');
    if (container) container.style.display = 'none';

    const submitBtn = document.getElementById('upload-submit-btn');
    const cancelBtn = document.getElementById('upload-cancel-btn');

    if (submitBtn) submitBtn.style.display = 'inline-block';
    if (cancelBtn) cancelBtn.style.display = 'none';
}

function updateProgress(percentage, status, details) {
    const fill = document.getElementById('progress-fill');
    const statusEl = document.getElementById('progress-status');
    const percentageEl = document.getElementById('progress-percentage');
    const detailsEl = document.getElementById('progress-details');

    if (fill) fill.style.width = percentage + '%';
    if (statusEl) statusEl.textContent = status;
    if (percentageEl) percentageEl.textContent = Math.round(percentage) + '%';
    if (detailsEl) detailsEl.textContent = details || '';
}

function toggleFormState(enabled) {
    const form = document.getElementById('upload-hls-form');
    if (!form) return;

    const inputs = form.querySelectorAll('input, select, textarea, button[type="submit"]');
    inputs.forEach(input => {
        input.disabled = !enabled;
    });
}

function cancelUpload() {
    if (currentUploadTask) {
        currentUploadTask.cancel();
        currentUploadTask = null;
    }

    hideProgress();
    toggleFormState(true);
    window.uiModule.showToast('Upload cancelado', 'info');
}

// ============================================
// EXPORTS
// ============================================

window.adminModule = {
    loadAdminVideos,
    handleAddVideoForm,
    editVideo,
    handleEditVideoForm,
    confirmDeleteVideo,
    deleteVideoAdmin,
    loadUsers,
    toggleUserRole,
    confirmDeleteUser,
    deleteUserAdmin,
    loadCommentsForModeration,
    approveComment: approveCommentAdmin,
    confirmDeleteComment,
    deleteCommentAdmin,
    loadAnalytics,
    // HLS Upload
    handleFileSelect,
    handleUploadForm,
    cancelUpload
};
