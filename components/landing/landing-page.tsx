"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { motion, AnimatePresence, cubicBezier } from "framer-motion"
import * as THREE from 'three'
import { 
  ArrowRight, BarChart3, Users, Zap, Shield, Layers, Bot, Play, Menu, X,
  Cpu, Atom, Satellite, Network, Database,
  Infinity as InfinityIcon, Loader2
} from "lucide-react"

// ==================== COMPONENTE THREE.JS - ESFERA CUÁNTICA ====================
function QuantumSphere() {
  const mountRef = useRef<HTMLDivElement>(null)
  
  useEffect(() => {
    if (!mountRef.current) return

    // ========== CONFIGURACIÓN THREE.JS ==========
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(
      60, 
      mountRef.current.clientWidth / mountRef.current.clientHeight, 
      0.1, 
      1000
    )
    camera.position.z = 8

    const renderer = new THREE.WebGLRenderer({ 
      alpha: true, 
      antialias: true,
      powerPreference: "high-performance"
    })
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)

    mountRef.current.appendChild(renderer.domElement)

    // ========== LUZ ==========
    const ambientLight = new THREE.AmbientLight(0x00ffff, 0.3)
    scene.add(ambientLight)

    const pointLight = new THREE.PointLight(0x0080ff, 1.5, 100)
    pointLight.position.set(10, 10, 10)
    scene.add(pointLight)

    // ========== ESFERA PRINCIPAL ==========
    const sphereGeometry = new THREE.IcosahedronGeometry(2, 3)
    const sphereMaterial = new THREE.MeshPhongMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.15,
      wireframe: true,
      emissive: 0x0080ff,
      emissiveIntensity: 0.2,
      shininess: 100
    })
    
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial)
    scene.add(sphere)

    // ========== ANILLOS ORBITALES ==========
    const ringGeometry = new THREE.TorusGeometry(3.5, 0.05, 16, 100)
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0x0080ff,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide
    })

    const rings: THREE.Mesh[] = []
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(ringGeometry, ringMaterial)
      ring.rotation.x = Math.PI / 2
      ring.rotation.y = (i * Math.PI) / 3
      scene.add(ring)
      rings.push(ring)
    }

    // ========== PARTÍCULAS CUÁNTICAS ==========
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

    const particleMaterial = new THREE.PointsMaterial({
      size: 0.05,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending
    })

    const particles = new THREE.Points(particleGeometry, particleMaterial)
    scene.add(particles)

    // ========== ANIMACIÓN ==========
    let animationId: number
    let time = 0

    const animate = () => {
      animationId = requestAnimationFrame(animate)
      time += 0.016

      // Rotación esfera
      sphere.rotation.x = time * 0.2
      sphere.rotation.y = time * 0.3
      sphere.scale.setScalar(1 + Math.sin(time) * 0.1)

      // Rotación anillos
      rings.forEach((ring, i) => {
        ring.rotation.z = time * (0.1 + i * 0.05)
      })

      // Animación partículas
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

      // Rotación cámara suave
      camera.position.x = Math.sin(time * 0.1) * 1
      camera.position.y = Math.cos(time * 0.08) * 0.5
      camera.lookAt(0, 0, 0)

      renderer.render(scene, camera)
    }

    animate()

    // ========== RESIZE HANDLER ==========
    const handleResize = () => {
      if (!mountRef.current) return
      
      const width = mountRef.current.clientWidth
      const height = mountRef.current.clientHeight
      
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
    }

    window.addEventListener('resize', handleResize)

    // ========== CLEANUP ==========
    return () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener('resize', handleResize)
      
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement)
      }
      
      // Dispose de recursos
      sphereGeometry.dispose()
      sphereMaterial.dispose()
      ringGeometry.dispose()
      ringMaterial.dispose()
      particleGeometry.dispose()
      particleMaterial.dispose()
      renderer.dispose()
    }
  }, [])
  
  return (
    <div 
      ref={mountRef} 
      className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,0,0,0)_0%,rgba(0,20,40,0.3)_100%)]"
    />
  )
}

