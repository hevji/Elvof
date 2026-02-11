// ===== CUSTOM CURSOR =====
const cursor = document.querySelector('.cursor');

document.addEventListener('mousemove', (e) => {
    cursor.style.left = e.clientX + 'px';
    cursor.style.top = e.clientY + 'px';
});

// ===== BLOB FOLLOWER =====
const blob = document.querySelector('.blob');
let blobX = window.innerWidth / 2;
let blobY = window.innerHeight / 2;

document.addEventListener('mousemove', (e) => {
    blobX = e.clientX;
    blobY = e.clientY;
});

function animateBlob() {
    const currentX = parseFloat(blob.style.left) || blobX;
    const currentY = parseFloat(blob.style.top) || blobY;
    
    const newX = currentX + (blobX - currentX) * 0.1;
    const newY = currentY + (blobY - currentY) * 0.1;
    
    blob.style.left = newX + 'px';
    blob.style.top = newY + 'px';
    
    requestAnimationFrame(animateBlob);
}

animateBlob();

// ===== PARTICLE SYSTEM =====
const canvas = document.getElementById('particles');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

class Particle {
    constructor() {
        this.x = Math.random() * canvas.width;
        this.y = canvas.height + 20;
        this.size = Math.random() * 2 + 1;
        this.speedY = -Math.random() * 1 - 0.5;
        this.speedX = (Math.random() - 0.5) * 0.5;
        this.opacity = 0;
        this.life = 0;
        this.maxLife = 200 + Math.random() * 100;
        this.colors = ['#ff6b6b', '#ffd93d', '#6bcbff', '#a78bfa'];
        this.color = this.colors[Math.floor(Math.random() * this.colors.length)];
    }
    
    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.life++;
        
        // Fade in
        if (this.life < 30) {
            this.opacity = this.life / 30;
        }
        // Fade out
        else if (this.life > this.maxLife - 30) {
            this.opacity = (this.maxLife - this.life) / 30;
        } else {
            this.opacity = 1;
        }
        
        // Reset when particle goes out of bounds
        if (this.y < -10 || this.life > this.maxLife) {
            this.x = Math.random() * canvas.width;
            this.y = canvas.height + 20;
            this.life = 0;
            this.color = this.colors[Math.floor(Math.random() * this.colors.length)];
        }
    }
    
    draw() {
        ctx.fillStyle = this.color;
        ctx.globalAlpha = this.opacity * 0.6;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}

const particles = [];
const particleCount = 70;

for (let i = 0; i < particleCount; i++) {
    particles.push(new Particle());
}

let mouseX = 0;
let mouseY = 0;

document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
});

function drawConnections() {
    const maxDistance = 150;
    
    particles.forEach(particle => {
        const dx = mouseX - particle.x;
        const dy = mouseY - particle.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < maxDistance) {
            ctx.strokeStyle = particle.color;
            ctx.globalAlpha = (1 - distance / maxDistance) * 0.3;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(particle.x, particle.y);
            ctx.lineTo(mouseX, mouseY);
            ctx.stroke();
            ctx.globalAlpha = 1;
        }
    });
}

function animateParticles() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    particles.forEach(particle => {
        particle.update();
        particle.draw();
    });
    
    drawConnections();
    
    requestAnimationFrame(animateParticles);
}

animateParticles();

// ===== MUSIC PLAYER =====
const audio = new Audio();
const playPauseBtn = document.querySelector('.btn-play-pause');
const prevBtn = document.querySelector('.btn-prev');
const nextBtn = document.querySelector('.btn-next');
const iconPlay = document.querySelector('.icon-play');
const iconPause = document.querySelector('.icon-pause');
const progressBar = document.querySelector('.progress-bar');
const progressFill = document.querySelector('.progress-fill');
const progressHandle = document.querySelector('.progress-handle');
const timeCurrent = document.querySelector('.time-current');
const timeTotal = document.querySelector('.time-total');
const volumeBar = document.querySelector('.volume-bar');
const volumeFill = document.querySelector('.volume-fill');
const trackTitle = document.querySelector('.track-title');
const trackArtist = document.querySelector('.track-artist');
const playlist = document.getElementById('playlist');
const trackCount = document.querySelector('.track-count');
const statusText = document.querySelector('.status-text');
const shuffleBtn = document.querySelector('.btn-shuffle');

let tracks = [];
let currentTrackIndex = 0;
let isShuffled = false;

// Load tracks from /music directory
async function loadTracks() {
    try {
        // Try to fetch from /music directory
       const response = await fetch('/music/music.json');
       const songs = await response.json();

       songs.forEach(song => {
         const audio = new Audio(`/music/${song}`);
         audio.play();
    });
        
        // Parse HTML to find audio files
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/html');
        const links = doc.querySelectorAll('a');
        
        const audioExtensions = ['.mp3', '.wav', '.ogg', '.m4a', '.flac'];
        
        links.forEach(link => {
            const href = link.getAttribute('href');
            if (href && audioExtensions.some(ext => href.toLowerCase().endsWith(ext))) {
                const fileName = decodeURIComponent(href);
                const trackName = fileName.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');
                
                tracks.push({
                    name: trackName,
                    file: '/music/' + fileName,
                    duration: null
                });
            }
        });
        
        if (tracks.length === 0) {
            throw new Error('No audio files found');
        }
        
        trackCount.textContent = `${tracks.length} track${tracks.length !== 1 ? 's' : ''} loaded`;
        displayPlaylist();
        
        // Load first track
        if (tracks.length > 0) {
            loadTrack(0);
        }
        
    } catch (error) {
        console.error('Error loading tracks:', error);
        
        // Fallback: Create sample tracks for demonstration
        tracks = [
            { name: 'Place your MP3 files in /music', file: '', duration: null },
            { name: 'They will appear here automatically', file: '', duration: null },
            { name: 'Supported formats: MP3, WAV, OGG, M4A, FLAC', file: '', duration: null }
        ];
        
        playlist.innerHTML = `
            <div class="playlist-empty">
                <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                    <path d="M32 8L8 20V44L32 56L56 44V20L32 8Z" stroke="rgba(255,255,255,0.1)" stroke-width="2"/>
                    <circle cx="32" cy="32" r="6" fill="rgba(255,255,255,0.1)"/>
                </svg>
                <p>No music files found in /music directory</p>
                <p style="margin-top: 8px; font-size: 12px;">Add your audio files to /music and refresh the page</p>
            </div>
        `;
        
        trackCount.textContent = 'No tracks loaded';
        statusText.textContent = 'NO MUSIC FILES FOUND';
    }
}

