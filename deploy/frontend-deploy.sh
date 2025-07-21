#!/bin/bash

# Frontend deployment script for S3 and CloudFront

set -e

# Configuration
BUCKET_NAME=${AWS_S3_BUCKET_NAME}
CLOUDFRONT_DISTRIBUTION_ID=${CLOUDFRONT_DISTRIBUTION_ID}
BUILD_DIR="./dist"

echo "Starting frontend deployment..."

# Check if bucket name is set
if [ -z "$BUCKET_NAME" ]; then
    echo "Error: AWS_S3_BUCKET_NAME environment variable is not set"
    exit 1
fi

# Check if build directory exists
if [ ! -d "$BUILD_DIR" ]; then
    echo "Error: Build directory $BUILD_DIR does not exist. Run 'npm run build' first."
    exit 1
fi

# Upload to S3
echo "Uploading files to S3 bucket: $BUCKET_NAME"
aws s3 sync $BUILD_DIR s3://$BUCKET_NAME/ --delete --exclude "*.map"

# Set cache headers for different file types
echo "Setting cache headers..."

# HTML files - no cache
aws s3 cp s3://$BUCKET_NAME/ s3://$BUCKET_NAME/ \
    --recursive \
    --exclude "*" \
    --include "*.html" \
    --metadata-directive REPLACE \
    --cache-control "no-cache, no-store, must-revalidate"

# CSS and JS files - long cache with versioning
aws s3 cp s3://$BUCKET_NAME/ s3://$BUCKET_NAME/ \
    --recursive \
    --exclude "*" \
    --include "*.css" \
    --include "*.js" \
    --metadata-directive REPLACE \
    --cache-control "max-age=31536000"

# Images and other assets - medium cache
aws s3 cp s3://$BUCKET_NAME/ s3://$BUCKET_NAME/ \
    --recursive \
    --exclude "*" \
    --include "*.png" \
    --include "*.jpg" \
    --include "*.jpeg" \
    --include "*.gif" \
    --include "*.svg" \
    --include "*.ico" \
    --metadata-directive REPLACE \
    --cache-control "max-age=86400"

# Invalidate CloudFront cache if distribution ID is provided
if [ ! -z "$CLOUDFRONT_DISTRIBUTION_ID" ]; then
    echo "Creating CloudFront invalidation..."
    aws cloudfront create-invalidation \
        --distribution-id $CLOUDFRONT_DISTRIBUTION_ID \
        --paths "/*"
    echo "CloudFront invalidation created"
else
    echo "Warning: CLOUDFRONT_DISTRIBUTION_ID not set, skipping cache invalidation"
fi

echo "Frontend deployment completed successfully!"
echo "Your application should be available at:"
echo "S3 Website: http://$BUCKET_NAME.s3-website.amazonaws.com/"

if [ ! -z "$CLOUDFRONT_DISTRIBUTION_ID" ]; then
    echo "CloudFront: https://your-cloudfront-domain.cloudfront.net/"
fi