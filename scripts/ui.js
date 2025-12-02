// UI Utilities and Helpers for Cruciflix
// Common UI functions used across all pages

// ============================================
// VIDEO CARD GENERATION
// ============================================

// Create video card HTML
function createVideoCard(video) {
    const card = document.createElement('div');
    card.className = 'video-card';
    card.onclick = () => openVideo(video.id);

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
        ${video.tags.slice(0, 3).map(tag => `<span class="tag">${tag}</span>`).join('')}
      </div>
    </div>
  `;

    return card;
}

// Open video player page
function openVideo(videoId) {
    window.location.href = `player.html?v=${videoId}`;
}

// Truncate text
function truncate(text, maxLength) {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

// ============================================
// TAG FILTERING
// ============================================

let selectedTags = [];

// Setup tag filter
function setupTagFilter(tagCheckboxes) {
    tagCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function () {
            if (this.checked) {
                if (!selectedTags.includes(this.value)) {
                    selectedTags.push(this.value);
                }
            } else {
                selectedTags = selectedTags.filter(tag => tag !== this.value);
            }

            filterVideos();
        });
    });
}

// Filter videos based on selected tags
async function filterVideos() {
    showLoading();

    let videos;
    if (selectedTags.length > 0) {
        videos = await window.firestoreModule.getVideosByTags(selectedTags);
    } else {
        videos = await window.firestoreModule.getAllVideos();
    }

    displayVideos(videos);
    hideLoading();
}

// Display videos in grid
function displayVideos(videos) {
    const container = document.getElementById('videos-container');
    if (!container) return;

    container.innerHTML = '';

    if (videos.length === 0) {
        container.innerHTML = '<p class="no-results">Nenhum vídeo encontrado</p>';
        return;
    }

    videos.forEach(video => {
        const card = createVideoCard(video);
        container.appendChild(card);
    });
}

// Reset filters
function resetFilters() {
    selectedTags = [];
    const checkboxes = document.querySelectorAll('.tag-filter input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = false);
    filterVideos();
}

// ============================================
// SEARCH FUNCTIONALITY
// ============================================

let searchDebounceTimer = null;

// Setup search
function setupSearch(searchInput) {
    searchInput.addEventListener('input', function () {
        clearTimeout(searchDebounceTimer);

        searchDebounceTimer = setTimeout(async () => {
            const searchTerm = this.value.trim();

            if (searchTerm.length > 0) {
                showLoading();
                const results = await window.firestoreModule.searchVideos(searchTerm);
                displayVideos(results);
                hideLoading();
            } else {
                filterVideos();
            }
        }, 500);
    });
}

// ============================================
// MODAL MANAGEMENT
// ============================================

// Show modal
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

// Hide modal
function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

// Close modal when clicking outside
function setupModalCloseOnOutsideClick() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', function (e) {
            if (e.target === this) {
                hideModal(this.id);
            }
        });
    });
}

// ============================================
// TOAST NOTIFICATIONS
// ============================================

// Show toast notification
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    document.body.appendChild(toast);

    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 10);

    // Remove after 3 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ============================================
// LOADING SPINNER
// ============================================

// Show loading spinner
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

// Hide loading spinner
function hideLoading() {
    const loader = document.getElementById('loading-spinner');
    if (loader) {
        loader.style.display = 'none';
    }
}

// ============================================
// NAVIGATION
// ============================================

// Setup mobile menu toggle
function setupMobileMenu() {
    const menuToggle = document.getElementById('mobile-menu-toggle');
    const nav = document.querySelector('.main-nav');

    if (menuToggle && nav) {
        menuToggle.addEventListener('click', function () {
            nav.classList.toggle('active');
        });
    }
}

// Navigate to page
function navigateTo(page) {
    window.location.href = page;
}

// Setup user menu
function setupUserMenu() {
    const userMenuBtn = document.getElementById('user-menu-btn');
    const userMenuDropdown = document.getElementById('user-menu-dropdown');

    if (userMenuBtn && userMenuDropdown) {
        userMenuBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            userMenuDropdown.classList.toggle('active');
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', function () {
            userMenuDropdown.classList.remove('active');
        });
    }
}

// ============================================
// FORM VALIDATION
// ============================================

// Validate email
function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// Validate password (min 6 characters)
function isValidPassword(password) {
    return password.length >= 6;
}

// Show form error
function showFormError(inputElement, message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'form-error';
    errorDiv.textContent = message;

    // Remove existing error
    const existingError = inputElement.parentElement.querySelector('.form-error');
    if (existingError) {
        existingError.remove();
    }

    inputElement.parentElement.appendChild(errorDiv);
    inputElement.classList.add('error');
}

// Clear form errors
function clearFormErrors(formElement) {
    formElement.querySelectorAll('.form-error').forEach(error => error.remove());
    formElement.querySelectorAll('.error').forEach(input => input.classList.remove('error'));
}

// ============================================
// URL PARAMETERS
// ============================================

// Get URL parameter
function getUrlParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

// ============================================
// FORMAT TIME
// ============================================

// Format seconds to HH:MM:SS or MM:SS
function formatTime(seconds) {
    if (isNaN(seconds)) return '00:00';

    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hrs > 0) {
        return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
}

// ============================================
// INITIALIZATION
// ============================================

// Initialize common UI elements
function initCommonUI() {
    setupMobileMenu();
    setupUserMenu();
    setupModalCloseOnOutsideClick();
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCommonUI);
} else {
    initCommonUI();
}

// Export functions
window.uiModule = {
    createVideoCard,
    openVideo,
    truncate,
    setupTagFilter,
    filterVideos,
    displayVideos,
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
