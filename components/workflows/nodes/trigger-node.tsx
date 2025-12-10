import { memo, useState } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from 'reactflow';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Zap, Settings2, Trash2 } from 'lucide-react';
import { WORKFLOW_TRIGGER_OPTIONS } from '@/lib/workflow-constants';

// ✅ FIX WF-007: Agregar configuración de triggers

interface TriggerNodeData {
    label: string;
    eventType?: string;
}

export const TriggerNode = memo(({ id, data, isConnectable }: NodeProps<TriggerNodeData>) => {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState(data.eventType || 'contact.created');
    const { setNodes } = useReactFlow();

    const handleSave = () => {
        const eventMeta = WORKFLOW_TRIGGER_OPTIONS.find(t => t.value === selectedEvent);
        setNodes((nds) =>
            nds.map((node) => {
                if (node.id === id) {
                    return {
                        ...node,
                        data: {
                            ...node.data,
                            eventType: selectedEvent,
                            label: eventMeta?.label || selectedEvent
                        }
                    };
                }
                return node;
            })
        );
        setDialogOpen(false);
    };

    const handleDelete = () => {
        setNodes((nds) => nds.filter((node) => node.id !== id));
        setDialogOpen(false);
    };

    return (
        <>
            <Card
                className="min-w-[250px] border-2 border-primary/50 shadow-lg bg-card cursor-pointer"
                onClick={() => setDialogOpen(true)}
            >
                <CardHeader className="p-3 pb-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-primary/10 rounded-full">
                                <Zap className="w-4 h-4 text-primary" />
                            </div>
                            <div>
                                <CardTitle className="text-sm font-bold text-primary">Disparador</CardTitle>
                                <p className="text-xs text-muted-foreground">Inicio del flujo</p>
                            </div>
                        </div>
                        <Settings2 className="w-4 h-4 text-muted-foreground" />
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

            {/* Diálogo de configuración */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Configurar Disparador</DialogTitle>
                        <DialogDescription>
                            Selecciona el evento que activará este workflow.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label>Tipo de Evento</Label>
                            <Select
                                value={selectedEvent}
                                onValueChange={setSelectedEvent}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccionar evento" />
                                </SelectTrigger>
                                <SelectContent className="max-h-[300px]">
                                    {WORKFLOW_TRIGGER_OPTIONS.map(option => (
                                        <SelectItem key={option.value} value={option.value}>
                                            <div className="flex flex-col">
                                                <span>{option.label}</span>
                                                <span className="text-xs text-muted-foreground">
                                                    {option.description}
                                                </span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="bg-muted/50 p-3 rounded-lg">
                            <p className="text-sm text-muted-foreground">
                                <strong>Tip:</strong> El workflow se activará automáticamente cuando ocurra el evento seleccionado.
                            </p>
                        </div>
                    </div>

                    <DialogFooter className="flex justify-between">
                        <Button variant="destructive" onClick={handleDelete} size="sm">
                            <Trash2 className="w-4 h-4 mr-2" />
                            Eliminar
                        </Button>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setDialogOpen(false)}>
                                Cancelar
                            </Button>
                            <Button onClick={handleSave}>
                                Guardar
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
});

TriggerNode.displayName = 'TriggerNode';
