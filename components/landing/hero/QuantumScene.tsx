"use client"

import { useRef, useMemo } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { Float, PerspectiveCamera } from "@react-three/drei"
import * as THREE from "three"

function QuantumSphere() {
    const meshRef = useRef<THREE.Mesh>(null)
    const particlesRef = useRef<THREE.Points>(null)

    // Particles data
    const particleCount = 200
    const positions = useMemo(() => {
        const pos = new Float32Array(particleCount * 3)
        for (let i = 0; i < particleCount; i++) {
            const theta = Math.random() * Math.PI * 2
            const phi = Math.random() * Math.PI
            const r = 3 + Math.random() * 2 // Radius between 3 and 5

            pos[i * 3] = r * Math.sin(phi) * Math.cos(theta)
            pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
            pos[i * 3 + 2] = r * Math.cos(phi)
        }
        return pos
    }, [])

    useFrame((state) => {
        const time = state.clock.getElapsedTime()

        if (meshRef.current) {
            meshRef.current.rotation.y = time * 0.1
            meshRef.current.rotation.x = Math.sin(time * 0.2) * 0.1
        }

        if (particlesRef.current) {
            particlesRef.current.rotation.y = time * 0.05
        }
    })

    return (
        <group>
            {/* Main Wireframe Sphere */}
            <mesh ref={meshRef}>
                <icosahedronGeometry args={[2.2, 2]} />
                <meshBasicMaterial
                    color="#06b6d4" // Cyan-500
                    wireframe
                    transparent
                    opacity={0.3}
                />
            </mesh>

            {/* Inner Glowing Core (Glass-like) */}
            <mesh>
                <icosahedronGeometry args={[2, 10]} />
                <meshPhysicalMaterial
                    color="#ecfeff" // Cyan-50
                    roughness={0}
                    metalness={0.1}
                    transmission={0.9} // Glass effect
                    transparent
                    opacity={0.5}
                    thickness={1}
                />
            </mesh>

            {/* Floating Particles */}
            <points ref={particlesRef}>
                <bufferGeometry>
                    <bufferAttribute attach="attributes-position" args={[positions, 3]} />
                </bufferGeometry>
                <pointsMaterial
                    size={0.08}
                    color="#22d3ee" // Cyan-400
                    transparent
                    opacity={0.8}
                    sizeAttenuation
                    depthWrite={false}
                />
            </points>

            {/* Orbital Rings */}
            <group rotation={[Math.PI / 3, 0, 0]}>
                <mesh>
                    <torusGeometry args={[3.2, 0.02, 16, 100]} />
                    <meshBasicMaterial color="#3b82f6" transparent opacity={0.2} />
                </mesh>
            </group>
            <group rotation={[-Math.PI / 3, 0, 0]}>
                <mesh>
                    <torusGeometry args={[3.8, 0.02, 16, 100]} />
                    <meshBasicMaterial color="#8b5cf6" transparent opacity={0.2} />
                </mesh>
            </group>

        </group>
    )
}

export default function QuantumScene() {
    return (
        <div className="absolute inset-0 z-0 pointer-events-none">
            <Canvas dpr={[1, 2]}>
                <PerspectiveCamera makeDefault position={[0, 0, 8]} fov={50} />

                {/* Lighting setup for the glass material */}
                <ambientLight intensity={1.5} />
                <pointLight position={[10, 10, 10]} intensity={1} color="#06b6d4" />
                <pointLight position={[-10, -10, -10]} intensity={0.5} color="#8b5cf6" />

                {/* Subtle environment for reflections */}
                {/* Extra directional light to replace environment reflections */}
                <directionalLight position={[5, 5, 5]} intensity={1} color="#ffffff" />
                <directionalLight position={[-5, 5, -5]} intensity={0.5} color="#06b6d4" />

                <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
                    <QuantumSceneContent />
                </Float>
            </Canvas>
        </div>
    )
}

function QuantumSceneContent() {
    return (
        <group position={[2, 0, 0]}> {/* Offset to the right slightly */}
            <QuantumSphere />
        </group>
    )
}