function displayPlaylist() {
    playlist.innerHTML = '';
    
    tracks.forEach((track, index) => {
        const item = document.createElement('div');
        item.className = 'playlist-item';
        item.innerHTML = `
            <div class="track-number">${String(index + 1).padStart(2, '0')}</div>
            <div class="track-details">
                <div class="track-name">${track.name}</div>
                <div class="track-duration">--:--</div>
            </div>
        `;
        
        item.addEventListener('click', () => {
            loadTrack(index);
            if (!audio.paused) {
                audio.play();
            }
        });
        
        playlist.appendChild(item);
    });
    
    // Load durations
    tracks.forEach((track, index) => {
        if (track.file) {
            const tempAudio = new Audio(track.file);
            tempAudio.addEventListener('loadedmetadata', () => {
                const duration = formatTime(tempAudio.duration);
                const durationEl = playlist.children[index]?.querySelector('.track-duration');
                if (durationEl) {
                    durationEl.textContent = duration;
                }
            });
        }
    });
}

function loadTrack(index) {
    if (index < 0 || index >= tracks.length || !tracks[index].file) return;
    
    currentTrackIndex = index;
    const track = tracks[index];
    
    audio.src = track.file;
    trackTitle.textContent = track.name;
    trackArtist.textContent = `Track ${index + 1} of ${tracks.length}`;
    
    // Update active state
    document.querySelectorAll('.playlist-item').forEach((item, i) => {
        item.classList.toggle('active', i === index);
    });
    
    audio.addEventListener('loadedmetadata', () => {
        timeTotal.textContent = formatTime(audio.duration);
    });
}

function togglePlayPause() {
    if (!tracks[currentTrackIndex]?.file) return;
    
    if (audio.paused) {
        audio.play();
        iconPlay.style.display = 'none';
        iconPause.style.display = 'block';
        document.body.classList.add('playing');
        statusText.textContent = 'NOW PLAYING';
    } else {
        audio.pause();
        iconPlay.style.display = 'block';
        iconPause.style.display = 'none';
        document.body.classList.remove('playing');
        statusText.textContent = 'PAUSED';
    }
}

function playNext() {
    if (isShuffled) {
        const randomIndex = Math.floor(Math.random() * tracks.length);
        loadTrack(randomIndex);
    } else {
        loadTrack((currentTrackIndex + 1) % tracks.length);
    }
    if (document.body.classList.contains('playing')) {
        audio.play();
    }
}

function playPrev() {
    if (audio.currentTime > 3) {
        audio.currentTime = 0;
    } else {
        loadTrack((currentTrackIndex - 1 + tracks.length) % tracks.length);
        if (document.body.classList.contains('playing')) {
            audio.play();
        }
    }
}

function toggleShuffle() {
    isShuffled = !isShuffled;
    shuffleBtn.classList.toggle('active', isShuffled);
    statusText.textContent = isShuffled ? 'SHUFFLE ON' : 'SHUFFLE OFF';
    setTimeout(() => {
        statusText.textContent = audio.paused ? 'READY TO PLAY' : 'NOW PLAYING';
    }, 2000);
}

function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Event Listeners
playPauseBtn.addEventListener('click', togglePlayPause);
nextBtn.addEventListener('click', playNext);
prevBtn.addEventListener('click', playPrev);
shuffleBtn.addEventListener('click', toggleShuffle);

audio.addEventListener('timeupdate', () => {
    if (audio.duration) {
        const percent = (audio.currentTime / audio.duration) * 100;
        progressFill.style.width = percent + '%';
        progressHandle.style.left = percent + '%';
        timeCurrent.textContent = formatTime(audio.currentTime);
    }
});

audio.addEventListener('ended', () => {
    playNext();
});

// Progress bar seeking
progressBar.addEventListener('click', (e) => {
    if (!tracks[currentTrackIndex]?.file) return;
    
    const rect = progressBar.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    audio.currentTime = percent * audio.duration;
});

// Volume control
volumeBar.addEventListener('click', (e) => {
    const rect = volumeBar.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    audio.volume = Math.max(0, Math.min(1, percent));
    volumeFill.style.width = (percent * 100) + '%';
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && e.target === document.body) {
        e.preventDefault();
        togglePlayPause();
    } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        audio.currentTime = Math.min(audio.duration, audio.currentTime + 5);
    } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        audio.currentTime = Math.max(0, audio.currentTime - 5);
    } else if (e.code === 'ArrowUp') {
        e.preventDefault();
        audio.volume = Math.min(1, audio.volume + 0.1);
        volumeFill.style.width = (audio.volume * 100) + '%';
    } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        audio.volume = Math.max(0, audio.volume - 0.1);
        volumeFill.style.width = (audio.volume * 100) + '%';
    }
});

// Initialize
loadTracks();
