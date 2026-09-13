-- Travel Journal schema (MySQL)
--
-- Apply with:  mysql -u root -p travel_journal < database/schema.sql
-- The backend also runs this CREATE TABLE IF NOT EXISTS on startup, so applying
-- this file by hand is optional.

CREATE TABLE IF NOT EXISTS entries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  location VARCHAR(255),
  note TEXT,
  entry_date DATE NOT NULL,
  image_url VARCHAR(2048),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
