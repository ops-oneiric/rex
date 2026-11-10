-- Starter capability list. Edit, rename or remove these in Settings > Capabilities.
INSERT INTO `capabilities` (`name`, `description`, `sort_order`) VALUES
  ('Multi-Control', 'Clients with several companies (controls) under one account.', 10),
  ('Large Employer (500+)', 'Clients with 500 or more employees.', 20),
  ('Complex Payroll', 'High payroll complexity: unusual pay rules, many pay groups or frequencies.', 30),
  ('Benefits-heavy', 'Clients with complex benefits setup or a benefits start date close to go-live.', 40),
  ('New Logo', 'Brand-new clients implementing for the first time.', 50),
  ('Add Control', 'Adding companies to an existing client database.', 60),
  ('In-house Conversions', 'Clients moving from in-house payroll processing.', 70),
  ('Time and Attendance', 'Time-keeping setup and integration.', 80),
  ('Integrations', 'Third-party data feeds and system integrations.', 90),
  ('Garnishments', 'Wage garnishments and child-support orders.', 100),
  ('Multi-State', 'Employees in several states, with multi-state tax setup.', 110),
  ('Union / Certified Payroll', 'Union rules, prevailing wage and certified payroll reporting.', 120);
