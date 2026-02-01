/**
 * High-Security Regional Lockout (European Edition)
 * Inlines all critical styles and ensures a heavy-duty legal notice for restricted regions.
 */

(function () {
    const STORAGE_KEY = 'legal_notice_acknowledged_v3';

    function injectNotice() {
        console.log('[LEGAL] Gatekeeper Active. Region Lock Check...');

        let acknowledged = false;
        try {
            acknowledged = localStorage.getItem(STORAGE_KEY);
        } catch (e) { }

        if (acknowledged && !window.FORCE_LEGAL_NOTICE) return;

        // Ensure we don't double inject
        if (document.getElementById('legal-notice-root')) return;

        const styleId = 'legal-guardian-styles';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.innerHTML = `
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&family=JetBrains+Mono:wght@800&display=swap');

                #legal-notice-root {
                    position: fixed !important;
                    top: 0 !important;
                    left: 0 !important;
                    width: 100vw !important;
                    height: 100vh !important;
                    z-index: 2147483647 !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    background: #000000 !important; /* Solid Black - No transparency/blur */
                    pointer-events: all !important;
                    font-family: 'Inter', system-ui, -apple-system, sans-serif !important;
                    color: white !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    overflow: auto !important;
                }
                #legal-notice-root .card-wrapper {
                    background: #0a0a0c !important;
                    border: 2px solid rgba(0, 245, 255, 0.5) !important;
                    border-radius: 32px !important;
                    padding: 60px !important;
                    max-width: 800px !important;
                    width: 90% !important;
                    box-shadow: 0 0 100px rgba(0, 245, 255, 0.15) !important;
                    position: relative !important;
                    display: block !important;
                    text-align: left !important;
                    animation: cardSlideUp 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) !important;
                }
                @keyframes cardSlideUp {
                    from { transform: translateY(40px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                #legal-notice-root .rn-box {
                    background: rgba(255, 255, 255, 0.03) !important;
                    border: 1px solid rgba(0, 245, 255, 0.2) !important;
                    padding: 30px !important;
                    border-radius: 20px !important;
                    margin: 30px 0 !important;
                }
                #legal-notice-root .rn-value {
                    color: #00f5ff !important;
                    font-family: 'JetBrains Mono', monospace !important;
                    font-size: 1.6rem !important;
                    font-weight: 800 !important;
                    display: block !important;
                    margin-top: 10px !important;
                    letter-spacing: 2px !important;
                }
                #legal-notice-root .item {
                    display: flex !important;
                    gap: 20px !important;
                    margin-bottom: 25px !important;
                    line-height: 1.7 !important;
                    color: #a1a1aa !important;
                    font-size: 1.05rem !important;
                }
                #legal-notice-root .item-num {
                    color: #00f5ff !important;
                    font-weight: 900 !important;
                    font-size: 1.2rem !important;
                }
                #legal-notice-root .item b {
                    color: #ffffff !important;
                }
                #legal-notice-root .btn-acknowledge {
                    background: #00f5ff !important;
                    color: #000 !important;
                    border: none !important;
                    padding: 24px !important;
                    border-radius: 18px !important;
                    font-weight: 900 !important;
                    cursor: pointer !important;
                    text-transform: uppercase !important;
                    width: 100% !important;
                    margin-top: 35px !important;
                    font-size: 1.1rem !important;
                    letter-spacing: 3px !important;
                    transition: all 0.3s ease !important;
                    box-shadow: 0 10px 30px rgba(0, 245, 255, 0.3) !important;
                }
                #legal-notice-root .btn-acknowledge:hover { 
                    filter: brightness(1.2) !important;
                    transform: scale(1.01) !important;
                    box-shadow: 0 15px 40px rgba(0, 245, 255, 0.5) !important;
                }
                .lock-interaction { overflow: hidden !important; pointer-events: none !important; user-select: none !important; }
                #legal-notice-root * { pointer-events: auto !important; }
            `;
            document.head.appendChild(style);
        }

        const html = `
            <div id="legal-notice-root">
                <div class="card-wrapper">
                    <div style="color:#00f5ff; font-weight:900; font-size:1.8rem; margin-bottom:35px; display:flex; align-items:center; gap:15px; letter-spacing:2px; text-transform:uppercase;">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                        REGIONAL ENFORCEMENT NOTICE
                    </div>
                    
                    <div class="rn-box">
                        <span style="color:rgba(255,255,255,0.4); font-size:0.8rem; text-transform:uppercase; font-weight:700; letter-spacing:2px;">Official Reference Number (RN)</span>
                        <span class="rn-value">260129-EU81438P18</span>
                    </div>

                    <div style="margin-top:20px;">
                        <p style="margin-bottom: 25px; color: #fff; font-weight: 700; font-size: 1.1rem;">Access from your region is restricted under active monitoring. By acknowledging this notice, you confirm your compliance with the following directives:</p>
                        
                        <div class="item">
                            <span class="item-num">1.</span>
                            <p>Cease all <b>automated crawling, scraping, and session hijacking</b> attempts on this infrastructure immediately.</p>
                        </div>
                        <div class="item">
                            <span class="item-num">2.</span>
                            <p>Evidence regarding prior <b>extortion attempts, suicidal persuasion, and harassment</b> has been localized and secured for regional enforcement.</p>
                        </div>
                        <div class="item">
                            <span class="item-num">3.</span>
                            <p>Formal enforcement of <b>NO COMMUNICATION</b> between all involved parties is strictly in effect and tracked via node telemetry.</p>
                        </div>
                        
                        <div style="background:rgba(255, 0, 80, 0.08); border:1px solid rgba(255, 0, 80, 0.3); border-left:6px solid #ff0050; padding:25px; border-radius:16px; margin-top:35px;">
                            <strong style="color:#ff0050; text-transform:uppercase; letter-spacing:2px; display:block; margin-bottom:10px; font-size:1rem;">Jurisdictional Warning:</strong>
                            <span style="color:#fecaca; font-size:1rem; line-height:1.5;">Any violation of these terms will result in immediate escalation to the respective regional authorities (EU/EFTA).</span>
                        </div>
                    </div>

                    <button id="legal-acknowledge-btn" class="btn-acknowledge">
                        Confirm Acknowledgement
                    </button>
                    
                    <div style="text-align:center; margin-top:25px; font-size:11px; color:rgba(255,255,255,0.2); font-family:monospace; text-transform:uppercase; letter-spacing:2px;">
                        NODE-ID: ${Math.random().toString(36).substring(2, 14).toUpperCase()} | SECURE-LINK-ACTIVE
                    </div>
                </div>
            </div>
        `;

        if (document.body) {
            document.body.insertAdjacentHTML('beforeend', html);
        } else {
            document.documentElement.insertAdjacentHTML('beforeend', html);
        }

        const root = document.getElementById('legal-notice-root');
        const btn = document.getElementById('legal-acknowledge-btn');

        const enforceLock = () => {
            document.documentElement.classList.add('lock-interaction');
            document.body.classList.add('lock-interaction');
        };

        enforceLock();
        if (root) root.scrollIntoView();
        if (btn) btn.focus();

        // Guardian interval to ensure interaction remains locked
        const guardian = setInterval(() => {
            if (!document.getElementById('legal-notice-root')) {
                injectNotice();
                clearInterval(guardian);
            }
            enforceLock();
        }, 500);

        if (btn) {
            btn.addEventListener('click', () => {
                root.remove();
                document.documentElement.classList.remove('lock-interaction');
                document.body.classList.remove('lock-interaction');
                clearInterval(guardian);

                try {
                    localStorage.setItem(STORAGE_KEY, 'true');
                } catch (e) { }
            });
        }
    }

    // Initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectNotice);
    } else {
        injectNotice();
    }
})();
