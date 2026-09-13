package main

import (
	"bufio"
	"context"
	"log"
	"net/http"
	"os"
	"strings"
	"time"
)

func main() {
	log.SetFlags(log.LstdFlags)
	loadDotEnv(".env")

	db, err := openDB()
	if err != nil {
		log.Fatalf("database: %v", err)
	}
	defer db.Close()

	uploader, err := newUploader(context.Background())
	if err != nil {
		log.Fatalf("s3: %v", err)
	}

	app := &App{db: db, uploader: uploader}

	addr := ":" + env("PORT", "8080")
	server := &http.Server{
		Addr:         addr,
		Handler:      app.routes(),
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	log.Printf("travel journal api listening on http://localhost%s", addr)
	if err := server.ListenAndServe(); err != nil {
		log.Fatalf("server: %v", err)
	}
}

// env reads an environment variable, falling back to a default.
func env(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		return v
	}
	return fallback
}

// loadDotEnv reads simple KEY=VALUE lines from a .env file so that
// `cp .env.example .env && go run .` works with no extra tooling. Variables
// already set in the real environment always win. A missing file is fine.
func loadDotEnv(path string) {
	file, err := os.Open(path)
	if err != nil {
		return
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, value, found := strings.Cut(line, "=")
		if !found {
			continue
		}
		key = strings.TrimSpace(key)
		value = strings.Trim(strings.TrimSpace(value), `"'`)
		if _, alreadySet := os.LookupEnv(key); !alreadySet {
			os.Setenv(key, value)
		}
	}
}
