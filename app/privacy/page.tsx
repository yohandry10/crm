import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function PrivacyPage() {
    return (
        <main className="min-h-screen bg-background px-6 py-10 text-foreground">
            <div className="mx-auto max-w-3xl space-y-6">
                <Button asChild variant="outline">
                    <Link href="/">Volver al inicio</Link>
                </Button>
                <Card>
                    <CardHeader>
                        <CardTitle className="text-3xl">Privacidad</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm leading-7 text-muted-foreground">
                        <p>
                            NEON SYSTEM procesa datos de usuarios, contactos, cuentas, oportunidades, tickets,
                            formularios, eventos y documentos comerciales para operar el CRM de cada organizacion.
                        </p>
                        <p>
                            Los datos se separan por organizacion y los accesos se validan por sesion, membresia y
                            permisos del usuario. Las rutas publicas aplican validacion, limites y controles de
                            origen cuando corresponden.
                        </p>
                        <p>
                            Las integraciones externas solo deben recibir la informacion necesaria para ejecutar la
                            funcion configurada por el cliente. Los secretos de integracion no se muestran al cliente
                            una vez guardados.
                        </p>
                        <p>
                            Esta politica es una base operativa del producto y debe revisarse con asesoria legal
                            antes de usarse como documento final frente a clientes.
                        </p>
                    </CardContent>
                </Card>
            </div>
        </main>
    )
}
