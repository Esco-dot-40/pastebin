// Rotating Title Script
(function () {
    // console.log("Title Rotator Initializing...");
    const domains = [
        "veroe.space",
        "q",
        "veroe.fun",
        "qu",
        "quietbin",
        "qui",
        "乇丂匚ㄖ 丨丂 匚尺卂乙ㄚ",
        "quie",
        "Esco is banished",
        "quiet",
        "Esco is lost 🧭",
        "quietb",
        "Esco is exiled"
        "quietbi",
        "Esco"
        "quietbin"
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
