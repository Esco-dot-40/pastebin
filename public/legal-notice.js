/**
 * Legal Notice Gate Interaction Logic
 * Injects the legal notice HTML and handles the acknowledgment workflow.
 */

(function () {
    const STORAGE_KEY = 'legal_notice_acknowledged_v3';

    function injectNotice() {
        console.log('[LEGAL] Script initialized. Force Mode:', !!window.FORCE_LEGAL_NOTICE);
        if (localStorage.getItem(STORAGE_KEY) && !window.FORCE_LEGAL_NOTICE) {
            console.log('[LEGAL] Skipping notice: Already acknowledged.');
            return;
        }

        const html = `
            <div id="legal-notice-root">
                <div class="card-wrapper">
                    ${window.FORCE_LEGAL_NOTICE ? '<div style="position:absolute; top:10px; right:10px; color:#ff0050; font-family:monospace; font-size:10px; z-index:100;">FORCED MODE</div>' : ''}
                    <div class="glow-1"></div>
                    <div class="glow-2"></div>
                    <div class="content-container">
                        <div class="header">
                            <div class="icon-box">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="M12 12h.01"/><path d="M12 7v1"/></svg>
                            </div>
                            <h2 class="title">Dutch / NL Politie:</h2>
                        </div>

                        <div class="space-y-6 text-gray-300">
                            <div class="rn-box">
                                <span class="rn-label">Reference Number (RN)</span>
                                <p class="rn-value">260129-PS182481438</p>
                            </div>

                            <div class="item">
                                <span class="item-num">1.</span>
                                <p>Please stop crawling / crawl attempting my website.</p>
                            </div>

                            <div class="item">
                                <span class="item-num">2.</span>
                                <p>
                                    We are done here, I have a <span class="text-white font-semibold">.rar archive</span> full of texts and evidence of suggesting at extortion / blackmail regarding my new job, Suicidal persuasion, Mocking, Bullying, etc.
                                </p>
                            </div>

                            <div class="item">
                                <span class="item-num">3.</span>
                                <p>
                                    I would prefer to leave this at a petty civil case and simply obey the request of no-communication <span class="font-bold text-white uppercase italic">FROM BOTH PARTIES FOREVER</span>.
                                </p>
                            </div>

                            <div class="alert-box">
                                <span class="alert-num">4.</span>
                                <p class="alert-text">
                                    Please remember the <span class="font-bold underline">BOTH PARTIES</span>. if she contacts me again, I will be reporting it.
                                </p>
                            </div>
                        </div>

                        <div class="footer">
                            <button id="legal-acknowledge-btn" class="btn-acknowledge">
                                ${window.FORCE_LEGAL_NOTICE ? 'I Am Not A Crawling Entity' : 'Acknowledge'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', html);

        const root = document.getElementById('legal-notice-root');
        const btn = document.getElementById('legal-acknowledge-btn');

        // Show almost immediately to block interaction
        setTimeout(() => {
            root.classList.add('active');
            document.body.style.overflow = 'hidden';
            // Force focus to button to ensure they can't tab away easily
            btn.focus();
        }, 400);

        btn.addEventListener('click', () => {
            root.classList.remove('active');
            localStorage.setItem(STORAGE_KEY, 'true');
            setTimeout(() => {
                root.remove();
                document.body.style.overflow = '';
            }, 600);
        });
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectNotice);
    } else {
        injectNotice();
    }
})();
