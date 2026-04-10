# 🚀 Complete Replit + Aiven Setup Guide

## ⚠️ PROBLEM: Data Disappears on Republish

Your data disappears because Replit's free storage is **ephemeral** (temporary). We need to connect to your Aiven database for **persistent storage**.

## 🔧 COMPLETE FIX - Step by Step

### Step 1: Update Your Replit Secrets

In your Replit, click the **🔒 Secrets** tab and add these **EXACT** keys:

```bash
DB_HOST=your-actual-aiven-host.aivencloud.com
DB_USER=avnadmin
DB_PASSWORD=your-actual-aiven-password
DB_NAME=defaultdb
DB_PORT=25060
NODE_ENV=production
PORT=3000
```

**IMPORTANT**: Replace `your-actual-aiven-host` and `your-actual-aiven-password` with your real Aiven credentials!

### Step 2: Upload SSL Certificate

1. **Download ca.pem** from your Aiven dashboard
2. In Replit, click **📁 Files** → **Upload file**
3. Select your `ca.pem` file
4. Upload to project root

### Step 3: Pull Latest Code

In Replit shell:
```bash
git pull origin main
```

### Step 4: Restart Your Replit

Click **⏹️ Stop** then **▶️ Run**

### Step 5: Check Console Messages

**SUCCESS** (you should see):
```
=== DATABASE CONFIGURATION DEBUG ===
DB_HOST: your-aiven-host.aivencloud.com
DB_USER: avnadmin
DB_PASSWORD: ***SET***
DB_NAME: defaultdb
DB_PORT: 25060
🌐 RUNNING IN REPLIT ENVIRONMENT
📂 Selecting database: defaultdb
✅ MySQL connection test successful
✅ Connected to the MySQL database.
```

**FAILURE** (if you see):
```
DB_HOST: NOT SET - THIS IS THE PROBLEM!
⚠️ WARNING: Using local database (127.0.0.1)
```

### Step 6: Test Data Persistence

1. **Create a test order** in your store
2. **Note the order number**
3. **Republish your Replit**
4. **Check if order still exists**

## 🆘 TROUBLESHOOTING

### If DB_HOST shows "NOT SET":
1. **Check Replit Secrets** - make sure DB_HOST is added
2. **Restart Replit** after adding secrets
3. **Check spelling** - must be exactly `DB_HOST`

### If connection fails:
1. **Verify Aiven credentials** - host, password, port
2. **Upload ca.pem** - SSL certificate required
3. **Check Aiven service** - make sure it's running

### If data still disappears:
1. **Check console** - must see "aivencloud.com" not "127.0.0.1"
2. **Test with API** - try creating an order via API
3. **Contact support** - Aiven or Replit

## 🎯 SUCCESS INDICATORS

✅ **Console shows Aiven host** (not 127.0.0.1)  
✅ **Connection successful** message  
✅ **Test order persists** after republish  
✅ **All store features work** normally  

## 📞 GET HELP

If still not working:
1. **Screenshot your console** messages
2. **Share your Aiven host** (without password)
3. **Check Replit Secrets** are correctly set

---

**Once this is working, your data will NEVER disappear on republish!** 🎉
