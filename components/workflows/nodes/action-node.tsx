import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlayCircle, Mail, MessageSquare, Database } from 'lucide-react';

const icons: any = {
    send_email: Mail,
    send_whatsapp: MessageSquare,
    update_record: Database,
    default: PlayCircle
};

export const ActionNode = memo(({ data, isConnectable }: any) => {
    const Icon = icons[data.actionType] || icons.default;

    return (
        <Card className="min-w-[250px] border border-border shadow-sm hover:border-primary/50 transition-colors bg-card">
            <Handle
                type="target"
                position={Position.Top}
                isConnectable={isConnectable}
                className="w-3 h-3 bg-muted-foreground border-2 border-background"
            />
            <CardHeader className="p-3 pb-0">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-muted rounded-full">
                        <Icon className="w-4 h-4 text-foreground" />
                    </div>
                    <div>
                        <CardTitle className="text-sm font-semibold">Acción</CardTitle>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-3 pt-2">
                <div className="text-sm">
                    {data.label || 'Configurar acción'}
                </div>
                {data.actionType && (
                    <Badge variant="secondary" className="mt-2 text-xs font-mono">
                        {data.actionType}
                    </Badge>
                )}
            </CardContent>
            <Handle
                type="source"
                position={Position.Bottom}
                isConnectable={isConnectable}
                className="w-3 h-3 bg-muted-foreground border-2 border-background"
            />
        </Card>
    );
});

ActionNode.displayName = 'ActionNode';
