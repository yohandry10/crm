"use client"

import { useState, type ReactElement } from "react"
import { Info, Copy, Check } from "lucide-react"
import { getAvailableVariables } from "@/lib/workflow-templates"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"

interface TemplateVariablesHelperProps {
  triggerType: string
}

export function TemplateVariablesHelper({ triggerType }: TemplateVariablesHelperProps) {
  const [copiedVariable, setCopiedVariable] = useState<string | null>(null)
  const availableVars = getAvailableVariables(triggerType)

  const copyVariable = (variable: string) => {
    const templateVar = `{{${variable}}}`
    navigator.clipboard.writeText(templateVar)
    setCopiedVariable(variable)
    toast.success(`Copiado: ${templateVar}`)

    setTimeout(() => {
      setCopiedVariable(null)
    }, 2000)
  }

  const renderValue = (value: any): string => {
    if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value, null, 2)
    }
    return String(value)
  }

  const renderVariables = (obj: any, prefix = ''): ReactElement[] => {
    const elements: ReactElement[] = []

    for (const [key, value] of Object.entries(obj)) {
      const fullPath = prefix ? `${prefix}.${key}` : key

      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Nested object
        elements.push(
          <div key={fullPath} className="mb-3">
            <p className="text-sm font-semibold text-gray-700 mb-2">{key}:</p>
            <div className="pl-4 border-l-2 border-gray-200">
              {renderVariables(value, fullPath)}
            </div>
          </div>
        )
      } else {
        // Leaf value
        elements.push(
          <div
            key={fullPath}
            className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 group transition-colors"
          >
            <div className="flex-1 min-w-0">
              <button
                onClick={() => copyVariable(fullPath)}
                className="text-left w-full"
              >
                <p className="text-sm font-mono text-blue-600 group-hover:text-blue-700 truncate">
                  {`{{${fullPath}}}`}
                </p>
                <p className="text-xs text-gray-500 truncate mt-0.5">
                  → {renderValue(value)}
                </p>
              </button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => copyVariable(fullPath)}
            >
              {copiedVariable === fullPath ? (
                <Check className="h-3 w-3 text-green-600" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </Button>
          </div>
        )
      }
    }

    return elements
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
        >
          <Info className="h-4 w-4" />
          Variables Disponibles
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 max-h-[500px] overflow-y-auto" align="start">
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-sm mb-1">
              Variables de Template
            </h4>
            <p className="text-xs text-gray-500">
              Haz clic en una variable para copiarla al portapapeles
            </p>
          </div>

          <div className="space-y-1">
            <Badge variant="secondary" className="text-xs">
              Trigger: {triggerType}
            </Badge>
          </div>

          <div className="border-t pt-4">
            <p className="text-xs font-semibold text-gray-600 mb-3 uppercase tracking-wide">
              Datos Disponibles:
            </p>
            <div className="space-y-2">
              {renderVariables(availableVars)}
            </div>
          </div>

          <div className="border-t pt-4 space-y-2">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
              Ejemplos:
            </p>
            <div className="bg-gray-50 p-3 rounded-lg text-xs font-mono">
              <p className="text-gray-600 mb-2">Email personalizado:</p>
              <code className="block text-blue-600 mb-1">
                to: "{`{{contact.email}}`}"
              </code>
              <code className="block text-blue-600">
                subject: "Hola {`{{contact.full_name}}`}!"
              </code>
            </div>
          </div>

          <div className="border-t pt-4">
            <p className="text-xs text-gray-500">
              💡 <strong>Tip:</strong> Usa notación de punto para acceder a propiedades anidadas
            </p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
