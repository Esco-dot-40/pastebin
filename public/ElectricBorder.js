import React, { useEffect, useRef, useCallback } from "https://esm.sh/react@19";
import htm from "https://esm.sh/htm";

const html = htm.bind(React.createElement);

const ElectricBorder = ({
    children,
    color = '#00f5ff',
    speed = 1,
    chaos = 0.12,
    borderRadius = 24,
    className = '',
    style = {}
}) => {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const animationRef = useRef(null);
    const timeRef = useRef(0);
    const lastFrameTimeRef = useRef(0);

    const random = useCallback(x => {
        return (Math.sin(x * 12.9898) * 43758.5453) % 1;
    }, []);

    const noise2D = useCallback(
        (x, y) => {
            const i = Math.floor(x);
            const j = Math.floor(y);
            const fx = x - i;
            const fy = y - j;

            const a = random(i + j * 57);
            const b = random(i + 1 + j * 57);
            const c = random(i + (j + 1) * 57);
            const d = random(i + 1 + (j + 1) * 57);

            const ux = fx * fx * (3.0 - 2.0 * fx);
            const uy = fy * fy * (3.0 - 2.0 * fy);

            return a * (1 - ux) * (1 - uy) + b * ux * (1 - uy) + c * (1 - ux) * uy + d * ux * uy;
        },
        [random]
    );

    const octavedNoise = useCallback(
        (x, octaves, lacunarity, gain, baseAmplitude, baseFrequency, time, seed) => {
            let y = 0;
            let amplitude = baseAmplitude;
            let frequency = baseFrequency;

            for (let i = 0; i < octaves; i++) {
                y += amplitude * noise2D(frequency * x + seed * 100, time * frequency * 0.3);
                frequency *= lacunarity;
                amplitude *= gain;
            }

            return y;
        },
        [noise2D]
    );

    const getCornerPoint = useCallback((centerX, centerY, radius, startAngle, arcLength, progress) => {
        const angle = startAngle + progress * arcLength;
        return {
            x: centerX + radius * Math.cos(angle),
            y: centerY + radius * Math.sin(angle)
        };
    }, []);

    const getRoundedRectPoint = useCallback(
        (t, left, top, width, height, radius) => {
            const straightWidth = width - 2 * radius;
            const straightHeight = height - 2 * radius;
            const cornerArc = (Math.PI * radius) / 2;
            const totalPerimeter = 2 * straightWidth + 2 * straightHeight + 4 * cornerArc;
            const distance = (t % 1) * totalPerimeter;

            let current = 0;
            // Top edge
            if (distance < (current + straightWidth)) {
                return { x: left + radius + (distance - current), y: top };
            }
            current += straightWidth;

            // Top right corner
            if (distance < (current + cornerArc)) {
                return getCornerPoint(left + width - radius, top + radius, radius, -Math.PI / 2, Math.PI / 2, (distance - current) / cornerArc);
            }
            current += cornerArc;

            // Right edge
            if (distance < (current + straightHeight)) {
                return { x: left + width, y: top + radius + (distance - current) };
            }
            current += straightHeight;

            // Bottom right corner
            if (distance < (current + cornerArc)) {
                return getCornerPoint(left + width - radius, top + height - radius, radius, 0, Math.PI / 2, (distance - current) / cornerArc);
            }
            current += cornerArc;

            // Bottom edge
            if (distance < (current + straightWidth)) {
                return { x: left + width - radius - (distance - current), y: top + height };
            }
            current += straightWidth;

            // Bottom left corner
            if (distance < (current + cornerArc)) {
                return getCornerPoint(left + radius, top + height - radius, radius, Math.PI / 2, Math.PI / 2, (distance - current) / cornerArc);
            }
            current += cornerArc;

            // Left edge
            if (distance < (current + straightHeight)) {
                return { x: left, y: top + height - radius - (distance - current) };
            }
            current += straightHeight;

            // Top left corner
            return getCornerPoint(left + radius, top + radius, radius, Math.PI, Math.PI / 2, (distance - current) / cornerArc);
        },
        [getCornerPoint]
    );

    useEffect(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const octaves = 3;
        const lacunarity = 2.0;
        const gain = 0.5;
        const displacement = 8;
        const borderPadding = 30;

        const updateSize = () => {
            const w = container.offsetWidth;
            const h = container.offsetHeight;

            const canvasW = w + borderPadding * 2;
            const canvasH = h + borderPadding * 2;

            const dpr = window.devicePixelRatio || 1;
            canvas.width = canvasW * dpr;
            canvas.height = canvasH * dpr;
            canvas.style.width = `${canvasW}px`;
            canvas.style.height = `${canvasH}px`;

            return { w, h, dpr };
        };

        let { w, h, dpr } = updateSize();
        lastFrameTimeRef.current = performance.now();

        const draw = currentTime => {
            if (!canvas || !ctx) return;

            // Handle the first frame and huge jumps
            if (!lastFrameTimeRef.current) lastFrameTimeRef.current = currentTime;
            let delta = (currentTime - lastFrameTimeRef.current) / 1000;
            if (delta > 0.1) delta = 0.1; // Cap delta to prevent teleports

            timeRef.current += delta * speed;
            lastFrameTimeRef.current = currentTime;

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.save();
            ctx.scale(dpr, dpr);

            ctx.strokeStyle = color;
            ctx.lineWidth = 1.5;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            // Use multiple strokes instead of shadowBlur for better performance/reliability
            ctx.globalAlpha = 0.3;
            ctx.lineWidth = 4;
            drawPath(ctx, 0.5);
            ctx.stroke();

            ctx.globalAlpha = 1.0;
            ctx.lineWidth = 1.5;
            drawPath(ctx, 1.0);
            ctx.stroke();

            ctx.restore();
            animationRef.current = requestAnimationFrame(draw);
        };

        function drawPath(context, noiseScale) {
            context.beginPath();
            const radius = Math.min(borderRadius, Math.min(w, h) / 2);
            const perimeter = 2 * (w + h) + (2 * Math.PI * radius) - (8 * radius);
            const stepCount = 180; // High enough for smoothness, low enough for performance

            const drawW = w + 2;
            const drawH = h + 2;
            const drawLeft = borderPadding - 1;
            const drawTop = borderPadding - 1;

            for (let i = 0; i <= stepCount; i++) {
                const t = i / stepCount;
                const basePoint = getRoundedRectPoint(t, drawLeft, drawTop, drawW, drawH, radius);

                // Faster, tighter noise
                const xNoise = octavedNoise(t * 5, octaves, lacunarity, gain, chaos * noiseScale, 2, timeRef.current, 0);
                const yNoise = octavedNoise(t * 5, octaves, lacunarity, gain, chaos * noiseScale, 2, timeRef.current, 1);

                const dx = basePoint.x + xNoise * displacement;
                const dy = basePoint.y + yNoise * displacement;

                if (i === 0) context.moveTo(dx, dy);
                else context.lineTo(dx, dy);
            }
        }

        const ro = new ResizeObserver(() => {
            const size = updateSize();
            w = size.w; h = size.h; dpr = size.dpr;
        });
        ro.observe(container);

        animationRef.current = requestAnimationFrame(draw);

        return () => {
            cancelAnimationFrame(animationRef.current);
            ro.disconnect();
        };
    }, [color, speed, chaos, borderRadius, octavedNoise, getRoundedRectPoint]);

    return html`
    <div ref=${containerRef} class=${`electric-border ${className}`} style=${{ ...style, '--electric-border-color': color, borderRadius: `${borderRadius}px` }}>
        <div class="eb-canvas-container">
            <canvas ref=${canvasRef} class="eb-canvas" />
        </div>
        <div class="eb-layers">
            <div class="eb-glow-1" />
            <div class="eb-glow-2" />
        </div>
        <div class="eb-content">${children}</div>
    </div>`;
};

export default ElectricBorder;
