"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table"
import {
  CreditCard, Download, ExternalLink, Loader2, CheckCircle, AlertTriangle, Clock
} from "lucide-react"
import { toast } from "sonner"
import { SubscriptionModal } from "@/components/subscription/subscription-modal"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"

interface BillingInfo {
  organization: {
    id: string
    name: string
    subscription_status: string
    subscription_plan: string
    trial_ends_at: string | null
    subscription_ends_at: string | null
    cancel_at_period_end: boolean
    stripe_customer_id: string | null
  }
  invoices: {
    id: string
    amount_paid: number
    currency: string
    status: string
    invoice_pdf: string | null
    hosted_invoice_url: string | null
    period_start: string
    period_end: string
    paid_at: string
  }[]
  currentPlan: {
    name: string
    display_name: string
    price_monthly: number
    price_yearly: number
    max_users: number
    max_contacts: number
  } | null
}

export default function BillingPage() {
  const searchParams = useSearchParams()
  const [billing, setBilling] = useState<BillingInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [managingPortal, setManagingPortal] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)

  useEffect(() => {
    loadBilling()
    
    // Check for success/cancelled from Stripe redirect
    if (searchParams?.get("success") === "true") {
      toast.success("¡Suscripción activada exitosamente!")
    } else if (searchParams?.get("cancelled") === "true") {
      toast.info("Checkout cancelado")
    }
  }, [searchParams])

  const loadBilling = async () => {
    try {
      const res = await fetch("/api/subscriptions/billing")
      const json = await res.json()
      if (json.success) {
        setBilling(json.data)
      }
    } catch (error) {
      toast.error("Error al cargar información de facturación")
    } finally {
      setLoading(false)
    }
  }

  const openCustomerPortal = async () => {
    setManagingPortal(true)
    try {
      const res = await fetch("/api/subscriptions/portal", { method: "POST" })
      const json = await res.json()
      if (json.success && json.url) {
        window.location.href = json.url
      } else {
        toast.error(json.error || "No se pudo abrir el portal")
      }
    } catch (error) {
      toast.error("Error al abrir portal de facturación")
    } finally {
      setManagingPortal(false)
    }
  }

  const cancelSubscription = async () => {
    setCancelling(true)
    try {
      const res = await fetch("/api/subscriptions/cancel", { method: "POST" })
      const json = await res.json()
      if (json.success) {
        toast.success("Suscripción cancelada. Tendrás acceso hasta el final del período.")
        loadBilling()
      } else {
        throw new Error(json.error)
      }
    } catch (error: any) {
      toast.error(error.message || "Error al cancelar")
    } finally {
      setCancelling(false)
      setShowCancelConfirm(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Activa</Badge>
      case "trial":
        return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" />Prueba</Badge>
      case "past_due":
        return <Badge className="bg-orange-100 text-orange-800"><AlertTriangle className="w-3 h-3 mr-1" />Pago pendiente</Badge>
      case "cancelled":
      case "expired":
        return <Badge className="bg-red-100 text-red-800">Cancelada</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const formatDate = (date: string | null) => {
    if (!date) return "-"
    return new Date(date).toLocaleDateString("es-PE", {
      day: "2-digit",
      month: "long",
      year: "numeric"
    })
  }

  const formatCurrency = (amount: number, currency = "pen") => {
    const symbol = currency.toLowerCase() === "usd" ? "$" : "S/"
    return `${symbol} ${(amount / 100).toLocaleString()}`
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      </DashboardLayout>
    )
  }

  if (!billing) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">No se pudo cargar la información de facturación</p>
        </div>
      </DashboardLayout>
    )
  }

  const { organization, invoices, currentPlan } = billing

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Facturación</h1>
          <p className="text-muted-foreground">Gestiona tu suscripción y métodos de pago</p>
        </div>

        {/* Current Plan */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Plan Actual
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start justify-between">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <h3 className="text-2xl font-bold">
                    {currentPlan?.display_name || organization.subscription_plan}
                  </h3>
                  {getStatusBadge(organization.subscription_status)}
                </div>

                {organization.subscription_status === "trial" && organization.trial_ends_at && (
                  <p className="text-sm text-muted-foreground">
                    Tu prueba termina el {formatDate(organization.trial_ends_at)}
                  </p>
                )}

                {organization.subscription_status === "active" && (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Próxima facturación: {formatDate(organization.subscription_ends_at)}
                    </p>
                    {organization.cancel_at_period_end && (
                      <p className="text-sm text-orange-600">
                        ⚠️ Tu suscripción se cancelará al final del período actual
                      </p>
                    )}
                  </>
                )}

                {currentPlan && (
                  <div className="flex gap-4 text-sm text-muted-foreground">
                    <span>{currentPlan.max_users} usuarios</span>
                    <span>{currentPlan.max_contacts.toLocaleString()} contactos</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2">
                {organization.subscription_status === "trial" || organization.subscription_status === "expired" ? (
                  <Button onClick={() => setShowUpgradeModal(true)}>
                    Suscribirse
                  </Button>
                ) : organization.subscription_status === "active" ? (
                  <>
                    <Button variant="outline" onClick={() => setShowUpgradeModal(true)}>
                      Cambiar Plan
                    </Button>
                    {organization.stripe_customer_id && (
                      <Button 
                        variant="outline" 
                        onClick={openCustomerPortal}
                        disabled={managingPortal}
                      >
                        {managingPortal && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Gestionar Pago
                      </Button>
                    )}
                    {!organization.cancel_at_period_end && (
                      <Button 
                        variant="ghost" 
                        className="text-red-600 hover:text-red-700"
                        onClick={() => setShowCancelConfirm(true)}
                        disabled={cancelling}
                      >
                        {cancelling && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Cancelar Suscripción
                      </Button>
                    )}
                  </>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Invoices */}
        <Card>
          <CardHeader>
            <CardTitle>Historial de Facturas</CardTitle>
            <CardDescription>Todas tus facturas y recibos de pago</CardDescription>
          </CardHeader>
          <CardContent>
            {invoices.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No hay facturas aún
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead>Monto</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell>{formatDate(invoice.paid_at)}</TableCell>
                      <TableCell>
                        {formatDate(invoice.period_start)} - {formatDate(invoice.period_end)}
                      </TableCell>
                      <TableCell>{formatCurrency(invoice.amount_paid, invoice.currency)}</TableCell>
                      <TableCell>
                        <Badge className={invoice.status === "paid" ? "bg-green-100 text-green-800" : ""}>
                          {invoice.status === "paid" ? "Pagado" : invoice.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {invoice.invoice_pdf && (
                            <Button variant="ghost" size="sm" asChild>
                              <a href={invoice.invoice_pdf} target="_blank" rel="noopener noreferrer">
                                <Download className="w-4 h-4" />
                              </a>
                            </Button>
                          )}
                          {invoice.hosted_invoice_url && (
                            <Button variant="ghost" size="sm" asChild>
                              <a href={invoice.hosted_invoice_url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <SubscriptionModal
        open={showUpgradeModal}
        onOpenChange={setShowUpgradeModal}
        organizationId={organization.id}
        isExpired={organization.subscription_status === "expired"}
      />

      {/* Cancel Subscription Confirmation Dialog */}
      <ConfirmDialog
        open={showCancelConfirm}
        onOpenChange={setShowCancelConfirm}
        title="Cancelar Suscripción"
        description="¿Estás seguro de cancelar tu suscripción? Mantendrás acceso hasta el final del período actual."
        confirmText="Sí, Cancelar"
        cancelText="No, Mantener"
        variant="destructive"
        onConfirm={cancelSubscription}
      />
    </DashboardLayout>
  )
}
