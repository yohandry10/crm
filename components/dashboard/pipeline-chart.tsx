"use client"

import { memo, useMemo } from "react"
import { Bar, BarChart, XAxis, YAxis, Cell, LabelList } from "recharts"
import { Target, TrendingUp } from "lucide-react"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"

interface PipelineStage {
  stage: string
  value: number
  count: number
}

interface PipelineChartProps {
  data?: PipelineStage[]
  title?: string
  description?: string
}

const stageColors: Record<string, string> = {
  "Lead": "#06b6d4",
  "Contactado": "#8b5cf6",
  "Calificado": "#6366f1",
  "Propuesta": "#f59e0b",
  "Negociación": "#ec4899",
  "Cerrado": "#10b981",
  "Ganado": "#10b981",
  "Perdido": "#ef4444",
}

const defaultColors = ["#06b6d4", "#8b5cf6", "#f59e0b", "#ec4899", "#10b981", "#6366f1"]

const chartConfig = {
  value: {
    label: "Valor",
    color: "#06b6d4",
  },
} satisfies ChartConfig

const EmptyState = memo(() => (
  <div className="flex flex-col items-center justify-center h-[280px] text-center px-4">
    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/10 to-emerald-500/10 flex items-center justify-center mb-4">
      <Target className="w-8 h-8 text-amber-500" />
    </div>
    <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">Pipeline vacío</h3>
    <p className="text-xs text-gray-500 dark:text-gray-400 max-w-[200px]">
      Las etapas de tu pipeline aparecerán aquí cuando agregues oportunidades
    </p>
  </div>
))

EmptyState.displayName = "PipelineEmptyState"

const formatCurrency = (value: number) => {
  if (value >= 1000000) return `S/ ${(value / 1000000).toFixed(1)}M`
  if (value >= 1000) return `S/ ${(value / 1000).toFixed(0)}K`
  return `S/ ${value}`
}

const formatShortCurrency = (value: number) => {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
  if (value >= 1000) return `${(value / 1000).toFixed(0)}K`
  return `${value}`
}

export const PipelineChart = memo(({ 
  data = [],
  title = "Pipeline",
  description = "Valor por etapa"
}: PipelineChartProps) => {
  const hasData = data.length > 0

  const { totalValue, totalCount } = useMemo(() => {
    if (!hasData) return { totalValue: 0, totalCount: 0 }
    
    const value = data.reduce((sum, item) => sum + (item.value || 0), 0)
    const count = data.reduce((sum, item) => sum + (item.count || 0), 0)
    
    return { totalValue: value, totalCount: count }
  }, [data, hasData])

  const getColor = (stage: string, index: number) => {
    return stageColors[stage] || defaultColors[index % defaultColors.length]
  }

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
        </div>
        {hasData && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-600">
            <TrendingUp className="w-3.5 h-3.5" />
            {totalCount} oportunidades
          </div>
        )}
      </div>

      {hasData && (
        <div className="mb-4">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(totalValue)}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Valor total del pipeline</p>
        </div>
      )}

      {hasData ? (
        <ChartContainer config={chartConfig} className="h-[280px] w-full">
          <BarChart 
            data={data} 
            layout="vertical" 
            margin={{ top: 0, right: 60, left: 0, bottom: 0 }}
          >
            <XAxis 
              type="number" 
              axisLine={false} 
              tickLine={false}
              tick={{ fontSize: 12, fill: "#94a3b8" }}
              tickFormatter={formatShortCurrency}
            />
            <YAxis 
              type="category" 
              dataKey="stage" 
              axisLine={false} 
              tickLine={false}
              tick={{ fontSize: 12, fill: "#374151" }}
              width={90}
            />
            <ChartTooltip 
              content={<ChartTooltipContent />}
              formatter={(value: number, name: string, props: any) => [
                formatCurrency(value),
                `${props.payload.count} oportunidades`
              ]}
              cursor={{ fill: "#f9fafb" }}
            />
            <Bar 
              dataKey="value" 
              radius={[0, 6, 6, 0]} 
              barSize={28}
              background={{ fill: "#f9fafb" }}
            >
              {data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={getColor(entry.stage, index)}
                />
              ))}
              <LabelList 
                dataKey="value" 
                position="right" 
                formatter={(value: any) => formatShortCurrency(Number(value))}
                style={{ fontSize: 11, fill: "#6b7280", fontWeight: 500 }}
              />
            </Bar>
          </BarChart>
        </ChartContainer>
      ) : (
        <EmptyState />
      )}

      {hasData && (
        <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
          {data.map((item, index) => (
            <div key={item.stage} className="flex items-center gap-2">
              <div 
                className="w-2.5 h-2.5 rounded-full" 
                style={{ backgroundColor: getColor(item.stage, index) }}
              />
              <span className="text-xs text-gray-600 dark:text-gray-400">
                {item.stage} ({item.count})
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
})

PipelineChart.displayName = "PipelineChart"

export default PipelineChart
