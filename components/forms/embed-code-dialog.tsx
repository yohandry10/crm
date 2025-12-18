"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Copy, Check, ExternalLink } from "lucide-react"
import { toast } from "sonner"

interface WebForm {
  id: string
  name: string
  slug: string
}

interface EmbedCodeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  form: WebForm | null
}

export function EmbedCodeDialog({ open, onOpenChange, form }: EmbedCodeDialogProps) {
  const [copiedType, setCopiedType] = useState<string | null>(null)

  if (!form) return null

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const formUrl = `${baseUrl}/f/${form.slug}`
  const apiUrl = `${baseUrl}/api/public/forms/${form.id}`

  const iframeCode = `<iframe 
  src="${formUrl}" 
  width="100%" 
  height="500" 
  frameborder="0"
  style="border: none; max-width: 500px;"
></iframe>`

  const scriptCode = `<!-- Formulario: ${form.name} -->
<div id="crm-form-${form.slug}"></div>
<script>
(function() {
  var container = document.getElementById('crm-form-${form.slug}');
  var iframe = document.createElement('iframe');
  iframe.src = '${formUrl}?embed=true';
  iframe.style.cssText = 'width:100%;max-width:500px;height:500px;border:none;';
  iframe.setAttribute('frameborder', '0');
  container.appendChild(iframe);
  
  // Auto-resize
  window.addEventListener('message', function(e) {
    if (e.data.type === 'crm-form-resize' && e.data.formId === '${form.id}') {
      iframe.style.height = e.data.height + 'px';
    }
  });
})();
</script>`

  const directLinkCode = formUrl

  const apiExample = `// Enviar datos al formulario via API
fetch('${baseUrl}/api/public/forms/${form.id}/submit', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    data: {
      name: 'Juan Pérez',
      email: 'juan@email.com',
      phone: '+51999888777'
    },
    utm_source: 'mi_sitio',
    utm_campaign: 'landing_principal'
  })
})
.then(res => res.json())
.then(data => {
  if (data.success) {
    // Form submission created: data.submission_id
    if (data.redirect_url) {
      window.location.href = data.redirect_url;
    }
  }
});`

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedType(type)
      toast.success('Copiado al portapapeles')
      setTimeout(() => setCopiedType(null), 2000)
    } catch (err) {
      toast.error('Error al copiar')
    }
  }

  const CopyButton = ({ text, type }: { text: string; type: string }) => (
    <Button
      variant="outline"
      size="sm"
      onClick={() => copyToClipboard(text, type)}
    >
      {copiedType === type ? (
        <Check className="h-4 w-4 mr-1" />
      ) : (
        <Copy className="h-4 w-4 mr-1" />
      )}
      {copiedType === type ? 'Copiado' : 'Copiar'}
    </Button>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Código para embeber</DialogTitle>
          <DialogDescription>
            Elige cómo quieres integrar el formulario "{form.name}" en tu sitio web
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="iframe">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="iframe">iFrame</TabsTrigger>
            <TabsTrigger value="script">Script</TabsTrigger>
            <TabsTrigger value="link">Link directo</TabsTrigger>
            <TabsTrigger value="api">API</TabsTrigger>
          </TabsList>

          {/* iFrame */}
          <TabsContent value="iframe">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Embeber con iFrame</CardTitle>
                <CardDescription>
                  La forma más simple. Copia y pega este código en tu HTML.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto">
                    {iframeCode}
                  </pre>
                  <div className="absolute top-2 right-2">
                    <CopyButton text={iframeCode} type="iframe" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Script */}
          <TabsContent value="script">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Embeber con Script</CardTitle>
                <CardDescription>
                  Más flexible. El formulario se ajusta automáticamente al contenido.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto whitespace-pre-wrap">
                    {scriptCode}
                  </pre>
                  <div className="absolute top-2 right-2">
                    <CopyButton text={scriptCode} type="script" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Link directo */}
          <TabsContent value="link">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Link directo</CardTitle>
                <CardDescription>
                  Comparte este link para que accedan directamente al formulario.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-gray-100 px-3 py-2 rounded text-sm">
                    {directLinkCode}
                  </code>
                  <CopyButton text={directLinkCode} type="link" />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(formUrl, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Puedes agregar parámetros UTM para tracking:
                </p>
                <code className="block bg-gray-100 px-3 py-2 rounded text-xs">
                  {formUrl}?utm_source=facebook&utm_campaign=promo
                </code>
              </CardContent>
            </Card>
          </TabsContent>

          {/* API */}
          <TabsContent value="api">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Integración via API</CardTitle>
                <CardDescription>
                  Para desarrolladores. Envía datos directamente desde tu aplicación.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium mb-2">Endpoint:</p>
                  <code className="block bg-gray-100 px-3 py-2 rounded text-sm">
                    POST {baseUrl}/api/public/forms/{form.id}/submit
                  </code>
                </div>
                <div className="relative">
                  <p className="text-sm font-medium mb-2">Ejemplo:</p>
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto whitespace-pre-wrap">
                    {apiExample}
                  </pre>
                  <div className="absolute top-8 right-2">
                    <CopyButton text={apiExample} type="api" />
                  </div>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded p-3">
                  <p className="text-sm text-blue-800">
                    <strong>Nota:</strong> Los campos en <code>data</code> deben coincidir con los IDs 
                    de los campos configurados en el formulario (name, email, phone, etc.)
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
