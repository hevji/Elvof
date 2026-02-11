// ==================== CONFIGURATION ====================
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5000'  // Local development
    : '';  // Production (Vercel handles routing)

// ==================== STATE MANAGEMENT ====================
let songs = [];
let currentSongIndex = 0;
let isPlaying = false;
let isShuffleOn = false;
let isMuted = false;
let volume = 0.8;
let isDraggingProgress = false;
let isDraggingVolume = false;

// ==================== DOM ELEMENTS ====================
const audioPlayer = document.getElementById('audioPlayer');
const playPauseBtn = document.getElementById('playPauseBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const shuffleBtn = document.getElementById('shuffleBtn');
const volumeBtn = document.getElementById('volumeBtn');
const volumeSlider = document.getElementById('volumeSlider');
const volumeFill = document.getElementById('volumeFill');
const progressBar = document.getElementById('progressBar');
const progressFill = document.getElementById('progressFill');
const progressHandle = document.getElementById('progressHandle');
const currentTimeEl = document.getElementById('currentTime');
const durationEl = document.getElementById('duration');
const songTitle = document.getElementById('songTitle');
const songArtist = document.getElementById('songArtist');
const albumArt = document.getElementById('albumArt');
const playlist = document.getElementById('playlist');
const songCount = document.getElementById('songCount');
const toast = document.getElementById('toast');

// ==================== INITIALIZATION ====================
/**
 * Initialize the music player on page load
 */
async function init() {
    console.log('Initializing music player...');
    
    // Set initial volume
    audioPlayer.volume = volume;
    updateVolumeUI();
    
    // Load songs from backend
    await loadSongs();
    
    // Set up event listeners
    setupEventListeners();
    
    console.log('Music player initialized');
}

// ==================== API FUNCTIONS ====================
/**
 * Fetch the list of songs from the backend
 */
async function loadSongs() {
    try {
        showToast('Loading your music...');
        
        const response = await fetch(`${API_BASE}/api/songs`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        songs = data.songs || [];
        
        console.log(`Loaded ${songs.length} songs`);
        
        if (songs.length === 0) {
            showToast('No songs found. Add some music to the /music folder!');
            displayEmptyPlaylist();
        } else {
            showToast(`${songs.length} tracks loaded!`);
            renderPlaylist();
            updateSongCount();
        }
    } catch (error) {
        console.error('Error loading songs:', error);
        showToast('Failed to load music. Check console for details.');
        displayEmptyPlaylist();
    }
}

// ==================== PLAYBACK CONTROL ====================
/**
 * Load a song by index
 */
function loadSong(index) {
    if (index < 0 || index >= songs.length) return;
    
    currentSongIndex = index;
    const song = songs[currentSongIndex];
    
    console.log('Loading song:', song.title);
    
    // Update audio source with fade effect
    const wasPlaying = isPlaying;
    if (wasPlaying) {
        fadeOut(() => {
            setSongSource(song);
            if (wasPlaying) {
                setTimeout(() => {
                    play();
                    fadeIn();
                }, 100);
            }
        });
    } else {
        setSongSource(song);
    }
    
    // Update UI
    updateSongInfo(song);
    updatePlaylistUI();
}

/**
 * Set the audio source and metadata
 */
function setSongSource(song) {
    audioPlayer.src = `${API_BASE}/api/music/${encodeURIComponent(song.filename)}`;
    
    // Update metadata for media session
    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: song.title || song.filename,
            artist: song.artist || 'Unknown Artist',
            album: song.album || '',
            artwork: song.cover ? [
                { src: `data:image/jpeg;base64,${song.cover}`, sizes: '512x512', type: 'image/jpeg' }
            ] : []
        });
    }
}

/**
 * Play the current song
 */
async function play() {
    try {
        await audioPlayer.play();
        isPlaying = true;
        updatePlayPauseButton();
        albumArt.classList.add('playing');
        console.log('Playing:', songs[currentSongIndex].title);
    } catch (error) {
        console.error('Error playing audio:', error);
        showToast('Failed to play audio');
        isPlaying = false;
        updatePlayPauseButton();
    }
}

