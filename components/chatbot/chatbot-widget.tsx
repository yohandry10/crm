"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MessageCircle, X, Send, Bot, User } from "lucide-react"
import { cn } from "@/lib/utils"

interface Message {
  id: number
  text: string
  sender: "user" | "bot"
  timestamp: Date
}

const initialMessages: Message[] = [
  {
    id: 1,
    text: "¡Hola! Soy tu asistente de IA para el CRM. ¿En qué puedo ayudarte hoy?",
    sender: "bot",
    timestamp: new Date(),
  },
]

export function ChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [inputValue, setInputValue] = useState("")

  const handleSendMessage = () => {
    if (!inputValue.trim()) return

    const userMessage: Message = {
      id: messages.length + 1,
      text: inputValue,
      sender: "user",
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInputValue("")

    // Simulate bot response
    setTimeout(() => {
      const botResponse: Message = {
        id: messages.length + 2,
        text: getBotResponse(inputValue),
        sender: "bot",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, botResponse])
    }, 1000)
  }

  const getBotResponse = (userInput: string): string => {
    const input = userInput.toLowerCase()

    if (input.includes("contactos") || input.includes("clientes")) {
      return "Tienes 2,847 contactos totales. 342 son leads calificados con score > 80. ¿Te gustaría ver los contactos más prometedores?"
    }

    if (input.includes("ventas") || input.includes("ingresos")) {
      return "Las ventas de este mes son S/ 45,230, un 23% más que el mes anterior. La predicción para el próximo mes es S/ 52,000."
    }



    if (input.includes("predicción") || input.includes("ia")) {
      return "El modelo de IA tiene 89% de precisión en lead scoring. Los sectores con mayor probabilidad de conversión son: Servicios (91%), Textiles (85%) y Minería (72%)."
    }

    return "Entiendo tu consulta. Puedo ayudarte con contactos, ventas, predicciones de IA y más. ¿Podrías ser más específico?"
  }

  return (
    <>
      {/* Chat Widget Button */}
      <Button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg z-40",
          "bg-primary hover:bg-primary/90 text-primary-foreground",
          isOpen && "hidden",
        )}
      >
        <MessageCircle className="w-6 h-6" />
      </Button>

      {/* Chat Window */}
      {isOpen && (
        <Card className="fixed bottom-6 right-6 w-96 h-[500px] shadow-xl z-50 flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 border-b">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                <Bot className="w-4 h-4 text-primary-foreground" />
              </div>
              <div>
                <CardTitle className="text-sm">Asistente IA</CardTitle>
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-xs text-muted-foreground">En línea</span>
                </div>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
              <X className="w-4 h-4" />
            </Button>
          </CardHeader>

          <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex items-start space-x-2",
                  message.sender === "user" && "flex-row-reverse space-x-reverse",
                )}
              >
                <div
                  className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-xs",
                    message.sender === "bot"
                      ? "bg-primary text-primary-foreground"
                      : "bg-accent text-accent-foreground",
                  )}
                >
                  {message.sender === "bot" ? <Bot className="w-3 h-3" /> : <User className="w-3 h-3" />}
                </div>
                <div
                  className={cn(
                    "max-w-[80%] p-3 rounded-lg text-sm",
                    message.sender === "bot" ? "bg-muted text-foreground" : "bg-primary text-primary-foreground",
                  )}
                >
                  {message.text}
                </div>
              </div>
            ))}
          </CardContent>

          <div className="p-4 border-t">
            <div className="flex space-x-2">
              <Input
                placeholder="Pregunta sobre tus datos..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                className="flex-1"
              />
              <Button onClick={handleSendMessage} size="sm">
                <Send className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-center">Powered by IA • Datos en tiempo real</p>
          </div>
        </Card>
      )}
    </>
  )
}
