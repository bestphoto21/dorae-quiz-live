let canvas;
let context;
let animationFrame = 0;
let particles = [];

const defaultColors = [
  "#ff2d75",
  "#00c8ff",
  "#ffe600",
  "#ff7a00",
  "#9b5cff",
  "#ff2b2b",
  "#ffffff",
];

function setupCanvas(zIndex) {
  if (canvas && context) {
    canvas.style.zIndex = String(zIndex);
    resizeCanvas();
    return;
  }

  canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.position = "fixed";
  canvas.style.inset = "0";
  canvas.style.width = "100vw";
  canvas.style.height = "100vh";
  canvas.style.pointerEvents = "none";
  canvas.style.zIndex = String(zIndex);
  document.body.appendChild(canvas);
  context = canvas.getContext("2d");
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);
}

function resizeCanvas() {
  if (!canvas) {
    return;
  }

  const pixelRatio = window.devicePixelRatio || 1;
  canvas.width = Math.ceil(window.innerWidth * pixelRatio);
  canvas.height = Math.ceil(window.innerHeight * pixelRatio);
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;

  if (context) {
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  }
}

function removeCanvas() {
  if (animationFrame) {
    window.cancelAnimationFrame(animationFrame);
    animationFrame = 0;
  }

  particles = [];
  window.removeEventListener("resize", resizeCanvas);
  canvas?.remove();
  canvas = undefined;
  context = undefined;
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function createParticle(options) {
  const {
    origin,
    colors,
    spread,
    startVelocity,
    scalar,
    ticks,
    gravity,
    decay,
  } = options;
  const startX = window.innerWidth * origin.x;
  const startY = window.innerHeight * origin.y;
  const angle = -Math.PI / 2 + ((Math.random() - 0.5) * spread * Math.PI) / 180;
  const velocity = startVelocity * randomBetween(0.62, 1.12);
  const shape = Math.random();
  const baseSize = randomBetween(5, 12) * scalar;

  return {
    x: startX,
    y: startY,
    velocityX: Math.cos(angle) * velocity,
    velocityY: Math.sin(angle) * velocity,
    wobble: Math.random() * Math.PI * 2,
    wobbleSpeed: randomBetween(0.08, 0.2),
    tilt: randomBetween(-Math.PI, Math.PI),
    tiltSpeed: randomBetween(-0.18, 0.18),
    color: colors[Math.floor(Math.random() * colors.length)] || "#ffffff",
    width: shape > 0.68 ? baseSize * randomBetween(1.6, 2.6) : baseSize,
    height: shape > 0.32 ? baseSize * randomBetween(0.55, 1.15) : baseSize,
    radius: shape > 0.86 ? baseSize * 0.5 : 0,
    opacity: 1,
    tick: 0,
    ticks,
    decay,
    gravity,
  };
}

function drawParticle(particle) {
  if (!context) {
    return;
  }

  const progress = particle.tick / particle.ticks;
  const alpha = Math.max(0, 1 - progress * progress);
  const wobbleX = Math.cos(particle.wobble) * 9;

  context.save();
  context.globalAlpha = alpha;
  context.translate(particle.x + wobbleX, particle.y);
  context.rotate(particle.tilt);
  context.fillStyle = particle.color;

  if (particle.radius) {
    context.beginPath();
    context.arc(0, 0, particle.radius, 0, Math.PI * 2);
    context.fill();
  } else {
    context.fillRect(
      -particle.width / 2,
      -particle.height / 2,
      particle.width,
      particle.height
    );
  }

  context.restore();
}

function updateParticle(particle) {
  particle.tick += 1;
  particle.velocityX *= particle.decay;
  particle.velocityY *= particle.decay;
  particle.velocityY += particle.gravity;
  particle.x += particle.velocityX;
  particle.y += particle.velocityY;
  particle.wobble += particle.wobbleSpeed;
  particle.tilt += particle.tiltSpeed;

  return particle.tick < particle.ticks && particle.y < window.innerHeight + 120;
}

function animate() {
  if (!context || !canvas) {
    return;
  }

  context.clearRect(0, 0, window.innerWidth, window.innerHeight);
  particles.forEach(drawParticle);
  particles = particles.filter(updateParticle);

  if (particles.length === 0) {
    removeCanvas();
    return;
  }

  animationFrame = window.requestAnimationFrame(animate);
}

export default function confetti(options = {}) {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.resolve(null);
  }

  const normalized = {
    particleCount: Math.max(0, Math.round(options.particleCount ?? 50)),
    spread: options.spread ?? 45,
    startVelocity: options.startVelocity ?? 45,
    scalar: options.scalar ?? 1,
    ticks: Math.max(1, Math.round(options.ticks ?? 200)),
    gravity: options.gravity ?? 1,
    decay: options.decay ?? 0.9,
    origin: {
      x: options.origin?.x ?? 0.5,
      y: options.origin?.y ?? 0.5,
    },
    colors: options.colors?.length ? options.colors : defaultColors,
    zIndex: options.zIndex ?? 100,
  };

  setupCanvas(normalized.zIndex);
  particles.push(
    ...Array.from({ length: normalized.particleCount }, () =>
      createParticle(normalized)
    )
  );

  if (!animationFrame) {
    animationFrame = window.requestAnimationFrame(animate);
  }

  return Promise.resolve(null);
}
