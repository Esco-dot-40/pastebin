const VIDEO_SOURCES = {
    main: "/public/uploads/main_bg.mp4",               // Main Screen
    loading: "/public/uploads/19627-304735769_medium.mp4", // Any and All Loading
    public: "/public/uploads/19627-304735769_medium.mp4",  // Public Paste List
    detail: "/public/uploads/19627-304735769_medium.mp4"   // Individual Paste View
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

        video.onloadeddata = () => { video.style.opacity = '1'; };
        video.src = src;
        container.appendChild(video);
        video.play().catch(e => { /* silent */ });

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
