/**
 * AudioManager.js
 * Manages site-wide background music rotation, shuffle, and persistent state.
 */

class AudioManager {
    constructor() {
        this.tracks = [
            '/public/audio.mp3',
            '/public/uploads/Opinion Base - EST Gee (1).mp3',
            '/public/uploads/Passionfruit - Drake.mp3',
            '/public/uploads/If You Ever - Kodak Black.mp3',
            '/public/uploads/i walk this earth all by myself - EKKSTACY (1).mp3',
            '/public/uploads/Game From Pluto - Kodak Black.mp3',
            '/public/uploads/Empire State Of Mind - JAY-Z.mp3'
        ];
        this.playlist = [];
        this.currentIndex = -1;
        this.audio = new Audio();
        this.isMuted = localStorage.getItem('audio_muted') === 'true';
        this.volume = parseFloat(localStorage.getItem('audio_volume') || '0.3');
        this.isEnabled = localStorage.getItem('audio_pref') === 'on';

        // Time persistence
        this.audio.currentTime = parseFloat(localStorage.getItem('audio_last_time') || '0');

        this.init();
    }

    init() {
        this.audio.volume = this.isMuted ? 0 : this.volume;
        this.audio.addEventListener('ended', () => this.next());
        this.audio.addEventListener('timeupdate', () => {
            if (this.audio.currentTime > 0) {
                localStorage.setItem('audio_last_time', this.audio.currentTime);
            }
        });

        // Prepare initial playlist
        this.shufflePlaylist();

        // Sync UI if elements exist
        this.syncUI();
    }

    shufflePlaylist() {
        this.playlist = [...this.tracks].sort(() => Math.random() - 0.5);
        this.currentIndex = 0;
    }

    play() {
        if (!this.isEnabled) return;

        if (this.currentIndex === -1) this.shufflePlaylist();

        this.audio.src = this.playlist[this.currentIndex];
        this.audio.volume = this.isMuted ? 0 : this.volume;

        this.audio.play().catch(err => {
            console.warn("Autoplay blocked or audio failed:", err);
        });

        this.syncUI();
    }

    next() {
        this.currentIndex++;
        if (this.currentIndex >= this.playlist.length) {
            this.shufflePlaylist();
        }
        this.play();
    }

    setMute(mute) {
        this.isMuted = mute;
        this.audio.volume = mute ? 0 : this.volume;
        localStorage.setItem('audio_muted', mute);
        this.syncUI();
    }

    toggleMute() {
        this.setMute(!this.isMuted);
    }

    setVolume(vol) {
        this.volume = vol;
        if (!this.isMuted) this.audio.volume = vol;
        localStorage.setItem('audio_volume', vol);
    }

    setEnabled(enabled) {
        this.isEnabled = enabled;
        localStorage.setItem('audio_pref', enabled ? 'on' : 'off');
        if (enabled) {
            this.play();
        } else {
            this.audio.pause();
        }
    }

    syncUI() {
        const iconMuted = document.getElementById('iconMuted');
        const iconSound = document.getElementById('iconSound');
        const slider = document.getElementById('volumeSlider');

        if (iconMuted && iconSound) {
            iconMuted.style.display = this.isMuted ? 'block' : 'none';
            iconSound.style.display = this.isMuted ? 'none' : 'block';
        }

        if (slider) {
            slider.value = this.volume;
        }
    }
}

// Global instance
window.audioSystem = new AudioManager();
