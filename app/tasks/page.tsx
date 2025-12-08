"use client"

import { useEffect, useState } from "react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { TaskDialog } from "@/components/tasks/task-dialog"
import { TutorialButton } from "@/components/tutorials"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Plus, Search, RefreshCw, CheckCircle2, Circle, Clock, Trash2, Download, Flag } from "lucide-react"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import { BulkActionsBar, useBulkSelection } from "@/components/bulk/bulk-actions-bar"
import { tasksExportColumns, exportToCSV } from "@/lib/export-utils"

export default function TasksPage() {
    const [tasks, setTasks] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [selectedTask, setSelectedTask] = useState<any>(null)
    const [filter, setFilter] = useState("")
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [taskToDelete, setTaskToDelete] = useState<string | null>(null)

    // Bulk selection
    const {
        selectedIds,
        toggleSelection,
        selectAll,
        clearSelection,
        isSelected,
    } = useBulkSelection<any>()

    const fetchTasks = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/tasks')
            if (!res.ok) throw new Error('Failed to fetch tasks')
            const data = await res.json()
            setTasks(data.data || [])
        } catch (error) {
            console.error(error)
            toast.error("Error al cargar tareas")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchTasks()
    }, [])

    const handleAddTask = () => {
        setSelectedTask(null)
        setDialogOpen(true)
    }

    const handleEditTask = (task: any) => {
        setSelectedTask(task)
        setDialogOpen(true)
    }

    // ✅ FIX TASK-005: Agregar funcionalidad de eliminar
    const handleDeleteClick = (taskId: string) => {
        setTaskToDelete(taskId)
        setDeleteDialogOpen(true)
    }

    const handleDeleteTask = async () => {
        if (!taskToDelete) return
        try {
            const res = await fetch(`/api/tasks/${taskToDelete}`, { method: 'DELETE' })
            if (!res.ok) throw new Error('Failed to delete task')
            toast.success("Tarea eliminada")
            fetchTasks()
        } catch (error) {
            toast.error("Error al eliminar tarea")
        } finally {
            setDeleteDialogOpen(false)
            setTaskToDelete(null)
        }
    }

    const handleToggleStatus = async (task: any) => {
        const newStatus = task.status === 'completed' ? 'pending' : 'completed'

        // Optimistic update
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t))

        try {
            const res = await fetch(`/api/tasks/${task.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            })
            if (!res.ok) throw new Error('Failed to update status')
            toast.success(`Tarea marcada como ${newStatus === 'completed' ? 'completada' : 'pendiente'}`)
        } catch (error) {
            fetchTasks() // Revert
            toast.error("Error al actualizar estado")
        }
    }

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'high': return 'destructive'
            case 'medium': return 'default' // or secondary
            case 'low': return 'outline'
            default: return 'secondary'
        }
    }

    const filteredTasks = tasks.filter(task =>
        task.title.toLowerCase().includes(filter.toLowerCase()) ||
        task.contact?.name?.toLowerCase().includes(filter.toLowerCase())
    )

    // Bulk actions
    const handleBulkDelete = async (ids: string[]) => {
        const res = await fetch("/api/tasks/bulk", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids }),
        })
        const data = await res.json()
        if (!data.success) throw new Error(data.error)
        toast.success(`Se eliminaron ${data.deleted} tareas`)
        fetchTasks()
    }

    const handleBulkStatusChange = async (ids: string[], status: string) => {
        const res = await fetch("/api/tasks/bulk", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids, updates: { status } }),
        })
        const data = await res.json()
        if (!data.success) throw new Error(data.error)
        toast.success(`Se actualizaron ${data.updated} tareas`)
        fetchTasks()
    }

    const handleBulkPriorityChange = async (ids: string[], priority: string) => {
        const res = await fetch("/api/tasks/bulk", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids, updates: { priority } }),
        })
        const data = await res.json()
        if (!data.success) throw new Error(data.error)
        toast.success(`Se actualizaron ${data.updated} tareas`)
        fetchTasks()
    }

    const handleBulkExport = async (ids: string[]) => {
        const selectedTasks = tasks.filter(t => ids.includes(t.id))
        exportToCSV(selectedTasks, tasksExportColumns, "tareas_seleccionadas")
        toast.success(`Se exportaron ${selectedTasks.length} tareas`)
    }

    const bulkActions = [
        {
            id: "export",
            label: "Exportar",
            icon: Download,
            action: handleBulkExport,
        },
        {
            id: "complete",
            label: "Completar",
            icon: CheckCircle2,
            action: (ids: string[]) => handleBulkStatusChange(ids, "completed"),
        },
        {
            id: "high-priority",
            label: "Alta prioridad",
            icon: Flag,
            action: (ids: string[]) => handleBulkPriorityChange(ids, "high"),
        },
        {
            id: "delete",
            label: "Eliminar",
            icon: Trash2,
            variant: "destructive" as const,
            requireConfirm: true,
            confirmTitle: "¿Eliminar tareas?",
            confirmDescription: "Esta acción eliminará permanentemente las tareas seleccionadas.",
            action: handleBulkDelete,
        },
    ]

    const allSelected = filteredTasks.length > 0 && filteredTasks.every(t => isSelected(t.id))
    const someSelected = filteredTasks.some(t => isSelected(t.id)) && !allSelected

    return (
        <DashboardLayout>
            <div className="flex flex-col h-[calc(100vh-4rem)]">
                <div className="flex items-center justify-between pb-6 border-b">
                    <div className="space-y-1">
                        <h1 className="text-3xl font-bold tracking-tight">Tareas</h1>
                        <p className="text-muted-foreground">
                            Gestiona tus pendientes y actividades diarias
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <TutorialButton moduleId="tasks" />
                        <Button variant="outline" size="icon" onClick={fetchTasks}>
                            <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button onClick={handleAddTask} className="gradient-neon border-0">
                            <Plus className="mr-2 h-4 w-4" />
                            Nueva Tarea
                        </Button>
                    </div>
                </div>

                <div className="p-6 space-y-4">
                    <div className="flex items-center gap-2 max-w-sm">
                        <Search className="h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar tareas..."
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                        />
                    </div>

                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-12">
                                        <Checkbox
                                            checked={allSelected}
                                            ref={(el) => {
                                                if (el) (el as any).indeterminate = someSelected
                                            }}
                                            onCheckedChange={(checked) => {
                                                if (checked) selectAll(filteredTasks)
                                                else clearSelection()
                                            }}
                                            aria-label="Seleccionar todos"
                                        />
                                    </TableHead>
                                    <TableHead className="w-[50px]"></TableHead>
                                    <TableHead>Título</TableHead>
                                    <TableHead>Prioridad</TableHead>
                                    <TableHead>Vencimiento</TableHead>
                                    <TableHead>Contacto</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-8">
                                            Cargando...
                                        </TableCell>
                                    </TableRow>
                                ) : filteredTasks.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                            No hay tareas encontradas.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredTasks.map((task) => (
                                        <TableRow 
                                            key={task.id} 
                                            className={`group ${isSelected(task.id) ? "bg-primary/5" : ""}`}
                                        >
                                            <TableCell>
                                                <Checkbox
                                                    checked={isSelected(task.id)}
                                                    onCheckedChange={() => toggleSelection(task.id)}
                                                    aria-label={`Seleccionar ${task.title}`}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8"
                                                    onClick={() => handleToggleStatus(task)}
                                                >
                                                    {task.status === 'completed' ? (
                                                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                                                    ) : (
                                                        <Circle className="h-5 w-5 text-muted-foreground" />
                                                    )}
                                                </Button>
                                            </TableCell>
                                            <TableCell>
                                                <span className={task.status === 'completed' ? "line-through text-muted-foreground" : "font-medium"}>
                                                    {task.title}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={getPriorityColor(task.priority) as any}>
                                                    {task.priority}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                {task.due_date ? (
                                                    <div className="flex items-center text-sm text-muted-foreground">
                                                        <Clock className="mr-1 h-3 w-3" />
                                                        {new Date(task.due_date).toLocaleDateString()}
                                                    </div>
                                                ) : '-'}
                                            </TableCell>
                                            <TableCell>
                                                {task.contact?.name || '-'}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleEditTask(task)}
                                                    >
                                                        Editar
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleDeleteClick(task.id)}
                                                    >
                                                        <Trash2 className="h-4 w-4 text-red-500" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>

                <TaskDialog
                    open={dialogOpen}
                    onOpenChange={setDialogOpen}
                    task={selectedTask}
                    onSuccess={fetchTasks}
                />

                <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>¿Eliminar tarea?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Esta acción no se puede deshacer. La tarea será eliminada permanentemente.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDeleteTask} className="bg-red-600 hover:bg-red-700">
                                Eliminar
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                {/* Bulk Actions Bar */}
                <BulkActionsBar
                    selectedIds={selectedIds}
                    onClearSelection={clearSelection}
                    actions={bulkActions}
                    entityName="tareas"
                />
            </div>
        </DashboardLayout>
    )
}
