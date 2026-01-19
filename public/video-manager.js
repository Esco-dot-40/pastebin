const VIDEO_SOURCES = {
    main: "/public/uploads/main_bg.mp4",           // Beach for entry page
    loading: "/public/uploads/19627-304735769_medium.mp4",  // Loading transitions
    public: "/public/uploads/153978-806571981.mp4",        // Public pastes list
    detail: "/public/uploads/150883-799711528_medium.mp4"  // Individual paste view
};

let currentVideoKey = null;

// Initialize Global Controls
window.setBackgroundVideo = function (key) {
    if (currentVideoKey === key) return;
    currentVideoKey = key;

    const container = document.getElementById('video-background-container');
    if (!container) return;

    const src = VIDEO_SOURCES[key];
    if (!src) {
        console.warn(`No video source for key: ${key}`);
        return;
    }

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
            // Force reflow
            img.offsetHeight;
            img.style.opacity = '1';
        };

        container.appendChild(img);

        // Safety: ensure opacity turns on even if cached
        setTimeout(() => img.style.opacity = '1', 100);

    } else {
        const video = document.createElement('video');
        video.autoplay = true;
        video.muted = true;
        video.playsInline = true;
        video.loop = true;
        video.disablePictureInPicture = true; // Block PiP
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
            pointerEvents: 'none', // Block Hover/Click
            transition: 'opacity 1s ease'
        });

        video.onloadeddata = () => { video.style.opacity = '1'; };
        video.src = src;
        container.appendChild(video);
        video.play().catch(e => { /* silent */ });

        // Safety
        setTimeout(() => video.style.opacity = '1', 500);
    }
};

// Initial Load
document.addEventListener('DOMContentLoaded', () => {
    // Only default to main if we are on the main page (index.html) or public landing
    // This prevents the 'pastes' view from loading 'main' if its own video is slow or missing
    if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
        if (!document.querySelector('#video-background-container video') && !document.querySelector('#video-background-container img')) {
            window.setBackgroundVideo('main');
        }
    }
});
