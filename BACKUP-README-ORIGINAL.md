# PasteBin Pro - Dual Domain Pastebin

A beautiful, modern pastebin alternative with **separate admin and public viewing domains** for enhanced privacy and organization.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## ✨ Features

### Admin Interface (`admin/`)
- 🎨 **Premium Modern UI** - Glassmorphism, gradients, and smooth animations
- 📝 **Rich Paste Editor** - Syntax highlighting for 17+ languages
- ⏰ **Expiration Control** - Set pastes to expire after 10m, 1h, 1d, 1w, or 1 month
- 🔥 **Burn After Read** - Pastes that self-destruct after first view
- 🔒 **Privacy Controls** - Make pastes public or private
- 📊 **Statistics Dashboard** - Track views and language usage
- ⌨️ **Keyboard Shortcuts** - Ctrl+Enter to create, Ctrl+K to focus editor
- 📱 **Fully Responsive** - Works perfectly on all devices

### Public Interface (`public/`)
- 👁️ **Beautiful Code Display** - Syntax highlighting with Tokyo Night theme
- 📋 **Copy & Share** - One-click copy and native share support
- 📄 **Raw View** - Access raw paste content
- 🎯 **Line Numbers** - Toggle line numbers for code
- ⚡ **Fast Loading** - Optimized performance
- 🎭 **Multiple States** - Loading, not found, and burned paste states
- ⌨️ **Keyboard Navigation** - R for raw view, Escape to close modals

### Technical Features
- 💾 **LocalStorage Backend** - No server required, works offline
- 🔄 **Shared Data Layer** - Both interfaces access the same storage
- 🎪 **Zero Dependencies** - Pure vanilla JavaScript (except highlight.js)
- 🚀 **Static Hosting Ready** - Deploy anywhere (Netlify, Vercel, GitHub Pages, etc.)

## 🏗️ Project Structure

```
pastebin-dual/
├── admin/              # Admin interface (your posting subdomain)
│   ├── index.html     # Main admin page
│   ├── style.css      # Admin styles
│   └── app.js         # Admin logic
├── public/            # Public interface (viewer subdomain)
│   ├── index.html     # Main public page
│   ├── style.css      # Public styles
│   └── app.js         # Public logic
├── shared/            # Shared code
│   └── storage.js     # Data storage layer
└── README.md          # This file
```

## 🚀 Quick Start

### Local Development

1. **Open Admin Interface**
   - Simply open `admin/index.html` in your browser
   - This is where you'll create and manage pastes

2. **Open Public Interface**
   - Open `public/index.html` in your browser
   - This is where viewers see your pastes

### Creating Your First Paste

1. Open the admin interface
2. Fill in the paste details:
   - **Title**: Give your paste a name
   - **Language**: Select the programming language
   - **Expiration**: Choose when it expires (or never)
   - **Content**: Paste your code
3. Configure options:
   - ✅ **Burn After Read**: Delete after first view
   - ✅ **Public**: Make it visible on public domain
4. Click "Create Paste" or press `Ctrl+Enter`
5. Copy the generated URL and share it!

## 🌐 Deployment Guide

### Option 1: Separate Subdomains (Recommended)

Deploy each folder to a different subdomain using your hosting provider:

#### **Admin Subdomain** (`admin.yourdomain.com`)
1. Deploy the `admin/` folder to this subdomain
2. Configure DNS to point to your hosting

#### **Public Subdomain** (`paste.yourdomain.com`)
1. Deploy the `public/` folder to this subdomain
2. Configure DNS to point to your hosting

### Option 2: Path-Based Routing

Deploy to a single domain with paths:
- `yourdomain.com/admin/` → Admin interface
- `yourdomain.com/public/` → Public interface

### Popular Hosting Options

#### Netlify
```bash
# Deploy admin
cd admin
netlify deploy --prod

# Deploy public  
cd ../public
netlify deploy --prod
```

#### Vercel
```bash
# Deploy admin
cd admin
vercel --prod

# Deploy public
cd ../public
vercel --prod
```

#### GitHub Pages
1. Push the `admin/` folder to a `gh-pages-admin` branch
2. Push the `public/` folder to a `gh-pages-public` branch
3. Configure GitHub Pages for each branch

#### Cloudflare Pages
1. Create two projects in Cloudflare Pages
2. Connect each to a different branch/folder
3. Set custom domains for each project

### Important Notes for Deployment

⚠️ **Storage Limitation**: This uses localStorage, which is:
- Limited to ~5-10MB per domain
- Client-side only (not shared between users)
- Cleared when browser data is cleared

For production use, consider implementing:
- A backend API (Node.js, Python, etc.)
- Database storage (PostgreSQL, MongoDB, etc.)
- User authentication
- Server-side encryption

