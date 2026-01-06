// Rotating Title Script
(function () {
    // console.log("Title Rotator Initializing...");
    const domains = [
        "quietbin | veroe.space",
        "veroe.fun",
        "velarixsolutions.nl"
    ];
    const colors = ["🔴", "🟠", "🟡", "⚪", "🔵", "🟢", "🟣", "⚫"];

    let domainIndex = 0;
    let colorIndex = 0;

    // Fast Color Rotation (Flow Effect)
    setInterval(() => {
        const color = colors[colorIndex];
        const domain = domains[domainIndex];

        document.title = `${color} ${domain}`;

        colorIndex = (colorIndex + 1) % colors.length;
    }, 100); // Updates every 200ms for "flashing" effect

    // Slower Domain Rotation
    setInterval(() => {
        domainIndex = (domainIndex + 1) % domains.length;
    }, 2000); // Changes text every 3 seconds
})();
