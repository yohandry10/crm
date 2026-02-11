import { redirect } from "next/navigation"

export default function InventoryPage() {
  // Inventory was unified into Products. Keep this route for backwards compatibility.
  redirect("/products?tab=inventory")
}

