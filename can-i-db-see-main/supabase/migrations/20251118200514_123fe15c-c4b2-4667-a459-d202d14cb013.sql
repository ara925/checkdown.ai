-- Add columns to track related entities in activity logs
ALTER TABLE activity_logs 
ADD COLUMN related_entity_type VARCHAR(50),
ADD COLUMN related_entity_id INTEGER;

-- Add index for better query performance
CREATE INDEX idx_activity_logs_entity ON activity_logs(related_entity_type, related_entity_id);

-- Add comments for clarity
COMMENT ON COLUMN activity_logs.related_entity_type IS 'Type of entity affected (e.g., task, meeting, department)';
COMMENT ON COLUMN activity_logs.related_entity_id IS 'ID of the affected entity';