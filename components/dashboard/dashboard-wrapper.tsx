"use client"

import dynamic from "next/dynamic"

const DashboardOverview = dynamic(
    () => import("@/components/dashboard/dashboard-overview"),
    {
        ssr: false,
        loading: () => (
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
)

export function DashboardWrapper() {
    return <DashboardOverview />
}