/**
 * Pause the current song
 */
function pause() {
    audioPlayer.pause();
    isPlaying = false;
    updatePlayPauseButton();
    albumArt.classList.remove('playing');
    console.log('Paused');
}

/**
 * Toggle play/pause
 */
function togglePlayPause() {
    if (songs.length === 0) {
        showToast('No songs available');
        return;
    }
    
    if (isPlaying) {
        pause();
    } else {
        play();
    }
}

/**
 * Play the next song
 */
function nextSong() {
    if (songs.length === 0) return;
    
    if (isShuffleOn) {
        // Random song (but not the current one if possible)
        if (songs.length > 1) {
            let newIndex;
            do {
                newIndex = Math.floor(Math.random() * songs.length);
            } while (newIndex === currentSongIndex);
            loadSong(newIndex);
        }
    } else {
        // Next song in sequence
        loadSong((currentSongIndex + 1) % songs.length);
    }
}

/**
 * Play the previous song
 */
function prevSong() {
    if (songs.length === 0) return;
    
    // If more than 3 seconds into the song, restart it
    if (audioPlayer.currentTime > 3) {
        audioPlayer.currentTime = 0;
    } else {
        // Go to previous song
        loadSong((currentSongIndex - 1 + songs.length) % songs.length);
    }
}

/**
 * Toggle shuffle mode
 */
function toggleShuffle() {
    isShuffleOn = !isShuffleOn;
    shuffleBtn.classList.toggle('active', isShuffleOn);
    showToast(isShuffleOn ? 'Shuffle on' : 'Shuffle off');
    console.log('Shuffle:', isShuffleOn);
}

/**
 * Toggle mute
 */
function toggleMute() {
    isMuted = !isMuted;
    audioPlayer.muted = isMuted;
    updateVolumeButton();
    showToast(isMuted ? 'Muted' : 'Unmuted');
}

/**
 * Set volume (0-1)
 */
function setVolume(value) {
    volume = Math.max(0, Math.min(1, value));
    audioPlayer.volume = volume;
    if (volume > 0 && isMuted) {
        isMuted = false;
        audioPlayer.muted = false;
    }
    updateVolumeUI();
}

// ==================== AUDIO EFFECTS ====================
/**
 * Fade out audio
 */
function fadeOut(callback) {
    const startVolume = audioPlayer.volume;
    const fadeStep = startVolume / 10;
    const fadeInterval = setInterval(() => {
        if (audioPlayer.volume > fadeStep) {
            audioPlayer.volume -= fadeStep;
        } else {
            audioPlayer.volume = 0;
            clearInterval(fadeInterval);
            if (callback) callback();
        }
    }, 30);
}

/**
 * Fade in audio
 */
function fadeIn() {
    audioPlayer.volume = 0;
    const targetVolume = volume;
    const fadeStep = targetVolume / 10;
    const fadeInterval = setInterval(() => {
        if (audioPlayer.volume < targetVolume - fadeStep) {
            audioPlayer.volume += fadeStep;
        } else {
            audioPlayer.volume = targetVolume;
            clearInterval(fadeInterval);
        }
    }, 30);
}

// ==================== UI UPDATES ====================
/**
 * Update song information display
 */
function updateSongInfo(song) {
    songTitle.textContent = song.title || song.filename;
    songArtist.textContent = song.artist || 'Unknown Artist';
    
    // Update album art with fade effect
    albumArt.style.opacity = '0';
    setTimeout(() => {
        if (song.cover) {
            albumArt.innerHTML = `<img src="data:image/jpeg;base64,${song.cover}" alt="Album art">`;
        } else {
            albumArt.innerHTML = `
                <div class="album-placeholder">
                    <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <circle cx="12" cy="12" r="10"/>
                        <circle cx="12" cy="12" r="3"/>
                        <path d="M12 2v2M12 20v2M2 12h2M20 12h2"/>
                    </svg>
                </div>
            `;
        }
        albumArt.style.opacity = '1';
    }, 150);
}

