-- Clean up test data
DELETE FROM user_roles WHERE organization_id IN (8, 9);
DELETE FROM team_members WHERE team_id IN (SELECT id FROM teams WHERE organization_id IN (8, 9));
DELETE FROM teams WHERE organization_id IN (8, 9);
DELETE FROM organizations WHERE id IN (8, 9);