const canvas = document.getElementById('snowfall');
const ctx = canvas.getContext('2d');
let particles = [];
let w, h;
let mouseX = -9999, mouseY = -9999;

function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
}
resize();
window.addEventListener('resize', resize);
document.addEventListener('mousemove', (e) => { mouseX = e.clientX; mouseY = e.clientY; });
document.addEventListener('mouseleave', () => { mouseX = -9999; mouseY = -9999; });

const SNOWFLAKE_COUNT = 200;
const HOLO_COLORS = ['#ffffff', '#ff0040', '#00e5ff', '#ff00aa', '#8800ff'];

class Particle {
    constructor() {
        this.reset();
    }

    reset() {
        this.x = Math.random() * w;
        this.y = -10;
        this.size = Math.random() * 4 + 1;
        this.speedY = Math.random() * 1.2 + 0.3;
        this.speedX = Math.random() * 0.4 - 0.2;
        this.opacity = Math.random() * 0.5 + 0.15;
        this.color = HOLO_COLORS[Math.floor(Math.random() * HOLO_COLORS.length)];
        this.wobble = Math.random() * Math.PI * 2;
        this.wobbleSpeed = Math.random() * 0.02 + 0.01;
        this.wobbleAmp = Math.random() * 0.5 + 0.2;
    }

    update() {
        this.wobble += this.wobbleSpeed;
        const dx = this.x - mouseX;
        const dy = this.y - mouseY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 100) {
            const force = (100 - dist) / 100;
            this.x += dx * force * 0.04;
            this.y += dy * force * 0.04;
        }
        this.x += this.speedX + Math.sin(this.wobble) * this.wobbleAmp;
        this.y += this.speedY;
        if (this.y > h + 15 || this.x < -20 || this.x > w + 20) this.reset();
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.globalAlpha = this.opacity;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
    }
}

function init() {
    particles = [];
    for (let i = 0; i < SNOWFLAKE_COUNT; i++) {
        const p = new Particle();
        p.y = Math.random() * h;
        particles.push(p);
    }
}
init();

function drawConnections() {
    for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
            const dx = particles[i].x - particles[j].x;
            const dy = particles[i].y - particles[j].y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 80) {
                ctx.beginPath();
                ctx.moveTo(particles[i].x, particles[i].y);
                ctx.lineTo(particles[j].x, particles[j].y);
                ctx.strokeStyle = 'rgba(255,255,255,0.04)';
                ctx.lineWidth = 0.5;
                ctx.stroke();
            }
        }
    }
}

function animate() {
    ctx.clearRect(0, 0, w, h);
    drawConnections();
    particles.forEach(p => { p.update(); p.draw(); });
    requestAnimationFrame(animate);
}
animate();

window.addEventListener('resize', () => { resize(); init(); });

function toggleNav() {
    document.querySelector('.nav-links').classList.toggle('show');
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('nav')) {
        document.querySelector('.nav-links').classList.remove('show');
    }
});

// --- Audio Player ---

const audioPlayerHTML = `
<div id="audio-player">
    <button id="ap-play" title="Play/Pause">&#9654;</button>
    <span id="ap-track">No track</span>
    <input type="range" id="ap-volume" min="0" max="1" step="0.05" value="0.5">
    <label id="ap-upload-label" title="Upload audio">&#128229;<input type="file" id="ap-upload" accept="audio/*" hidden></label>
</div>`;
document.body.insertAdjacentHTML('beforeend', audioPlayerHTML);

const audio = new Audio();
audio.volume = 0.5;
audio.loop = true;
const playBtn = document.getElementById('ap-play');
const trackLabel = document.getElementById('ap-track');
const volSlider = document.getElementById('ap-volume');
const fileInput = document.getElementById('ap-upload');
let isPlaying = false;

