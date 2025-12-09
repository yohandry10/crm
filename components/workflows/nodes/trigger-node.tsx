import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap } from 'lucide-react';

export const TriggerNode = memo(({ data, isConnectable }: any) => {
    return (
        <Card className="min-w-[250px] border-2 border-primary/50 shadow-lg bg-card">
            <CardHeader className="p-3 pb-0">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-primary/10 rounded-full">
                        <Zap className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                        <CardTitle className="text-sm font-bold text-primary">Disparador</CardTitle>
                        <p className="text-xs text-muted-foreground">Inicio del flujo</p>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-3 pt-2">
                <div className="text-sm font-medium">
                    {data.label || 'Seleccionar Evento'}
                </div>
                {data.eventType && (
                    <Badge variant="outline" className="mt-2 text-xs">
                        {data.eventType}
                    </Badge>
                )}
            </CardContent>
            <Handle
                type="source"
                position={Position.Bottom}
                isConnectable={isConnectable}
                className="w-3 h-3 bg-primary border-2 border-background"
            />
        </Card>
    );
});

TriggerNode.displayName = 'TriggerNode';
