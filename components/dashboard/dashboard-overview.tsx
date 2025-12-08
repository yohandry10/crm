"use client"

import { memo, useState, useEffect } from "react"
import useSWR from "swr"
import { motion } from "framer-motion"
import { TrendingUp, Users, DollarSign, FileText, Target, Zap, Package, ArrowUpRight, ArrowDownRight } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { ActivityTimeline } from "@/components/activity"
import { ActivityOverviewChart } from "./activity-overview-chart"
import { PipelineChart } from "./pipeline-chart"

const iconMap: Record<string, any> = {
  Users,
  DollarSign,
  FileText,
  Target,
  Zap,
  Package,
  TrendingUp
}

const gradients = [
  "from-cyan-500 to-blue-600",
  "from-violet-500 to-purple-600",
  "from-amber-500 to-orange-600",
  "from-emerald-500 to-teal-600",
]

const StatCard = memo(({ stat, index }: { stat: any; index: number }) => {
  const Icon = iconMap[stat.icon] || FileText
  const isPositive = stat.changeType === "positive"

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className="group bg-white border border-gray-100 rounded-2xl p-6 hover:shadow-lg hover:border-gray-200 transition-all duration-300"
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradients[index % 4]} flex items-center justify-center shadow-lg`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div className={cn(
          "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full",
          isPositive ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
        )}>
          {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {stat.change}
        </div>
      </div>
      <p className="text-sm text-gray-500 mb-1">{stat.title}</p>
      <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
      <p className="text-xs text-gray-400 mt-2">{stat.description}</p>
    </motion.div>
  )
})

StatCard.displayName = "StatCard"

const fetcher = async (url: string) => {
  const response = await fetch(url, { credentials: "include" })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const json = await response.json()
  if (!json.success) throw new Error(json.error || "Error al obtener métricas")
  return json
}

function DashboardOverviewContent() {
  const { data, isLoading } = useSWR('/api/dashboard', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 5 * 60 * 1000,
    shouldRetryOnError: false,
    onError: (error) => {
      console.error("Error fetching dashboard:", error)
      toast.error("Error al cargar el dashboard")
    }
  })

  if (isLoading) {
    return <DashboardOverviewSkeleton />
  }

  const stats = data?.data?.stats ?? []

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-2"
      >
        <h1 className="text-3xl font-bold text-gray-900">
          Bienvenido a{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-blue-600">
            NEON
          </span>
        </h1>
        <p className="text-gray-500">
          Tu centro de control para gestión empresarial inteligente
        </p>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat: any, index: number) => (
          <StatCard key={index} stat={stat} index={index} />
        ))}
      </div>

      {/* Charts Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.4 }}
        className="grid gap-5 lg:grid-cols-2"
      >
        <ActivityOverviewChart data={data?.data?.activityOverview} />
        <PipelineChart data={data?.data?.pipeline} />
      </motion.div>

      {/* Activity Timeline */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.5 }}
      >
        <ActivityTimeline 
          limit={10} 
          showFilters={true}
          compact={true}
        />
      </motion.div>
    </div>
  )
}

function DashboardOverviewSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <div className="h-9 w-72 bg-gray-100 rounded-lg animate-pulse" />
        <div className="h-5 w-96 bg-gray-50 rounded animate-pulse" />
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((key) => (
          <div key={key} className="bg-white border border-gray-100 rounded-2xl p-6 animate-pulse">
            <div className="flex justify-between mb-4">
              <div className="w-12 h-12 bg-gray-100 rounded-xl" />
              <div className="w-16 h-6 bg-gray-50 rounded-full" />
            </div>
            <div className="h-4 w-24 bg-gray-50 rounded mb-2" />
            <div className="h-8 w-32 bg-gray-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}

export const DashboardOverview = memo(() => {
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => {
    setMounted(true)
  }, [])
  
  if (!mounted) {
    return <DashboardOverviewSkeleton />
  }
  
  return <DashboardOverviewContent />
})

DashboardOverview.displayName = "DashboardOverview"

export default DashboardOverview
