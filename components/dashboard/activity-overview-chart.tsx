"use client"

import { memo, useMemo } from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts"
import { Activity, TrendingUp, TrendingDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface ActivityData {
  date: string
  leads: number
  deals: number
}

interface ActivityOverviewChartProps {
  data?: ActivityData[]
  title?: string
  description?: string
}

const EmptyState = memo(() => (
  <div className="flex flex-col items-center justify-center h-[300px] text-center px-4">
    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-violet-500/10 flex items-center justify-center mb-4 backdrop-blur-sm">
      <Activity className="w-8 h-8 text-cyan-500" />
    </div>
    <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-50 mb-1">Sin actividad reciente</h3>
    <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-[200px]">
      La actividad de leads y deals se visualizará aquí.
    </p>
  </div>
))

EmptyState.displayName = "ActivityEmptyState"

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border border-zinc-200/50 dark:border-zinc-800/50 p-4 rounded-xl shadow-xl">
        <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-2 uppercase tracking-wider">{label}</p>
        <div className="space-y-1.5">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full ring-2 ring-white dark:ring-zinc-900"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                {entry.name === 'leads' ? 'Leads' : 'Cierres'}:
              </span>
              <span className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
                {entry.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  }
  return null
}

export const ActivityOverviewChart = memo(({
  data = [],
  title = "Resumen de Actividad",
  description = "Rendimiento de leads vs cierres"
}: ActivityOverviewChartProps) => {
  const hasData = data.length > 0

  const { totalLeads, totalDeals, trend } = useMemo(() => {
    if (!hasData) return { totalLeads: 0, totalDeals: 0, trend: 0 }

    const leads = data.reduce((sum, d) => sum + (d.leads || 0), 0)
    const deals = data.reduce((sum, d) => sum + (d.deals || 0), 0)

    // Calculate simple trend based on second half vs first half performance
    const mid = Math.floor(data.length / 2)
    const firstHalf = data.slice(0, mid).reduce((s, d) => s + d.leads + d.deals, 0)
    const secondHalf = data.slice(mid).reduce((s, d) => s + d.leads + d.deals, 0)
    const trendValue = firstHalf > 0 ? ((secondHalf - firstHalf) / firstHalf) * 100 : 0

    return { totalLeads: leads, totalDeals: deals, trend: trendValue }
  }, [data, hasData])

  const isPositiveTrend = trend >= 0

  return (
    <div className="group relative bg-white dark:bg-zinc-900/50 border border-zinc-200/50 dark:border-zinc-800/50 rounded-3xl p-6 hover:shadow-2xl hover:shadow-zinc-500/5 dark:hover:shadow-black/20 transition-all duration-500">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-10 transition-opacity duration-500 pointer-events-none">
        <Activity className="w-24 h-24 text-cyan-500 transform rotate-12" />
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">{title}</h3>
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{description}</p>
        </div>

        {hasData && (
          <div className="flex items-center gap-3 bg-zinc-50 dark:bg-zinc-800/50 p-1.5 pl-3 pr-1.5 rounded-full border border-zinc-100 dark:border-zinc-800">
            <span className={cn(
              "text-xs font-bold",
              isPositiveTrend ? "text-emerald-500" : "text-rose-500"
            )}>
              {isPositiveTrend ? "+" : ""}{trend.toFixed(1)}%
            </span>
            <div className={cn(
              "w-6 h-6 rounded-full flex items-center justify-center shadow-sm",
              isPositiveTrend ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"
            )}>
              {isPositiveTrend ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            </div>
          </div>
        )}
      </div>

      {hasData && (
        <div className="flex items-center gap-8 mb-6">
          <div className="flex flex-col">
            <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium uppercase tracking-wider mb-1">Total Leads</span>
            <div className="flex items-center gap-2">
              <div className="w-1 h-8 rounded-full bg-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.5)]" />
              <span className="text-2xl font-bold text-zinc-900 dark:text-white">{totalLeads}</span>
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium uppercase tracking-wider mb-1">Cierres</span>
            <div className="flex items-center gap-2">
              <div className="w-1 h-8 rounded-full bg-violet-500 shadow-[0_0_15px_rgba(139,92,246,0.5)]" />
              <span className="text-2xl font-bold text-zinc-900 dark:text-white">{totalDeals}</span>
            </div>
          </div>
        </div>
      )}

      {hasData ? (
        <div className="h-[300px] w-full -ml-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorDeals" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" opacity={0.4} />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "#94a3b8", fontWeight: 500 }}
                dy={10}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "#94a3b8", fontWeight: 500 }}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '4 4' }} />
              <Area
                type="monotone"
                dataKey="leads"
                stroke="#06b6d4"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorLeads)"
                stackId="1"
              />
              <Area
                type="monotone"
                dataKey="deals"
                stroke="#8b5cf6"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorDeals)"
                stackId="1"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <EmptyState />
      )}
    </div>
  )
})

ActivityOverviewChart.displayName = "ActivityOverviewChart"

export default ActivityOverviewChart
