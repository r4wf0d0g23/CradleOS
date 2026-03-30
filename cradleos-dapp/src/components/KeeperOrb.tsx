/**
 * KeeperOrb — tiny self-contained rotating wireframe octahedron for the header.
 * No scanlines, no overlays, just the diamond geometry.
 */
import { useRef, useEffect } from "react";
import * as THREE from "three";

interface KeeperOrbProps {
  size?: number;
  onClick?: () => void;
  title?: string;
}

export default function KeeperOrb({ size = 44, onClick, title }: KeeperOrbProps) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(size, size);
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.set(0, 0.4, 2.6);
    camera.lookAt(0, 0, 0);

    const geo = new THREE.OctahedronGeometry(0.72, 0);
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0xff4700,
      opacity: 0.7,
      transparent: true,
      wireframe: true,
    });
    const solidMat = new THREE.MeshBasicMaterial({
      color: 0xff4700,
      opacity: 0.06,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const diamond = new THREE.Group();
    diamond.add(new THREE.Mesh(geo, solidMat));
    diamond.add(new THREE.Mesh(geo.clone(), wireMat));
    scene.add(diamond);

    let frameId: number;
    let t = 0;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      t += 0.012;
      diamond.rotation.y = t * 0.5;
      diamond.rotation.x = Math.sin(t * 0.35) * 0.18;
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      geo.dispose();
      wireMat.dispose();
      solidMat.dispose();
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, [size]);

  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        background: "none",
        border: "none",
        padding: 0,
        cursor: "pointer",
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: 0.22,
        transition: "opacity 0.3s, filter 0.3s",
        filter: "drop-shadow(0 0 4px rgba(255,71,0,0.3))",
        flexShrink: 0,
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLButtonElement).style.opacity = "0.75";
        (e.currentTarget as HTMLButtonElement).style.filter = "drop-shadow(0 0 10px rgba(255,71,0,0.8))";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.opacity = "0.22";
        (e.currentTarget as HTMLButtonElement).style.filter = "drop-shadow(0 0 4px rgba(255,71,0,0.3))";
      }}
    >
      <div ref={mountRef} style={{ width: size, height: size, pointerEvents: "none" }} />
    </button>
  );
}
