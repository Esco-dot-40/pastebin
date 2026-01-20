# 🧪 Testing Guide - Analytics & Discord Auth Fixes

## Pre-Test: Restart Server

**IMPORTANT:** Restart your server to apply all changes!

```bash
# Stop current server (Ctrl+C if running)
# Then restart:
npm start
```

---

## Test 1: Discord Authentication ✅

### Steps:
1. **Open your website** in a browser
2. **Click the Discord login button** (entry portal or request modal)
3. **Watch for:**
   - Popup window appears
   - Discord authorization screen shows
   - After authorization, popup shows "✅ Verified!"
   - Popup auto-closes after 1 second
   - Main window shows success message

### Expected Server Console Output:
```
🔵 [DISCORD CALLBACK] Processing authentication callback...
✅ [DISCORD CALLBACK] User authenticated: YourUsername (ID: 123456789)
🔵 [DISCORD CALLBACK] State: login
✨ [DISCORD CALLBACK] Creating new user: YourUsername
   OR
🔄 [DISCORD CALLBACK] Updating existing user: YourUsername
✅ [DISCORD CALLBACK] Session saved successfully
✅ [DISCORD CALLBACK] Sending success response to popup window
```

### If It Fails:
- Check browser console in BOTH windows (main + popup)
- Check server console for `🔴 [DISCORD CALLBACK]` errors
- Error page will show the exact problem

### Success Criteria:
- ✅ No "Internal Server Error"
- ✅ User registered in database
- ✅ Session created
- ✅ Main window receives postMessage

---

## Test 2: Admin Tracking Filter 🚫

### Steps:
1. **Login to admin panel** (`/admin`)
2. **View 2-3 pastes** from the admin panel
3. **Check server console** - should see:
   ```
   📊 [SKIP] Admin viewing {paste-id} - not tracking to analytics
   ```
4. **Go to Analytics dashboard** (`/admin/analytics.html`)
5. **Verify:** Those admin views are NOT in the analytics data

### Then Test Public Views:
1. **Open site in INCOGNITO/Private window**
2. **Navigate to `/public`**
3. **View 2-3 pastes**
4. **Check server console** - should see:
   ```
   🌐 Geo-Lookup: {ip-address}
   ```
   (NO "SKIP" message)
5. **Go back to Analytics dashboard**
6. **Verify:** These public views ARE tracked

### Success Criteria:
- ✅ Admin views show "[SKIP]" in console
- ✅ Admin views NOT in analytics
- ✅ Public views ARE tracked
- ✅ Public views show in analytics

---

## Test 3: City-Based Log Deletion 🗑️

### Steps:
1. **Open Analytics Dashboard** (`/admin/analytics.html`)
2. **Click "Overview" tab** (should be default)
3. **Scroll down** past the map
4. **Find "Top Cities" section**
5. **Verify you see:**
   - List of cities with hit counts
   - Visual progress bars
   - "🗑️ Delete" button for each city

### Test Deletion:
1. **Click "🗑️ Delete" on a city** (e.g., "Saint Joseph")
2. **Confirm the alert:**
   ```
   ⚠️ Are you sure you want to DELETE ALL logs from Saint Joseph?
   
   This will permanently remove:
   • All paste views from Saint Joseph
   • All reactions from Saint Joseph
   
   This action cannot be undone!
   ```
3. **Click OK**
4. **Success alert appears:**
   ```
   ✅ Success!
   
   Deleted from Saint Joseph:
   • 37 view logs
   • 5 reaction logs
   ```
5. **Verify:**
   - City removed from list (or count reduced to 0)
   - Heatmap updated (markers removed)
   - Recent activity table updated

### Success Criteria:
- ✅ Top Cities section visible
- ✅ Delete buttons work
- ✅ Double confirmation shown
- ✅ Data actually deleted from database
- ✅ UI refreshes after deletion

---

## Test 4: Heatmap Population 🗺️

### Current Status:
The heatmap might be empty if:
- No valid geolocation data exists (lat/lon/city all required)
- Only admin views were logged (now fixed)

### To Populate Heatmap:
1. **Clear existing admin-polluted data** (optional):
   - Use "WIPE ALL LOGS" if you want fresh start
   
2. **Generate fresh public views:**
   - Open site in **incognito/private window**
   - Navigate to `/public`
   - View **3-5 different pastes**
   - Wait **3-5 seconds** after each view (for geolocation API)

3. **Use different IPs if possible:**
   - Use phone (mobile data)
   - Use VPN
   - Use different device
   - This creates diverse geolocation data

4. **Check Analytics:**
   - Refresh analytics dashboard
   - Map should show markers (pink circles)
   - Circles size = number of hits
   - Click marker to see city details

### Debugging Empty Heatmap:
1. **Check browser console** while viewing pastes
2. **Check server console** for:
   ```
   🌐 Geo-Lookup: {ip}
   ```
3. **Verify database** has location data:
   - Look at `paste_views` table
   - Check that `lat`, `lon`, `city` columns are populated

### Success Criteria:
- ✅ Map shows markers for different cities
- ✅ Markers clickable with details
- ✅ Top Cities list matches map

---

## Test 5: All Analytics Tabs 📊

### Verify each tab populates:

**Overview Tab:**
- ✅ Total Visits count
- ✅ Unique Visitors count
- ✅ Active Now (30-second window)
- ✅ Geographic Reach count
- ✅ Map with markers
- ✅ Top Cities list
- ✅ Platform Distribution bars

**Devices Tab:**
- ✅ Browser Distribution bars
- ✅ Screen Resolutions list

**Network Tab:**
- ✅ ISP Distribution bars
- ✅ Connection Types list

**Traffic Tab:**
- ✅ Traffic Sources & Referrers

**Recent Tab:**
- ✅ Recent Activity table with:
  - Time ago
  - Action type (👁️ View or reaction)
  - Location
  - ISP
  - IP address

---

## Common Issues & Solutions

### Issue: "Cannot read property 'id' of undefined"
**Solution:** Discord user object is null - check Discord OAuth credentials

### Issue: Heatmap still empty after public views
**Solution:** 
1. Check IP is public (not 127.0.0.1 or 192.168.x.x)
2. Wait 5 seconds after viewing paste
3. Check server console for geo-lookup success
4. Private/local IPs won't have geolocation data

### Issue: Top Cities section shows "No city data available"
**Solution:** 
- No valid city data in database yet
- Generate public views from real IPs
- Check that ip-api.com is accessible

### Issue: Admin views still being tracked
**Solution:**
- Restart server
- Clear browser cache
- Verify you're logged in as admin (check session)

---

## Success Summary

All tests passing means:
- ✅ Discord auth works without crashes
- ✅ Admin views excluded from analytics
- ✅ Public views properly tracked
- ✅ City deletion functional
- ✅ Heatmap populated with real data
- ✅ All analytics tabs showing data

## Next Steps After Testing

1. **Monitor server logs** for any `🔴` error messages
2. **Generate more diverse traffic** for better analytics
3. **Consider deleting test/admin data** to clean up analytics
4. **Optional:** Deploy to production and test live

---

**Questions or Issues?** Check:
- `ANALYTICS-AUTH-FIXES.md` for technical details
- Server console for detailed error logs
- Browser console (F12) for client-side errors
