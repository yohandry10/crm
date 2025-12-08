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
import { Badge } from "@/components/ui/badge"
import { 
  ChevronLeft, ChevronRight, X, Lightbulb, ArrowRight,
  Users, Building2, Target, DollarSign, FileText, CheckSquare,
  Ticket, Package, ShoppingCart, BarChart3, Calendar, Zap,
  Mail, Settings, UserCircle
} from "lucide-react"


export interface TutorialStep {
  title: string
  description: string
  tip?: string
  image?: string
}

export interface ModuleTutorial {
  id: string
  moduleName: string
  moduleIcon: keyof typeof moduleIcons
  description: string
  steps: TutorialStep[]
  relatedModules: string[]
}

const moduleIcons = {
  contacts: Users,
  accounts: Building2,
  leads: Target,
  opportunities: DollarSign,
  invoices: FileText,
  tasks: CheckSquare,
  tickets: Ticket,
  products: Package,
  orders: ShoppingCart,
  analytics: BarChart3,
  calendar: Calendar,
  workflows: Zap,
  campaigns: Mail,
  settings: Settings,
  profile: UserCircle,
}

interface ModuleTutorialProps {
  tutorial: ModuleTutorial
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete?: () => void
}

export function ModuleTutorialModal({ 
  tutorial, 
  open, 
  onOpenChange,
  onComplete 
}: ModuleTutorialProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const totalSteps = tutorial.steps.length
  const progress = ((currentStep + 1) / totalSteps) * 100
  const Icon = moduleIcons[tutorial.moduleIcon] || Users

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
    // Save to localStorage that user completed this tutorial
    const completed = JSON.parse(localStorage.getItem("completedTutorials") || "[]")
    if (!completed.includes(tutorial.id)) {
      completed.push(tutorial.id)
      localStorage.setItem("completedTutorials", JSON.stringify(completed))
    }
    onComplete?.()
    onOpenChange(false)
    setCurrentStep(0)
  }

  const handleSkip = () => {
    onOpenChange(false)
    setCurrentStep(0)
  }

  useEffect(() => {
    if (!open) {
      setCurrentStep(0)
    }
  }, [open])

  const step = tutorial.steps[currentStep]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] p-0 gap-0 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 border-b">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Icon className="w-6 h-6 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-xl">{tutorial.moduleName}</DialogTitle>
                <DialogDescription>{tutorial.description}</DialogDescription>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={handleSkip} className="h-8 w-8">
              <X className="w-4 h-4" />
            </Button>
          </div>
          
          {/* Progress */}
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Paso {currentStep + 1} de {totalSteps}</span>
              <span className="text-muted-foreground">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </div>

        {/* Content */}
        <div className="p-6 min-h-[250px]">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">{step.title}</h3>
            <p className="text-muted-foreground leading-relaxed">{step.description}</p>
            
            {step.tip && (
              <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                <Lightbulb className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800 dark:text-amber-200">{step.tip}</p>
              </div>
            )}
          </div>
        </div>

        {/* Related Modules */}
        {currentStep === totalSteps - 1 && tutorial.relatedModules.length > 0 && (
          <div className="px-6 pb-4">
            <p className="text-sm text-muted-foreground mb-2">Módulos relacionados:</p>
            <div className="flex flex-wrap gap-2">
              {tutorial.relatedModules.map(mod => (
                <Badge key={mod} variant="secondary">{mod}</Badge>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <DialogFooter className="p-4 border-t bg-muted/30">
          <div className="flex items-center justify-between w-full">
            <Button
              variant="ghost"
              onClick={handleSkip}
              className="text-muted-foreground"
            >
              Saltar tutorial
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
              
              <Button onClick={handleNext}>
                {currentStep === totalSteps - 1 ? (
                  <>
                    Completar
                    <ArrowRight className="w-4 h-4 ml-1" />
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
