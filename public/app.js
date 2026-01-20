(function () {
    // Public View Application
    const storage = window.storage || new (window.PasteStorage || window.PasteAPI)();

    // DOM Elements
    const loadingState = document.getElementById('loadingState') || document.getElementById('loading-screen');
    const notFoundState = document.getElementById('notFoundState');
    const burnedState = document.getElementById('burnedState');
    const pasteView = document.getElementById('pasteView');
    const pasteTitle = document.getElementById('pasteTitle');
    const pasteLanguage = document.getElementById('pasteLanguage');
    const pasteViews = document.getElementById('pasteViews');
    const pasteDate = document.getElementById('pasteDate');
    const burnNotice = document.getElementById('burnNotice');
    const pasteContent = document.getElementById('pasteContent');
    const codeTitle = document.getElementById('codeTitle');
    const copyBtn = document.getElementById('copyBtn');
    const rawBtn = document.getElementById('rawBtn');
    const footer = document.getElementById('footer');
    const rawModal = document.getElementById('rawModal');
    const closeRawBtn = document.getElementById('closeRawBtn');
    const rawContent = document.getElementById('rawContent');
    const copyRawBtn = document.getElementById('copyRawBtn');
    const toggleLineNumbers = document.getElementById('toggleLineNumbers');
    const shareBtn = document.getElementById('shareBtn');
    const reportBtn = document.getElementById('reportBtn');

    let currentPaste = null;
    let showLineNumbers = false;

    // Initialize
    loadPaste();

    // Event Listeners
    copyBtn?.addEventListener('click', copyToClipboard);
    rawBtn?.addEventListener('click', showRawView);
    closeRawBtn?.addEventListener('click', () => {
        rawModal.classList.remove('active');
    });
    copyRawBtn?.addEventListener('click', copyRawContent);
    toggleLineNumbers?.addEventListener('click', toggleLineNumbersFunc);
    shareBtn?.addEventListener('click', sharePaste);
    reportBtn?.addEventListener('click', () => {
        alert('Report functionality would be implemented here.');
    });

    // Close modal on background click
    rawModal?.addEventListener('click', (e) => {
        if (e.target === rawModal) {
            rawModal.classList.remove('active');
        }
    });

    // Functions
    async function loadPaste() {
        // Get paste ID from URL params or path
        const urlParams = new URLSearchParams(window.location.search);
        let pasteId = urlParams.get('id');

        // If not in query, check path (e.g., /v/ID)
        if (!pasteId) {
            const pathParts = window.location.pathname.split('/');
            // Assuming path is /v/ID or /view/ID
            if (pathParts[1] === 'v' || pathParts[1] === 'view') {
                pasteId = pathParts[2];
            }
        }

        if (!pasteId) {
            showNotFound();
            return;
        }

        // Simulate loading delay for better UX
        setTimeout(async () => {
            try {
                let paste = await storage.getPaste(pasteId);

                if (!paste) {
                    showNotFound();
                    return;
                }

                processPaste(paste);
            } catch (error) {
                if (error.message.includes('401')) {
                    // Password required
                    const password = prompt('🔒 This paste is password protected.\nPlease enter the password:');
                    if (password) {
                        try {
                            const paste = await storage.getPaste(pasteId, true, password);
                            processPaste(paste);
                        } catch (e) {
                            alert('❌ Incorrect password or access denied.');
                            showNotFound(); // Or show a specialized "Access Denied" state
                        }
                    } else {
                        showNotFound();
                    }
                } else {
                    console.error(error);
                    showNotFound();
                }
            }
        }, 500);
    }

    function processPaste(paste) {
        if (paste.burned) {
            currentPaste = paste;
            showBurned();
            return;
        }

        currentPaste = paste;
        displayPaste(paste);
    }

    function showNotFound() {
        if (loadingState) loadingState.style.display = 'none';
        if (notFoundState) notFoundState.style.display = 'flex';
    }

    function showBurned() {
        if (loadingState) loadingState.style.display = 'none';
        if (burnedState) burnedState.style.display = 'flex';

        // Still show the paste content briefly
        if (currentPaste.content) {
            setTimeout(() => {
                displayPaste(currentPaste);

                // Show a notification
                const notification = document.createElement('div');
                notification.style.cssText = `
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: linear-gradient(135deg, #ff006e, #ffbe0b);
                    color: #0a0a0f;
                    padding: 16px 24px;
                    border-radius: 12px;
                    font-weight: 600;
                    box-shadow: 0 8px 32px rgba(255, 0, 110, 0.4);
                    animation: slideInRight 0.3s ease;
                    z-index: 9999;
                `;
                notification.textContent = '🔥 This paste has been deleted';
                document.body.appendChild(notification);

                setTimeout(() => {
                    notification.remove();
                }, 5000);
            }, 1000);
        }
    }

    function displayPaste(paste) {
        if (loadingState) loadingState.style.display = 'none';
        if (notFoundState) notFoundState.style.display = 'none';
        if (burnedState) burnedState.style.display = 'none';
        if (pasteView) pasteView.style.display = 'block';
        if (footer) footer.style.display = 'flex';

        // Reactions Integration
        window.currentPasteId = paste.id;
        if (document.getElementById('reactionsPanel')) {
            document.getElementById('reactionsPanel').style.display = 'flex';
            displayReactions(paste.reactions || {});
        }

        // Set title and meta
        if (pasteTitle) pasteTitle.textContent = paste.title;
        document.title = `${paste.title} - PasteBin Pro`;
        if (pasteLanguage) pasteLanguage.textContent = paste.language;
        if (pasteViews) pasteViews.textContent = `${paste.views} ${paste.views === 1 ? 'view' : 'views'}`;
        if (pasteDate) pasteDate.textContent = formatDate(paste.createdAt);

        // Only show copy/share buttons for public pastes (per user request)
        const isPublic = paste.isPublic === 1 || paste.isPublic === true;
        if (copyBtn) copyBtn.style.display = isPublic ? 'flex' : 'none';
        if (shareBtn) shareBtn.style.display = isPublic ? 'flex' : 'none';

        // Show burn notice if applicable
        if (paste.burnAfterRead && !paste.burned && burnNotice) {
            burnNotice.style.display = 'flex';
        }

        // Set code title
        if (codeTitle) {
            const extensions = {
                javascript: '.js',
                python: '.py',
                java: '.java',
                cpp: '.cpp',
                csharp: '.cs',
                php: '.php',
                ruby: '.rb',
                go: '.go',
                rust: '.rs',
                sql: '.sql',
                html: '.html',
                css: '.css',
                json: '.json',
                yaml: '.yml',
                markdown: '.md',
                bash: '.sh'
            };

            const ext = extensions[paste.language] || '.txt';
            codeTitle.textContent = paste.title.toLowerCase().replace(/\s+/g, '-') + ext;
        }

        // Syntax highlighting or Markdown rendering
        if (pasteContent) {
            const hasImage = /!\[.*?\]\(.*?\)/.test(paste.content);
            const hasVideo = /<video.*?src=["'].*?["'].*?>/i.test(paste.content);
            const hasIframe = /<iframe.*?src=["'].*?["'].*?>/i.test(paste.content);
            const container = document.getElementById('pasteContentContainer');

            if (paste.language === 'markdown' || (paste.language === 'plaintext' && (hasImage || hasVideo || hasIframe))) {
                pasteContent.innerHTML = marked.parse(paste.content);
                pasteContent.classList.add('markdown-body');
                if (container) container.classList.add('markdown-body');

                // Apply syntax highlighting to code blocks within markdown
                pasteContent.querySelectorAll('pre code').forEach((block) => {
                    hljs.highlightElement(block);
                });
            } else {
                pasteContent.textContent = paste.content;
                pasteContent.className = `language-${paste.language}`;
                if (container) container.classList.remove('markdown-body');
                hljs.highlightElement(pasteContent);
            }
        }

        // Add line numbers if enabled
        if (showLineNumbers) {
            addLineNumbers();
        }
    }

    window.refreshPaste = async () => {
        if (!currentPaste) return;
        try {
            const paste = await storage.getPaste(currentPaste.id, false);
            displayReactions(paste.reactions || {});
        } catch (e) {
            console.error('Failed to refresh reactions:', e);
        }
    };

    function displayReactions(reactions) {
        const counts = {
            heart: document.getElementById('count-heart'),
            star: document.getElementById('count-star'),
            like: document.getElementById('count-like')
        };

        if (counts.heart) counts.heart.textContent = reactions.heart || 0;
        if (counts.star) counts.star.textContent = reactions.star || 0;
        if (counts.like) counts.like.textContent = reactions.like || 0;
    }

    function addLineNumbers() {
        if (!pasteContent) return;
        const lines = pasteContent.textContent.split('\n');
        const numberedContent = lines
            .map((line, i) => `<span class="line-number">${i + 1}</span>${line}`)
            .join('\n');
        pasteContent.innerHTML = numberedContent;
    }

    function toggleLineNumbersFunc() {
        if (!pasteContent || !toggleLineNumbers) return;
        showLineNumbers = !showLineNumbers;

        if (showLineNumbers) {
            toggleLineNumbers.style.background = 'rgba(0, 245, 255, 0.2)';
            toggleLineNumbers.style.borderColor = 'var(--primary-start)';
            toggleLineNumbers.style.color = 'var(--primary-start)';
            addLineNumbers();
        } else {
            toggleLineNumbers.style.background = '';
            toggleLineNumbers.style.borderColor = '';
            toggleLineNumbers.style.color = '';
            hljs.highlightElement(pasteContent);
        }
    }

    function copyToClipboard() {
        if (!currentPaste || !copyBtn) return;

        navigator.clipboard.writeText(currentPaste.content).then(() => {
            const originalContent = copyBtn.innerHTML;
            copyBtn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="2"/>
                    <path d="M7 10L9 12L13 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                Copied!
            `;
            copyBtn.style.background = 'linear-gradient(135deg, #00ff88, #00f5ff)';
            copyBtn.style.color = '#0a0a0f';

            setTimeout(() => {
                copyBtn.innerHTML = originalContent;
                copyBtn.style.background = '';
                copyBtn.style.color = '';
            }, 2000);
        });
    }

    function showRawView() {
        if (!currentPaste || !rawContent || !rawModal) return;

        rawContent.value = currentPaste.content;
        rawModal.classList.add('active');
    }

    function copyRawContent() {
        if (!rawContent || !copyRawBtn) return;
        rawContent.select();
        document.execCommand('copy');

        const originalText = copyRawBtn.textContent;
        copyRawBtn.textContent = 'Copied!';
        copyRawBtn.style.background = 'linear-gradient(135deg, #00ff88, #00f5ff)';

        setTimeout(() => {
            copyRawBtn.textContent = originalText;
            copyRawBtn.style.background = '';
        }, 2000);
    }

    function sharePaste() {
        if (!currentPaste) return;
        const url = window.location.href;

        if (navigator.share) {
            navigator.share({
                title: currentPaste.title,
                text: `Check out this paste: ${currentPaste.title}`,
                url: url
            }).catch(() => {
                // Fallback to clipboard
                copyUrlToClipboard(url);
            });
        } else {
            copyUrlToClipboard(url);
        }
    }

    function copyUrlToClipboard(url) {
        navigator.clipboard.writeText(url).then(() => {
            if (window.showToast) window.showToast('✅ URL copied to clipboard!', 'success');
            else alert('URL copied to clipboard!');
        });
    }

    function formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now - date;

        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
        if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
        if (days < 7) return `${days} ${days === 1 ? 'day' : 'days'} ago`;

        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + C to copy (when not in a text field)
        if ((e.ctrlKey || e.metaKey) && e.key === 'c' && !e.target.matches('input, textarea')) {
            e.preventDefault();
            copyToClipboard();
        }

        // R for raw view
        if (e.key === 'r' && !e.target.matches('input, textarea')) {
            e.preventDefault();
            showRawView();
        }

        // Escape to close modals
        if (e.key === 'Escape') {
            rawModal?.classList.remove('active');
        }
    });

    // Add slide in animation keyframe
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideInRight {
            from {
                transform: translateX(400px);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        .line-number {
            display: inline-block;
            width: 40px;
            margin-right: 16px;
            color: var(--text-tertiary);
            text-align: right;
            user-select: none;
            border-right: 1px solid var(--border);
            padding-right: 12px;
        }

        .markdown-body img, .markdown-body video {
            max-width: 100%;
            height: auto;
            border-radius: 8px;
            margin: 16px 0;
            border: 1px solid var(--border);
        }
        
        .markdown-body a {
            color: var(--primary-start);
            text-decoration: none;
        }
        
        .markdown-body a:hover {
            text-decoration: underline;
        }

        .markdown-body h1, .markdown-body h2, .markdown-body h3 {
            margin-top: 24px;
            margin-bottom: 16px;
            color: var(--primary-start);
        }

        .markdown-body p {
            margin-bottom: 16px;
            line-height: 1.6;
        }
    `;
    document.head.appendChild(style);
})();
