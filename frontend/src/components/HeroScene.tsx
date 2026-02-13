"use client";

import { Canvas } from "@react-three/fiber";
import { Float, OrbitControls } from "@react-three/drei";

const FloatingOrb = () => (
  <Float speed={1.4} rotationIntensity={0.6} floatIntensity={1.2}>
    <mesh>
      <icosahedronGeometry args={[1.2, 1]} />
      <meshStandardMaterial color="#c8794f" metalness={0.3} roughness={0.2} />
    </mesh>
  </Float>
);

export default function HeroScene() {
  return (
    <div className="relative h-[360px] w-full overflow-hidden rounded-[32px] border border-black/10 bg-[#fdf7ef] shadow-[0_24px_80px_-40px_rgba(0,0,0,0.4)]">
      <Canvas camera={{ position: [2.8, 2.2, 3.2], fov: 45 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[4, 4, 2]} intensity={1.2} />
        <FloatingOrb />
        <OrbitControls enableZoom={false} enablePan={false} />
      </Canvas>
      <div className="pointer-events-none absolute inset-0 grid-overlay" />
    </div>
  );
}
