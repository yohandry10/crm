"use client"

import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence, cubicBezier } from "framer-motion"
import { Atom, Loader2, Cpu, Network, Zap, Database, Satellite, Infinity as InfinityIcon } from "lucide-react"
import * as THREE from 'three'

// Use the exact same logic as before for the internal sphere of the preloader
// to reuse the existing code effectively but encapsulated.
function QuantumSphereInternal() {
    const mountRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!mountRef.current) return

        const scene = new THREE.Scene()
        const camera = new THREE.PerspectiveCamera(60, mountRef.current.clientWidth / mountRef.current.clientHeight, 0.1, 1000)
        camera.position.z = 8

        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" })
        renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight)
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        renderer.setClearColor(0x000000, 0)
        mountRef.current.appendChild(renderer.domElement)

        const ambientLight = new THREE.AmbientLight(0x00ffff, 0.3)
        scene.add(ambientLight)
        const pointLight = new THREE.PointLight(0x0080ff, 1.5, 100)
        pointLight.position.set(10, 10, 10)
        scene.add(pointLight)

        const sphereGeometry = new THREE.IcosahedronGeometry(2, 3)
        const sphereMaterial = new THREE.MeshPhongMaterial({
            color: 0x00ffff, transparent: true, opacity: 0.15, wireframe: true, emissive: 0x0080ff, emissiveIntensity: 0.2, shininess: 100
        })
        const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial)
        scene.add(sphere)

        const ringGeometry = new THREE.TorusGeometry(3.5, 0.05, 16, 100)
        const ringMaterial = new THREE.MeshBasicMaterial({ color: 0x0080ff, transparent: true, opacity: 0.3, side: THREE.DoubleSide })
        const rings: THREE.Mesh[] = []
        for (let i = 0; i < 3; i++) {
            const ring = new THREE.Mesh(ringGeometry, ringMaterial)
            ring.rotation.x = Math.PI / 2
            ring.rotation.y = (i * Math.PI) / 3
            scene.add(ring)
            rings.push(ring)
        }

        const particleCount = 200
        const positions = new Float32Array(particleCount * 3)
        const colors = new Float32Array(particleCount * 3)

        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3
            const radius = 3 + Math.random() * 2
            const theta = Math.random() * Math.PI * 2
            const phi = Math.random() * Math.PI
            positions[i3] = radius * Math.sin(phi) * Math.cos(theta)
            positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta)
            positions[i3 + 2] = radius * Math.cos(phi)
            colors[i3] = Math.random() > 0.5 ? 0.0 : 1.0
            colors[i3 + 1] = Math.random() > 0.3 ? 1.0 : 0.5
            colors[i3 + 2] = Math.random() > 0.5 ? 1.0 : 0.0
        }

        const particleGeometry = new THREE.BufferGeometry()
        particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
        particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
        const particleMaterial = new THREE.PointsMaterial({ size: 0.05, vertexColors: true, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending })
        const particles = new THREE.Points(particleGeometry, particleMaterial)
        scene.add(particles)

        let animationId: number
        let time = 0
        const animate = () => {
            animationId = requestAnimationFrame(animate)
            time += 0.016
            sphere.rotation.x = time * 0.2
            sphere.rotation.y = time * 0.3
            sphere.scale.setScalar(1 + Math.sin(time) * 0.1)
            rings.forEach((ring, i) => { ring.rotation.z = time * (0.1 + i * 0.05) })

            const positions = particleGeometry.attributes.position.array as Float32Array
            for (let i = 0; i < particleCount; i++) {
                const i3 = i * 3
                const radius = 3 + Math.sin(time * 0.5 + i) * 0.5
                const theta = time * 0.1 + i * 0.01
                const phi = time * 0.05 + i * 0.02
                positions[i3] = radius * Math.sin(phi) * Math.cos(theta)
                positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta)
                positions[i3 + 2] = radius * Math.cos(phi)
            }
            particleGeometry.attributes.position.needsUpdate = true
            camera.position.x = Math.sin(time * 0.1) * 1
            camera.position.y = Math.cos(time * 0.08) * 0.5
            camera.lookAt(0, 0, 0)
            renderer.render(scene, camera)
        }
        animate()

        const handleResize = () => {
            if (!mountRef.current) return
            const width = mountRef.current.clientWidth
            const height = mountRef.current.clientHeight
            camera.aspect = width / height
            camera.updateProjectionMatrix()
            renderer.setSize(width, height)
        }
        window.addEventListener('resize', handleResize)

        return () => {
            cancelAnimationFrame(animationId)
            window.removeEventListener('resize', handleResize)
            sphereGeometry.dispose(); sphereMaterial.dispose(); ringGeometry.dispose(); ringMaterial.dispose(); particleGeometry.dispose(); particleMaterial.dispose(); renderer.dispose()
            if (mountRef.current && renderer.domElement) mountRef.current.removeChild(renderer.domElement)
        }
    }, [])

    return <div ref={mountRef} className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,0,0,0)_0%,rgba(0,20,40,0.3)_100%)]" />
}

