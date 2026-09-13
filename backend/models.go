package main

import (
	"fmt"
	"strings"
	"time"
)

// Entry is one journal entry. Dates are plain "YYYY-MM-DD" strings so that
// nothing has to translate between Go time values and JSON on the way through.
type Entry struct {
	ID        int64  `json:"id"`
	Title     string `json:"title"`
	Location  string `json:"location"`
	Note      string `json:"note"`
	EntryDate string `json:"entry_date"`
	ImageURL  string `json:"image_url"`
	CreatedAt string `json:"created_at"`
}

// EntryInput is the request body accepted by POST and PUT /api/entries.
type EntryInput struct {
	Title     string `json:"title"`
	Location  string `json:"location"`
	Note      string `json:"note"`
	EntryDate string `json:"entry_date"`
	ImageURL  string `json:"image_url"`
}

// validate returns an error message suitable for a 400 response, or "" if the
// input is acceptable.
func (in *EntryInput) validate() string {
	in.Title = strings.TrimSpace(in.Title)
	in.Location = strings.TrimSpace(in.Location)
	in.EntryDate = strings.TrimSpace(in.EntryDate)
	in.ImageURL = strings.TrimSpace(in.ImageURL)

	if in.Title == "" {
		return "title is required"
	}
	if len(in.Title) > 255 {
		return "title must be 255 characters or fewer"
	}
	if len(in.Location) > 255 {
		return "location must be 255 characters or fewer"
	}
	if len(in.ImageURL) > 2048 {
		return "image_url must be 2048 characters or fewer"
	}
	if in.EntryDate == "" {
		return "entry_date is required"
	}
	if _, err := time.Parse("2006-01-02", in.EntryDate); err != nil {
		return fmt.Sprintf("entry_date must be a valid date in YYYY-MM-DD format, got %q", in.EntryDate)
	}
	return ""
}

// PresignInput is the request body for POST /api/uploads/presign.
type PresignInput struct {
	Filename    string `json:"filename"`
	ContentType string `json:"contentType"`
}

// PresignOutput is the response for POST /api/uploads/presign.
type PresignOutput struct {
	UploadURL string `json:"uploadUrl"`
	FileURL   string `json:"fileUrl"`
}
