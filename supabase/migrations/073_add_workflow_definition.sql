-- Add definition column to workflows table to store React Flow graph data
ALTER TABLE workflows 
ADD COLUMN IF NOT EXISTS definition JSONB DEFAULT '{}';

-- Add comment to explain the column
COMMENT ON COLUMN workflows.definition IS 'Stores the visual graph definition (nodes and edges) from React Flow';
