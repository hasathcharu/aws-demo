package main

import (
	"database/sql"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strconv"
	"strings"
)

// App holds the dependencies the handlers need.
type App struct {
	db       *sql.DB
	uploader *Uploader
}

const entryColumns = "id, title, location, note, DATE_FORMAT(entry_date, '%Y-%m-%d'), image_url, created_at"

// routes wires every endpoint. The {id} patterns need Go 1.22 or newer.
//
// There is no CORS middleware on purpose. This service is meant to sit on a
// private subnet with no public ingress: the only caller is the Next.js server,
// which reaches it over the VPC. No browser ever talks to it directly, so it has
// no origins to allow.
func (a *App) routes() http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /health", a.health)
	mux.HandleFunc("GET /api/entries", a.listEntries)
	mux.HandleFunc("POST /api/entries", a.createEntry)
	mux.HandleFunc("GET /api/entries/{id}", a.getEntry)
	mux.HandleFunc("PUT /api/entries/{id}", a.updateEntry)
	mux.HandleFunc("DELETE /api/entries/{id}", a.deleteEntry)
	mux.HandleFunc("POST /api/uploads/presign", a.presignUpload)

	return mux
}

func (a *App) health(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// GET /api/entries?location=Kyoto
func (a *App) listEntries(w http.ResponseWriter, r *http.Request) {
	query := "SELECT " + entryColumns + " FROM entries"
	args := []any{}

	if location := strings.TrimSpace(r.URL.Query().Get("location")); location != "" {
		query += " WHERE location = ?"
		args = append(args, location)
	}
	query += " ORDER BY entry_date DESC, id DESC"

	rows, err := a.db.Query(query, args...)
	if err != nil {
		serverError(w, "list entries", err)
		return
	}
	defer rows.Close()

	entries := []Entry{}
	for rows.Next() {
		entry, err := scanEntry(rows)
		if err != nil {
			serverError(w, "scan entry", err)
			return
		}
		entries = append(entries, entry)
	}
	if err := rows.Err(); err != nil {
		serverError(w, "read entries", err)
		return
	}

	writeJSON(w, http.StatusOK, entries)
}

// GET /api/entries/{id}
func (a *App) getEntry(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r)
	if !ok {
		return
	}

	row := a.db.QueryRow("SELECT "+entryColumns+" FROM entries WHERE id = ?", id)
	entry, err := scanEntry(row)
	if errors.Is(err, sql.ErrNoRows) {
		writeError(w, http.StatusNotFound, "entry not found")
		return
	}
	if err != nil {
		serverError(w, "get entry", err)
		return
	}

	writeJSON(w, http.StatusOK, entry)
}

// POST /api/entries
func (a *App) createEntry(w http.ResponseWriter, r *http.Request) {
	in, ok := decodeEntryInput(w, r)
	if !ok {
		return
	}

	result, err := a.db.Exec(
		"INSERT INTO entries (title, location, note, entry_date, image_url) VALUES (?, ?, ?, ?, ?)",
		in.Title, in.Location, in.Note, in.EntryDate, in.ImageURL,
	)
	if err != nil {
		serverError(w, "insert entry", err)
		return
	}

	id, err := result.LastInsertId()
	if err != nil {
		serverError(w, "read new entry id", err)
		return
	}

	writeJSON(w, http.StatusCreated, Entry{
		ID:        id,
		Title:     in.Title,
		Location:  in.Location,
		Note:      in.Note,
		EntryDate: in.EntryDate,
		ImageURL:  in.ImageURL,
	})
}

// PUT /api/entries/{id}
func (a *App) updateEntry(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r)
	if !ok {
		return
	}
	in, ok := decodeEntryInput(w, r)
	if !ok {
		return
	}

	result, err := a.db.Exec(
		"UPDATE entries SET title = ?, location = ?, note = ?, entry_date = ?, image_url = ? WHERE id = ?",
		in.Title, in.Location, in.Note, in.EntryDate, in.ImageURL, id,
	)
	if err != nil {
		serverError(w, "update entry", err)
		return
	}

	// RowsAffected is 0 both for a missing row and for an update that changed
	// nothing, so check for existence separately to avoid a bogus 404.
	if affected, err := result.RowsAffected(); err == nil && affected == 0 {
		var exists int
		if err := a.db.QueryRow("SELECT 1 FROM entries WHERE id = ?", id).Scan(&exists); errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "entry not found")
			return
		}
	}

	writeJSON(w, http.StatusOK, Entry{
		ID:        id,
		Title:     in.Title,
		Location:  in.Location,
		Note:      in.Note,
		EntryDate: in.EntryDate,
		ImageURL:  in.ImageURL,
	})
}

// DELETE /api/entries/{id}
func (a *App) deleteEntry(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r)
	if !ok {
		return
	}

	result, err := a.db.Exec("DELETE FROM entries WHERE id = ?", id)
	if err != nil {
		serverError(w, "delete entry", err)
		return
	}

	affected, err := result.RowsAffected()
	if err != nil {
		serverError(w, "delete entry", err)
		return
	}
	if affected == 0 {
		writeError(w, http.StatusNotFound, "entry not found")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

// POST /api/uploads/presign
func (a *App) presignUpload(w http.ResponseWriter, r *http.Request) {
	var in PresignInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "request body must be valid JSON")
		return
	}

	in.Filename = strings.TrimSpace(in.Filename)
	in.ContentType = strings.TrimSpace(in.ContentType)

	if in.Filename == "" {
		writeError(w, http.StatusBadRequest, "filename is required")
		return
	}
	if _, ok := allowedImageTypes[in.ContentType]; !ok {
		writeError(w, http.StatusBadRequest, "contentType must be one of image/png, image/jpeg, image/webp")
		return
	}

	out, err := a.uploader.presignPut(r.Context(), in.Filename, in.ContentType)
	if err != nil {
		serverError(w, "presign upload", err)
		return
	}

	writeJSON(w, http.StatusOK, out)
}

// --- small helpers ---------------------------------------------------------

func decodeEntryInput(w http.ResponseWriter, r *http.Request) (EntryInput, bool) {
	var in EntryInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "request body must be valid JSON")
		return EntryInput{}, false
	}
	if msg := in.validate(); msg != "" {
		writeError(w, http.StatusBadRequest, msg)
		return EntryInput{}, false
	}
	return in, true
}

func pathID(w http.ResponseWriter, r *http.Request) (int64, bool) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil || id <= 0 {
		writeError(w, http.StatusBadRequest, "id must be a positive integer")
		return 0, false
	}
	return id, true
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(body); err != nil {
		log.Printf("write response: %v", err)
	}
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

// serverError logs the real cause and tells the client only what it needs.
func serverError(w http.ResponseWriter, what string, err error) {
	log.Printf("%s: %v", what, err)
	writeError(w, http.StatusInternalServerError, "internal server error")
}
