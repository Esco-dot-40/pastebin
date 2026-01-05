const VIDEO_SOURCES = {
    main: "/public/uploads/main_bg.mp4",
    pastes: "/public/uploads/main_bg.mp4" // DEBUG: Use known good video
};

let currentVideoKey = null;

// Initialize Global Controls
window.setBackgroundVideo = function (key) {
    if (currentVideoKey === key) return;
    currentVideoKey = key;

    const container = document.getElementById('video-background-container');
    if (!container) return;

    let video = container.querySelector('video');

    if (!video) {
        // Create only once
        video = document.createElement('video');
        video.autoplay = true;
        video.muted = true;
        video.playsInline = true;
        video.loop = true;

        Object.assign(video.style, {
            position: 'absolute',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            zIndex: '0'
        });

        container.appendChild(video);
    }

    // Just swap the source
    video.src = VIDEO_SOURCES[key];
    video.play().catch(e => console.error("Play failed", e));
};

// Initial Load
document.addEventListener('DOMContentLoaded', () => {
    // Default to main if not triggered elsewhere, but allow logic to drive it
    // If no video is present, load main
    if (!document.querySelector('#video-background-container video')) {
        window.setBackgroundVideo('main');
    }
});
