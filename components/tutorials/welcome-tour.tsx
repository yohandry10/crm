"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { 
  ChevronLeft, ChevronRight, Rocket, Users, Target, DollarSign, 
  FileText, CheckSquare, BarChart3, Zap, Sparkles
} from "lucide-react"
import { cn } from "@/lib/utils"

interface TourStep {
  icon: any
  title: string
  description: string
  module?: string
}

const tourSteps: TourStep[] = [
  {
    icon: Rocket,
    title: "¡Bienvenido a tu CRM!",
    description: "Te guiaremos por las funciones principales para que puedas sacar el máximo provecho de la plataforma. Este tour solo toma 2 minutos.",
  },
  {
    icon: Users,
    title: "Contactos y Cuentas",
    description: "Gestiona tu base de datos de clientes. Los Contactos son personas y las Cuentas son empresas. Puedes vincularlos para tener una vista completa de cada cliente.",
    module: "contacts"
  },
  {
    icon: Target,
    title: "Leads y Oportunidades",
    description: "Captura prospectos como Leads, califícalos y conviértelos en Oportunidades cuando estén listos para comprar. El pipeline visual te ayuda a dar seguimiento.",
    module: "leads"
  },
  {
    icon: DollarSign,
    title: "Ventas y Cotizaciones",
    description: "Crea cotizaciones profesionales, conviértelas en pedidos y genera facturas. Todo el ciclo de venta en un solo lugar.",
    module: "opportunities"
  },
  {
    icon: FileText,
    title: "Facturación",
    description: "Emite facturas, boletas y notas de crédito. Controla pagos pendientes y envía recordatorios automáticos a clientes morosos.",
    module: "invoices"
  },
  {
    icon: CheckSquare,
    title: "Tareas y Calendario",
    description: "Organiza tu día con tareas y eventos. Recibe recordatorios y nunca pierdas un seguimiento importante.",
    module: "tasks"
  },
  {
    icon: BarChart3,
    title: "Reportes y Analíticas",
    description: "Visualiza el rendimiento de tu negocio: ventas, pipeline, métricas de soporte y más. Toma decisiones basadas en datos.",
    module: "analytics"
  },
  {
    icon: Zap,
    title: "Automatizaciones",
    description: "Ahorra tiempo automatizando tareas repetitivas: asignación de leads, envío de emails, creación de tareas y más.",
    module: "workflows"
  },
  {
    icon: Sparkles,
    title: "¡Listo para empezar!",
    description: "Cada módulo tiene un botón de ayuda (?) que te muestra un tutorial detallado. ¡Explora y no dudes en usarlos!",
  },
]

interface WelcomeTourProps {
  onComplete?: () => void
}

export function WelcomeTour({ onComplete }: WelcomeTourProps) {
  const [open, setOpen] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const totalSteps = tourSteps.length
  const progress = ((currentStep + 1) / totalSteps) * 100

  useEffect(() => {
    // Check if user has seen the tour - use sessionStorage to show only once per session
    const hasSeenTour = localStorage.getItem("hasSeenWelcomeTour") || sessionStorage.getItem("welcomeTourShown")
    if (!hasSeenTour) {
      sessionStorage.setItem("welcomeTourShown", "true")
      const timer = setTimeout(() => setOpen(true), 1000)
      return () => clearTimeout(timer)
    }
  }, [])

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(prev => prev + 1)
    } else {
      handleComplete()
    }
  }

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1)
    }
  }

  const handleComplete = () => {
    localStorage.setItem("hasSeenWelcomeTour", "true")
    setOpen(false)
    setCurrentStep(0)
    onComplete?.()
  }

  const handleSkip = () => {
    localStorage.setItem("hasSeenWelcomeTour", "true")
    setOpen(false)
    setCurrentStep(0)
  }

  const step = tourSteps[currentStep]
  const Icon = step.icon

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[500px] p-0 gap-0 overflow-hidden">
        {/* Header with gradient */}
        <div className="bg-gradient-to-br from-primary/20 via-primary/10 to-transparent p-8 text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <Icon className="w-8 h-8 text-primary" />
          </div>
          <DialogTitle className="text-2xl mb-2">{step.title}</DialogTitle>
          <DialogDescription className="text-base">
            {step.description}
          </DialogDescription>
        </div>

        {/* Progress */}
        <div className="px-6 py-4 border-t">
          <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
            <span>Paso {currentStep + 1} de {totalSteps}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
          
          {/* Step indicators */}
          <div className="flex justify-center gap-1.5 mt-4">
            {tourSteps.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentStep(index)}
                className={cn(
                  "w-2 h-2 rounded-full transition-all",
                  index === currentStep 
                    ? "bg-primary w-6" 
                    : index < currentStep 
                      ? "bg-primary/50" 
                      : "bg-muted"
                )}
              />
            ))}
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 border-t bg-muted/30">
          <div className="flex items-center justify-between w-full">
            <Button
              variant="ghost"
              onClick={handleSkip}
              className="text-muted-foreground"
            >
              Saltar tour
            </Button>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={handlePrev}
                disabled={currentStep === 0}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Anterior
              </Button>
              
              <Button onClick={handleNext} className="min-w-[120px]">
                {currentStep === totalSteps - 1 ? (
                  <>
                    ¡Empezar!
                    <Sparkles className="w-4 h-4 ml-1" />
                  </>
                ) : (
                  <>
                    Siguiente
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Function to reset the tour (for testing or settings)
export function resetWelcomeTour() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("hasSeenWelcomeTour")
  }
}

// Function to manually trigger the tour
export function showWelcomeTour() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("hasSeenWelcomeTour")
    window.location.reload()
  }
}
