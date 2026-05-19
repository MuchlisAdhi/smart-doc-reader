-- Seed demo user
-- Password: demo1234 (PBKDF2-SHA256, 100000 iterations)
INSERT OR IGNORE INTO users (id, email, password_hash, name, role)
VALUES (
  'demo-user-001',
  'demo@superbrands.test',
  'pbkdf2$100000$DmFoDsXxWMWRnHvtXyibmQ==$0SQjuAZtQY0NEQ6Baa7gpONzT4QykAw7S31gNeF2j8I=',
  'Demo User',
  'user'
);
