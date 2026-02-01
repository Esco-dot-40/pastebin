/**
 * High-Security Legal Notice (Guardian Edition)
 * Inlines all critical styles to bypass cache issues and ensures full site lockout.
 */

(function () {
    const STORAGE_KEY = 'legal_notice_acknowledged_v3';

    function injectNotice() {
        console.log('[LEGAL] Guardian Active. Region Lock Check...');

        let acknowledged = false;
        try {
            acknowledged = localStorage.getItem(STORAGE_KEY);
        } catch (e) { }

        if (acknowledged && !window.FORCE_LEGAL_NOTICE) return;

        // Inline CSS to guarantee appearance even if external CSS fails
        const styleId = 'legal-guardian-styles';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.innerHTML = `
                #legal-notice-root {
                    position: fixed !important;
                    top: 0 !important;
                    left: 0 !important;
                    width: 100vw !important;
                    height: 100vh !important;
                    z-index: 9999999 !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    background: rgba(0, 0, 0, 0.98) !important;
                    backdrop-filter: blur(25px) !important;
                    -webkit-backdrop-filter: blur(25px) !important;
                    opacity: 0;
                    transition: opacity 0.4s ease;
                    pointer-events: all !important;
                    font-family: 'Inter', system-ui, -apple-system, sans-serif !important;
                    color: white !important;
                    visibility: hidden;
                }
                #legal-notice-root.active { opacity: 1; visibility: visible; }
                #legal-notice-root .card-wrapper {
                    background: #0f0f11 !important;
                    border: 1px solid rgba(0, 245, 255, 0.3) !important;
                    border-radius: 28px !important;
                    padding: 45px !important;
                    max-width: 650px !important;
                    width: 92% !important;
                    box-shadow: 0 30px 70px rgba(0,0,0,0.9), 0 0 40px rgba(0,245,255,0.15) !important;
                    position: relative;
                    transform: translateY(20px) scale(0.95);
                    transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
                    text-align: left !important;
                }
                #legal-notice-root.active .card-wrapper { transform: translateY(0) scale(1); }
                #legal-notice-root .rn-box {
                    background: rgba(0,245,255,0.05);
                    border: 1px solid rgba(0,245,255,0.2);
                    padding: 24px;
                    border-radius: 16px;
                    margin: 25px 0;
                }
                #legal-notice-root .rn-value {
                    color: #00f5ff;
                    font-family: 'JetBrains Mono', monospace;
                    font-size: 1.3rem;
                    font-weight: 800;
                    display: block;
                    margin-top: 8px;
                    letter-spacing: 1px;
                }
                #legal-notice-root .item {
                    display: flex;
                    gap: 15px;
                    margin-bottom: 20px;
                    line-height: 1.6;
                    color: #d1d5db;
                }
                #legal-notice-root .item-num {
                    color: #00f5ff;
                    font-weight: 900;
                    font-size: 1.1rem;
                }
                #legal-notice-root .btn-acknowledge {
                    background: #00f5ff !important;
                    color: #000 !important;
                    border: none !important;
                    padding: 18px 35px !important;
                    border-radius: 14px !important;
                    font-weight: 800 !important;
                    cursor: pointer !important;
                    text-transform: uppercase !important;
                    width: 100% !important;
                    margin-top: 25px !important;
                    font-size: 1rem !important;
                    letter-spacing: 2px !important;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    box-shadow: 0 10px 25px rgba(0,245,255,0.3);
                }
                #legal-notice-root .btn-acknowledge:hover { 
                    transform: translateY(-2px);
                    box-shadow: 0 15px 35px rgba(0,245,255,0.5);
                    filter: brightness(1.1);
                }
                .lock-interaction { overflow: hidden !important; pointer-events: none !important; user-select: none !important; }
                #legal-notice-root * { pointer-events: auto !important; }
            `;
            document.head.appendChild(style);
        }

        const html = `
            <div id="legal-notice-root">
                <div class="card-wrapper">
                    <div style="color:#00f5ff; font-weight:900; font-size:1.4rem; margin-bottom:25px; display:flex; align-items:center; gap:12px; letter-spacing:1px; text-transform:uppercase;">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                        DUTCH / NL POLITIE NOTICE
                    </div>
                    
                    <div class="rn-box">
                        <span style="color:rgba(255,255,255,0.5); font-size:0.75rem; text-transform:uppercase; font-weight:700; letter-spacing:2px;">Official Reference Number (RN)</span>
                        <span class="rn-value">260129-PS182481438</span>
                    </div>

                    <div style="margin-top:20px;">
                        <div class="item">
                            <span class="item-num">1.</span>
                            <p>Cease all automated crawling and session hijacking attempts on this infrastructure immediately.</p>
                        </div>
                        <div class="item">
                            <span class="item-num">2.</span>
                            <p>Evidence regarding prior <span style="color:white; font-weight:700;">extortion attempts, suicidal persuasion, and harassment</span> has been localized and secured for further reporting.</p>
                        </div>
                        <div class="item">
                            <span class="item-num">3.</span>
                            <p>Formal enforcement of <span style="color:white; font-weight:900; text-transform:uppercase; font-style:italic;">NO COMMUNICATION</span> between all involved parties is now in effect.</p>
                        </div>
                        
                        <div style="background:rgba(255,0,80,0.1); border:1px solid rgba(255,0,80,0.3); border-left:5px solid #ff0050; padding:18px; border-radius:12px; margin-top:25px;">
                            <strong style="color:#ff0050; text-transform:uppercase; letter-spacing:1px; display:block; margin-bottom:5px; font-size:0.9rem;">Enforcement Warning:</strong>
                            <span style="color:#fecaca; font-size:0.95rem; line-height:1.4;">Any violation of this notice will result in immediate escalation to regional authorities.</span>
                        </div>
                    </div>

                    <button id="legal-acknowledge-btn" class="btn-acknowledge">
                        Confirm Acknowledgement
                    </button>
                    
                    <div style="text-align:center; margin-top:15px; font-size:10px; color:rgba(255,255,255,0.2); font-family:monospace; text-transform:uppercase; letter-spacing:1px;">
                        Tracking Signature: ${Math.random().toString(36).substring(2, 12).toUpperCase()}
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', html);

        const root = document.getElementById('legal-notice-root');
        const btn = document.getElementById('legal-acknowledge-btn');

        const enforceLock = () => {
            document.documentElement.classList.add('lock-interaction');
            document.body.classList.add('lock-interaction');
        };

        setTimeout(() => {
            root.classList.add('active');
            enforceLock();
            btn.focus();
        }, 50);

        // Guardian interval to ensure interaction remains locked
        const guardian = setInterval(() => {
            if (!document.getElementById('legal-notice-root')) {
                injectNotice();
                clearInterval(guardian);
            }
            enforceLock();
        }, 500);

        btn.addEventListener('click', () => {
            root.classList.remove('active');
            document.documentElement.classList.remove('lock-interaction');
            document.body.classList.remove('lock-interaction');
            clearInterval(guardian);

            try {
                localStorage.setItem(STORAGE_KEY, 'true');
            } catch (e) { }

            setTimeout(() => root.remove(), 600);
        });
    }

    // Initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectNotice);
    } else {
        injectNotice();
    }
})();
