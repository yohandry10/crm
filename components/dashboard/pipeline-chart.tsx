"use client"

import { memo, useMemo } from "react"
import { Bar, BarChart, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts"
import { Target } from "lucide-react"

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

const formatCurrency = (value: number) => {
  if (value >= 1000000) return `S/ ${(value / 1000000).toFixed(1)}M`
  if (value >= 1000) return `S/ ${(value / 1000).toFixed(0)}K`
  return `S/ ${value}`
}

const EmptyState = memo(() => (
  <div className="flex flex-col items-center justify-center h-[300px] text-center px-4">
    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/10 to-emerald-500/10 flex items-center justify-center mb-4 backdrop-blur-sm">
      <Target className="w-8 h-8 text-amber-500" />
    </div>
    <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-50 mb-1">Pipeline vacío</h3>
    <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-[200px]">
      Las etapas de tu pipeline aparecerán aquí cuando agregues oportunidades
    </p>
  </div>
))

EmptyState.displayName = "PipelineEmptyState"

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border border-zinc-200/50 dark:border-zinc-800/50 p-4 rounded-xl shadow-xl min-w-[150px]">
        <div className="flex items-center gap-2 mb-2">
          <div
            className="w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-zinc-900"
            style={{ backgroundColor: data.fill }}
          />
          <p className="text-sm font-bold text-zinc-900 dark:text-zinc-50">{data.stage}</p>
        </div>
        <div className="flex items-center justify-between gap-4 mb-1">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">Valor Potencial</span>
          <span className="text-sm font-bold text-zinc-800 dark:text-zinc-100">{formatCurrency(data.value)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">Oportunidades</span>
          <span className="text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full text-zinc-600 dark:text-zinc-300">
            {data.count}
          </span>
        </div>
      </div>
    )
  }
  return null
}

export const PipelineChart = memo(({
  data = [],
  title = "Pipeline de Ventas",
  description = "Valor total por etapa"
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

  const chartData = useMemo(() => {
    return data.map((item, index) => ({
      ...item,
      fill: getColor(item.stage, index)
    }))
  }, [data])

  return (
    <div className="group relative bg-white dark:bg-zinc-900/50 border border-zinc-200/50 dark:border-zinc-800/50 rounded-3xl p-6 hover:shadow-2xl hover:shadow-zinc-500/5 dark:hover:shadow-black/20 transition-all duration-500">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-10 transition-opacity duration-500 pointer-events-none">
        <Target className="w-24 h-24 text-amber-500 transform -rotate-12" />
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">{title}</h3>
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{description}</p>
        </div>

        {hasData && (
          <div className="text-right">
            <p className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">{formatCurrency(totalValue)}</p>
            <div className="flex items-center justify-end gap-1.5 mt-1">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{totalCount} oportunidades activas</p>
            </div>
          </div>
        )}
      </div>

      {hasData ? (
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 0, right: 0, left: 30, bottom: 0 }}
              barSize={32} // Thicker bars for modern look
            >
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="stage"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 13, fill: "#64748b", fontWeight: 600 }}
                width={100}
                dx={-10}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
              <Bar
                dataKey="value"
                radius={[0, 8, 8, 0]}
                background={{ fill: 'var(--muted)' }}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <EmptyState />
      )}
    </div>
  )
})

PipelineChart.displayName = "PipelineChart"

export default PipelineChart