/**
 * Update play/pause button
 */
function updatePlayPauseButton() {
    const playIcon = playPauseBtn.querySelector('.play-icon');
    const pauseIcon = playPauseBtn.querySelector('.pause-icon');
    
    if (isPlaying) {
        playIcon.style.display = 'none';
        pauseIcon.style.display = 'block';
        playPauseBtn.title = 'Pause';
    } else {
        playIcon.style.display = 'block';
        pauseIcon.style.display = 'none';
        playPauseBtn.title = 'Play';
    }
}

/**
 * Update volume button icon
 */
function updateVolumeButton() {
    const volumeIcon = volumeBtn.querySelector('.volume-icon');
    const muteIcon = volumeBtn.querySelector('.mute-icon');
    
    if (isMuted || volume === 0) {
        volumeIcon.style.display = 'none';
        muteIcon.style.display = 'block';
    } else {
        volumeIcon.style.display = 'block';
        muteIcon.style.display = 'none';
    }
}

/**
 * Update volume slider UI
 */
function updateVolumeUI() {
    const percentage = isMuted ? 0 : (volume * 100);
    volumeFill.style.width = `${percentage}%`;
    updateVolumeButton();
}

/**
 * Update progress bar
 */
function updateProgress() {
    if (isDraggingProgress) return;
    
    const { currentTime, duration } = audioPlayer;
    
    if (duration) {
        const percentage = (currentTime / duration) * 100;
        progressFill.style.width = `${percentage}%`;
        progressHandle.style.left = `calc(${percentage}% - 8px)`;
        currentTimeEl.textContent = formatTime(currentTime);
    }
}

/**
 * Update duration display
 */
function updateDuration() {
    const { duration } = audioPlayer;
    if (duration && !isNaN(duration)) {
        durationEl.textContent = formatTime(duration);
    }
}

/**
 * Update song count display
 */
function updateSongCount() {
    const count = songs.length;
    songCount.textContent = `${count} track${count !== 1 ? 's' : ''}`;
}

/**
 * Update playlist item active state
 */
function updatePlaylistUI() {
    const items = document.querySelectorAll('.playlist-item');
    items.forEach((item, index) => {
        item.classList.toggle('active', index === currentSongIndex);
    });
}

// ==================== PLAYLIST RENDERING ====================
/**
 * Render the playlist
 */
function renderPlaylist() {
    playlist.innerHTML = '';
    
    songs.forEach((song, index) => {
        const item = createPlaylistItem(song, index);
        playlist.appendChild(item);
    });
}

/**
 * Create a playlist item element
 */
