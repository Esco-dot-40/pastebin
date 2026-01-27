import React, { useState, useEffect } from "https://esm.sh/react@19";
import { createRoot } from "https://esm.sh/react-dom@19/client";
import { motion } from "https://esm.sh/framer-motion";
import htm from "https://esm.sh/htm";

const html = htm.bind(React.createElement);

const FolderDropdown = ({ folders, activeFolder, onSelect }) => {
    const [isOpen, setIsOpen] = useState(false);

    return html`
        <div class="relative inline-block text-left w-[280px]">
            <${motion.button}
                whileHover=${{ scale: 1.02 }}
                whileTap=${{ scale: 0.98 }}
                onClick=${() => setIsOpen(!isOpen)}
                class="w-full px-8 py-4 bg-black/40 backdrop-blur-2xl border border-white/10 rounded-2xl flex items-center justify-between group hover:border-cyan-500/50 transition-all duration-300 shadow-[0_10px_40px_rgba(0,0,0,0.4)]"
            >
                <div class="text-left">
                    <span class="block text-[9px] uppercase tracking-[0.3em] text-white/30 font-black mb-1">Active Sector</span>
                    <span class="block text-[13px] uppercase tracking-[0.1em] text-cyan-400 font-bold font-mono">${activeFolder}</span>
                </div>
                <${motion.div}
                    animate=${{ rotate: isOpen ? 180 : 0 }}
                    class="text-cyan-500/50 group-hover:text-cyan-400"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="m6 9 6 6 6-6"/>
                    </svg>
                <//>
            <//>

            <${motion.div}
                initial=${{ opacity: 0, y: 10, scale: 0.95 }}
                animate=${{
            opacity: isOpen ? 1 : 0,
            y: isOpen ? 0 : 10,
            scale: isOpen ? 1 : 0.95,
            pointerEvents: isOpen ? 'auto' : 'none'
        }}
                class="absolute left-0 right-0 mt-3 p-2 bg-black/80 backdrop-blur-3xl border border-white/10 rounded-2xl shadow-[0_20px_80px_rgba(0,0,0,0.8)] z-50 overflow-hidden"
            >
                <div class="max-h-[350px] overflow-y-auto no-scrollbar py-1">
                    ${folders.map(f => html`
                        <${motion.button}
                            key=${f}
                            whileHover=${{ x: 5, backgroundColor: 'rgba(0, 245, 255, 0.05)' }}
                            onClick=${() => {
                onSelect(f);
                setIsOpen(false);
            }}
                            class=${`w-full px-6 py-4 flex items-center justify-between rounded-xl transition-all duration-200 group/item ${activeFolder === f ? 'bg-cyan-500/10 text-cyan-400' : 'text-white/40 hover:text-white'}`}
                        >
                            <span class="text-[11px] uppercase tracking-[0.2em] font-bold font-mono">${f}</span>
                            ${activeFolder === f && html`
                                <${motion.span} 
                                    layoutId="activeIndicator"
                                    class="w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_10px_#00f5ff]"
                                ></${motion.span}>
                            `}
                        <//>
                    `)}
                </div>
            <//>
        </div>
    `;
};