// ==================== PRELOADER QUANTUM CON THREE.JS ====================
function QuantumPreloader({ onComplete }: { onComplete: () => void }) {
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
  
  // Ref para guardar la fase actual sin causar re-renders del useEffect
  const phaseRef = useRef(0)
  
  useEffect(() => {
    // Secuencia de inicialización QUANTUM
    const sequence = [
      { delay: 300, action: () => { setPhase(1); phaseRef.current = 1 } },
      { delay: 800, action: () => {
        setModules(prev => prev.map((m, i) => 
          i === 0 ? { ...m, active: true } : m
        ))
      }},
      { delay: 1300, action: () => { setPhase(2); phaseRef.current = 2 } },
      { delay: 1800, action: () => {
        setModules(prev => prev.map((m, i) => 
          i === 1 ? { ...m, active: true } : m
        ))
      }},
      { delay: 2300, action: () => { setPhase(3); phaseRef.current = 3 } },
      { delay: 2800, action: () => {
        setModules(prev => prev.map((m, i) => 
          i === 2 ? { ...m, active: true } : m
        ))
      }},
      { delay: 3300, action: () => { setPhase(4); phaseRef.current = 4 } },
      { delay: 3800, action: () => {
        setModules(prev => prev.map((m, i) => 
          i === 3 ? { ...m, active: true } : m
        ))
      }},
      { delay: 4300, action: () => {
        setPhase(5)
        phaseRef.current = 5
      }},
      { delay: 4800, action: () => {
        setIsExiting(true)
        window.scrollTo(0, 0)
        setTimeout(() => {
          window.scrollTo(0, 0)
          onComplete()
        }, 800)
      }}
    ]
    
    // Efectos de glitch aleatorios
    const glitchInterval = setInterval(() => {
      if (Math.random() > 0.7 && phaseRef.current > 1) {
        setGlitch(true)
        setTimeout(() => setGlitch(false), 80)
      }
    }, 1500)
    
    // Progreso principal
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval)
          return 100
        }
        return prev + (100 / 48)
      })
    }, 48)
    
    // Progreso de módulos
    const moduleInterval = setInterval(() => {
      setModules(prev => prev.map(module => ({
        ...module,
        progress: module.active 
          ? Math.min(module.progress + Math.random() * 4, 100)
          : module.progress
      })))
    }, 200)
    
    // Ejecutar secuencia
    const timers = sequence.map(({ delay, action }) => 
      setTimeout(action, delay)
    )
    
    return () => {
      clearInterval(progressInterval)
      clearInterval(moduleInterval)
      clearInterval(glitchInterval)
      timers.forEach(timer => clearTimeout(timer))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  
  const systemMessages = [
    "INICIALIZANDO CAMPO CUÁNTICO...",
    "CALIBRANDO PATRONES NEURONALES...",
    "SINCRONIZANDO MATRIZ ENERGÉTICA...",
    "ESTABLECIENDO FLUJO DE DATOS...",
    "SISTEMA CUÁNTICO ACTIVO",
    "¡BIENVENIDO A NEON SYSTEM!"
  ]
  
  const currentMessage = systemMessages[Math.min(phase, systemMessages.length - 1)]
  
  return (
    <AnimatePresence mode="wait">
      {!isExiting && (
        <motion.div
          key="quantum-preloader"
          initial={{ opacity: 0 }}
          animate={{ 
            opacity: 1,
            filter: glitch ? "contrast(2) saturate(3) brightness(1.2)" : "none"
          }}
          exit={{
            opacity: 0,
            scale: 1.1,
            filter: "blur(20px) contrast(2)",
            y: -30
          }}
          transition={{ 
            duration: 1.2, 
            ease: quantumEase,
            filter: { duration: 0.1 }
          }}
          className="fixed inset-0 z-[99999] overflow-hidden bg-gradient-to-br from-gray-950 via-black to-gray-950"
        >
          {/* Fondo Three.js */}
          <QuantumSphere />
          
          {/* Efectos de brillo */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-500/5 to-transparent"
            animate={{ 
              x: ["-100%", "200%"],
              opacity: [0, 0.1, 0]
            }}
            transition={{
              x: { duration: 3, repeat: Infinity, ease: "linear" },
              opacity: { duration: 3, repeat: Infinity }
            }}
          />
          
          {/* Contenido principal */}
          <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-4 md:p-8">
            <div className="w-full max-w-6xl mx-auto">
              
              {/* Header */}
              <motion.div
                initial={{ opacity: 0, y: -30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, delay: 0.2 }}
                className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 md:mb-16"
              >
                {/* Logo */}
                <div className="flex items-center gap-3 mb-4 md:mb-0">
                  <motion.div
                    animate={{ 
                      rotate: 360,
                      scale: [1, 1.1, 1]
                    }}
                    transition={{ 
                      rotate: { duration: 8, repeat: Infinity, ease: "linear" },
                      scale: { duration: 2, repeat: Infinity }
                    }}
                    className="relative"
                  >
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/30">
                      <Atom className="w-5 h-5 md:w-6 md:h-6 text-white" />
                    </div>
                    <motion.div
                      className="absolute -inset-2 rounded-full border-2 border-cyan-400/30"
                      animate={{ rotate: -360 }}
                      transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                    />
                  </motion.div>
                  <div>
                    <div className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
                      NEON SYSTEM
                    </div>
                    <div className="text-xs text-gray-400 tracking-widest">QUANTUM EDITION v2.1</div>
                  </div>
                </div>
                
                {/* Estado del sistema */}
                <div className="text-right">
                  <div className="text-xs text-gray-400 mb-1">SISTEMA CUÁNTICO</div>
                  <div className="font-mono text-sm text-cyan-300">
                    {">"} ESTADO: {phase >= 4 ? "ACTIVO" : "INICIANDO"}
                  </div>
                </div>
              </motion.div>
              
              {/* Contenido central */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-16 items-center">
                
                {/* Panel izquierdo - Visualización */}
                <div className="relative h-64 md:h-96 flex items-center justify-center">
                  
                  {/* Info flotante */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 1, delay: 0.5 }}
                    className="absolute top-4 left-4 bg-black/50 backdrop-blur-sm rounded-lg p-3 border border-cyan-500/20"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
                      <span className="text-xs text-cyan-300">TRANSMISIÓN EN VIVO</span>
                    </div>
                    <div className="font-mono text-xs text-gray-300 mt-1">
                      PARTÍCULAS: 200
                    </div>
                  </motion.div>
                  
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 1, delay: 0.7 }}
                    className="absolute bottom-4 right-4 bg-black/50 backdrop-blur-sm rounded-lg p-3 border border-purple-500/20"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                      <span className="text-xs text-purple-300">ENERGÍA</span>
                    </div>
                    <div className="font-mono text-xs text-gray-300 mt-1">
                      {Math.round(progress)}% ESTABLE
                    </div>
                  </motion.div>
                </div>
                
                {/* Panel derecho - Control */}
                <div className="space-y-6 md:space-y-8">
                  
                  {/* Título */}
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.8, delay: 0.3 }}
                    className="text-center md:text-left"
                  >
                    <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent mb-2">
                      INICIALIZACIÓN CUÁNTICA
                    </h1>
                    <p className="text-sm text-gray-400">
                      Cargando interfaz multidimensional...
                    </p>
                  </motion.div>
                  
                  {/* Mensaje del sistema */}
                  <motion.div
                    key={phase}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="bg-black/30 backdrop-blur-sm rounded-lg p-4 border border-cyan-500/20"
                  >
                    <div className="font-mono text-base md:text-lg text-cyan-300 mb-1">
                      {">"} {currentMessage}
                    </div>
                    <div className="text-xs text-gray-400">
                      Fase {phase}/5 • {modules.filter(m => m.active).length}/{modules.length} módulos
                    </div>
                  </motion.div>
                  
                  {/* Progreso principal */}
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-300">INTEGRIDAD DEL SISTEMA</span>
                      <span className="font-mono text-cyan-300">{Math.round(progress)}%</span>
                    </div>
                    <div className="relative h-2 bg-gray-900 rounded-full overflow-hidden">
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ type: "spring", damping: 25 }}
                      >
                        <motion.div
                          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                          animate={{ x: ["-100%", "100%"] }}
                          transition={{ 
                            duration: 1.5, 
                            repeat: Infinity,
                            ease: "linear"
                          }}
                        />
                      </motion.div>
                    </div>
                  </div>
                  
                  {/* Módulos del sistema */}
                  <div className="space-y-3">
                    <div className="text-sm text-gray-300 mb-2">MÓDULOS DEL SISTEMA</div>
                    {modules.map((module, i) => (
                      <motion.div
                        key={module.name}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5, delay: i * 0.1 }}
                        className="space-y-1"
                      >
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${module.active ? 'bg-cyan-500 animate-pulse' : 'bg-gray-700'}`} />
                            <span className={`text-sm ${module.active ? 'text-cyan-300' : 'text-gray-500'}`}>
                              {module.name}
                            </span>
                          </div>
                          <span className="font-mono text-xs text-gray-400">
                            {Math.round(module.progress)}%
                          </span>
                        </div>
                        <div className="h-1 bg-gray-900 rounded-full overflow-hidden">
                          <motion.div
                            className={`h-full ${module.active ? 'bg-gradient-to-r from-cyan-500 to-blue-500' : 'bg-gray-800'}`}
                            initial={{ width: 0 }}
                            animate={{ width: `${module.progress}%` }}
                            transition={{ duration: 0.5, delay: i * 0.15 }}
                          />
                        </div>
                      </motion.div>
                    ))}
                  </div>
                  
                  {/* Indicadores */}
                  <div className="grid grid-cols-2 gap-3 pt-4">
                    {[
                      { icon: Cpu, label: "QUBITS CUÁNTICOS", value: "512 Qubits", color: "text-cyan-400" },
                      { icon: Network, label: "ENTRELAZAMIENTO", value: "98.7%", color: "text-purple-400" },
                      { icon: Zap, label: "ENERGÍA", value: "∞", color: "text-yellow-400" },
                      { icon: Database, label: "FLUJO DE DATOS", value: "42TB/s", color: "text-green-400" }
                    ].map((item, i) => (
                      <motion.div
                        key={item.label}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5, delay: 0.5 + i * 0.1 }}
                        className="bg-black/30 backdrop-blur-sm rounded-lg p-3 border border-gray-800"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <item.icon className={`w-4 h-4 ${item.color}`} />
                          <span className="text-xs text-gray-400">{item.label}</span>
                        </div>
                        <div className={`font-mono text-lg ${item.color}`}>{item.value}</div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
              
              {/* Footer */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, delay: 0.8 }}
                className="mt-8 md:mt-12 text-center"
              >
                <div className="inline-flex flex-wrap items-center justify-center gap-4 md:gap-6 text-xs text-gray-500">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
                    <span>SISTEMA ESTABLE</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Satellite className="w-3.5 h-3.5" />
                    <span>SINCRONIZACIÓN MULTIDIMENSIONAL</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <InfinityIcon className="w-3.5 h-3.5" />
                    <span>BUCLE CUÁNTICO ACTIVO</span>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
          
          {/* Efecto de barrido inferior */}
          <div className="absolute bottom-0 left-0 right-0 h-16 overflow-hidden">
            {Array.from({ length: 20 }).map((_, i) => (
              <motion.div
                key={i}
                className={`absolute bottom-0 w-px bg-gradient-to-t from-cyan-500/30 to-transparent left-[${i * 5}%]`}
                animate={{ 
                  height: [0, Math.random() * 40 + 20, 0],
                  opacity: [0, 0.6, 0]
                }}
                transition={{ 
                  duration: 1.5 + Math.random(),
                  repeat: Infinity,
                  delay: i * 0.08,
                  ease: "easeInOut"
                }}
              />
            ))}
          </div>
          
          {/* Indicador de carga */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: phase >= 5 ? 1 : 0 }}
            className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex items-center gap-2"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            >
              <Loader2 className="w-4 h-4 text-cyan-400" />
            </motion.div>
            <span className="text-xs text-gray-400">Redirigiendo a la interfaz principal...</span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ==================== COMPONENTE PRINCIPAL ====================
function Counter({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [count, setCount] = useState(0)
  const ref = useRef(null)
  
  useEffect(() => {
    let current = 0
    const increment = value / 60
    const timer = setInterval(() => {
      current += increment
      if (current >= value) {
        setCount(value)
        clearInterval(timer)
      } else {
        setCount(Math.floor(current))
      }
    }, 33)
    return () => clearInterval(timer)
  }, [value])
  
  return <span ref={ref}>{count}{suffix}</span>
}

function MagneticButton({ children, className, href }: { children: React.ReactNode; className?: string; href: string }) {
  const ref = useRef<HTMLAnchorElement>(null)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  
  const handleMouse = (e: React.MouseEvent) => {
    if (!ref.current) return
    const { clientX, clientY } = e
    const { left, top, width, height } = ref.current.getBoundingClientRect()
    setPosition({
      x: (clientX - left - width / 2) * 0.15,
      y: (clientY - top - height / 2) * 0.15
    })
  }
  
  return (
    <motion.a
      ref={ref}
      href={href}
      className={className}
      onMouseMove={handleMouse}
      onMouseLeave={() => setPosition({ x: 0, y: 0 })}
      animate={{ x: position.x, y: position.y }}
      transition={{ type: "spring", stiffness: 150, damping: 15 }}
    >
      {children}
    </motion.a>
  )
}

export default function LandingPage() {
  const [loading, setLoading] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  
  // Bloquear scroll durante el preloader y hacer scroll al inicio al completar
  useEffect(() => {
    if (loading) {
      // Bloquear scroll durante la carga
      document.body.style.overflow = 'hidden'
      // Asegurar que empiece desde arriba
      window.scrollTo(0, 0)
    } else {
      // Restaurar scroll y asegurar posición inicial
      document.body.style.overflow = ''
      window.scrollTo({ top: 0, behavior: 'instant' })
    }
    
    return () => {
      document.body.style.overflow = ''
    }
  }, [loading])
  
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])
  
  const features = [
    { icon: Users, title: "CRM Inteligente", desc: "Gestión de contactos con scoring IA", gradient: "from-cyan-500 to-blue-600" },
    { icon: BarChart3, title: "Analytics", desc: "Predicciones en tiempo real", gradient: "from-violet-500 to-purple-600" },
    { icon: Zap, title: "Automatización", desc: "Workflows sin código", gradient: "from-amber-500 to-orange-600" },
    { icon: Shield, title: "Seguridad", desc: "Encriptación enterprise", gradient: "from-emerald-500 to-teal-600" },
    { icon: Layers, title: "Integraciones", desc: "50+ apps conectadas", gradient: "from-pink-500 to-rose-600" },
    { icon: Bot, title: "Asistente IA", desc: "Chatbot 24/7", gradient: "from-blue-500 to-indigo-600" },
  ]
  
  return (
    <>
      <AnimatePresence mode="wait">
        {loading && <QuantumPreloader onComplete={() => setLoading(false)} />}
      </AnimatePresence>
      
      {/* Esto asegura que cuando loading sea false, se muestre el contenido */}
      <div className={`min-h-screen bg-white text-gray-900 ${loading ? 'opacity-0' : 'opacity-100 transition-opacity duration-500'}`}>
        <motion.nav
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "py-3" : "py-5"}`}
        >
          <div className={`absolute inset-0 transition-all duration-300 ${scrolled ? "bg-white/90 backdrop-blur-xl shadow-sm" : "bg-transparent"}`} />
          <div className="relative max-w-7xl mx-auto px-6 lg:px-8">
            <div className="flex items-center justify-between">
              <Link href="/" className="flex flex-col leading-none">
                <span className="text-xl font-bold tracking-tight text-gray-900">NEON</span>
                <span className="text-[9px] font-semibold tracking-[0.25em] text-cyan-600 uppercase">System</span>
              </Link>
              <div className="hidden lg:flex items-center gap-8">
                {["Características", "Soluciones", "Precios"].map((item) => (
                  <a key={item} href={`#${item.toLowerCase()}`} className="text-sm text-gray-600 hover:text-gray-900 transition-colors">{item}</a>
                ))}
              </div>
              <div className="flex items-center gap-4">
                <Link href="/pricing" className="hidden sm:block text-sm text-gray-600 hover:text-gray-900 transition-colors">Precios</Link>
                <Link href="/login" className="hidden sm:block text-sm text-gray-600 hover:text-gray-900 transition-colors">Iniciar Sesión</Link>
                <MagneticButton href="/signup" className="relative group px-6 py-2.5 rounded-full text-sm font-medium overflow-hidden">
                  <span className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-blue-600" />
                  <span className="relative text-white flex items-center gap-2">Empezar Gratis<ArrowRight className="w-4 h-4" /></span>
                </MagneticButton>
                <button className="lg:hidden p-2" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
                  {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                </button>
              </div>
            </div>
          </div>
          <AnimatePresence>
            {mobileMenuOpen && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }} 
                animate={{ opacity: 1, height: "auto" }} 
                exit={{ opacity: 0, height: 0 }} 
                className="lg:hidden bg-white border-t mt-3"
              >
                <div className="px-6 py-4 space-y-3">
                  <a href="#caracteristicas" className="block text-gray-600 hover:text-gray-900 py-2">Características</a>
                  <a href="#soluciones" className="block text-gray-600 hover:text-gray-900 py-2">Soluciones</a>
                  <Link href="/pricing" className="block text-gray-600 hover:text-gray-900 py-2">Precios</Link>
                  <Link href="/login" className="block text-gray-600 hover:text-gray-900 py-2">Iniciar Sesión</Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.nav>
        
        <section className="relative min-h-screen flex items-center justify-center pt-20 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-cyan-50/50 via-white to-white" />
          <div className="relative z-10 max-w-6xl mx-auto px-6 text-center">
            <motion.div 
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }} 
              transition={{ duration: 0.6, delay: 0.3 }} 
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-50 border border-cyan-100 mb-8"
            >
              <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
              <span className="text-sm text-cyan-700">Potenciado con IA Quantum</span>
            </motion.div>
            <motion.h1 
              initial={{ opacity: 0, y: 30 }} 
              animate={{ opacity: 1, y: 0 }} 
              transition={{ duration: 0.8, delay: 0.4 }} 
              className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight leading-tight mb-6"
            >
              El futuro de la
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-blue-600">gestión empresarial</span>
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }} 
              transition={{ duration: 0.6, delay: 0.5 }} 
              className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto mb-10"
            >
              CRM, analytics y automatización unificados en una plataforma diseñada para empresas que buscan escalar.
            </motion.p>
            <motion.div 
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }} 
              transition={{ duration: 0.6, delay: 0.6 }} 
              className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
            >
              <MagneticButton 
                href="/signup" 
                className="group relative inline-flex items-center gap-2 px-8 py-4 rounded-full text-base font-semibold overflow-hidden shadow-lg shadow-cyan-500/25"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-blue-600" />
                <span className="relative text-white flex items-center gap-2">Comenzar Gratis<ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" /></span>
              </MagneticButton>
              <Link 
                href="/login" 
                className="inline-flex items-center gap-2 px-8 py-4 rounded-full text-base font-medium text-gray-700 hover:text-gray-900 border border-gray-200 hover:border-gray-300 transition-all"
              >
                <Play className="w-4 h-4" />Ver Demo
              </Link>
            </motion.div>
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              transition={{ duration: 0.8, delay: 0.8 }} 
              className="flex flex-wrap items-center justify-center gap-12 sm:gap-16"
            >
              {[
                { value: 10, suffix: "K+", label: "Usuarios" }, 
                { value: 99, suffix: ".9%", label: "Uptime" }, 
                { value: 50, suffix: "+", label: "Integraciones" }
              ].map((stat, i) => (
                <div key={i} className="text-center">
                  <div className="text-4xl font-bold text-gray-900">
                    <Counter value={stat.value} suffix={stat.suffix} />
                  </div>
                  <div className="text-sm text-gray-500 mt-1">{stat.label}</div>
                </div>
              ))}
            </motion.div>
          </div>
        </section>
        
        <section id="características" className="py-24 bg-gray-50">
          <div className="max-w-7xl mx-auto px-6">
            <motion.div 
              initial={{ opacity: 0, y: 40 }} 
              whileInView={{ opacity: 1, y: 0 }} 
              viewport={{ once: true }} 
              transition={{ duration: 0.6 }} 
              className="text-center mb-16"
            >
              <span className="text-cyan-600 text-sm font-semibold tracking-widest uppercase">Características</span>
              <h2 className="text-4xl sm:text-5xl font-bold mt-3 text-gray-900">Todo lo que necesitas</h2>
            </motion.div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((feature, i) => (
                <motion.div 
                  key={i} 
                  initial={{ opacity: 0, y: 30 }} 
                  whileInView={{ opacity: 1, y: 0 }} 
                  viewport={{ once: true }} 
                  transition={{ duration: 0.5, delay: i * 0.1 }} 
                  className="group p-8 rounded-2xl bg-white border border-gray-100 hover:border-gray-200 hover:shadow-lg transition-all duration-300"
                >
                  <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-5`}>
                    <feature.icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2 text-gray-900">{feature.title}</h3>
                  <p className="text-gray-600">{feature.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
        
        <section className="py-24">
          <motion.div 
            initial={{ opacity: 0, y: 40 }} 
            whileInView={{ opacity: 1, y: 0 }} 
            viewport={{ once: true }} 
            transition={{ duration: 0.6 }} 
            className="max-w-4xl mx-auto px-6 text-center"
          >
            <h2 className="text-4xl sm:text-5xl font-bold mb-6 text-gray-900">¿Listo para empezar?</h2>
            <p className="text-xl text-gray-600 mb-10">Únete a miles de empresas que ya transformaron su gestión.</p>
            <MagneticButton 
              href="/signup" 
              className="group relative inline-flex items-center gap-3 px-10 py-5 rounded-full text-lg font-semibold overflow-hidden shadow-xl shadow-cyan-500/25"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-blue-600" />
              <span className="relative text-white flex items-center gap-2">Crear Cuenta Gratis<ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" /></span>
            </MagneticButton>
            <p className="text-sm text-gray-500 mt-6">Sin tarjeta • Setup en 2 min</p>
          </motion.div>
        </section>
        
        <footer className="border-t border-gray-100 py-10">
          <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex flex-col leading-none">
              <span className="text-lg font-bold tracking-tight text-gray-900">NEON</span>
              <span className="text-[9px] font-semibold tracking-[0.25em] text-cyan-600 uppercase">System</span>
            </div>
            <p className="text-sm text-gray-500">© 2025 NEON SYSTEM</p>
            <div className="flex gap-8 text-sm text-gray-500">
              <Link href="/terms" className="hover:text-gray-900 transition-colors">Términos</Link>
              <Link href="/privacy" className="hover:text-gray-900 transition-colors">Privacidad</Link>
            </div>
          </div>
        </footer>
      </div>
    </>
  )
}