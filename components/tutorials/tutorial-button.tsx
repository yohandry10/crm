"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { HelpCircle, Sparkles } from "lucide-react"
import { ModuleTutorialModal, type ModuleTutorial } from "./module-tutorial"
import { getTutorial, isTutorialCompleted } from "./tutorial-data"
import { cn } from "@/lib/utils"

interface TutorialButtonProps {
  moduleId: string
  variant?: "default" | "icon" | "subtle"
  className?: string
  showPulse?: boolean
}

export function TutorialButton({ 
  moduleId, 
  variant = "default",
  className,
  showPulse = true
}: TutorialButtonProps) {
  const [open, setOpen] = useState(false)
  const [tutorial, setTutorial] = useState<ModuleTutorial | null>(null)
  const [isCompleted, setIsCompleted] = useState(true)

  useEffect(() => {
    const t = getTutorial(moduleId)
    if (t) {
      setTutorial(t)
      setIsCompleted(isTutorialCompleted(moduleId))
    }
  }, [moduleId])

  const handleComplete = () => {
    setIsCompleted(true)
  }

  if (!tutorial) return null

  const showAnimation = showPulse && !isCompleted

  if (variant === "icon") {
    return (
      <>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setOpen(true)}
          className={cn("relative", className)}
        >
          <HelpCircle className="w-5 h-5" />
          {showAnimation && (
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full animate-pulse" />
          )}
        </Button>
        <ModuleTutorialModal
          tutorial={tutorial}
          open={open}
          onOpenChange={setOpen}
          onComplete={handleComplete}
        />
      </>
    )
  }

  if (variant === "subtle") {
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          className={cn(
            "inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors",
            className
          )}
        >
          <HelpCircle className="w-4 h-4" />
          <span>¿Cómo funciona?</span>
        </button>
        <ModuleTutorialModal
          tutorial={tutorial}
          open={open}
          onOpenChange={setOpen}
          onComplete={handleComplete}
        />
      </>
    )
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className={cn("gap-2", showAnimation && "border-primary/50", className)}
      >
        {showAnimation ? (
          <Sparkles className="w-4 h-4 text-primary" />
        ) : (
          <HelpCircle className="w-4 h-4" />
        )}
        {showAnimation ? "Ver Tutorial" : "Ayuda"}
      </Button>
      <ModuleTutorialModal
        tutorial={tutorial}
        open={open}
        onOpenChange={setOpen}
        onComplete={handleComplete}
      />
    </>
  )
}
