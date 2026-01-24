// Rotating Title Script
(function () {
    console.log("Terminal Title Rotator Online...");
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
        "Esco is exiled",
        "quietbi",
        "Esco is banished",
        "quietbin"
    ];
    const colors = ["🔴", "🟠", "🟡", "⚪", "🔵", "🟢", "🟣", "⚫"];

    let domainIndex = 0;
    let colorIndex = 0;

    function refreshTitle() {
        const color = colors[colorIndex];
        const domain = domains[domainIndex];
        document.title = `${color} ${domain}`;
    }

    // Fast Color Rotation (Flow Effect)
    setInterval(() => {
        colorIndex = (colorIndex + 1) % colors.length;
        refreshTitle();
    }, 67);

    // Slower Domain Rotation
    setInterval(() => {
        domainIndex = (domainIndex + 1) % domains.length;
        refreshTitle();
    }, 1333);

    // Initial Trigger
    refreshTitle();
})(
