const VIDEO_SOURCES = {
    main: "/public/uploads/main_bg.mp4?v=" + Date.now(),
    pastes: "/public/uploads/pastes_bg.mp4?v=" + Date.now()
};

let currentVideoKey = null;

// Initialize Global Controls
window.setBackgroundVideo = function (key) {
    console.log(`[VideoManager] Requesting background: ${key}`);

    if (currentVideoKey === key) {
        console.log(`[VideoManager] Already on ${key}, ignoring.`);
        return;
    }
    currentVideoKey = key;

    const container = document.getElementById('video-background-container');
    if (!container) {
        console.error("[VideoManager] Container not found!");
        return;
    }

    const src = VIDEO_SOURCES[key];
    if (!src) {
        console.error(`[VideoManager] No source for key ${key}`);
        return;
    }

    // Create new video for cross-fade
    const newVideo = document.createElement('video');
    newVideo.autoplay = true;
    newVideo.muted = true;
    newVideo.playsInline = true;
    newVideo.loop = true;
    newVideo.src = src;

    // Debug loading
    newVideo.addEventListener('custom_log', (e) => console.log(e.detail));
    newVideo.addEventListener('loadeddata', () => console.log(`[VideoManager] ${key} loaded successfully.`));
    newVideo.addEventListener('error', (e) => console.error(`[VideoManager] Error loading ${key}:`, newVideo.error));

    // Style
    Object.assign(newVideo.style, {
        position: 'absolute',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        opacity: '0', // Start hidden
        transition: 'opacity 1.5s ease',
        zIndex: '1', // Ensure it's on top of previous (which effectively defaults to 0 or auto)
    });

    container.appendChild(newVideo);

    newVideo.play().then(() => {
        console.log(`[VideoManager] ${key} started playing.`);

        // Fade in new
        // Small delay to ensure render
        requestAnimationFrame(() => {
            newVideo.style.opacity = '1';
        });

        // Remove old video(s) after transition
        const oldVideos = Array.from(container.querySelectorAll('video')).filter(v => v !== newVideo);

        // Lower z-index of old videos just in case
        oldVideos.forEach(v => v.style.zIndex = '0');

        if (oldVideos.length > 0) {
            console.log(`[VideoManager] Scheduling removal of ${oldVideos.length} old videos.`);
            setTimeout(() => {
                oldVideos.forEach(v => {
                    v.remove();
                    console.log("[VideoManager] Removed an old video.");
                });
            }, 1500); // Match transition duration
        }
    }).catch(e => {
        console.error("[VideoManager] Video play failed:", e);
        // Fallback: just show it if play fails (interaction might be needed, but muted should work)
        newVideo.style.opacity = '1';

        // Force cleanup of old videos immediately if play fails, to avoid "stuck" old video
        // (Though if new video is black/broken, we might prefer old video? 
        //  But user problem is "old video stays", so let's try to remove it to see if we at least get a black screen = progress)
        /* 
        const oldVideos = Array.from(container.querySelectorAll('video')).filter(v => v !== newVideo);
        oldVideos.forEach(v => v.remove()); 
        */
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
