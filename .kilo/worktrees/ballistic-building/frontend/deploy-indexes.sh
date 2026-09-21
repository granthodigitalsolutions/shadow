#!/bin/bash

echo "🔥 Firebase Index Deployment Script"
echo "===================================="
echo ""

# Check if firebase-tools is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI not found"
    echo ""
    echo "Install it with:"
    echo "  npm install -g firebase-tools"
    echo ""
    exit 1
fi

echo "✅ Firebase CLI found"
echo ""

# Check if user is logged in
if ! firebase projects:list &> /dev/null; then
    echo "❌ Not logged in to Firebase"
    echo ""
    echo "Login with:"
    echo "  firebase login"
    echo ""
    exit 1
fi

echo "✅ Logged in to Firebase"
echo ""

# Deploy indexes
echo "📤 Deploying Firestore indexes..."
echo ""

firebase deploy --only firestore:indexes --project team-shadowkai

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Indexes deployed successfully!"
    echo ""
    echo "⏱️  Indexes are now building (1-2 minutes)"
    echo ""
    echo "Check status at:"
    echo "https://console.firebase.google.com/project/team-shadowkai/firestore/indexes"
    echo ""
    echo "Once they show 'Enabled', your pagination will work!"
else
    echo ""
    echo "❌ Deployment failed"
    echo ""
    echo "Try manually:"
    echo "1. Click the links in DEPLOY_INDEXES.md"
    echo "2. Or run: firebase deploy --only firestore:indexes"
fi
