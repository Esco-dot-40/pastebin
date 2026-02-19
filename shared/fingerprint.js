/**
 * Advanced Digital Fingerprinting Utility
 * Generates a unique Machine ID based on Hardware, Software, and Graphics signatures.
 */

export const getAdvancedFingerprint = async () => {
    const fingerprint = {
        hardware: {
            cpuCores: navigator.hardwareConcurrency || 'unknown',
            deviceMemory: navigator.deviceMemory || 'unknown',
            screenResolution: `${screen.width}x${screen.height}`,
            colorDepth: screen.colorDepth,
            pixelRatio: window.devicePixelRatio,
            maxTouchPoints: navigator.maxTouchPoints || 0
        },
        software: {
            language: navigator.language,
            platform: navigator.platform,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            cookiesEnabled: navigator.cookieEnabled,
            doNotTrack: navigator.doNotTrack || 'none',
            plugins: Array.from(navigator.plugins).map(p => p.name).join(', '),
            fonts: [] // Populated below
        },
        graphics: {
            canvas: '',
            webgl: {
                vendor: '',
                renderer: ''
            }
        }
    };

    // 1. Canvas Fingerprinting
    try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 200;
        canvas.height = 50;
        ctx.textBaseline = "top";
        ctx.font = "14px 'Arial'";
        ctx.textBaseline = "alphabetic";
        ctx.fillStyle = "#f60";
        ctx.fillRect(125, 1, 62, 20);
        ctx.fillStyle = "#069";
        ctx.fillText("Veroe_Pulse_Fingerprint <canvas> 1.0", 2, 15);
        ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
        ctx.fillText("Veroe_Pulse_Fingerprint <canvas> 1.0", 4, 17);
        fingerprint.graphics.canvas = canvas.toDataURL();
    } catch (e) {
        fingerprint.graphics.canvas = 'blocked';
    }

    // 2. WebGL Fingerprinting
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (gl) {
            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            fingerprint.graphics.webgl.vendor = debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : 'unknown';
            fingerprint.graphics.webgl.renderer = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'unknown';
        }
    } catch (e) {
        fingerprint.graphics.webgl.renderer = 'blocked';
    }

    // 3. Simple Font Detection (Common ones)
    const fontList = ['Arial', 'Verdana', 'Times New Roman', 'Courier New', 'Georgia', 'Comic Sans MS', 'Trebuchet MS', 'Impact'];
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const baseWidth = ctx.measureText('mmmmmmmmmmlli').width;
    fingerprint.software.fonts = fontList.filter(font => {
        ctx.font = `72px ${font}, sans-serif`;
        return ctx.measureText('mmmmmmmmmmlli').width !== baseWidth;
    }).join(', ');

    // 4. Generate Machine ID (Hash)
    const rawString = JSON.stringify(fingerprint);
    const msgUint8 = new TextEncoder().encode(rawString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    return {
        id: hashHex,
        details: fingerprint
    };
};
