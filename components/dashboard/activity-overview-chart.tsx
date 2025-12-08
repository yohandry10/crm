"use client"

import { memo, useMemo } from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { Activity, TrendingUp, TrendingDown } from "lucide-react"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"

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

const chartConfig = {
  leads: {
    label: "Leads",
    color: "#06b6d4",
  },
  deals: {
    label: "Deals",
    color: "#8b5cf6",
  },
} satisfies ChartConfig

const EmptyState = memo(() => (
  <div className="flex flex-col items-center justify-center h-[280px] text-center px-4">
    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-violet-500/10 flex items-center justify-center mb-4">
      <Activity className="w-8 h-8 text-cyan-500" />
    </div>
    <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">Sin actividad aún</h3>
    <p className="text-xs text-gray-500 dark:text-gray-400 max-w-[200px]">
      La actividad de leads y deals aparecerá aquí cuando tengas datos
    </p>
  </div>
))

EmptyState.displayName = "ActivityEmptyState"

export const ActivityOverviewChart = memo(({ 
  data = [], 
  title = "Activity Overview",
  description = "Leads y deals en el tiempo"
}: ActivityOverviewChartProps) => {
  const hasData = data.length > 0

  const { totalLeads, totalDeals, trend } = useMemo(() => {
    if (!hasData) return { totalLeads: 0, totalDeals: 0, trend: 0 }
    
    const leads = data.reduce((sum, d) => sum + (d.leads || 0), 0)
    const deals = data.reduce((sum, d) => sum + (d.deals || 0), 0)
    
    const mid = Math.floor(data.length / 2)
    const firstHalf = data.slice(0, mid).reduce((s, d) => s + d.leads + d.deals, 0)
    const secondHalf = data.slice(mid).reduce((s, d) => s + d.leads + d.deals, 0)
    const trendValue = firstHalf > 0 ? ((secondHalf - firstHalf) / firstHalf) * 100 : 0
    
    return { totalLeads: leads, totalDeals: deals, trend: trendValue }
  }, [data, hasData])

  const isPositiveTrend = trend >= 0

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
        </div>
        {hasData && (
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
            isPositiveTrend 
              ? "bg-emerald-50 text-emerald-600" 
              : "bg-rose-50 text-rose-600"
          }`}>
            {isPositiveTrend ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            {Math.abs(trend).toFixed(1)}%
          </div>
        )}
      </div>

      {hasData && (
        <div className="flex items-center gap-6 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-cyan-500" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Leads</span>
            <span className="text-sm font-semibold text-gray-900 dark:text-white">{totalLeads}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-violet-500" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Deals</span>
            <span className="text-sm font-semibold text-gray-900 dark:text-white">{totalDeals}</span>
          </div>
        </div>
      )}

      {hasData ? (
        <ChartContainer config={chartConfig} className="h-[280px] w-full">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="fillLeads" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="fillDeals" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis 
              dataKey="date" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 12, fill: "#94a3b8" }}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 12, fill: "#94a3b8" }}
            />
            <ChartTooltip 
              content={<ChartTooltipContent />}
              cursor={{ stroke: "#d1d5db", strokeDasharray: "4 4" }}
            />
            <Area
              type="monotone"
              dataKey="leads"
              stroke="#06b6d4"
              strokeWidth={2}
              fill="url(#fillLeads)"
              dot={false}
              activeDot={{ r: 4, fill: "#06b6d4", stroke: "#fff", strokeWidth: 2 }}
            />
            <Area
              type="monotone"
              dataKey="deals"
              stroke="#8b5cf6"
              strokeWidth={2}
              fill="url(#fillDeals)"
              dot={false}
              activeDot={{ r: 4, fill: "#8b5cf6", stroke: "#fff", strokeWidth: 2 }}
            />
          </AreaChart>
        </ChartContainer>
      ) : (
        <EmptyState />
      )}
    </div>
  )
})

ActivityOverviewChart.displayName = "ActivityOverviewChart"

export default ActivityOverviewChart