function togglePlay() {
    if (audio.src) {
        if (isPlaying) { audio.pause(); playBtn.innerHTML = '&#9654;'; }
        else { audio.play().catch(() => {}); playBtn.innerHTML = '&#9646;&#9646;'; }
        isPlaying = !isPlaying;
    }
}
playBtn.addEventListener('click', togglePlay);
volSlider.addEventListener('input', () => { audio.volume = volSlider.value; });
audio.addEventListener('ended', () => { isPlaying = false; playBtn.innerHTML = '&#9654;'; });
fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const url = URL.createObjectURL(file);
        audio.src = url;
        trackLabel.textContent = file.name;
        audio.play().catch(() => {});
        playBtn.innerHTML = '&#9646;&#9646;';
        isPlaying = true;
    }
});
fetch('music/bg.mp3', { method: 'HEAD' })
    .then(res => { if (res.ok) { audio.src = 'music/bg.mp3'; trackLabel.textContent = 'bg.mp3'; audio.play().catch(() => {}); playBtn.innerHTML = '&#9646;&#9646;'; isPlaying = true; }})
    .catch(() => {});

// --- Theme Toggle (Dark/Light) ---

const themeHTML = `<button id="theme-toggle" title="Toggle theme">&#9790;</button>`;
document.body.insertAdjacentHTML('beforeend', themeHTML);

const themeToggle = document.getElementById('theme-toggle');
const savedTheme = localStorage.getItem('cybersec-theme');
if (savedTheme === 'light') {
    document.body.classList.add('light-mode');
    themeToggle.innerHTML = '&#9790;';
}
themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('light-mode');
    const isLight = document.body.classList.contains('light-mode');
    localStorage.setItem('cybersec-theme', isLight ? 'light' : 'dark');
    themeToggle.innerHTML = isLight ? '&#9790;' : '&#9790;';
});

// --- Back to Top Button ---

const backTopHTML = `<button id="back-top" title="Back to top">&#8593;</button>`;
document.body.insertAdjacentHTML('beforeend', backTopHTML);
const backTop = document.getElementById('back-top');

window.addEventListener('scroll', () => {
    backTop.classList.toggle('show', window.scrollY > 400);
});
backTop.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

// --- Visitor Counter ---

const visitorHTML = `<div id="visitor-counter">Visitors: <span id="visitor-count">0</span></div>`;
document.body.insertAdjacentHTML('beforeend', visitorHTML);
let count = parseInt(localStorage.getItem('cybersec-visitors') || '0');
count++;
localStorage.setItem('cybersec-visitors', count);
document.getElementById('visitor-count').textContent = count;

// --- Page Transitions ---

document.body.classList.add('fade-in');
window.addEventListener('load', () => {
    document.body.classList.add('fade-in-active');
});

// --- Explore Modal ---

const exploreBtn = document.getElementById('explore-btn');
const exploreOverlay = document.getElementById('explore-overlay');
const exploreClose = document.getElementById('explore-close');

if (exploreBtn && exploreOverlay) {
    function openExplore() {
        exploreOverlay.classList.add('open');
        document.body.style.overflow = 'hidden';
    }

    function closeExplore() {
        exploreOverlay.classList.remove('open');
        document.body.style.overflow = '';
    }

    exploreBtn.addEventListener('click', openExplore);
    if (exploreClose) exploreClose.addEventListener('click', closeExplore);
    exploreOverlay.addEventListener('click', (e) => {
        if (e.target === exploreOverlay) closeExplore();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeExplore();
    });
}

// --- Typewriter Effect (homepage only) ---

const typewriterEl = document.getElementById('typewriter');
if (typewriterEl) {
    const text = typewriterEl.getAttribute('data-text') || 'Enter the digital dimension';
    typewriterEl.textContent = '';
    let i = 0;
    const cursor = document.createElement('span');
    cursor.className = 'typewriter-cursor';
    cursor.textContent = '|';
    typewriterEl.appendChild(cursor);

    function typeChar() {
        if (i < text.length) {
            cursor.insertAdjacentText('beforebegin', text[i]);
            i++;
            setTimeout(typeChar, 50 + Math.random() * 40);
        }
    }
    typeChar();
}
