package main

import (
	"database/sql"
	"fmt"
	"time"

	_ "github.com/go-sql-driver/mysql"
)

const createTableSQL = `
CREATE TABLE IF NOT EXISTS entries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  location VARCHAR(255),
  note TEXT,
  entry_date DATE NOT NULL,
  image_url VARCHAR(2048),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`

// openDB connects to MySQL using DB_* environment variables and makes sure the
// entries table exists, so a fresh checkout needs no manual migration step.
func openDB() (*sql.DB, error) {
	host := env("DB_HOST", "127.0.0.1")
	port := env("DB_PORT", "3306")
	user := env("DB_USER", "root")
	password := env("DB_PASSWORD", "")
	name := env("DB_NAME", "travel_journal")

	// parseTime is deliberately left off: DATE and TIMESTAMP columns come back
	// as strings, which is exactly what the JSON API hands to the browser.
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?charset=utf8mb4", user, password, host, port, name)

	db, err := sql.Open("mysql", dsn)
	if err != nil {
		return nil, fmt.Errorf("open mysql: %w", err)
	}

	db.SetConnMaxLifetime(5 * time.Minute)
	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(10)

	if err := db.Ping(); err != nil {
		db.Close()
		return nil, fmt.Errorf("connect to mysql at %s:%s/%s as %s: %w", host, port, name, user, err)
	}

	if _, err := db.Exec(createTableSQL); err != nil {
		db.Close()
		return nil, fmt.Errorf("create entries table: %w", err)
	}

	return db, nil
}

// scanEntry reads one row of the standard column list into an Entry. NULL
// columns become empty strings.
func scanEntry(row interface{ Scan(...any) error }) (Entry, error) {
	var e Entry
	var location, note, imageURL, createdAt sql.NullString

	err := row.Scan(&e.ID, &e.Title, &location, &note, &e.EntryDate, &imageURL, &createdAt)
	if err != nil {
		return Entry{}, err
	}

	e.Location = location.String
	e.Note = note.String
	e.ImageURL = imageURL.String
	e.CreatedAt = createdAt.String
	return e, nil
}
