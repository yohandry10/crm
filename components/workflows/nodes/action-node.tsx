import { memo, useState } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from 'reactflow';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { PlayCircle, Mail, MessageSquare, Database, ListPlus, Globe, Settings2, Trash2 } from 'lucide-react';
import { WORKFLOW_ACTION_OPTIONS } from '@/lib/workflow-constants';

// ✅ FIX WF-007: Agregar configuración de parámetros en nodos

const icons: any = {
    send_email: Mail,
    create_task: ListPlus,
    send_whatsapp: MessageSquare,
    update_record: Database,
    webhook: Globe,
    default: PlayCircle
};

interface ActionNodeData {
    label: string;
    actionType: string;
    params?: Record<string, any>;
}

export const ActionNode = memo(({ id, data, isConnectable }: NodeProps<ActionNodeData>) => {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [params, setParams] = useState<Record<string, any>>(data.params || {});
    const { setNodes, getNodes } = useReactFlow();

    const Icon = icons[data.actionType] || icons.default;

    const handleSaveParams = () => {
        // Update node data with new params
        setNodes((nds) =>
            nds.map((node) => {
                if (node.id === id) {
                    return {
                        ...node,
                        data: {
                            ...node.data,
                            params
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

    const handleChangeActionType = (newType: string) => {
        const actionMeta = WORKFLOW_ACTION_OPTIONS.find(a => a.value === newType);
        setNodes((nds) =>
            nds.map((node) => {
                if (node.id === id) {
                    return {
                        ...node,
                        data: {
                            ...node.data,
                            actionType: newType,
                            label: actionMeta?.label || newType,
                            params: {} // Reset params when type changes
                        }
                    };
                }
                return node;
            })
        );
        setParams({});
    };

    // Render form fields based on action type
    const renderParamFields = () => {
        switch (data.actionType) {
            case 'send_email':
                return (
                    <>
                        <div className="space-y-2">
                            <Label htmlFor="to">Destinatario (opcional)</Label>
                            <Input
                                id="to"
                                placeholder="email@ejemplo.com o vacío para usar contacto"
                                value={params.to || ''}
                                onChange={(e) => setParams({ ...params, to: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="subject">Asunto</Label>
                            <Input
                                id="subject"
                                placeholder="Asunto del email"
                                value={params.subject || ''}
                                onChange={(e) => setParams({ ...params, subject: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="body">Contenido</Label>
                            <Textarea
                                id="body"
                                placeholder="Contenido del email (HTML permitido)"
                                rows={4}
                                value={params.body || ''}
                                onChange={(e) => setParams({ ...params, body: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="template">O usar plantilla</Label>
                            <Select
                                value={params.template || ''}
                                onValueChange={(v) => setParams({ ...params, template: v })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccionar plantilla" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">Ninguna (usar contenido personalizado)</SelectItem>
                                    <SelectItem value="welcome">Bienvenida</SelectItem>
                                    <SelectItem value="task_assigned">Tarea Asignada</SelectItem>
                                    <SelectItem value="order_completed">Pedido Completado</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </>
                );

            case 'create_task':
                return (
                    <>
                        <div className="space-y-2">
                            <Label htmlFor="title">Título *</Label>
                            <Input
                                id="title"
                                placeholder="Título de la tarea"
                                value={params.title || ''}
                                onChange={(e) => setParams({ ...params, title: e.target.value })}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="description">Descripción</Label>
                            <Textarea
                                id="description"
                                placeholder="Descripción de la tarea"
                                rows={3}
                                value={params.description || ''}
                                onChange={(e) => setParams({ ...params, description: e.target.value })}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="priority">Prioridad</Label>
                                <Select
                                    value={params.priority || 'medium'}
                                    onValueChange={(v) => setParams({ ...params, priority: v })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="low">Baja</SelectItem>
                                        <SelectItem value="medium">Media</SelectItem>
                                        <SelectItem value="high">Alta</SelectItem>
                                        <SelectItem value="urgent">Urgente</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="due_date">Fecha límite</Label>
                                <Input
                                    id="due_date"
                                    type="date"
                                    value={params.due_date?.split('T')[0] || ''}
                                    onChange={(e) => setParams({ ...params, due_date: e.target.value })}
                                />
                            </div>
                        </div>
                    </>
                );

            case 'update_lead_score':
                return (
                    <div className="space-y-2">
                        <Label htmlFor="score">Puntuación (0-100)</Label>
                        <Input
                            id="score"
                            type="number"
                            min={0}
                            max={100}
                            value={params.score || 0}
                            onChange={(e) => setParams({ ...params, score: Number(e.target.value) })}
                        />
                    </div>
                );

            case 'update_lead_status':
                return (
                    <div className="space-y-2">
                        <Label htmlFor="status">Nuevo Estado</Label>
                        <Select
                            value={params.status || ''}
                            onValueChange={(v) => setParams({ ...params, status: v })}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Seleccionar estado" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="new">Nuevo</SelectItem>
                                <SelectItem value="contacted">Contactado</SelectItem>
                                <SelectItem value="qualified">Calificado</SelectItem>
                                <SelectItem value="proposal">Propuesta</SelectItem>
                                <SelectItem value="negotiation">Negociación</SelectItem>
                                <SelectItem value="won">Ganado</SelectItem>
                                <SelectItem value="lost">Perdido</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                );

            case 'webhook':
                return (
                    <>
                        <div className="space-y-2">
                            <Label htmlFor="url">URL del Webhook *</Label>
                            <Input
                                id="url"
                                type="url"
                                placeholder="https://ejemplo.com/webhook"
                                value={params.url || ''}
                                onChange={(e) => setParams({ ...params, url: e.target.value })}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="method">Método HTTP</Label>
                            <Select
                                value={params.method || 'POST'}
                                onValueChange={(v) => setParams({ ...params, method: v })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="GET">GET</SelectItem>
                                    <SelectItem value="POST">POST</SelectItem>
                                    <SelectItem value="PUT">PUT</SelectItem>
                                    <SelectItem value="PATCH">PATCH</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </>
                );

            default:
                return (
                    <p className="text-sm text-muted-foreground">
                        No hay parámetros configurables para esta acción.
                    </p>
                );
        }
    };

    // Check if params are configured
    const hasParams = Object.keys(data.params || {}).length > 0;

    return (
        <>
            <Card
                className="min-w-[250px] border border-border shadow-sm hover:border-primary/50 transition-colors bg-card cursor-pointer"
                onClick={() => setDialogOpen(true)}
            >
                <Handle
                    type="target"
                    position={Position.Top}
                    isConnectable={isConnectable}
                    className="w-3 h-3 bg-muted-foreground border-2 border-background"
                />
                <CardHeader className="p-3 pb-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-muted rounded-full">
                                <Icon className="w-4 h-4 text-foreground" />
                            </div>
                            <div>
                                <CardTitle className="text-sm font-semibold">Acción</CardTitle>
                            </div>
                        </div>
                        <Settings2 className="w-4 h-4 text-muted-foreground" />
                    </div>
                </CardHeader>
                <CardContent className="p-3 pt-2">
                    <div className="text-sm">
                        {data.label || 'Configurar acción'}
                    </div>
                    <div className="flex gap-2 mt-2 flex-wrap">
                        {data.actionType && (
                            <Badge variant="secondary" className="text-xs font-mono">
                                {data.actionType}
                            </Badge>
                        )}
                        {hasParams && (
                            <Badge variant="outline" className="text-xs text-green-600">
                                Configurado
                            </Badge>
                        )}
                    </div>
                </CardContent>
                <Handle
                    type="source"
                    position={Position.Bottom}
                    isConnectable={isConnectable}
                    className="w-3 h-3 bg-muted-foreground border-2 border-background"
                />
            </Card>

            {/* Diálogo de configuración */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Configurar Acción</DialogTitle>
                        <DialogDescription>
                            Define los parámetros para esta acción del workflow.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label>Tipo de Acción</Label>
                            <Select
                                value={data.actionType}
                                onValueChange={handleChangeActionType}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccionar acción" />
                                </SelectTrigger>
                                <SelectContent>
                                    {WORKFLOW_ACTION_OPTIONS.map(option => (
                                        <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="border-t pt-4">
                            {renderParamFields()}
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
                            <Button onClick={handleSaveParams}>
                                Guardar
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
});

ActionNode.displayName = 'ActionNode';
