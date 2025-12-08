/**
 * Workflow Condition Types
 * Resolves ERROR-LOGIC-005: Workflow trigger_conditions evaluation
 */

export type ConditionOperator =
    | "=="  // Equal
    | "!="  // Not equal
    | ">"   // Greater than
    | ">="  // Greater than or equal
    | "<"   // Less than
    | "<="  // Less than or equal
    | "contains"  // String contains
    | "in"  // Value in array
    | "not_in"  // Value not in array

export interface WorkflowCondition {
    field: string
    operator: ConditionOperator
    value: any
}

export interface WorkflowConditionsGroup {
    conditions: WorkflowCondition[]
    logic?: "AND" | "OR"  // Default: AND
}

/**
 * Evaluates a single condition against a data object
 */
export function evaluateCondition(
    condition: WorkflowCondition,
    data: Record<string, any>
): boolean {
    const { field, operator, value } = condition
    const fieldValue = getNestedValue(data, field)

    switch (operator) {
        case "==":
            return fieldValue == value  // Loose equality for flexibility

        case "!=":
            return fieldValue != value

        case ">":
            return Number(fieldValue) > Number(value)

        case ">=":
            return Number(fieldValue) >= Number(value)

        case "<":
            return Number(fieldValue) < Number(value)

        case "<=":
            return Number(fieldValue) <= Number(value)

        case "contains":
            if (typeof fieldValue === "string" && typeof value === "string") {
                return fieldValue.toLowerCase().includes(value.toLowerCase())
            }
            return false

        case "in":
            if (Array.isArray(value)) {
                return value.includes(fieldValue)
            }
            return false

        case "not_in":
            if (Array.isArray(value)) {
                return !value.includes(fieldValue)
            }
            return true

        default:
            console.warn(`Unknown operator: ${operator}`)
            return false
    }
}

/**
 * Evaluates a group of conditions with AND/OR logic
 */
export function evaluateConditionsGroup(
    group: WorkflowConditionsGroup,
    data: Record<string, any>
): boolean {
    const { conditions, logic = "AND" } = group

    if (!conditions || conditions.length === 0) {
        // No conditions means always pass
        return true
    }

    if (logic === "AND") {
        return conditions.every(condition => evaluateCondition(condition, data))
    } else {
        // OR logic
        return conditions.some(condition => evaluateCondition(condition, data))
    }
}

/**
 * Evaluates workflow trigger_conditions
 * Supports both array of conditions (simple) or complex groups
 */
export function evaluateWorkflowConditions(
    triggerConditions: any,
    eventData: Record<string, any>
): boolean {
    if (!triggerConditions) {
        return true  // No conditions = always trigger
    }

    // Simple array of conditions (assume AND logic)
    if (Array.isArray(triggerConditions)) {
        return evaluateConditionsGroup(
            { conditions: triggerConditions, logic: "AND" },
            eventData
        )
    }

    // Complex conditions group
    if (triggerConditions.conditions) {
        return evaluateConditionsGroup(triggerConditions, eventData)
    }

    console.warn("Invalid trigger_conditions format:", triggerConditions)
    return false
}

/**
 * Helper: Get nested object property by dot notation
 * Example: getNestedValue({user: {name: "John"}}, "user.name") => "John"
 */
function getNestedValue(obj: Record<string, any>, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj)
}

/**
 * Validates condition structure
 */
export function isValidCondition(condition: any): condition is WorkflowCondition {
    return (
        condition &&
        typeof condition === "object" &&
        typeof condition.field === "string" &&
        typeof condition.operator === "string" &&
        condition.value !== undefined
    )
}

/**
 * Validates conditions group structure
 */
export function isValidConditionsGroup(group: any): group is WorkflowConditionsGroup {
    return (
        group &&
        typeof group === "object" &&
        Array.isArray(group.conditions) &&
        group.conditions.every(isValidCondition)
    )
}
