/* Shared, original contour animation. Canvas 2D only; no remote assets.
   A dark default, optional saved colours and motion preferences work sitewide. */
(() => {
    'use strict';

    // Public console pages use static presentation; return before canvas/DOM work.
    if (window.WWB_HOST_CONSOLE === true || window.WhatsiteConsoleLite && window.WhatsiteConsoleLite.enabled) return;

    if (!document.body || window.__siteFlowBackground) return;
    window.__siteFlowBackground = true;
    document.body.classList.add('site-atmosphere');

    const palettes = {
        dark: { label: 'Dark', colors: ['144, 144, 150', '93, 93, 101', '173, 173, 179'] },
        emerald: { label: 'Emerald', colors: ['52, 211, 153', '45, 212, 191', '125, 211, 252'] },
        cobalt: { label: 'Cobalt', colors: ['96, 165, 250', '34, 211, 238', '167, 139, 250'] },
        violet: { label: 'Violet', colors: ['167, 139, 250', '129, 140, 248', '244, 114, 182'] },
        rose: { label: 'Rose', colors: ['251, 113, 133', '251, 146, 60', '244, 114, 182'] },
        amber: { label: 'Amber', colors: ['251, 191, 36', '251, 146, 60', '253, 224, 71'] },
        ice: { label: 'Ice', colors: ['103, 232, 249', '148, 163, 184', '147, 197, 253'] }
    };
    const hasPalette = (value) => Object.prototype.hasOwnProperty.call(palettes, value);
    const storageKey = 'whatwhatboy.backgroundPaused';
    const paletteKey = 'whatwhatboy.backgroundPalette';
    let selectedTheme = 'auto';
    let paused = false;
    try {
        const preference = localStorage.getItem(storageKey);
        paused = preference === null ? localStorage.getItem('whatwhatboy.home.backgroundPaused') === 'true' : preference === 'true';
        const savedTheme = localStorage.getItem(paletteKey);
        if (hasPalette(savedTheme) && savedTheme !== 'dark') selectedTheme = savedTheme;
    } catch { /* storage is optional */ }
    document.body.setAttribute('data-background-theme', selectedTheme === 'auto' ? 'dark' : selectedTheme);

    let surface = document.getElementById('site-flow-background');
    if (!surface) {
        surface = document.createElement('div');
        surface.id = 'site-flow-background';
        surface.className = 'site-flow-background';
        surface.setAttribute('aria-hidden', 'true');
        document.body.insertBefore(surface, document.body.firstChild);
    }
    let canvas = document.getElementById('site-flow-canvas');
    if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.id = 'site-flow-canvas';
        surface.appendChild(canvas);
    }
    let context;
    try { context = canvas.getContext('2d', { alpha: true }); } catch { return; }
    if (!context) return;

    let controls = document.getElementById('site-background-controls');
    if (!controls) {
        controls = document.createElement('div');
        controls.id = 'site-background-controls';
        controls.className = 'site-background-controls';
        controls.setAttribute('role', 'group');
        controls.setAttribute('aria-label', 'Background appearance');
        document.body.appendChild(controls);
    }
    // Keep saved appearance preferences without showing the floating controls.
    controls.hidden = true;
    let paletteSelect = document.getElementById('site-background-palette');
    if (!paletteSelect) {
        paletteSelect = document.createElement('select');
        paletteSelect.id = 'site-background-palette';
        paletteSelect.className = 'site-palette-select';
        paletteSelect.setAttribute('aria-label', 'Background colour');
        for (const [value, label] of [['auto', 'Dark (default)'], ...Object.entries(palettes).filter(([key]) => key !== 'dark').map(([key, palette]) => [key, palette.label])]) {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = label;
            paletteSelect.appendChild(option);
        }
        controls.appendChild(paletteSelect);
    }
    paletteSelect.value = selectedTheme;
    let toggle = document.getElementById('site-motion-toggle');
    if (!toggle) {
        toggle = document.createElement('button');
        toggle.id = 'site-motion-toggle';
        toggle.className = 'site-motion-toggle';
        toggle.setAttribute('type', 'button');
        controls.appendChild(toggle);
    }

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    let width = 0;
    let height = 0;
    let compact = false;
    let paths = [];
    let particles = [];
    let segments = 0;
    let frameId = 0;
    let lastFrame = null;
    let elapsed = 0;
    let suspended = false;
    let resizeTimer = 0;
    let inks = [];
    let colors = palettes.dark.colors;

    // Stable variation avoids the flicker caused by new random values per frame.
    const seed = (index) => {
        const value = Math.sin((index + 1) * 127.1) * 43758.5453;
        return value - Math.floor(value);
    };

    const canAnimate = () => !paused && !reducedMotion.matches && !document.hidden && !suspended;

    function paint(time) {
        context.clearRect(0, 0, width, height);
        const unit = Math.min(width, height);
        const aspectX = width / unit;
        const aspectY = height / unit;
        const phase = time * 0.105;
        const lowerX = aspectX * 0.03 + Math.sin(phase * 0.4) * 0.06;
        const lowerY = aspectY * 0.98;
        const upperX = aspectX * 0.96;
        const upperY = aspectY * 0.02 + Math.cos(phase * 0.35) * 0.05;

        context.lineCap = 'round';
        context.lineJoin = 'round';

        for (let line = 0; line < paths.length; line++) {
            const points = paths[line];
            const lane = line / (paths.length - 1);
            const baseY = (lane * 2.4 - 0.7) * aspectY;

            for (let point = 0; point <= segments; point++) {
                let x = (point / segments * 2.3 - 0.65) * aspectX;
                let y = baseY
                    + Math.sin(x * 3.2 + phase + baseY * 0.72) * 0.17
                    + Math.sin(x * 5.1 - phase * 0.65 - baseY * 0.55) * 0.075
                    + Math.sin(x * 1.4 + baseY * 1.8 + phase * 0.4) * 0.055;

                // Two smooth radial twists form the curled contour bundles.
                // Every strand uses the same deformation, so they flow together.
                let dx = x - lowerX;
                let dy = y - lowerY;
                let angle = (1.75 + Math.sin(phase * 0.65) * 0.18) * Math.exp(-(dx * dx + dy * dy) * 1.5);
                let cosine = Math.cos(angle);
                let sine = Math.sin(angle);
                x = lowerX + dx * cosine - dy * sine;
                y = lowerY + dx * sine + dy * cosine;

                dx = x - upperX;
                dy = y - upperY;
                angle = (-1.65 + Math.cos(phase * 0.5) * 0.2) * Math.exp(-(dx * dx + dy * dy) * 1.65);
                cosine = Math.cos(angle);
                sine = Math.sin(angle);
                x = upperX + dx * cosine - dy * sine;
                y = upperY + dx * sine + dy * cosine;

                points[point * 2] = x * unit;
                points[point * 2 + 1] = y * unit;
            }

            const highlighted = line % 10 === 0;
            context.strokeStyle = inks[line % inks.length];
            const alpha = highlighted ? 0.65 : 0.16 + seed(line) * 0.24;
            context.globalAlpha = alpha * (0.88 + Math.sin(time * 0.24 + line * 0.32) * 0.12);
            context.lineWidth = highlighted ? 1.15 : 0.55 + seed(line + 70) * 0.35;
            context.setLineDash(line % 17 === 4 ? [1, 12] : []);
            context.lineDashOffset = -time * (line % 2 ? 5 : -4);
            context.beginPath();
            context.moveTo(points[0], points[1]);
            for (let point = 1; point <= segments; point++) {
                context.lineTo(points[point * 2], points[point * 2 + 1]);
            }
            if (highlighted) {
                context.globalAlpha = 0.035;
                context.lineWidth = 4;
                context.stroke();
                context.globalAlpha = alpha;
                context.lineWidth = 1.15;
            }
            context.stroke();
        }

        context.setLineDash([]);
        context.globalAlpha = 1;
        for (const particle of particles) {
            const points = paths[particle.line];
            const position = ((particle.offset + time * particle.speed) % 1) * segments;
            const point = Math.floor(position);
            const mix = position - point;
            const next = Math.min(point + 1, segments);
            const x = points[point * 2] + (points[next * 2] - points[point * 2]) * mix;
            const y = points[point * 2 + 1] + (points[next * 2 + 1] - points[point * 2 + 1]) * mix;
            if (x < -4 || x > width + 4 || y < -4 || y > height + 4) continue;
            const shimmer = 0.7 + Math.sin(time * 0.65 + particle.offset * 12) * 0.3;

            context.fillStyle = `rgba(${colors[particle.line % colors.length]}, ${particle.opacity * shimmer})`;
            context.beginPath();
            context.arc(x, y, particle.radius, 0, Math.PI * 2);
            context.fill();
            if (particle.radius > 0.9) {
                context.strokeStyle = `rgba(${colors[particle.line % colors.length]}, 0.12)`;
                context.lineWidth = 0.6;
                context.beginPath();
                context.arc(x, y, particle.radius + 1.7, 0, Math.PI * 2);
                context.stroke();
            }
        }
    }

    function fit() {
        width = canvas.clientWidth || window.innerWidth;
        height = canvas.clientHeight || window.innerHeight;
        compact = width < 768;
        const pixelBudget = Math.sqrt(3000000 / (width * height));
        const ratio = Math.min(window.devicePixelRatio || 1, compact ? 1.25 : 1.5, pixelBudget);
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
        context.setTransform(ratio, 0, 0, ratio, 0, 0);

        segments = compact ? 104 : 168;
        paths = Array.from({ length: compact ? 88 : 124 }, () => new Float32Array((segments + 1) * 2));
        particles = Array.from({ length: compact ? 32 : 64 }, (_, index) => ({
            line: (index * 17 + 7) % paths.length,
            offset: seed(index + 200),
            speed: 0.009 + seed(index + 300) * 0.009,
            radius: 0.45 + seed(index + 400) * 0.65,
            opacity: 0.15 + seed(index + 500) * 0.34
        }));

        updateInks();
        paint(elapsed);
    }

    function updateInks() {
        const theme = selectedTheme === 'auto' ? 'dark' : selectedTheme;
        document.body.setAttribute('data-background-theme', theme);
        const styles = window.getComputedStyle?.(document.body);
        colors = palettes[theme].colors.map((fallback, index) => {
            const value = styles?.getPropertyValue(`--flow-color-${'abc'[index]}`).trim();
            return value && /^\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}$/.test(value) && value.split(',').every(channel => Number(channel) <= 255) ? value : fallback;
        });
        inks = colors.map((color, index) => {
            const ink = context.createLinearGradient(0, index % 2 ? height : 0, width, index % 2 ? 0 : height);
            ink.addColorStop(0, `rgba(${color}, 0.6)`);
            ink.addColorStop(0.3, `rgba(${colors[(index + 1) % colors.length]}, 0.28)`);
            ink.addColorStop(0.5, `rgba(${color}, 0.08)`);
            ink.addColorStop(0.72, `rgba(${colors[(index + 2) % colors.length]}, 0.36)`);
            ink.addColorStop(1, `rgba(${color}, 0.64)`);
            return ink;
        });
    }

    function animate(now) {
        frameId = 0;
        if (!canAnimate()) return;
        if (lastFrame === null) lastFrame = now;
        const delta = now - lastFrame;
        if (delta >= 1000 / (compact ? 24 : 30) - 1) {
            elapsed += Math.min(delta / 1000, 0.08);
            lastFrame = now;
            paint(elapsed);
        }
        frameId = requestAnimationFrame(animate);
    }

    function sync() {
        cancelAnimationFrame(frameId);
        frameId = 0;
        lastFrame = null;
        const running = canAnimate();
        document.body.classList.toggle('site-motion-paused', !running);
        surface.dataset.motion = running ? 'running' : reducedMotion.matches ? 'reduced' : 'paused';
        if (toggle) {
            toggle.hidden = reducedMotion.matches;
            const label = paused ? 'Resume background animation' : 'Pause background animation';
            toggle.setAttribute('aria-label', label);
            toggle.setAttribute('title', label);
            toggle.setAttribute('data-paused', String(paused));
        }
        if (running) frameId = requestAnimationFrame(animate);
        else if (!document.hidden) paint(elapsed);
    }

    toggle?.addEventListener('click', () => {
        paused = !paused;
        try { localStorage.setItem(storageKey, String(paused)); } catch { /* optional preference */ }
        sync();
    });
    paletteSelect.addEventListener('change', () => {
        const value = paletteSelect.value;
        selectedTheme = hasPalette(value) && value !== 'dark' ? value : 'auto';
        try { localStorage.setItem(paletteKey, selectedTheme); } catch { /* optional preference */ }
        updateInks();
        paint(elapsed);
    });
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => { fit(); sync(); }, 120);
    });
    document.addEventListener('visibilitychange', sync);
    if (reducedMotion.addEventListener) reducedMotion.addEventListener('change', sync);
    else reducedMotion.addListener(sync);
    window.addEventListener('pagehide', () => { suspended = true; sync(); });
    window.addEventListener('pageshow', () => { suspended = false; fit(); sync(); });

    fit();
    sync();
})();