const App = () => {
    const [pastes, setPastes] = useState([]);
    const [filteredPastes, setFilteredPastes] = useState([]);
    const [activeIndex, setActiveIndex] = useState(0);
    const [activeFolder, setActiveFolder] = useState('ALL');
    const [isInitializing, setIsInitializing] = useState(true);
    const [hasError, setHasError] = useState(null);

    useEffect(() => {
        try {
            const loadData = () => {
                if (window._pendingPastes) {
                    setPastes(window._pendingPastes);
                    setFilteredPastes(window._pendingPastes);
                    window._pendingPastes = null;
                    setIsInitializing(false);
                }
                window.setPasteData = (data) => {
                    setPastes(data || []);
                    const folded = activeFolder === 'ALL' ? (data || []) : (data || []).filter(p => p.folderName === activeFolder);
                    setFilteredPastes(folded);
                    if (folded.length > 0) setActiveIndex(0);
                    setIsInitializing(false);
                };
            };
            loadData();
            const timer = setTimeout(() => setIsInitializing(false), 3000);
            return () => clearTimeout(timer);
        } catch (err) {
            console.error("Initialization Error:", err);
            setHasError(err.message);
        }
    }, []);

    useEffect(() => {
        const fetchFolders = async () => {
            try {
                const res = await fetch('/api/folders', { credentials: 'include' });
                const data = await res.json();
                setFolders(['ALL', ...data.map(f => f.name)]);
            } catch (err) {
                console.error("Failed to fetch folders:", err);
            }
        };

        const activeKey = localStorage.getItem('private_access_key');
        let visiblePastes = pastes;

        // CLIENT-SIDE PRIVACY MASK
        if (!activeKey) {
            visiblePastes = pastes.filter(p => !['PRIV', 'Private', 'priv', 'private'].includes(p.folderName));
        }

        const folded = activeFolder === 'ALL' ? visiblePastes : visiblePastes.filter(p => p.folderName === activeFolder);
        setFilteredPastes(folded);

        if (activeFolder !== 'ALL' && activeFolder !== 'Public' && !visiblePastes.find(p => p.folderName === activeFolder)) {
            // Check if folder exists in fetched folders but is just empty
            // If it's not in visiblePastes, it might still be a valid selectable folder
        }

        fetchFolders();
    }, [activeFolder, pastes]);

    const [folders, setFolders] = useState(['ALL']);

    if (hasError) {
        return html`
            <div class="flex flex-col justify-center items-center h-[100vh] bg-red-950/20 backdrop-blur-3xl text-red-500 font-mono p-10">
                <h2 class="text-2xl font-black mb-4">CRITICAL SYSTEM ERROR</h2>
                <p class="opacity-80">${hasError}</p>
                <button onClick=${() => window.location.reload()} class="mt-8 px-6 py-2 border border-red-500/50 rounded-full hover:bg-red-500/10">Re-Initialize</button>
            </div>
        `;
    }

    if (isInitializing || !pastes || pastes.length === 0) {
        return html`
            <div class="flex flex-col justify-center items-center h-[100vh] text-center p-8 bg-black/30 backdrop-blur-sm">
                <div class="relative w-32 h-32 mb-12">
                    <div class="absolute inset-0 border-2 border-cyan-500/10 rounded-full animate-ping"></div>
                    <div class="absolute inset-4 border border-cyan-500/20 rounded-full animate-pulse"></div>
                    <div class="absolute inset-0 flex items-center justify-center">
                        <div class="w-1.5 h-1.5 bg-cyan-500 rounded-full shadow-[0_0_20px_#00f5ff]"></div>
                    </div>
                </div>
                <div class="overflow-hidden">
                    <${motion.h2} 
                        initial=${{ y: 50 }}
                        animate=${{ y: 0 }}
                        class="text-3xl font-black mb-4 text-white uppercase tracking-[0.5em] leading-none"
                    >
                        ${isInitializing ? 'Decrypting Feed' : 'Sector Empty'}
                    <//>
                </div>
                <p class="opacity-30 max-w-sm mb-12 text-white text-[11px] uppercase font-mono tracking-widest leading-relaxed">
                    ${isInitializing ? 'Establishing secure uplink to node repository...' : 'No active packets detected. Awaiting administrative propagation to this sector.'}
                </p>
                ${!isInitializing && html`
                    <div class="flex gap-4">
                        <button onClick=${() => window.navigateTo('/')} class="px-12 py-3 rounded-full border border-white/10 bg-white/5 text-white/60 text-[10px] uppercase tracking-[0.3em] hover:bg-white/10">Abort</button>
                        <button onClick=${() => window.location.reload()} class="px-12 py-3 rounded-full border border-cyan-500/30 bg-cyan-500/5 text-cyan-400 text-[10px] uppercase tracking-[0.3em] hover:bg-cyan-500/10">Re-Sync</button>
                    </div>
                `}
            </div>
        `;
    }

    const HEIGHT = 540;
    const EDGE = 180;

    const toPrev = () => activeIndex > 0 && setActiveIndex(prev => prev - 1);
    const toNext = () => activeIndex < filteredPastes.length - 1 && setActiveIndex(prev => prev + 1);

    return html`
        <div class="flex flex-col items-center select-none py-20 w-full min-h-screen overflow-hidden relative bg-transparent">
            <!-- Header / System Path -->
            <div class="text-center mb-16 relative z-10 w-full px-10">
                <div class="flex justify-between items-center max-w-6xl mx-auto mb-10">
                    <button onClick=${() => window.navigateTo('/')} class="accent-text font-black text-[10px] uppercase tracking-[0.4em] hover:scale-110 transition-transform">
                        ← BACK TO SYSTEM CORE
                    </button>
                    <div class="text-cyan-400 font-mono text-[12px] tracking-[0.2em] uppercase opacity-70 bg-black/20 px-6 py-2 rounded-xl border border-white/5 inline-block backdrop-blur-xl">
                        C:\\Users\\Veroe\\Pastes\\Sectors\\${activeFolder}
                    </div>
                    <div class="w-24"></div> 
                </div>
                
                <div class="flex justify-center relative z-20">
                    <${FolderDropdown} 
                        folders=${folders} 
                        activeFolder=${activeFolder} 
                        onSelect=${setActiveFolder} 
                    />
                </div>
            </div>

            <!-- Navigation Controls -->
            <div class=${`p-8 mb-4 transition-all duration-300 ${activeIndex === 0 ? 'opacity-5 scale-75 cursor-not-allowed' : 'cursor-pointer hover:scale-125 active:scale-90 accent-text'}`} onClick=${toPrev}>
                <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6" /></svg>
            </div>

            <!-- Main Carousel -->
            <div class="overflow-hidden w-full max-w-[1500px] perspective-[3500px] transform-3d relative" style=${{ height: HEIGHT + EDGE * 2 }}>
                <${motion.div} 
                    class="flex flex-col items-center"
                    animate=${{ y: (activeIndex * -HEIGHT) + EDGE }}
                    transition=${{ type: 'spring', damping: 30, stiffness: 100 }}
                >
                    ${filteredPastes.length === 0 ? html`
                        <div key="empty" style=${{ height: HEIGHT }} class="flex items-center justify-center text-white/10 font-mono tracking-[1rem] uppercase">
                            Sector empty // No nodes detected
                        </div>
                    ` : filteredPastes.map((p, index) => {
        const thumb = p.embedUrl || '/public/preview.png';
        return html`
                            <div key=${p.id} style=${{ height: HEIGHT }} class="shrink-0 w-full flex justify-center py-12 transform-gpu">
                                <div onClick=${() => window.navigateTo(`/v/${p.id}`)}
                                     class=${`h-full aspect-[16/9] md:aspect-[3.5] rounded-[4rem] overflow-hidden relative transition-all duration-[1s] ease-[cubic-bezier(0.23,1,0.32,1)] cursor-pointer group
                                            ${activeIndex !== index ? 'scale-75 opacity-10 blur-[20px]' : 'scale-100 opacity-100 shadow-[0_100px_250px_rgba(0,0,0,1)] ring-1 ring-white/20'}
                                            ${activeIndex > index ? '[transform:rotateX(45deg)_translateY(-80px)_scale(0.85)]' : ''}
                                            ${activeIndex < index ? '[transform:rotateX(-45deg)_translateY(80px)_scale(0.85)]' : ''}`}>
                                    
                                    <img class="w-full h-full object-cover transition-transform duration-[4s] group-hover:scale-110 grayscale-[0.4]"
                                         src=${thumb} alt=${p.title} onError=${(e) => { e.target.src = '/public/preview.png'; }} />
                                    
                                    <div class="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/95"></div>
                                    
                                    <div class="absolute inset-0 flex flex-col justify-end p-20">
                                        <div class="translate-y-12 group-hover:translate-y-0 transition-transform duration-[1s] ease-out">
                                            <div class="flex items-center gap-6 mb-8">
                                                <span class="text-white/40 text-[11px] font-black tracking-[0.5em] uppercase border border-white/10 px-5 py-2.5 rounded-full backdrop-blur-2xl bg-white/5">
                                                    ${p.isPublic === 0 ? '🔒 Encrypted Node' : '🌐 Global Stream'}
                                                </span>
                                                ${p.folderName ? html`<span class="text-cyan-500/30 text-[11px] uppercase tracking-[0.4em] font-mono">/repo/${p.folderName}</span>` : ''}
                                            </div>
                                            <h3 class="text-white text-7xl md:text-9xl font-black uppercase tracking-tighter leading-[0.8] mb-10 group-hover:accent-text transition-colors duration-[0.8s]">
                                                ${p.title || 'Undeclared'}
                                            </h3>
                                            <div class="flex items-center gap-16 text-white/10 font-mono text-[12px] tracking-[0.6em] uppercase">
                                                <div class="flex items-center gap-4">
                                                    <span class="w-2.5 h-2.5 rounded-full bg-white/10"></span>
                                                    ${p.language || 'txt'}
                                                </div>
                                                <div class="flex items-center gap-4">
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M2 12h20" /></svg>
                                                    DECLARED: ${new Date(p.createdAt).toLocaleDateString()}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-[2s] bg-[radial-gradient(circle_at_50%_150%,rgba(0,245,255,0.15),transparent_70%)]"></div>
                                </div>
                            </div>
                        `;
    })}
                </${motion.div}>
            </div>

            <div class=${`p-8 mt-4 transition-all duration-300 ${activeIndex === filteredPastes.length - 1 || filteredPastes.length === 0 ? 'opacity-5 scale-75 cursor-not-allowed' : 'cursor-pointer hover:scale-125 active:scale-90 accent-text'}`} onClick=${toNext}>
                <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6" /></svg>
            </div>

            <!-- Footer Identification -->
            <div class="mt-24 flex items-center gap-10">
                <div class="h-[1px] w-32 bg-gradient-to-r from-transparent to-white/10"></div>
                <div class="text-white/10 font-mono text-[11px] tracking-[1rem] uppercase">
                    ${activeFolder} // TRANSMISSION ${activeIndex + 1} OF ${filteredPastes.length}
                </div>
                <div class="h-[1px] w-32 bg-gradient-to-l from-transparent to-white/10"></div>
            </div>
        </div>
    `;
}

const container = document.getElementById("pasteGalleryApp");
if (container) {
    const root = createRoot(container);
    root.render(React.createElement(App));
}
