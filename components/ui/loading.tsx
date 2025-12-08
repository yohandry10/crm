import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface LoadingProps extends React.HTMLAttributes<HTMLDivElement> {
    size?: "sm" | "default" | "lg" | "xl"
    text?: string
    fullScreen?: boolean
}

export function Loading({
    size = "default",
    text,
    fullScreen = false,
    className,
    ...props
}: LoadingProps) {
    const sizeClasses = {
        sm: "h-4 w-4",
        default: "h-8 w-8",
        lg: "h-12 w-12",
        xl: "h-16 w-16"
    }

    const content = (
        <div className={cn("flex flex-col items-center justify-center gap-2", className)} {...props}>
            <Loader2 className={cn("animate-spin text-primary", sizeClasses[size])} />
            {text && <p className="text-muted-foreground text-sm animate-pulse">{text}</p>}
        </div>
    )

    if (fullScreen) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
                {content}
            </div>
        )
    }

    return content
}
