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
  CreditCard, Download, ExternalLink, Loader2, CheckCircle, AlertTriangle, Clock, ArrowLeft, Users
} from "lucide-react"
import { toast } from "sonner"
import { SubscriptionModal } from "@/components/subscription/subscription-modal"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { motion } from "framer-motion"
import Link from "next/link"

interface BillingInfo {
  organization: {
    id: string
    name: string
    subscription_status: string
    subscription_plan: string
    trial_ends_at: string | null
    subscription_ends_at: string | null
    cancel_at_period_end: boolean
    payment_customer_id: string | null
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

    // Check for checkout status redirects
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
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <div className="relative">
            <div className="absolute inset-0 bg-cyan-500/20 blur-xl rounded-full" />
            <Loader2 className="w-12 h-12 animate-spin text-cyan-500 relative z-10" />
          </div>
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
      <div className="max-w-6xl mx-auto space-y-8 pb-10">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-4"
        >
          <Link
            href="/settings"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-cyan-600 transition-colors w-fit"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver a Configuración
          </Link>

          <div className="space-y-1">
            <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-gray-900 via-gray-700 to-gray-900 bg-clip-text text-transparent">
              Facturación
            </h1>
            <p className="text-lg text-muted-foreground">
              Gestiona tu suscripción y métodos de pago
            </p>
          </div>
        </motion.div>

        {/* Current Plan */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="border-0 shadow-lg shadow-gray-200/40 bg-white/60 backdrop-blur-md overflow-hidden">
            <CardHeader className="border-b border-gray-100 bg-white/50">
              <CardTitle className="flex items-center gap-2 text-xl">
                <CreditCard className="w-5 h-5 text-cyan-500" />
                Plan Actual
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8">
              <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-6">
                <div className="space-y-4 w-full md:w-auto">
                  <div className="flex items-center gap-3">
                    <h3 className="text-3xl font-bold text-gray-900">
                      {currentPlan?.display_name || organization.subscription_plan}
                    </h3>
                    <div className="transform scale-110">
                      {getStatusBadge(organization.subscription_status)}
                    </div>
                  </div>

                  {organization.subscription_status === "trial" && organization.trial_ends_at && (
                    <div className="bg-yellow-50 text-yellow-800 px-4 py-2 rounded-lg border border-yellow-200 text-sm inline-flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Tu prueba termina el <strong>{formatDate(organization.trial_ends_at)}</strong>
                    </div>
                  )}

                  {organization.subscription_status === "active" && (
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500" />
                        Próxima facturación: <span className="text-gray-900 font-medium">{formatDate(organization.subscription_ends_at)}</span>
                      </p>
                      {organization.cancel_at_period_end && (
                        <p className="text-sm text-orange-600 bg-orange-50 px-3 py-1 rounded-md border border-orange-100 inline-block">
                          ⚠️ Tu suscripción se cancelará al final del período actual
                        </p>
                      )}
                    </div>
                  )}

                  {currentPlan && (
                    <div className="flex gap-4 text-sm text-gray-500 pt-2 border-t border-gray-100">
                      <span className="flex items-center gap-1.5"><Users className="w-4 h-4 text-cyan-600" /> {currentPlan.max_users} usuarios</span>
                      <span className="flex items-center gap-1.5"><CheckCircle className="w-4 h-4 text-cyan-600" /> {currentPlan.max_contacts.toLocaleString()} contactos</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-3 w-full md:w-auto min-w-[200px]">
                  {organization.subscription_status === "trial" || organization.subscription_status === "expired" ? (
                    <Button onClick={() => setShowUpgradeModal(true)} className="w-full gradient-neon border-0 text-white shadow-lg shadow-cyan-500/20 hover:scale-105 transition-all">
                      Suscribirse Ahora
                    </Button>
                  ) : organization.subscription_status === "active" ? (
                    <>
                      <Button variant="outline" onClick={() => setShowUpgradeModal(true)} className="w-full hover:bg-gray-50 border-gray-200">
                        Cambiar Plan
                      </Button>
                      {organization.payment_customer_id && (
                        <Button
                          variant="outline"
                          onClick={openCustomerPortal}
                          disabled={managingPortal}
                          className="w-full hover:bg-gray-50 border-gray-200"
                        >
                          {managingPortal && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                          Gestionar Pago
                        </Button>
                      )}
                      {!organization.cancel_at_period_end && (
                        <Button
                          variant="ghost"
                          className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
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
        </motion.div>

        {/* Invoices */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="border-0 shadow-lg shadow-gray-200/40 bg-white/60 backdrop-blur-md overflow-hidden">
            <CardHeader className="border-b border-gray-100 bg-white/50">
              <CardTitle className="text-xl">Historial de Facturas</CardTitle>
              <CardDescription>Todas tus facturas y recibos de pago</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {invoices.length === 0 ? (
                <div className="text-center py-16 bg-gray-50/30">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Download className="w-8 h-8 text-gray-300" />
                  </div>
                  <p className="text-muted-foreground">No hay facturas disponibles aún</p>
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-gray-50/50">
                    <TableRow className="hover:bg-transparent border-gray-100">
                      <TableHead className="pl-6">Fecha</TableHead>
                      <TableHead>Período</TableHead>
                      <TableHead>Monto</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right pr-6">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((invoice) => (
                      <TableRow key={invoice.id} className="hover:bg-cyan-50/30 border-gray-100 transition-colors">
                        <TableCell className="pl-6 font-medium text-gray-700">{formatDate(invoice.paid_at)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(invoice.period_start)} - {formatDate(invoice.period_end)}
                        </TableCell>
                        <TableCell className="font-mono text-gray-900">{formatCurrency(invoice.amount_paid, invoice.currency)}</TableCell>
                        <TableCell>
                          <Badge className={invoice.status === "paid" ? "bg-green-100 text-green-800 border-0" : "bg-gray-100 text-gray-700 border-0"}>
                            {invoice.status === "paid" ? "Pagado" : invoice.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          <div className="flex justify-end gap-2">
                            {invoice.invoice_pdf && (
                              <Button variant="ghost" size="sm" asChild className="h-8 w-8 p-0 rounded-full hover:bg-blue-50 hover:text-blue-600">
                                <a href={invoice.invoice_pdf} target="_blank" rel="noopener noreferrer" title="Descargar PDF">
                                  <Download className="w-4 h-4" />
                                </a>
                              </Button>
                            )}
                            {invoice.hosted_invoice_url && (
                              <Button variant="ghost" size="sm" asChild className="h-8 w-8 p-0 rounded-full hover:bg-cyan-50 hover:text-cyan-600">
                                <a href={invoice.hosted_invoice_url} target="_blank" rel="noopener noreferrer" title="Ver Factura">
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
        </motion.div>
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
