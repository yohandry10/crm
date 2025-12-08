-- =====================================================
-- TASKS TABLE (MULTI-TENANT)
-- =====================================================

CREATE TYPE task_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');
CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'urgent');

CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by UUID REFERENCES auth.users(id),
    assigned_to UUID REFERENCES auth.users(id),
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    workflow_id UUID REFERENCES workflows(id) ON DELETE SET NULL,
    
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status task_status DEFAULT 'pending' NOT NULL,
    priority task_priority DEFAULT 'medium' NOT NULL,
    due_date TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_tasks_org ON tasks(organization_id);
CREATE INDEX idx_tasks_org_status ON tasks(organization_id, status);
CREATE INDEX idx_tasks_assigned ON tasks(assigned_to);
CREATE INDEX idx_tasks_contact ON tasks(contact_id);
CREATE INDEX idx_tasks_due ON tasks(due_date) WHERE completed_at IS NULL;

CREATE TRIGGER update_tasks_updated_at
    BEFORE UPDATE ON tasks FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view tasks" ON tasks
    FOR SELECT USING (is_org_member(organization_id));

CREATE POLICY "Org members can create tasks" ON tasks
    FOR INSERT WITH CHECK (is_org_member(organization_id));

CREATE POLICY "Org members can update tasks" ON tasks
    FOR UPDATE USING (is_org_member(organization_id));

CREATE POLICY "Admins can delete tasks" ON tasks
    FOR DELETE USING (get_org_role(organization_id) IN ('owner', 'admin', 'manager'));

-- Users can also see tasks assigned to them
CREATE POLICY "Users can view assigned tasks" ON tasks
    FOR SELECT USING (auth.uid() = assigned_to);
