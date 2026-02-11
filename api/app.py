"""
Flask Music Player API
Provides endpoints for:
- Listing songs with metadata
- Streaming audio files
- Optional file upload
"""

from flask import Flask, jsonify, send_file, request
from flask_cors import CORS
import os
import base64
from pathlib import Path

# Try to import mutagen for metadata extraction
try:
    from mutagen import File as MutagenFile
    from mutagen.id3 import ID3, APIC
    from mutagen.mp3 import MP3
    from mutagen.oggvorbis import OggVorbis
    from mutagen.wave import WAVE
    MUTAGEN_AVAILABLE = True
except ImportError:
    MUTAGEN_AVAILABLE = False
    print("Warning: mutagen not installed. Install with: pip install mutagen")

# Initialize Flask app
app = Flask(__name__)

# Enable CORS for local development
CORS(app)

# Configuration
MUSIC_FOLDER = os.path.join(os.path.dirname(__file__), '..', 'music')
ALLOWED_EXTENSIONS = {'.mp3', '.wav', '.ogg'}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB

# Ensure music folder exists
os.makedirs(MUSIC_FOLDER, exist_ok=True)


# ==================== HELPER FUNCTIONS ====================

def get_audio_metadata(filepath):
    """
    Extract metadata from audio file using mutagen
    Returns: dict with title, artist, album, duration, cover
    """
    metadata = {
        'filename': os.path.basename(filepath),
        'title': None,
        'artist': None,
        'album': None,
        'duration': None,
        'cover': None
    }
    
    if not MUTAGEN_AVAILABLE:
        # Fallback: use filename as title
        metadata['title'] = os.path.splitext(metadata['filename'])[0]
        return metadata
    
    try:
        # Load audio file
        audio = MutagenFile(filepath)
        
        if audio is None:
            metadata['title'] = os.path.splitext(metadata['filename'])[0]
            return metadata
        
        # Get duration
        if hasattr(audio.info, 'length'):
            metadata['duration'] = audio.info.length
        
        # Extract tags based on file type
        if isinstance(audio, MP3):
            # MP3 files with ID3 tags
            if audio.tags:
                metadata['title'] = str(audio.tags.get('TIT2', [''])[0]) or None
                metadata['artist'] = str(audio.tags.get('TPE1', [''])[0]) or None
                metadata['album'] = str(audio.tags.get('TALB', [''])[0]) or None
                
                # Extract album art
                for tag in audio.tags.values():
                    if isinstance(tag, APIC):
                        metadata['cover'] = base64.b64encode(tag.data).decode('utf-8')
                        break
        
        elif isinstance(audio, OggVorbis):
            # OGG Vorbis files
            if audio.tags:
                metadata['title'] = audio.tags.get('title', [None])[0]
                metadata['artist'] = audio.tags.get('artist', [None])[0]
                metadata['album'] = audio.tags.get('album', [None])[0]
                
                # OGG can have embedded images
                if 'metadata_block_picture' in audio.tags:
                    try:
                        import base64 as b64
                        from mutagen.flac import Picture
                        pic_data = b64.b64decode(audio.tags['metadata_block_picture'][0])
                        pic = Picture(pic_data)
                        metadata['cover'] = base64.b64encode(pic.data).decode('utf-8')
                    except:
                        pass
        
        elif isinstance(audio, WAVE):
            # WAV files (limited metadata support)
            if hasattr(audio, 'tags') and audio.tags:
                metadata['title'] = audio.tags.get('TIT2', [None])[0]
                metadata['artist'] = audio.tags.get('TPE1', [None])[0]
        
        # Fallback to filename if no title found
        if not metadata['title']:
            metadata['title'] = os.path.splitext(metadata['filename'])[0]
        
    except Exception as e:
        print(f"Error extracting metadata from {filepath}: {e}")
        metadata['title'] = os.path.splitext(metadata['filename'])[0]
    
    return metadata


def scan_music_folder():
    """
    Scan the music folder for audio files
    Returns: list of song metadata dictionaries
    """
    songs = []
    
    try:
        # Get all files in music folder
        for filename in os.listdir(MUSIC_FOLDER):
            filepath = os.path.join(MUSIC_FOLDER, filename)
            
            # Skip directories and non-audio files
            if not os.path.isfile(filepath):
                continue
            
            ext = os.path.splitext(filename)[1].lower()
            if ext not in ALLOWED_EXTENSIONS:
                continue
            
            # Get metadata
            metadata = get_audio_metadata(filepath)
            songs.append(metadata)
        
        # Sort by title
        songs.sort(key=lambda x: (x['title'] or x['filename']).lower())
        
    except Exception as e:
        print(f"Error scanning music folder: {e}")
    
    return songs


