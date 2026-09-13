package main

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/google/uuid"
)

// allowedImageTypes maps the content types we accept for upload to the file
// extension we fall back to when the filename doesn't carry a usable one.
var allowedImageTypes = map[string]string{
	"image/png":  ".png",
	"image/jpeg": ".jpg",
	"image/webp": ".webp",
}

const presignExpiry = 5 * time.Minute

// Uploader hands out short-lived presigned PUT URLs so the browser can upload
// photos straight to S3. The file bytes never pass through this server.
type Uploader struct {
	presign *s3.PresignClient
	bucket  string
	region  string
}

// newUploader builds an Uploader from S3_BUCKET and AWS_REGION. Credentials come
// from the AWS SDK's default chain (env vars, shared config, instance role).
func newUploader(ctx context.Context) (*Uploader, error) {
	bucket := strings.TrimSpace(env("S3_BUCKET", ""))
	if bucket == "" {
		return nil, fmt.Errorf("S3_BUCKET must be set")
	}
	region := strings.TrimSpace(env("AWS_REGION", ""))
	if region == "" {
		return nil, fmt.Errorf("AWS_REGION must be set")
	}

	cfg, err := awsconfig.LoadDefaultConfig(ctx, awsconfig.WithRegion(region))
	if err != nil {
		return nil, fmt.Errorf("load aws config: %w", err)
	}

	// Fail at startup rather than on the first upload if no credentials are
	// available from the default chain.
	if _, err := cfg.Credentials.Retrieve(ctx); err != nil {
		return nil, fmt.Errorf("no AWS credentials available (try `aws configure` or AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY): %w", err)
	}

	return &Uploader{
		presign: s3.NewPresignClient(s3.NewFromConfig(cfg)),
		bucket:  bucket,
		region:  region,
	}, nil
}

// presignPut returns the URL the browser should PUT the file to, and the public
// URL the object will live at once the upload succeeds.
func (u *Uploader) presignPut(ctx context.Context, filename, contentType string) (PresignOutput, error) {
	key := "uploads/" + uuid.NewString() + extensionFor(filename, contentType)

	req, err := u.presign.PresignPutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(u.bucket),
		Key:         aws.String(key),
		ContentType: aws.String(contentType),
	}, s3.WithPresignExpires(presignExpiry))
	if err != nil {
		return PresignOutput{}, fmt.Errorf("presign put: %w", err)
	}

	return PresignOutput{
		UploadURL: req.URL,
		FileURL:   fmt.Sprintf("https://%s.s3.%s.amazonaws.com/%s", u.bucket, u.region, key),
	}, nil
}

// extensionFor keeps the uploaded file's own extension when it is one we expect,
// and otherwise picks the extension that matches the content type.
func extensionFor(filename, contentType string) string {
	dot := strings.LastIndex(filename, ".")
	if dot >= 0 {
		ext := strings.ToLower(filename[dot:])
		switch ext {
		case ".png", ".jpg", ".jpeg", ".webp":
			return ext
		}
	}
	return allowedImageTypes[contentType]
}
