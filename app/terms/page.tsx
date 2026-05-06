import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function TermsPage() {
    return (
        <main className="min-h-screen bg-background px-6 py-10 text-foreground">
            <div className="mx-auto max-w-3xl space-y-6">
                <Button asChild variant="outline">
                    <Link href="/">Volver al inicio</Link>
                </Button>
                <Card>
                    <CardHeader>
                        <CardTitle className="text-3xl">Terminos de servicio</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm leading-7 text-muted-foreground">
                        <p>
                            NEON SYSTEM provee una plataforma CRM para gestionar contactos, ventas, tareas,
                            formularios, calendario, facturacion y operaciones relacionadas de una organizacion.
                        </p>
                        <p>
                            Cada cliente es responsable de la exactitud de la informacion que registra, de contar
                            con autorizacion para procesar datos personales y de configurar usuarios, dominios,
                            integraciones y metodos de pago conforme a sus politicas internas.
                        </p>
                        <p>
                            La plataforma puede suspender operaciones que afecten seguridad, disponibilidad o uso
                            indebido del servicio. Las funciones de pago externo solo deben activarse con
                            credenciales reales del proveedor correspondiente.
                        </p>
                        <p>
                            Estos terminos son una base operativa para el producto y deben ser revisados por asesoria
                            legal antes de publicarse como contrato comercial final.
                        </p>
                    </CardContent>
                </Card>
            </div>
        </main>
    )
}