# ==================== API ENDPOINTS ====================

@app.route('/')
def index():
    """Root endpoint - serves as health check"""
    return jsonify({
        'status': 'ok',
        'message': 'Music Player API is running',
        'endpoints': {
            '/api/songs': 'GET - List all songs',
            '/api/music/<filename>': 'GET - Stream audio file',
            '/api/upload': 'POST - Upload new song (optional)'
        }
    })


@app.route('/api/songs', methods=['GET'])
def get_songs():
    """
    GET /api/songs
    Returns list of all available songs with metadata
    """
    try:
        songs = scan_music_folder()
        
        return jsonify({
            'success': True,
            'count': len(songs),
            'songs': songs
        })
    
    except Exception as e:
        print(f"Error in /api/songs: {e}")
        return jsonify({
            'success': False,
            'error': str(e),
            'songs': []
        }), 500


@app.route('/api/music/<path:filename>', methods=['GET'])
def stream_music(filename):
    """
    GET /api/music/<filename>
    Stream audio file to client
    """
    try:
        # Sanitize filename to prevent directory traversal
        filename = os.path.basename(filename)
        filepath = os.path.join(MUSIC_FOLDER, filename)
        
        # Check if file exists
        if not os.path.isfile(filepath):
            return jsonify({
                'success': False,
                'error': 'File not found'
            }), 404
        
        # Check if file has allowed extension
        ext = os.path.splitext(filename)[1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            return jsonify({
                'success': False,
                'error': 'File type not allowed'
            }), 400
        
        # Determine MIME type
        mime_types = {
            '.mp3': 'audio/mpeg',
            '.wav': 'audio/wav',
            '.ogg': 'audio/ogg'
        }
        mime_type = mime_types.get(ext, 'application/octet-stream')
        
        # Stream the file
        return send_file(
            filepath,
            mimetype=mime_type,
            as_attachment=False,
            download_name=filename
        )
    
    except Exception as e:
        print(f"Error streaming {filename}: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/upload', methods=['POST'])
def upload_song():
    """
    POST /api/upload
    Upload a new song to the music folder (optional feature)
    """
    try:
        # Check if file is in request
        if 'file' not in request.files:
            return jsonify({
                'success': False,
                'error': 'No file provided'
            }), 400
        
        file = request.files['file']
        
        # Check if filename is empty
        if file.filename == '':
            return jsonify({
                'success': False,
                'error': 'No file selected'
            }), 400
        
        # Check file extension
        ext = os.path.splitext(file.filename)[1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            return jsonify({
                'success': False,
                'error': f'File type not allowed. Allowed: {", ".join(ALLOWED_EXTENSIONS)}'
            }), 400
        
        # Sanitize filename
        filename = os.path.basename(file.filename)
        filepath = os.path.join(MUSIC_FOLDER, filename)
        
        # Check if file already exists
        if os.path.exists(filepath):
            return jsonify({
                'success': False,
                'error': 'File already exists'
            }), 409
        
        # Save file
        file.save(filepath)
        
        # Get metadata of uploaded file
        metadata = get_audio_metadata(filepath)
        
        return jsonify({
            'success': True,
            'message': 'File uploaded successfully',
            'song': metadata
        }), 201
    
    except Exception as e:
        print(f"Error uploading file: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


# ==================== ERROR HANDLERS ====================

@app.errorhandler(404)
def not_found(e):
    """Handle 404 errors"""
    return jsonify({
        'success': False,
        'error': 'Endpoint not found'
    }), 404


@app.errorhandler(500)
def server_error(e):
    """Handle 500 errors"""
    return jsonify({
        'success': False,
        'error': 'Internal server error'
    }), 500


# ==================== MAIN ====================

if __name__ == '__main__':
    # Run Flask development server
    print(f"Music folder: {os.path.abspath(MUSIC_FOLDER)}")
    print(f"Mutagen available: {MUTAGEN_AVAILABLE}")
    
    # Create sample music folder if it doesn't have files
    if not os.listdir(MUSIC_FOLDER):
        print("\nNo music files found in /music folder.")
        print("Add .mp3, .wav, or .ogg files to get started!")
    
    app.run(debug=True, host='0.0.0.0', port=5000)
