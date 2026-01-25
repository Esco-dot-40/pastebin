document.addEventListener('DOMContentLoaded', () => {
    // 1. Create the Cursor Structure
    const cursor = document.createElement('div');
    cursor.id = 'digital-cursor';

    // Determine the center dot if we want one
    const dot = document.createElement('div');
    dot.className = 'cursor-center-dot';
    cursor.appendChild(dot);

    document.body.appendChild(cursor);

    let mouseX = -100;
    let mouseY = -100;

    // 2. Ultra-Fast Tracking
    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;

        // Direct update for lowest latency feel (no RAF loop lag for position)
        cursor.style.transform = `translate(${mouseX}px, ${mouseY}px) translate(-50%, -50%)`;
    });

    // 3. Hover Interaction Logic
    // We use event delegation for performance and dynamic content support
    const handleHover = () => cursor.classList.add('active');
    const handleLeave = () => cursor.classList.remove('active');

    // Attach to common interactive elements
    const selectors = 'a, button, input, textarea, select, .card, .reaction-btn, .clickable';

    document.body.addEventListener('mouseover', (e) => {
        if (e.target.closest(selectors)) {
            handleHover();
        }
    });

    document.body.addEventListener('mouseout', (e) => {
        if (e.target.closest(selectors)) {
            handleLeave();
        }
    });

    // 4. Click Feedback
    document.addEventListener('mousedown', () => cursor.classList.add('clicking'));
    document.addEventListener('mouseup', () => cursor.classList.remove('clicking'));
});
