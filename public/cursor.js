document.addEventListener('DOMContentLoaded', () => {
    // Create cursor elements
    const dot = document.createElement('div');
    dot.id = 'custom-cursor-dot';
    document.body.appendChild(dot);

    const border = document.createElement('div');
    border.id = 'custom-cursor-border';
    document.body.appendChild(border);

    // Initial position off-screen
    let mouseX = -100;
    let mouseY = -100;
    let dotX = -100;
    let dotY = -100;
    let borderX = -100;
    let borderY = -100;

    // Move cursor
    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
    });

    // Animation Loop
    function animate() {
        // Dot follows instantly/closely
        dotX += (mouseX - dotX) * 1;
        dotY += (mouseY - dotY) * 1;
        dot.style.transform = `translate3d(${dotX - 4}px, ${dotY - 4}px, 0)`; // Center offset

        // Border follows smoothly
        borderX += (mouseX - borderX) * 0.15;
        borderY += (mouseY - borderY) * 0.15;
        border.style.transform = `translate3d(${borderX - 20}px, ${borderY - 20}px, 0)`; // Center offset

        requestAnimationFrame(animate);
    }
    animate();

    // Hover effects
    const interactiveElements = document.querySelectorAll('a, button, input, textarea, select, .card, .reaction-btn');

    interactiveElements.forEach(el => {
        el.addEventListener('mouseenter', () => border.classList.add('active'));
        el.addEventListener('mouseleave', () => border.classList.remove('active'));
    });

    // Handle dynamic elements (optional, via MutationObserver if needed, but simple delegate is better)
    document.body.addEventListener('mouseover', (e) => {
        if (e.target.closest('a, button, input, textarea, select, .card, .reaction-btn')) {
            border.classList.add('active');
        } else {
            border.classList.remove('active');
        }
    });
});