export function QuantumPreloader({ onComplete }: { onComplete: () => void }) {
    const [phase, setPhase] = useState(0)
    const [progress, setProgress] = useState(0)
    const [isExiting, setIsExiting] = useState(false)
    const [glitch, setGlitch] = useState(false)
    const [modules, setModules] = useState([
        { name: "NÚCLEO CUÁNTICO", progress: 0, active: false },
        { name: "RED NEURONAL", progress: 0, active: false },
        { name: "MATRIZ ENERGÉTICA", progress: 0, active: false },
        { name: "FLUJO DE DATOS", progress: 0, active: false }
    ])

    const quantumEase = cubicBezier(0.16, 1, 0.3, 1)
    const phaseRef = useRef(0)

    useEffect(() => {
        const sequence = [
            { delay: 300, action: () => { setPhase(1); phaseRef.current = 1 } },
            { delay: 800, action: () => { setModules(prev => prev.map((m, i) => i === 0 ? { ...m, active: true } : m)) } },
            { delay: 1300, action: () => { setPhase(2); phaseRef.current = 2 } },
            { delay: 1800, action: () => { setModules(prev => prev.map((m, i) => i === 1 ? { ...m, active: true } : m)) } },
            { delay: 2300, action: () => { setPhase(3); phaseRef.current = 3 } },
            { delay: 2800, action: () => { setModules(prev => prev.map((m, i) => i === 2 ? { ...m, active: true } : m)) } },
            { delay: 3300, action: () => { setPhase(4); phaseRef.current = 4 } },
            { delay: 3800, action: () => { setModules(prev => prev.map((m, i) => i === 3 ? { ...m, active: true } : m)) } },
            { delay: 4300, action: () => { setPhase(5); phaseRef.current = 5 } },
            {
                delay: 4800, action: () => {
                    setIsExiting(true)
                    window.scrollTo(0, 0)
                    setTimeout(() => {
                        window.scrollTo(0, 0)
                        onComplete()
                    }, 800)
                }
            }
        ]

        const glitchInterval = setInterval(() => {
            if (Math.random() > 0.7 && phaseRef.current > 1) { setGlitch(true); setTimeout(() => setGlitch(false), 80) }
        }, 1500)

        const progressInterval = setInterval(() => {
            setProgress(prev => { if (prev >= 100) { clearInterval(progressInterval); return 100 } return prev + (100 / 48) })
        }, 48)

        const moduleInterval = setInterval(() => {
            setModules(prev => prev.map(module => ({
                ...module,
                progress: module.active ? Math.min(module.progress + Math.random() * 4, 100) : module.progress
            })))
        }, 200)

        const timers = sequence.map(({ delay, action }) => setTimeout(action, delay))

        return () => { clearInterval(progressInterval); clearInterval(moduleInterval); clearInterval(glitchInterval); timers.forEach(timer => clearTimeout(timer)) }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const systemMessages = [
        "INICIALIZANDO CAMPO CUÁNTICO...", "CALIBRANDO PATRONES NEURONALES...", "SINCRONIZANDO MATRIZ ENERGÉTICA...",
        "ESTABLECIENDO FLUJO DE DATOS...", "SISTEMA CUÁNTICO ACTIVO", "¡BIENVENIDO A NEON SYSTEM!"
    ]
    const currentMessage = systemMessages[Math.min(phase, systemMessages.length - 1)]

    return (
        <AnimatePresence mode="wait">
            {!isExiting && (
                <motion.div
                    key="quantum-preloader"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1, filter: glitch ? "contrast(2) saturate(3) brightness(1.2)" : "none" }}
                    exit={{ opacity: 0, scale: 1.1, filter: "blur(20px) contrast(2)", y: -30 }}
                    transition={{ duration: 1.2, ease: quantumEase, filter: { duration: 0.1 } }}
                    className="fixed inset-0 z-[99999] overflow-hidden bg-gradient-to-br from-gray-950 via-black to-gray-950"
                >
                    <QuantumSphereInternal />
                    <motion.div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-500/5 to-transparent" animate={{ x: ["-100%", "200%"], opacity: [0, 0.1, 0] }} transition={{ x: { duration: 3, repeat: Infinity, ease: "linear" }, opacity: { duration: 3, repeat: Infinity } }} />
                    <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-4 md:p-8">
                        <div className="w-full max-w-6xl mx-auto">
                            <motion.div initial={{ opacity: 0, y: -30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 0.2 }} className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 md:mb-16">
                                <div className="flex items-center gap-3 mb-4 md:mb-0">
                                    <motion.div animate={{ rotate: 360, scale: [1, 1.1, 1] }} transition={{ rotate: { duration: 8, repeat: Infinity, ease: "linear" }, scale: { duration: 2, repeat: Infinity } }} className="relative">
                                        <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/30"><Atom className="w-5 h-5 md:w-6 md:h-6 text-white" /></div>
                                        <motion.div className="absolute -inset-2 rounded-full border-2 border-cyan-400/30" animate={{ rotate: -360 }} transition={{ duration: 12, repeat: Infinity, ease: "linear" }} />
                                    </motion.div>
                                    <div><div className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">NEON SYSTEM</div><div className="text-xs text-gray-400 tracking-widest">QUANTUM EDITION v2.1</div></div>
                                </div>
                                <div className="text-right"><div className="text-xs text-gray-400 mb-1">SISTEMA CUÁNTICO</div><div className="font-mono text-sm text-cyan-300">{">"} ESTADO: {phase >= 4 ? "ACTIVO" : "INICIANDO"}</div></div>
                            </motion.div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-16 items-center">
                                <div className="relative h-64 md:h-96 flex items-center justify-center">
                                    <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1, delay: 0.5 }} className="absolute top-4 left-4 bg-black/50 backdrop-blur-sm rounded-lg p-3 border border-cyan-500/20">
                                        <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" /><span className="text-xs text-cyan-300">TRANSMISIÓN EN VIVO</span></div>
                                        <div className="font-mono text-xs text-gray-300 mt-1">PARTÍCULAS: 200</div>
                                    </motion.div>
                                    <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1, delay: 0.7 }} className="absolute bottom-4 right-4 bg-black/50 backdrop-blur-sm rounded-lg p-3 border border-purple-500/20">
                                        <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" /><span className="text-xs text-purple-300">ENERGÍA</span></div>
                                        <div className="font-mono text-xs text-gray-300 mt-1">{Math.round(progress)}% ESTABLE</div>
                                    </motion.div>
                                </div>
                                <div className="space-y-6 md:space-y-8">
                                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, delay: 0.3 }} className="text-center md:text-left">
                                        <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent mb-2">INICIALIZACIÓN CUÁNTICA</h1>
                                        <p className="text-sm text-gray-400">Cargando interfaz multidimensional...</p>
                                    </motion.div>
                                    <motion.div key={phase} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="bg-black/30 backdrop-blur-sm rounded-lg p-4 border border-cyan-500/20">
                                        <div className="font-mono text-base md:text-lg text-cyan-300 mb-1">{">"} {currentMessage}</div>
                                        <div className="text-xs text-gray-400">Fase {phase}/5 • {modules.filter(m => m.active).length}/{modules.length} módulos</div>
                                    </motion.div>
                                    <div className="space-y-3">
                                        <div className="flex justify-between text-sm"><span className="text-gray-300">INTEGRIDAD DEL SISTEMA</span><span className="font-mono text-cyan-300">{Math.round(progress)}%</span></div>
                                        <div className="relative h-2 bg-gray-900 rounded-full overflow-hidden">
                                            <motion.div className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500" initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ type: "spring", damping: 25 }}>
                                                <motion.div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent" animate={{ x: ["-100%", "100%"] }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }} />
                                            </motion.div>
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="text-sm text-gray-300 mb-2">MÓDULOS DEL SISTEMA</div>
                                        {modules.map((module, i) => (
                                            <motion.div key={module.name} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: i * 0.1 }} className="space-y-1">
                                                <div className="flex justify-between items-center">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-2 h-2 rounded-full ${module.active ? 'bg-cyan-500 animate-pulse' : 'bg-gray-700'}`} />
                                                        <span className={`text-sm ${module.active ? 'text-cyan-300' : 'text-gray-500'}`}>{module.name}</span>
                                                    </div>
                                                    <span className="font-mono text-xs text-gray-400">{Math.round(module.progress)}%</span>
                                                </div>
                                                <div className="h-1 bg-gray-900 rounded-full overflow-hidden">
                                                    <motion.div className={`h-full ${module.active ? 'bg-gradient-to-r from-cyan-500 to-blue-500' : 'bg-gray-800'}`} initial={{ width: 0 }} animate={{ width: `${module.progress}%` }} transition={{ duration: 0.5, delay: i * 0.15 }} />
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 pt-4">
                                        {[{ icon: Cpu, label: "QUBITS", value: "512", color: "text-cyan-400" }, { icon: Network, label: "ENTRELAZAMIENTO", value: "98.7%", color: "text-purple-400" }, { icon: Zap, label: "ENERGÍA", value: "∞", color: "text-yellow-400" }, { icon: Database, label: "FLUJO", value: "42TB/s", color: "text-green-400" }].map((item, i) => (
                                            <motion.div key={item.label} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, delay: 0.5 + i * 0.1 }} className="bg-black/30 backdrop-blur-sm rounded-lg p-3 border border-gray-800">
                                                <div className="flex items-center gap-2 mb-1"><item.icon className={`w-4 h-4 ${item.color}`} /><span className="text-xs text-gray-400">{item.label}</span></div>
                                                <div className={`font-mono text-lg ${item.color}`}>{item.value}</div>
                                            </motion.div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 0.8 }} className="mt-8 md:mt-12 text-center">
                                <div className="inline-flex flex-wrap items-center justify-center gap-4 md:gap-6 text-xs text-gray-500">
                                    <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" /><span>SISTEMA ESTABLE</span></div>
                                    <div className="flex items-center gap-2"><Satellite className="w-3.5 h-3.5" /><span>SINCRONIZACIÓN</span></div>
                                    <div className="flex items-center gap-2"><InfinityIcon className="w-3.5 h-3.5" /><span>BUCLE CUÁNTICO</span></div>
                                </div>
                            </motion.div>
                        </div>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 h-16 overflow-hidden">
                        {Array.from({ length: 20 }).map((_, i) => (
                            <motion.div key={i} className={`absolute bottom-0 w-px bg-gradient-to-t from-cyan-500/30 to-transparent left-[${i * 5}%]`} animate={{ height: [0, Math.random() * 40 + 20, 0], opacity: [0, 0.6, 0] }} transition={{ duration: 1.5 + Math.random(), repeat: Infinity, delay: i * 0.08, ease: "easeInOut" }} />
                        ))}
                    </div>
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: phase >= 5 ? 1 : 0 }} className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex items-center gap-2">
                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}><Loader2 className="w-4 h-4 text-cyan-400" /></motion.div><span className="text-xs text-gray-400">Redirigiendo...</span>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
