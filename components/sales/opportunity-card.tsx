import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar, User } from "lucide-react"
import { formatCurrency } from "@/lib/utils"

interface OpportunityCardProps {
    opportunity: any
    onDragStart: (e: React.DragEvent, id: string) => void
    onClick: (opportunity: any) => void
}

export function OpportunityCard({ opportunity, onDragStart, onClick }: OpportunityCardProps) {
    return (
        <Card
            className="cursor-grab active:cursor-grabbing hover:border-primary/50 hover:shadow-md transition-all mb-3 bg-card"
            draggable
            onDragStart={(e) => onDragStart(e, opportunity.id)}
            onClick={() => onClick(opportunity)}
        >
            <CardHeader className="p-3 pb-0">
                <div className="flex justify-between items-start">
                    <CardTitle className="text-sm font-medium leading-none">
                        {opportunity.name}
                    </CardTitle>
                    {opportunity.priority === 'high' && (
                        <Badge variant="destructive" className="h-1.5 w-1.5 rounded-full p-0" />
                    )}
                </div>
            </CardHeader>
            <CardContent className="p-3 pt-2 space-y-2">
                <div className="flex items-center justify-between text-sm">
                    <span className="font-bold text-primary">
                        {formatCurrency(opportunity.expected_revenue)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                        {opportunity.probability}%
                    </span>
                </div>

                {opportunity.contact && (
                    <div className="flex items-center text-xs text-muted-foreground">
                        <User className="mr-1 h-3 w-3" />
                        <span className="truncate">{opportunity.contact.name}</span>
                    </div>
                )}

                {opportunity.expected_close_date && (
                    <div className="flex items-center text-xs text-muted-foreground">
                        <Calendar className="mr-1 h-3 w-3" />
                        <span>{new Date(opportunity.expected_close_date).toLocaleDateString()}</span>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
