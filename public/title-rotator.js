// Rotating Title Script
(function () {
    console.log("Terminal Title Rotator Online...");
    const domains = [
        "𝘃𝗲𝗿𝗼𝗲.𝘀𝗽𝗮𝗰𝗲",
        "乇丂匚ㄖ 丨丂 匚尺卂乙ㄚ",
        "𝘁𝗵𝗲",
        "𝗺𝗼𝗿𝗲",
        "𝘆𝗼𝘂",
        "𝗿𝗲𝘀𝗶𝘀𝘁",
        "𝘁𝗵𝗲",
        "𝗺𝗼𝗿𝗲",
        "𝗶𝘁",
        "𝗽𝗲𝗿𝘀𝗶𝘀𝘁𝘀",
        "乇丂匚ㄖ 丨丂 匚尺卂乙ㄚ",
        "𝗘𝘀𝗰𝗼 𝗶𝘀 𝗯𝗮𝗻𝗶𝘀𝗵𝗲𝗱",
        "𝗘𝘀𝗰𝗼 𝗶𝘀 𝗲𝘅𝗶𝗹𝗲𝗱",
        "𝗘𝘀𝗰𝗼 𝗶𝘀 𝗹𝗼𝘀𝘁 🧭",
        "𝗘𝘀𝗰𝗼 𝗶𝘀 𝗯𝗮𝗻𝗶𝘀𝗵𝗲𝗱"
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
})();
