// HLS Video Player for Cruciflix
// Integrates HLS.js for video playback with custom controls

let hlsPlayer = null;
let currentVideoElement = null;
let progressSaveInterval = null;

// Initialize HLS player
function initPlayer(videoElementId, hlsUrl, videoId) {
    currentVideoElement = document.getElementById(videoElementId);

    if (!currentVideoElement) {
        console.error('❌ Video element not found');
        return;
    }

    // Check if HLS is supported
    if (Hls.isSupported()) {
        hlsPlayer = new Hls({
            enableWorker: true,
            lowLatencyMode: false,
        });

        hlsPlayer.loadSource(hlsUrl);
        hlsPlayer.attachMedia(currentVideoElement);

        hlsPlayer.on(Hls.Events.MANIFEST_PARSED, function () {
            console.log('✅ HLS manifest loaded');
            loadSavedProgress(videoId);
        });

        hlsPlayer.on(Hls.Events.ERROR, function (event, data) {
            if (data.fatal) {
                console.error('❌ Fatal HLS error:', data);
                switch (data.type) {
                    case Hls.ErrorTypes.NETWORK_ERROR:
                        console.error('Network error');
                        hlsPlayer.startLoad();
                        break;
                    case Hls.ErrorTypes.MEDIA_ERROR:
                        console.error('Media error');
                        hlsPlayer.recoverMediaError();
                        break;
                    default:
                        console.error('Unrecoverable error');
                        break;
                }
            }
        });
    } else if (currentVideoElement.canPlayType('application/vnd.apple.mpegurl')) {
        // For Safari native HLS support
        currentVideoElement.src = hlsUrl;
        currentVideoElement.addEventListener('loadedmetadata', function () {
            console.log('✅ Native HLS loaded');
            loadSavedProgress(videoId);
        });
    } else {
        alert('Este navegador não suporta reprodução HLS.');
    }

    // Start auto-saving progress
    startProgressTracking(videoId);

    // Increment view count
    if (window.firestoreModule) {
        window.firestoreModule.incrementViewCount(videoId);
    }
}

// Load saved progress and resume playback
async function loadSavedProgress(videoId) {
    if (!window.firestoreModule) return;

    const progress = await window.firestoreModule.getProgress(videoId);
    if (progress && progress.watchTime > 0 && !progress.completed) {
        currentVideoElement.currentTime = progress.watchTime;
        console.log(`✅ Resumed from ${progress.watchTime}s`);
    }
}

// Start tracking progress (save every 10 seconds)
function startProgressTracking(videoId) {
    if (progressSaveInterval) {
        clearInterval(progressSaveInterval);
    }

    progressSaveInterval = setInterval(() => {
        if (currentVideoElement && !currentVideoElement.paused) {
            const currentTime = currentVideoElement.currentTime;
            const duration = currentVideoElement.duration;
            const completed = (currentTime / duration) > 0.9; // 90% watched = completed

            if (window.firestoreModule) {
                window.firestoreModule.saveProgress(videoId, currentTime, completed);
            }
        }
    }, 10000); // Save every 10 seconds
}

// Stop progress tracking
function stopProgressTracking() {
    if (progressSaveInterval) {
        clearInterval(progressSaveInterval);
        progressSaveInterval = null;
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
function toggleFullscreen() {
    if (!currentVideoElement) return;

    if (!document.fullscreenElement) {
        if (currentVideoElement.requestFullscreen) {
            currentVideoElement.requestFullscreen();
        } else if (currentVideoElement.webkitRequestFullscreen) {
            currentVideoElement.webkitRequestFullscreen();
        } else if (currentVideoElement.mozRequestFullScreen) {
            currentVideoElement.mozRequestFullScreen();
        } else if (currentVideoElement.msRequestFullscreen) {
            currentVideoElement.msRequestFullscreen();
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

// Keyboard shortcuts
function setupKeyboardControls() {
    document.addEventListener('keydown', function (e) {
        if (!currentVideoElement) return;

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
        }
    });
}

// Cleanup on page unload
function cleanup() {
    stopProgressTracking();
    if (hlsPlayer) {
        hlsPlayer.destroy();
        hlsPlayer = null;
    }
}

window.addEventListener('beforeunload', cleanup);

// Export functions
window.playerModule = {
    initPlayer,
    togglePlayPause,
    setVolume,
    toggleMute,
    toggleFullscreen,
    seekTo,
    skip,
    setupKeyboardControls,
    cleanup
};
