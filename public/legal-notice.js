/**
 * High-Security Regional Lockout (European Edition)
 * FORCED INJECTION: This script clears everything else to ensure lockout.
 */

(function () {
    const STORAGE_KEY = 'legal_notice_acknowledged_v4';

    function injectNotice() {
        console.log('[LEGAL] Gatekeeper Active.');

        // If we are in restricted mode, we ignore previous acknowledgments for maximum lockout certainty
        // (Removing the early return for window.FORCE_LEGAL_NOTICE)

        // Ensure we don't double inject
        if (document.getElementById('legal-notice-root')) return;

        // NUCLEAR OPTION: If this script is running, we HIDE EVERYTHING ELSE immediately.
        const hideStyles = document.createElement('style');
        hideStyles.innerHTML = `
            html, body { background: #000 !important; overflow: hidden !important; }
            body > *:not(#legal-notice-root):not(#legal-guardian-styles) { display: none !important; }
        `;
        document.head.appendChild(hideStyles);

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
                    background: #000000 !important;
                    pointer-events: all !important;
                    font-family: 'Inter', sans-serif !important;
                    color: white !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    overflow: auto !important;
                }
                #legal-notice-root .card-wrapper {
                    background: #0a0a0c !important;
                    border: 2px solid rgba(0, 245, 255, 0.4) !important;
                    border-radius: 32px !important;
                    padding: 60px !important;
                    max-width: 800px !important;
                    width: 90% !important;
                    box-shadow: 0 0 100px rgba(0, 245, 255, 0.2) !important;
                    position: relative !important;
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
                }
                #legal-notice-root .item-num {
                    color: #00f5ff !important;
                    font-weight: 900 !important;
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
                    box-shadow: 0 10px 30px rgba(0, 245, 255, 0.3) !important;
                }
                .lock-interaction { overflow: hidden !important; pointer-events: none !important; user-select: none !important; }
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
                        <p style="margin-bottom: 25px; color: #fff; font-weight: 700; font-size: 1.1rem;">Your region is currently under active infrastructure monitoring. Confirm your local representative identity to proceed.</p>
                        
                        <div class="item">
                            <span class="item-num">1.</span>
                            <p>Cease all automated hijacking attempts on this infrastructure immediately.</p>
                        </div>
                        <div class="item">
                            <span class="item-num">2.</span>
                            <p>Evidence regarding prior extortion and harassment has been localized and secured for regional enforcement.</p>
                        </div>
                        <div class="item">
                            <span class="item-num">3.</span>
                            <p>NO COMMUNICATION between all involved parties is strictly in effect.</p>
                        </div>
                        
                        <div style="background:rgba(255, 0, 80, 0.08); border:1px solid rgba(255, 0, 80, 0.3); border-left:6px solid #ff0050; padding:25px; border-radius:16px; margin-top:35px;">
                            <strong style="color:#ff0050; text-transform:uppercase; letter-spacing:2px; display:block; margin-bottom:10px; font-size:1rem;">Jurisdictional Warning:</strong>
                            <span style="color:#fecaca; font-size:1rem; line-height:1.5;">Violation of these terms will results in immediate escalation to EU/EFTA authorities.</span>
                        </div>
                    </div>

                    <button id="legal-acknowledge-btn" class="btn-acknowledge">
                        Confirm Acknowledgement
                    </button>
                </div>
            </div>
        `;

        if (document.body) {
            document.body.insertAdjacentHTML('afterbegin', html);
        } else {
            document.documentElement.insertAdjacentHTML('afterbegin', html);
        }

        const root = document.getElementById('legal-notice-root');
        const btn = document.getElementById('legal-acknowledge-btn');

        if (btn) {
            btn.addEventListener('click', () => {
                root.remove();
                hideStyles.remove();
                document.documentElement.classList.remove('lock-interaction');
                document.body.classList.remove('lock-interaction');
            });
        }
    }

    // High-frequency guardian
    const guardian = setInterval(() => {
        if (!document.getElementById('legal-notice-root')) {
            injectNotice();
        }
        document.documentElement.classList.add('lock-interaction');
        if (document.body) document.body.classList.add('lock-interaction');
    }, 100);

    // Initial trigger
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectNotice);
    } else {
        injectNotice();
    }
})();