## 🔧 Configuration

### Updating Public URL in Admin

When deploying to separate domains, update the URL in `admin/app.js`:

```javascript
// Line ~80 in admin/app.js
const publicUrl = `https://paste.yourdomain.com/?id=${id}`;
```

### Customizing Expiration Times

Edit the expiration map in `admin/app.js`:

```javascript
const expirationMap = {
    '10m': 10 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '1d': 24 * 60 * 60 * 1000,
    '1w': 7 * 24 * 60 * 60 * 1000,
    '1M': 30 * 24 * 60 * 60 * 1000
};
```

### Adding More Languages

Add to the language dropdown in `admin/index.html`:

```html
<option value="newlang">New Language</option>
```

## ⌨️ Keyboard Shortcuts

### Admin Interface
- `Ctrl/Cmd + Enter` - Create paste
- `Ctrl/Cmd + K` - Focus content editor

### Public Interface
- `Ctrl/Cmd + C` - Copy paste content
- `R` - Show raw view
- `Escape` - Close modals

## 🎨 Customization

### Changing Color Scheme

Edit CSS variables in either `admin/style.css` or `public/style.css`:

```css
:root {
    --primary-start: #00f5ff;    /* Cyan */
    --primary-end: #7b42ff;      /* Purple */
    --secondary-start: #ff006e;  /* Pink */
    --secondary-end: #ffbe0b;    /* Yellow */
}
```

### Modifying Fonts

Update the Google Fonts import in the HTML files:

```html
<link href="https://fonts.googleapis.com/css2?family=YourFont&display=swap" rel="stylesheet">
```

Then update the CSS variable:

```css
--font-sans: 'YourFont', sans-serif;
```

## 🔒 Backend Implementation (Advanced)

To make this production-ready with persistent storage:

### 1. Create an API Backend

```javascript
// Example Node.js/Express API structure
POST   /api/pastes          - Create paste
GET    /api/pastes/:id      - Get paste
DELETE /api/pastes/:id      - Delete paste
GET    /api/stats           - Get statistics
```

### 2. Update Storage Layer

Replace `shared/storage.js` localStorage calls with API calls:

```javascript
async createPaste(content, config) {
    const response = await fetch('/api/pastes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, config })
    });
    return response.json();
}
```

### 3. Add Authentication

- Implement admin authentication for the admin subdomain
- Use JWT tokens or sessions
- Protect create/delete endpoints

### 4. Database Setup

Recommended schema:

```sql
CREATE TABLE pastes (
    id VARCHAR(8) PRIMARY KEY,
    title VARCHAR(255),
    content TEXT,
    language VARCHAR(50),
    created_at TIMESTAMP,
    expires_at TIMESTAMP,
    views INTEGER DEFAULT 0,
    is_public BOOLEAN DEFAULT true,
    burn_after_read BOOLEAN DEFAULT false,
    password_hash VARCHAR(255)
);
```

## 📊 Browser Support

- ✅ Chrome/Edge (100+)
- ✅ Firefox (100+)
- ✅ Safari (15+)
- ✅ Opera (85+)

## 🐛 Known Limitations

1. **LocalStorage**: Limited to ~5MB, not shared between users
2. **No Server**: Pastes only exist in your browser
3. **No Authentication**: Anyone with the admin URL can create pastes
4. **No Search**: No ability to search through pastes (yet)

## 🚢 Roadmap

- [ ] Add backend API support
- [ ] Implement database storage
- [ ] Add user authentication
- [ ] Enable paste search
- [ ] Add paste categories/tags
- [ ] Implement paste editing
- [ ] Add collaborative features
- [ ] Create mobile apps

## 📝 License

MIT License - feel free to use this for any purpose!

## 🤝 Contributing

Contributions are welcome! Feel free to:
- Report bugs
- Suggest features
- Submit pull requests
- Improve documentation

## 💡 Tips

1. **Bookmark Admin**: Save the admin URL and keep it private
2. **Share Public URLs**: Only share the public interface URLs
3. **Regular Backups**: Export your localStorage data regularly
4. **Use HTTPS**: Always deploy with SSL/TLS encryption
5. **Set Expirations**: Use expiration times to manage storage

## 📞 Support

Need help? Here are some common solutions:

### "Paste not found" error
- Check if the paste has expired
- Verify you're using the correct URL
- Check if it was a burn-after-read paste

### Copy button not working
- Ensure you're using HTTPS (required for clipboard API)
- Try the raw view and manual copy

### Styles not loading
- Clear your browser cache
- Check that CSS files are in the correct location
- Verify font imports are loading

---

**Made with ❤️ for the developer community**

Enjoy your new pastebin! 🎉
