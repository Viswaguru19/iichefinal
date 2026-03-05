-- ============================================
-- TASK NOTIFICATION TRIGGERS
-- Run this AFTER running RUN_THIS_TASK_SYSTEM.sql
-- ============================================

-- Function 1: Notify EC when task is assigned
CREATE OR REPLACE FUNCTION notify_on_task_assignment()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notifications (user_id, type, title, message, link)
  SELECT 
    p.id,
    'task',
    'New Task Assignment Pending Approval',
    'Task "' || NEW.title || '" needs EC approval',
    '/dashboard/tasks'
  FROM profiles p
  WHERE p.executive_role IS NOT NULL;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function 2: Notify when EC approves task
CREATE OR REPLACE FUNCTION notify_on_task_approval()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status = 'pending_ec_approval' THEN
    -- Notify assigned committee
    INSERT INTO notifications (user_id, type, title, message, link)
    SELECT 
      cm.user_id,
      'task',
      'New Task Assigned',
      'Task "' || NEW.title || '" assigned to your committee',
      '/dashboard/tasks'
    FROM committee_members cm
    WHERE cm.committee_id = NEW.assigned_to_committee;
    
    -- Notify assigning user
    INSERT INTO notifications (user_id, type, title, message, link)
    VALUES (
      NEW.assigned_by_user,
      'approval',
      'Task Approved',
      'Your task "' || NEW.title || '" was approved by EC',
      '/dashboard/tasks'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function 3: Notify when task is completed
CREATE OR REPLACE FUNCTION notify_on_task_completion()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    -- Notify proposing committee
    INSERT INTO notifications (user_id, type, title, message, link)
    SELECT 
      cm.user_id,
      'task',
      'Task Completed',
      'Task "' || NEW.title || '" has been completed',
      '/dashboard/tasks'
    FROM committee_members cm
    WHERE cm.committee_id = NEW.assigned_by_committee;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function 4: Notify when event becomes active
CREATE OR REPLACE FUNCTION notify_on_event_active()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'active' AND OLD.status != 'active' THEN
    INSERT INTO notifications (user_id, type, title, message, link)
    SELECT 
      cm.user_id,
      'approval',
      'Proposal Accepted! Assign Tasks',
      'Event "' || NEW.title || '" is approved. Assign tasks now!',
      '/dashboard/events/progress'
    FROM committee_members cm
    WHERE cm.committee_id = NEW.committee_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS trigger_notify_on_task_assignment ON task_assignments;
CREATE TRIGGER trigger_notify_on_task_assignment
AFTER INSERT ON task_assignments
FOR EACH ROW
WHEN (NEW.status = 'pending_ec_approval')
EXECUTE FUNCTION notify_on_task_assignment();

DROP TRIGGER IF EXISTS trigger_notify_on_task_approval ON task_assignments;
CREATE TRIGGER trigger_notify_on_task_approval
AFTER UPDATE ON task_assignments
FOR EACH ROW
EXECUTE FUNCTION notify_on_task_approval();

DROP TRIGGER IF EXISTS trigger_notify_on_task_completion ON task_assignments;
CREATE TRIGGER trigger_notify_on_task_completion
AFTER UPDATE ON task_assignments
FOR EACH ROW
EXECUTE FUNCTION notify_on_task_completion();

DROP TRIGGER IF EXISTS trigger_notify_on_event_active ON events;
CREATE TRIGGER trigger_notify_on_event_active
AFTER UPDATE ON events
FOR EACH ROW
EXECUTE FUNCTION notify_on_event_active();

-- Done!
SELECT 'Task Notification Triggers Created!' as status;
