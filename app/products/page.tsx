"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ProductsCatalog } from "@/components/products/products-catalog"
import { InventoryPanel } from "@/components/inventory/inventory-panel"

type ProductsTab = "catalog" | "inventory"

function normalizeTab(tab: string | null): ProductsTab {
  if (tab === "inventory") return "inventory"
  return "catalog"
}

export default function ProductsPage() {
  const router = useRouter()
  const pathname = usePathname() ?? "/products"
  const searchParams = useSearchParams()
  const tabParam = searchParams?.get("tab") ?? null

  const [tab, setTab] = useState<ProductsTab>(() => normalizeTab(tabParam))

  useEffect(() => {
    setTab(normalizeTab(tabParam))
  }, [tabParam])

  const handleTabChange = (value: string) => {
    const nextTab = value === "inventory" ? "inventory" : "catalog"
    setTab(nextTab)

    const params = new URLSearchParams(searchParams?.toString() ?? "")
    if (nextTab === "inventory") params.set("tab", "inventory")
    else params.delete("tab")

    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  return (
    <DashboardLayout>
      <Tabs value={tab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList>
          <TabsTrigger value="catalog">Catálogo</TabsTrigger>
          <TabsTrigger value="inventory">Inventario</TabsTrigger>
        </TabsList>

        <TabsContent value="catalog">
          <ProductsCatalog />
        </TabsContent>

        <TabsContent value="inventory">
          <InventoryPanel />
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  )
}
