const VIDEO_SOURCES = {
    main: "/public/uploads/main_bg.mp4",               // Main Entry Screen
    loading: "/public/uploads/19627-304735769_medium.mp4", // Loading Screen (Highway)
    public: "/public/uploads/153978-806571981.mp4",  // Public Paste List
    detail: "/public/uploads/150883-799711528_medium.mp4"   // Individual Paste View
};

let currentVideoKey = null;

// Initialize Global Controls
window.setBackgroundVideo = function (key) {
    if (currentVideoKey === key) return;

    const src = VIDEO_SOURCES[key];
    if (!src || typeof src !== 'string') {
        console.warn(`Invalid video source for key: ${key}`, src);
        return;
    }

    currentVideoKey = key;

    const container = document.getElementById('video-background-container');
    if (!container) return;

    const isImage = src.match(/\.(jpg|jpeg|png|gif)$/i);

    // Clear existing content to prevent mixing
    container.innerHTML = '';

    if (isImage) {
        const img = document.createElement('img');
        img.src = src;
        img.className = 'bg-animate'; // Applies the Ken Burns keyframe

        Object.assign(img.style, {
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            position: 'absolute',
            top: '0',
            left: '0',
            zIndex: '0',
            opacity: '0',
            transition: 'opacity 1.5s ease'
        });

        img.onload = () => {
            img.style.opacity = '1';
        };

        container.appendChild(img);
        setTimeout(() => img.style.opacity = '1', 100);

    } else {
        const video = document.createElement('video');
        video.autoplay = true;
        video.muted = true;
        video.playsInline = true;
        video.loop = true;
        video.disablePictureInPicture = true;
        video.setAttribute('disablePictureInPicture', '');

        Object.assign(video.style, {
            position: 'absolute',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            zIndex: '0',
            opacity: '0',
            pointerEvents: 'none',
            transition: 'opacity 1s ease'
        });

        // Set source and attempt to play
        video.src = src;
        container.appendChild(video);

        // Try to load and play with better error handling
        video.load();

        const attemptPlay = () => {
            const playPromise = video.play();
            if (playPromise !== undefined) {
                playPromise
                    .then(() => {
                        console.log(`Video playing: ${key}`);
                        video.style.opacity = '1';
                    })
                    .catch(err => {
                        console.warn(`Autoplay blocked for ${key}, will play on next interaction:`, err.message);
                        // Still show the video frame even if autoplay is blocked
                        video.style.opacity = '1';

                        // Retry on next user interaction
                        const playOnInteraction = () => {
                            video.play().catch(() => { });
                            document.removeEventListener('click', playOnInteraction);
                            document.removeEventListener('keydown', playOnInteraction);
                        };
                        document.addEventListener('click', playOnInteraction, { once: true });
                        document.addEventListener('keydown', playOnInteraction, { once: true });
                    });
            }
        };

        // If video is ready, play immediately
        if (video.readyState >= 3) {
            attemptPlay();
        } else {
            // Otherwise wait for it to be ready
            video.onloadeddata = attemptPlay;
        }

        // Fallback opacity transition
        setTimeout(() => video.style.opacity = '1', 500);
    }
};

// Initial Load
document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
        if (!document.querySelector('#video-background-container video') && !document.querySelector('#video-background-container img')) {
            window.setBackgroundVideo('main');
        }
    }
});
