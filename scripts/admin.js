// Admin Panel Functions for Cruciflix
// Handles admin-specific operations for content and user management

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
      <td>${video.tags.join(', ')}</td>
      <td>${video.viewCount || 0}</td>
      <td>${video.isKidsSafe ? 'Sim' : 'Não'}</td>
      <td>
        <button class="btn-edit" onclick="editVideo('${video.id}')">Editar</button>
        <button class="btn-delete" onclick="confirmDeleteVideo('${video.id}', '${video.title}')">Excluir</button>
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
        showToast('Vídeo adicionado com sucesso!', 'success');
        form.reset();
        loadAdminVideos();
    } else {
        showToast('Erro ao adicionar vídeo: ' + result.error, 'error');
    }
}

// Edit video
async function editVideo(videoId) {
    const video = await window.firestoreModule.getVideoById(videoId);
    if (!video) return;

    // Populate edit form
    const form = document.getElementById('edit-video-form');
    if (!form) return;

    form.elements.videoId.value = video.id;
    form.elements.title.value = video.title;
    form.elements.description.value = video.description;
    form.elements.tags.value = video.tags.join(', ');
    form.elements.hlsUrl.value = video.hlsUrl;
    form.elements.thumbnailUrl.value = video.thumbnailUrl || '';
    form.elements.duration.value = video.duration || 0;
    form.elements.isKidsSafe.checked = video.isKidsSafe;

    // Show modal
    showModal('edit-video-modal');
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
        showToast('Vídeo atualizado com sucesso!', 'success');
        hideModal('edit-video-modal');
        loadAdminVideos();
    } else {
        showToast('Erro ao atualizar vídeo: ' + result.error, 'error');
    }
}

// Confirm delete video
function confirmDeleteVideo(videoId, title) {
    if (confirm(`Tem certeza que deseja excluir "${title}"?`)) {
        deleteVideo(videoId);
    }
}

// Delete video
async function deleteVideo(videoId) {
    const result = await window.firestoreModule.deleteVideo(videoId);

    if (result.success) {
        showToast('Vídeo excluído com sucesso!', 'success');
        loadAdminVideos();
    } else {
        showToast('Erro ao excluir vídeo: ' + result.error, 'error');
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
        <button class="btn-edit" onclick="toggleUserRole('${user.uid}', '${user.role}')">
          ${user.role === 'admin' ? 'Remover Admin' : 'Tornar Admin'}
        </button>
        <button class="btn-delete" onclick="confirmDeleteUser('${user.uid}', '${user.email}')">Excluir</button>
      </td>
    `;
        tableBody.appendChild(row);
    });
}

// Toggle user role
async function toggleUserRole(userId, currentRole) {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';

    try {
        await firebaseDB.collection('users').doc(userId).update({
            role: newRole
        });

        showToast(`Role atualizado para ${newRole}!`, 'success');
        loadUsers();
    } catch (error) {
        console.error('❌ Error updating role:', error);
        showToast('Erro ao atualizar role', 'error');
    }
}

// Confirm delete user
function confirmDeleteUser(userId, email) {
    if (confirm(`Tem certeza que deseja excluir o usuário "${email}"?`)) {
        deleteUser(userId);
    }
}

// Delete user
async function deleteUser(userId) {
    try {
        await firebaseDB.collection('users').doc(userId).delete();
        showToast('Usuário excluído com sucesso!', 'success');
        loadUsers();
    } catch (error) {
        console.error('❌ Error deleting user:', error);
        showToast('Erro ao excluir usuário', 'error');
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
        ${!comment.approved ? `<button class="btn-approve" onclick="approveComment('${comment.id}')">Aprovar</button>` : ''}
        <button class="btn-delete" onclick="confirmDeleteComment('${comment.id}')">Excluir</button>
      </td>
    `;
        tableBody.appendChild(row);
    });
}

// Approve comment
async function approveComment(commentId) {
    const result = await window.firestoreModule.approveComment(commentId);

    if (result.success) {
        showToast('Comentário aprovado!', 'success');
        loadCommentsForModeration();
    } else {
        showToast('Erro ao aprovar comentário', 'error');
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
        showToast('Comentário excluído!', 'success');
        loadCommentsForModeration();
    } else {
        showToast('Erro ao excluir comentário', 'error');
    }
}

// ============================================
// ANALYTICS
// ============================================

// Load dashboard analytics
async function loadAnalytics() {
    try {
        // Total videos
        const videos = await window.firestoreModule.getAllVideos();
        document.getElementById('total-videos').textContent = videos.length;

        // Total views
        const totalViews = videos.reduce((sum, video) => sum + (video.viewCount || 0), 0);
        document.getElementById('total-views').textContent = totalViews;

        // Total users
        const usersSnapshot = await firebaseDB.collection('users').get();
        document.getElementById('total-users').textContent = usersSnapshot.size;

        // Pending comments
        const comments = await window.firestoreModule.getAllComments();
        const pendingComments = comments.filter(c => !c.approved).length;
        document.getElementById('pending-comments').textContent = pendingComments;

    } catch (error) {
        console.error('❌ Error loading analytics:', error);
    }
}

// Export functions
window.adminModule = {
    loadAdminVideos,
    handleAddVideoForm,
    editVideo,
    handleEditVideoForm,
    deleteVideo,
    loadUsers,
    toggleUserRole,
    deleteUser,
    loadCommentsForModeration,
    approveComment,
    deleteCommentAdmin,
    loadAnalytics
};
