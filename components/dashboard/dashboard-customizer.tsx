"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { Settings2, RotateCcw } from "lucide-react"
import { DashboardConfig, DashboardWidget, AVAILABLE_WIDGETS, DEFAULT_WIDGETS, saveDashboardConfig } from "@/lib/dashboard-config"

interface DashboardCustomizerProps {
  config: DashboardConfig
  onConfigChange: (config: DashboardConfig) => void
}

export function DashboardCustomizer({ config, onConfigChange }: DashboardCustomizerProps) {
  const [open, setOpen] = useState(false)

  const toggleWidget = (widgetType: string) => {
    const exists = config.widgets.find(w => w.type === widgetType)
    
    let newWidgets: DashboardWidget[]
    if (exists) {
      newWidgets = config.widgets.filter(w => w.type !== widgetType)
    } else {
      const widgetInfo = AVAILABLE_WIDGETS.find(w => w.type === widgetType)
      const newWidget: DashboardWidget = {
        id: `w-${Date.now()}`,
        type: widgetType as any,
        title: widgetInfo?.label || widgetType,
        size: "small",
        position: { x: 0, y: config.widgets.length },
      }
      newWidgets = [...config.widgets, newWidget]
    }

    const newConfig = { ...config, widgets: newWidgets }
    saveDashboardConfig(newConfig)
    onConfigChange(newConfig)
  }

  const resetToDefault = () => {
    const newConfig = { ...config, widgets: DEFAULT_WIDGETS }
    saveDashboardConfig(newConfig)
    onConfigChange(newConfig)
  }

  const changeWidgetSize = (widgetId: string, size: "small" | "medium" | "large") => {
    const newWidgets = config.widgets.map(w => 
      w.id === widgetId ? { ...w, size } : w
    )
    const newConfig = { ...config, widgets: newWidgets }
    saveDashboardConfig(newConfig)
    onConfigChange(newConfig)
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings2 className="w-4 h-4" />
          Personalizar
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Personalizar Dashboard</SheetTitle>
          <SheetDescription>
            Activa o desactiva widgets para personalizar tu vista
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Reset Button */}
          <Button variant="outline" size="sm" onClick={resetToDefault} className="gap-2">
            <RotateCcw className="w-4 h-4" />
            Restaurar por defecto
          </Button>

          {/* Available Widgets */}
          <div className="space-y-4">
            <h4 className="font-medium text-sm">Widgets Disponibles</h4>
            {AVAILABLE_WIDGETS.map((widget) => {
              const isActive = config.widgets.some(w => w.type === widget.type)
              const activeWidget = config.widgets.find(w => w.type === widget.type)
              
              return (
                <div key={widget.type} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{widget.label}</p>
                    <p className="text-xs text-muted-foreground">{widget.description}</p>
                    {isActive && activeWidget && (
                      <div className="flex gap-1 mt-2">
                        {(["small", "medium", "large"] as const).map((size) => (
                          <button
                            key={size}
                            onClick={() => changeWidgetSize(activeWidget.id, size)}
                            className={`px-2 py-0.5 text-xs rounded ${
                              activeWidget.size === size 
                                ? "bg-primary text-primary-foreground" 
                                : "bg-muted hover:bg-muted/80"
                            }`}
                          >
                            {size === "small" ? "S" : size === "medium" ? "M" : "L"}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <Switch
                    checked={isActive}
                    onCheckedChange={() => toggleWidget(widget.type)}
                  />
                </div>
              )
            })}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
