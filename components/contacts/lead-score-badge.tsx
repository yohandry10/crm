"use client"

import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { Flame, Thermometer, Snowflake } from "lucide-react"

interface LeadScoreBadgeProps {
  score: number
  showLabel?: boolean
  size?: "sm" | "md" | "lg"
  className?: string
}

export function LeadScoreBadge({
  score,
  showLabel = false,
  size = "md",
  className,
}: LeadScoreBadgeProps) {
  const getScoreInfo = (score: number) => {
    if (score >= 80) {
      return {
        grade: "A",
        label: "Hot",
        color: "bg-red-500 text-white",
        icon: Flame,
        description: "Lead muy caliente - Alta probabilidad de conversión",
      }
    }
    if (score >= 60) {
      return {
        grade: "B",
        label: "Warm",
        color: "bg-orange-500 text-white",
        icon: Thermometer,
        description: "Lead caliente - Buena probabilidad de conversión",
      }
    }
    if (score >= 40) {
      return {
        grade: "C",
        label: "Warm",
        color: "bg-yellow-500 text-black",
        icon: Thermometer,
        description: "Lead tibio - Necesita más nurturing",
      }
    }
    if (score >= 20) {
      return {
        grade: "D",
        label: "Cold",
        color: "bg-blue-400 text-white",
        icon: Snowflake,
        description: "Lead frío - Requiere más engagement",
      }
    }
    return {
      grade: "F",
      label: "Cold",
      color: "bg-slate-400 text-white",
      icon: Snowflake,
      description: "Lead muy frío - Necesita calificación",
    }
  }

  const info = getScoreInfo(score)
  const Icon = info.icon

  const sizeClasses = {
    sm: "text-xs px-1.5 py-0.5",
    md: "text-sm px-2 py-1",
    lg: "text-base px-3 py-1.5",
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            className={cn(
              info.color,
              sizeClasses[size],
              "font-bold cursor-help",
              className
            )}
          >
            <Icon className={cn(
              "mr-1",
              size === "sm" ? "w-3 h-3" : size === "md" ? "w-4 h-4" : "w-5 h-5"
            )} />
            {score}
            {showLabel && <span className="ml-1 font-normal">({info.grade})</span>}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1">
            <p className="font-medium">Score: {score}/100 (Grado {info.grade})</p>
            <p className="text-xs text-muted-foreground">{info.description}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

interface LeadScoreProgressProps {
  score: number
  showBreakdown?: boolean
  breakdown?: {
    demographic: number
    engagement: number
    behavior: number
    fit: number
  }
}

export function LeadScoreProgress({
  score,
  showBreakdown = false,
  breakdown,
}: LeadScoreProgressProps) {
  const getColor = (score: number) => {
    if (score >= 80) return "bg-red-500"
    if (score >= 60) return "bg-orange-500"
    if (score >= 40) return "bg-yellow-500"
    if (score >= 20) return "bg-blue-400"
    return "bg-slate-400"
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Lead Score</span>
        <LeadScoreBadge score={score} showLabel />
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={cn("h-full transition-all", getColor(score))}
          style={{ width: `${score}%` }}
        />
      </div>
      {showBreakdown && breakdown && (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Demográfico</span>
            <span>{breakdown.demographic}/25</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Engagement</span>
            <span>{breakdown.engagement}/35</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Comportamiento</span>
            <span>{breakdown.behavior}/25</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Fit</span>
            <span>{breakdown.fit}/15</span>
          </div>
        </div>
      )}
    </div>
  )
}
