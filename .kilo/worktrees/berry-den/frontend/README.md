# TEAM SHADOW KAI Karate - Belt Test Management System

## 🚨 Getting "Missing or insufficient permissions" Error?

**QUICK FIX:** See [QUICK_FIX_PERMISSIONS.md](QUICK_FIX_PERMISSIONS.md)

**TL;DR:**
1. Go to Firebase Console → Firestore Database → Rules
2. Copy rules from `firestore.rules` file
3. Paste in editor and click **Publish**
4. Refresh your app

---

## 📚 Documentation

| File | Description |
|------|-------------|
| [QUICK_FIX_PERMISSIONS.md](QUICK_FIX_PERMISSIONS.md) | **START HERE** if you have permission errors |
| [FIREBASE_SETUP.md](FIREBASE_SETUP.md) | Complete Firebase setup guide |
| [FIRESTORE_RULES_FIX.md](FIRESTORE_RULES_FIX.md) | Detailed troubleshooting for rules |
| [SYSTEM_OVERVIEW.md](SYSTEM_OVERVIEW.md) | Complete system documentation |
| [ROUTES.md](ROUTES.md) | All app routes and navigation |
| [firestore.rules](firestore.rules) | **Copy this** for Firestore security rules |

---

## 🚀 Quick Start

### 1. Fix Permissions (If Error)
```bash
# See QUICK_FIX_PERMISSIONS.md or copy firestore.rules to Firebase Console
```

### 2. Create Admin Account
```
Visit: /admin/register
```

### 3. Create Belt Test
```
Login → Dashboard → Belt Tests → Create New Test
```

### 4. Test Registration
```
Visit: / (homepage)
Register a test student
```

---

## 🎯 Key Routes

| Route | Purpose |
|-------|---------|
| `/` | Student registration (homepage) |
| `/admin/register` | Create admin account |
| `/admin/login` | Admin login |
| `/admin/dashboard` | Admin panel |
| `/admin/qr-scanner` | Scan student QR codes |

---

## 🔧 Firebase Setup Checklist

- [ ] Enable Email/Password authentication
- [ ] Create Firestore database
- [ ] **Set Firestore security rules** ⚠️ CRITICAL
- [ ] Create admin account at `/admin/register`
- [ ] Create belt test in admin panel
- [ ] Test student registration

---

## 📱 Features

### For Students
✅ Online registration
✅ Belt level selection
✅ Payment submission
✅ QR code hall ticket
✅ PDF certificate download

### For Admins
✅ Self-service admin creation
✅ Student management
✅ Payment verification
✅ Real camera QR scanning
✅ Belt test configuration
✅ Student scoring & evaluation
✅ Result management
✅ Bulk WhatsApp notifications
✅ Analytics dashboard

---

## 🛠️ Tech Stack

- **Frontend**: React + TypeScript + Tailwind CSS
- **Authentication**: Firebase Auth
- **Database**: Cloud Firestore
- **QR Scanner**: html5-qrcode
- **PDF Generation**: jspdf + html2canvas
- **Icons**: Lucide React
- **Routing**: React Router DOM

---

## 📦 Installation

```bash
# Install dependencies
pnpm install

# Run development server
# (Vite dev server should already be running)
```

---

## 🔐 Security

**Current Rules** (Development):
- Open read/write access for testing
- See `firestore.rules` file

**Production Rules** (Recommended):
- Restrict writes to authenticated users only
- Add role-based access control
- See FIREBASE_SETUP.md for production rules

---

## 🎨 Branding

**Colors:**
- Black: `#000000` (Primary)
- White: `#FFFFFF` (Background)
- Gold: `#FFD700` (Accent)
- Orange: `#FF8C00` (Actions)

**Fonts:**
- Headers: Bebas Neue
- Body: Nunito

**Logo:**
- TEAM SHADOW KAI Karate circular badge
- Used in headers and watermarks

---

## 📞 Support

**Common Issues:**

1. **Permission Error**
   - See: [QUICK_FIX_PERMISSIONS.md](QUICK_FIX_PERMISSIONS.md)

2. **Camera Not Working**
   - Check browser permissions
   - Ensure HTTPS connection
   - Use manual ID entry as fallback

3. **Data Not Saving**
   - Check Firestore rules are published
   - Verify network connection
   - Check browser console (F12)

4. **Login Failed**
   - Verify Email/Password auth is enabled
   - Check credentials
   - Create account at `/admin/register`

---

## 📖 Workflow Overview

```
STUDENT FLOW:
Homepage → Registration → Payment → Hall Ticket (QR Code)
                                          ↓
                                    [Saved to Firebase]

ADMIN FLOW:
Register → Login → Dashboard → Verify Payments → Scan QR → Score → Results
```

---

## 🎯 Firebase Collections

### `students`
```javascript
{
  id: "SKT-2026-12345",
  name: "Student Name",
  school: "School Name",
  paymentStatus: "pending" | "verified" | "rejected",
  testStatus: "pending" | "passed" | "failed",
  score: 85,
  // ... more fields
}
```

### `beltTests`
```javascript
{
  name: "April 2026 Belt Test",
  date: "2026-04-25",
  time: "10:00 AM",
  isActive: true,
  scoringParameters: [...],
  // ... more fields
}
```

---

## 🔄 Data Flow

1. **Student registers** → Data saved to Firestore `students` collection
2. **Admin verifies payment** → Status updated to "verified"
3. **Admin scans QR code** → Loads student data
4. **Admin scores student** → Results saved to student record
5. **View results** → Display pass/fail with detailed scores

---

## 🌟 Getting Started Checklist

Day 1:
- [ ] Read QUICK_FIX_PERMISSIONS.md
- [ ] Set Firestore security rules
- [ ] Create admin account
- [ ] Explore admin dashboard

Day 2:
- [ ] Create first belt test
- [ ] Configure scoring parameters
- [ ] Set test as active
- [ ] Test student registration

Day 3:
- [ ] Register test student
- [ ] Verify payment
- [ ] Practice QR scanning
- [ ] Score test student

Day 4+:
- [ ] Real student registrations
- [ ] Payment verification workflow
- [ ] Belt test day operations
- [ ] Result management

---

## 📜 License

Built for TEAM SHADOW KAI Karate · Shitoryu India

---

## 🙏 Credits

Developed with:
- React 18.3.1
- Firebase 12.12.0
- Tailwind CSS 4.1.12
- TypeScript
- Love ❤️

---

**Ready to get started? Fix permissions first, then create your admin account!**

See [QUICK_FIX_PERMISSIONS.md](QUICK_FIX_PERMISSIONS.md) → It takes 2 minutes! ⚡
