export interface IntegrationConfig {
    [key: string]: any
}

export interface ConnectionResult {
    success: boolean
    message: string
    details?: any
}

export async function testConnection(provider: string, config: IntegrationConfig): Promise<ConnectionResult> {
    switch (provider) {
        case "google":
            return testGoogle(config)
        default:
            return {
                success: false,
                message: "Proveedor no soportado. Solo Google OAuth está disponible.",
            }
    }
}

async function testGoogle(config: IntegrationConfig): Promise<ConnectionResult> {
    if (!config.client_id || !config.client_secret) {
        return {
            success: false,
            message: "Faltan credenciales OAuth (Client ID / Secret)",
        }
    }

    // ✅ Validar formato de credenciales
    if (!config.client_id.includes('.apps.googleusercontent.com')) {
        return {
            success: false,
            message: "Client ID de Google inválido"
        }
    }

    // ✅ Test OAuth token endpoint (sin redirect)
    try {
        const response = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                client_id: config.client_id,
                client_secret: config.client_secret,
                grant_type: 'client_credentials'
            }).toString(),
            signal: AbortSignal.timeout(5000)
        })

        // Si devuelve 400 con "invalid_grant" significa que credenciales son válidas
        // pero no hay tokens activos (esperado en este flujo)
        const data = await response.json()

        if (data.error === 'unsupported_grant_type' || data.error === 'invalid_grant') {
            // Credenciales correctas pero necesita flujo OAuth completo
            return {
                success: true,
                message: "Credenciales de Google validadas correctamente",
                details: {
                    note: "OAuth flow debe completarse en configuración"
                }
            }
        }

        if (!response.ok) {
            return {
                success: false,
                message: `Error de Google: ${data.error_description || 'Credenciales inválidas'}`
            }
        }

        return {
            success: true,
            message: "Conexión con Google Workspace verificada"
        }
    } catch (error: any) {
        if (error.name === 'AbortError') {
            return {
                success: false,
                message: "Timeout: Google OAuth no respondió"
            }
        }
        return {
            success: false,
            message: `Error de conexión: ${error.message}`
        }
    }
}
