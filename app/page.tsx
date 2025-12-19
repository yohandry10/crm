import { redirect } from "next/navigation"
import LandingEntry from "@/components/landing/landing-entry"
import { createSupabaseServerClient } from "@/lib/supabase-server"

export default async function HomePage() {
  try {
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      redirect("/dashboard")
    }
  } catch {
    // If env/auth is not configured, still render marketing landing.
  }

  return <LandingEntry />
}
