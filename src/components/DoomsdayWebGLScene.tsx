import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { AtmosphereMode } from '../utils/atmosphere';

interface DoomsdayWebGLSceneProps {
  accentHex: string;
  mode: AtmosphereMode;
}

export function DoomsdayWebGLScene({ accentHex, mode }: DoomsdayWebGLSceneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const accentRef = useRef(accentHex);
  const modeRef = useRef(mode);

  useEffect(() => {
    accentRef.current = accentHex;
  }, [accentHex]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
      });
    } catch {
      return;
    }

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x020503, 0.035);

    const camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 100);
    camera.position.set(0, 0.2, 11.5);

    // 3D Volumetric Particle Field
    const PARTICLE_COUNT = 420;
    const particlePositions = new Float32Array(PARTICLE_COUNT * 3);
    const particleSpeeds = new Float32Array(PARTICLE_COUNT);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particlePositions[i * 3] = (Math.random() - 0.5) * 22;
      particlePositions[i * 3 + 1] = (Math.random() - 0.5) * 14;
      particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 14 - 2;
      particleSpeeds[i] = 0.2 + Math.random() * 0.65;
    }

    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));

    const particleMat = new THREE.PointsMaterial({
      color: new THREE.Color(accentHex),
      size: 0.065,
      transparent: true,
      opacity: 0.68,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    // Pointer & Scroll state
    let pointerX = 0;
    let pointerY = 0;
    let smoothX = 0;
    let smoothY = 0;
    let scrollProgress = 0;

    const handlePointerMove = (e: PointerEvent) => {
      const w = window.innerWidth || 1440;
      const h = window.innerHeight || 900;
      pointerX = (e.clientX / w - 0.5) * 2;
      pointerY = (e.clientY / h - 0.5) * 2;
    };

    const handleScroll = () => {
      const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      scrollProgress = Math.min(1, Math.max(0, window.scrollY / maxScroll));
    };

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize);
    handleScroll();

    const targetColor = new THREE.Color(accentHex);
    const timer = new THREE.Timer();
    timer.connect(document);

    const updateFrame = (elapsed: number, delta: number) => {
      const isSurge = modeRef.current === 'ember-surge';
      const surgeMult = isSurge ? 2.4 : 1.0;

      targetColor.set(accentRef.current);
      particleMat.color.lerp(targetColor, 0.06);

      smoothX += (pointerX - smoothX) * 0.05;
      smoothY += (pointerY - smoothY) * 0.05;

      camera.position.x = smoothX * 0.75;
      camera.position.y = 0.2 - smoothY * 0.45 - scrollProgress * 0.8;
      camera.position.z = 11.5 - scrollProgress * 2.1;
      camera.lookAt(0, 0.2 - scrollProgress * 0.6, -2.5);

      const posAttr = particleGeo.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        let y = posAttr.getY(i) + delta * particleSpeeds[i] * surgeMult;
        if (y > 7) y = -7;
        posAttr.setY(i, y);
      }
      posAttr.needsUpdate = true;
      particles.rotation.y = elapsed * 0.025 + smoothX * 0.08;
    };

    if (prefersReducedMotion) {
      updateFrame(0, 0);
      renderer.render(scene, camera);
    } else {
      let rafId = 0;
      const animate = () => {
        timer.update();
        const delta = Math.min(timer.getDelta(), 0.05);
        const elapsed = timer.getElapsed();
        updateFrame(elapsed, delta);
        renderer.render(scene, camera);
        rafId = window.requestAnimationFrame(animate);
      };
      rafId = window.requestAnimationFrame(animate);

      return () => {
        window.cancelAnimationFrame(rafId);
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('scroll', handleScroll);
        window.removeEventListener('resize', handleResize);
        particleGeo.dispose();
        particleMat.dispose();
        renderer.dispose();
        if (renderer.domElement.parentNode === container) {
          container.removeChild(renderer.domElement);
        }
      };
    }

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
      particleGeo.dispose();
      particleMat.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      data-testid="webgl-3d-stage"
      className="pointer-events-none fixed inset-0 z-[5] opacity-85"
    />
  );
}
