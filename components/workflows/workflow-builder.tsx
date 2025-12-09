"use client"

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import ReactFlow, {
    ReactFlowProvider,
    addEdge,
    useNodesState,
    useEdgesState,
    Controls,
    Background,
    Connection,
    Edge,
    Node,
    Panel,
    MarkerType
} from 'reactflow';
import 'reactflow/dist/style.css';

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, Save, Play, MonitorPlay } from 'lucide-react';
import { toast } from "sonner";
import { TriggerNode } from './nodes/trigger-node';
import { ActionNode } from './nodes/action-node';



const defaultViewport = { x: 0, y: 0, zoom: 1.5 };

interface WorkflowBuilderProps {
    initialNodes?: Node[];
    initialEdges?: Edge[];
    onSave: (nodes: Node[], edges: Edge[]) => Promise<void>;
}

const WorkflowBuilderContent = ({ initialNodes = [], initialEdges = [], onSave }: WorkflowBuilderProps) => {
    const reactFlowWrapper = useRef<HTMLDivElement>(null);
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
    const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);

    const nodeTypes = useMemo(() => ({
        trigger: TriggerNode,
        action: ActionNode,
    }), []);

    const onConnect = useCallback((params: Connection) => {
        setEdges((eds) => addEdge({ ...params, type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } }, eds));
    }, [setEdges]);

    const onDragOver = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    const onDrop = useCallback(
        (event: React.DragEvent) => {
            event.preventDefault();

            const type = event.dataTransfer.getData('application/reactflow');
            const label = event.dataTransfer.getData('label');
            const actionType = event.dataTransfer.getData('actionType'); // metadata

            // check if the dropped element is valid
            if (typeof type === 'undefined' || !type) {
                return;
            }

            const position = reactFlowInstance.screenToFlowPosition({
                x: event.clientX,
                y: event.clientY,
            });

            const newNode: Node = {
                id: `${type}-${Date.now()}`,
                type,
                position,
                data: { label, actionType },
            };

            setNodes((nds) => nds.concat(newNode));
        },
        [reactFlowInstance, setNodes]
    );

    const handleSave = async () => {
        if (nodes.length === 0) {
            toast.error("El workflow está vacío");
            return;
        }
        await onSave(nodes, edges);
    }

    return (
        <div className="flex h-[80vh] w-full border rounded-lg overflow-hidden bg-background">
            {/* Sidebar de herramientas */}
            <aside className="w-64 border-r bg-muted/20 p-4 flex flex-col gap-4">
                <div className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                    Bloques
                </div>

                <div
                    className="p-3 bg-card border rounded shadow-sm cursor-grab active:cursor-grabbing hover:border-primary transition-colors"
                    draggable
                    onDragStart={(event) => {
                        event.dataTransfer.setData('application/reactflow', 'trigger');
                        event.dataTransfer.setData('label', 'Nuevo Evento');
                    }}
                >
                    <div className="flex items-center gap-2">
                        <MonitorPlay className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium">Disparador</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Inicia el flujo (ej. Nuevo Lead)</p>
                </div>

                <div
                    className="p-3 bg-card border rounded shadow-sm cursor-grab active:cursor-grabbing hover:border-primary transition-colors"
                    draggable
                    onDragStart={(event) => {
                        event.dataTransfer.setData('application/reactflow', 'action');
                        event.dataTransfer.setData('label', 'Enviar Email');
                        event.dataTransfer.setData('actionType', 'send_email');
                    }}
                >
                    <div className="flex items-center gap-2">
                        <Play className="w-4 h-4 text-blue-500" />
                        <span className="text-sm font-medium">Enviar Email</span>
                    </div>
                </div>

                <div
                    className="p-3 bg-card border rounded shadow-sm cursor-grab active:cursor-grabbing hover:border-primary transition-colors"
                    draggable
                    onDragStart={(event) => {
                        event.dataTransfer.setData('application/reactflow', 'action');
                        event.dataTransfer.setData('label', 'Crear Tarea');
                        event.dataTransfer.setData('actionType', 'create_task');
                    }}
                >
                    <div className="flex items-center gap-2">
                        <Play className="w-4 h-4 text-green-500" />
                        <span className="text-sm font-medium">Crear Tarea</span>
                    </div>
                </div>
            </aside>

            {/* Canvas */}
            <div className="flex-1 relative" ref={reactFlowWrapper}>
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onInit={setReactFlowInstance}
                    onDrop={onDrop}
                    onDragOver={onDragOver}
                    nodeTypes={nodeTypes}
                    defaultViewport={defaultViewport}
                    fitView
                    attributionPosition="bottom-right"
                >
                    <Background color="#aaa" gap={16} />
                    <Controls />
                    <Panel position="top-right" className='flex gap-2'>
                        <Button onClick={handleSave} className="gradient-neon border-0 shadow-lg">
                            <Save className="w-4 h-4 mr-2" />
                            Guardar Flujo
                        </Button>
                    </Panel>
                </ReactFlow>
            </div>
        </div>
    );
};

export const WorkflowBuilder = (props: WorkflowBuilderProps) => {
    return (
        <ReactFlowProvider>
            <WorkflowBuilderContent {...props} />
        </ReactFlowProvider>
    );
};
