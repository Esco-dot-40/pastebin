const VIDEO_SOURCES = {
    main: "/public/uploads/main_bg.mp4",
    pastes: "/public/uploads/pastes_bg.mp4"
};

let currentVideoKey = null;

// Initialize Global Controls
window.setBackgroundVideo = function (key) {
    if (currentVideoKey === key) return;
    currentVideoKey = key;

    const container = document.getElementById('video-background-container');
    if (!container) return;

    const src = VIDEO_SOURCES[key];
    if (!src) return;

    // Create new video for cross-fade
    const newVideo = document.createElement('video');
    newVideo.autoplay = true;
    newVideo.muted = true;
    newVideo.playsInline = true;
    newVideo.loop = true;
    newVideo.src = src;

    // Style
    Object.assign(newVideo.style, {
        position: 'absolute',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        opacity: '0', // Start hidden
        transition: 'opacity 1.5s ease'
    });

    container.appendChild(newVideo);

    newVideo.play().then(() => {
        // Fade in new
        // Small delay to ensure render
        requestAnimationFrame(() => {
            newVideo.style.opacity = '1';
        });

        // Remove old video(s) after transition
        const oldVideos = Array.from(container.querySelectorAll('video')).filter(v => v !== newVideo);
        if (oldVideos.length > 0) {
            setTimeout(() => {
                oldVideos.forEach(v => v.remove());
            }, 1500); // Match transition duration
        }
    }).catch(e => {
        console.error("Video play failed:", e);
        // Fallback: just show it if play fails (interaction might be needed, but muted should work)
        newVideo.style.opacity = '1';
    });
};

// Initial Load
document.addEventListener('DOMContentLoaded', () => {
    // Default to main if not triggered elsewhere, but allow logic to drive it
    // If no video is present, load main
    if (!document.querySelector('#video-background-container video')) {
        window.setBackgroundVideo('main');
    }
});
