"use client"

import { Component, ReactNode } from "react"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { reportClientError } from "@/lib/client-error-reporting"

interface Props {
    children: ReactNode
}

interface State {
    hasError: boolean
    error: Error | null
    errorInfo: any
}

/**
 * Global Error Boundary
 * Resolves ERROR-UI-005: Implement global error boundary
 * 
 * Catches React component errors and displays user-friendly error page
 */
export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props)
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null
        }
    }

    static getDerivedStateFromError(error: Error): State {
        return {
            hasError: true,
            error,
            errorInfo: null
        }
    }

    componentDidCatch(error: Error, errorInfo: any) {
        console.error("ErrorBoundary caught an error:", error, errorInfo)

        void reportClientError({
            source: "react-boundary",
            message: error.message || "Error inesperado de interfaz",
            stack: error.stack,
            componentStack: errorInfo.componentStack,
        })

        this.setState({
            errorInfo
        })
    }

    handleReset = () => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null
        })

        // Reload page
        window.location.reload()
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center p-4 bg-background">
                    <Card className="max-w-2xl w-full">
                        <CardHeader className="text-center">
                            <div className="flex justify-center mb-4">
                                <div className="p-4 bg-destructive/10 rounded-full">
                                    <AlertTriangle className="h-12 w-12 text-destructive" />
                                </div>
                            </div>
                            <CardTitle className="text-2xl">
                                Algo salió mal
                            </CardTitle>
                            <CardDescription>
                                Lo sentimos, ocurrió un error inesperado al procesar tu solicitud
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {process.env.NODE_ENV === "development" && this.state.error && (
                                <div className="p-4 bg-muted rounded-lg">
                                    <p className="font-mono text-sm text-destructive">
                                        {this.state.error.message}
                                    </p>
                                    {this.state.error.stack && (
                                        <details className="mt-2">
                                            <summary className="cursor-pointer text-sm text-muted-foreground">
                                                Ver detalles técnicos
                                            </summary>
                                            <pre className="mt-2 text-xs overflow-auto max-h-48 p-2 bg-background rounded border">
                                                {this.state.error.stack}
                                            </pre>
                                        </details>
                                    )}
                                </div>
                            )}

                            <div className="flex gap-4 justify-center">
                                <Button onClick={this.handleReset} variant="default">
                                    Recargar página
                                </Button>
                                <Button onClick={() => window.location.href = "/"} variant="outline">
                                    Ir al inicio
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )
        }

        return this.props.children
    }
}