function createPlaylistItem(song, index) {
    const item = document.createElement('div');
    item.className = 'playlist-item';
    item.style.animationDelay = `${index * 0.05}s`;
    
    // Thumbnail
    const thumbnail = document.createElement('div');
    thumbnail.className = 'playlist-item-thumbnail';
    if (song.cover) {
        thumbnail.innerHTML = `<img src="data:image/jpeg;base64,${song.cover}" alt="">`;
    } else {
        thumbnail.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <circle cx="12" cy="12" r="3"/>
            </svg>
        `;
    }
    
    // Info
    const info = document.createElement('div');
    info.className = 'playlist-item-info';
    info.innerHTML = `
        <div class="playlist-item-title">${song.title || song.filename}</div>
        <div class="playlist-item-artist">${song.artist || 'Unknown Artist'}</div>
    `;
    
    // Duration
    const duration = document.createElement('div');
    duration.className = 'playlist-item-duration';
    duration.textContent = song.duration ? formatTime(song.duration) : '--:--';
    
    // Assemble
    item.appendChild(thumbnail);
    item.appendChild(info);
    item.appendChild(duration);
    
    // Click handler
    item.addEventListener('click', () => {
        loadSong(index);
        if (!isPlaying) {
            play();
        }
    });
    
    return item;
}

/**
 * Display empty playlist message
 */
function displayEmptyPlaylist() {
    playlist.innerHTML = `
        <div class="playlist-loading">
            <p>No songs found</p>
            <p style="font-size: 0.875rem; opacity: 0.7; margin-top: 0.5rem;">
                Add .mp3, .wav, or .ogg files to the /music folder
            </p>
        </div>
    `;
}

// ==================== EVENT LISTENERS ====================
/**
 * Set up all event listeners
 */
function setupEventListeners() {
    // Playback controls
    playPauseBtn.addEventListener('click', togglePlayPause);
    prevBtn.addEventListener('click', prevSong);
    nextBtn.addEventListener('click', nextSong);
    shuffleBtn.addEventListener('click', toggleShuffle);
    volumeBtn.addEventListener('click', () => {
        volumeSlider.classList.toggle('show');
    });
    
    // Audio events
    audioPlayer.addEventListener('timeupdate', updateProgress);
    audioPlayer.addEventListener('loadedmetadata', updateDuration);
    audioPlayer.addEventListener('ended', nextSong);
    audioPlayer.addEventListener('error', (e) => {
        console.error('Audio error:', e);
        showToast('Error playing audio file');
    });
    
    // Progress bar
    progressBar.addEventListener('mousedown', startDraggingProgress);
    progressBar.addEventListener('click', seekProgress);
    
    // Volume control
    document.querySelector('.volume-track').addEventListener('mousedown', startDraggingVolume);
    document.querySelector('.volume-track').addEventListener('click', setVolumeFromClick);
    
    // Global mouse events for dragging
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', stopDragging);
    
    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyPress);
    
    // Media session (for media keys)
    if ('mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('play', play);
        navigator.mediaSession.setActionHandler('pause', pause);
        navigator.mediaSession.setActionHandler('previoustrack', prevSong);
        navigator.mediaSession.setActionHandler('nexttrack', nextSong);
    }
}

// ==================== INTERACTION HANDLERS ====================
/**
 * Start dragging progress bar
 */
function startDraggingProgress(e) {
    isDraggingProgress = true;
    seekProgress(e);
}

/**
 * Start dragging volume slider
 */
function startDraggingVolume(e) {
    isDraggingVolume = true;
    setVolumeFromClick(e);
}

/**
 * Handle mouse move for dragging
 */
function handleMouseMove(e) {
    if (isDraggingProgress) {
        seekProgress(e);
    } else if (isDraggingVolume) {
        setVolumeFromClick(e);
    }
}

/**
 * Stop all dragging
 */
function stopDragging() {
    isDraggingProgress = false;
    isDraggingVolume = false;
}

/**
 * Seek to position in song
 */
function seekProgress(e) {
    const rect = progressBar.getBoundingClientRect();
    const percentage = (e.clientX - rect.left) / rect.width;
    const time = percentage * audioPlayer.duration;
    
    if (!isNaN(time)) {
        audioPlayer.currentTime = time;
        updateProgress();
    }
}

/**
 * Set volume from click position
 */
function setVolumeFromClick(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const percentage = (e.clientX - rect.left) / rect.width;
    setVolume(percentage);
}

/**
 * Handle keyboard shortcuts
 */
function handleKeyPress(e) {
    // Don't interfere if user is typing
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    
    switch(e.key) {
        case ' ':
            e.preventDefault();
            togglePlayPause();
            break;
        case 'ArrowRight':
            e.preventDefault();
            nextSong();
            break;
        case 'ArrowLeft':
            e.preventDefault();
            prevSong();
            break;
        case 'm':
        case 'M':
            toggleMute();
            break;
        case 's':
        case 'S':
            toggleShuffle();
            break;
        case 'ArrowUp':
            e.preventDefault();
            setVolume(volume + 0.1);
            break;
        case 'ArrowDown':
            e.preventDefault();
            setVolume(volume - 0.1);
            break;
    }
}

// ==================== UTILITY FUNCTIONS ====================
/**
 * Format time in seconds to MM:SS
 */
function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Show toast notification
 */
function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 2000);
}

// ==================== INITIALIZE APP ====================
// Start the app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
