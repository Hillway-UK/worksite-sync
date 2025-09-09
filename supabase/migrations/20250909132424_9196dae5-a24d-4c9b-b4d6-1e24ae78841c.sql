-- Clean up and create proper test super admin user
DELETE FROM managers WHERE email = 'manager@test.com';
DELETE FROM workers WHERE email = 'manager@test.com';

-- Create test super admin user
INSERT INTO super_admins (email, name, is_owner) 
VALUES ('manager@test.com', 'Test Manager', true)
ON CONFLICT (email) DO UPDATE SET 
  is_owner = true,
  name = 'Test Manager';