const SIDEBAR_SETTINGS_KEY = "karuna-sidebar-fixed";
const SIDEBAR_COLLAPSED_CLASS = "sidebar-collapsed";

function ensureSidebarStyles() {
    if (document.getElementById("sidebar-pin-styles")) return;
    const style = document.createElement("style");
    style.id = "sidebar-pin-styles";
    style.textContent = `
    aside, .main-wrapper { transition: width 0.18s ease, margin-left 0.18s ease; will-change: width, margin-left; }
    .sidebar-pin-btn {
        position: absolute;
        top: 0.75rem;
        right: 0.75rem;
        width: 2.4rem;
        height: 2.4rem;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 9999px;
        border: 1px solid rgba(255,255,255,0.18);
        background: rgba(255,255,255,0.08);
        color: inherit;
        cursor: pointer;
        z-index: 10;
        transition: transform 0.2s ease, background 0.2s ease, right 0.18s ease;
        will-change: transform, right;
    }
    .sidebar-pin-btn:hover { background: rgba(255,255,255,0.16); transform: scale(1.05); }
    aside.sidebar-collapsed { width: 7rem !important; min-width: 7rem !important; overflow: hidden; }
    aside.sidebar-collapsed .sidebar-pin-btn { opacity: 0; pointer-events: none; transform: scale(0.8); }
    aside.sidebar-collapsed:hover .sidebar-pin-btn { opacity: 1; pointer-events: auto; transform: scale(1); }
    aside.sidebar-collapsed .absolute, aside.sidebar-collapsed .pointer-events-none { display: none !important; }
    aside.sidebar-collapsed h1,
    aside.sidebar-collapsed .sidebar-brand-description,
    aside.sidebar-collapsed .sidebar-action-text,
    aside.sidebar-collapsed .sidebar-footer {
        display: none !important;
    }
    aside.sidebar-collapsed nav a > span:not(:first-child),
    aside.sidebar-collapsed a > span:not(:first-child) {
        display: none !important;
    }
    aside.sidebar-collapsed nav a,
    aside.sidebar-collapsed > .p-4,
    aside.sidebar-collapsed > .p-6,
    aside.sidebar-collapsed > .p-4 > a,
    aside.sidebar-collapsed > .p-6 > a {
        justify-content: center !important;
        padding-left: 0.5rem !important;
        padding-right: 0.5rem !important;
    }
    aside.sidebar-collapsed .sidebar-pin-btn { right: 0.75rem; width: 2.1rem; height: 2.1rem; }
    aside.sidebar-collapsed > .p-6 { padding-left: 0.5rem !important; padding-right: 0.5rem !important; }
    aside.sidebar-collapsed:hover { width: 15.5rem !important; }
    aside.sidebar-collapsed:hover h1,
    aside.sidebar-collapsed:hover .sidebar-brand-description,
    aside.sidebar-collapsed:hover .sidebar-action-text,
    aside.sidebar-collapsed:hover .sidebar-footer,
    aside.sidebar-collapsed:hover nav a > span:not(:first-child),
    aside.sidebar-collapsed:hover a > span:not(:first-child) {
        display: inline-flex !important;
    }
    aside.sidebar-collapsed:hover ~ .main-wrapper { margin-left: 15.5rem !important; }
    .main-wrapper.sidebar-collapsed { margin-left: 7rem !important; }
    `;
    document.head.appendChild(style);
}

function initSidebarPin() {
    const aside = document.querySelector("aside");
    if (!aside) return;
    const main = aside.nextElementSibling;
    if (!main || !(main instanceof HTMLElement)) return;
    main.classList.add("main-wrapper");
    ensureSidebarStyles();
    const header = Array.from(aside.children).find((child): child is HTMLElement =>
        child instanceof HTMLElement && !child.classList.contains("pointer-events-none")
    );
    if (!header) return;
    if (aside.querySelector(".sidebar-pin-btn")) return;
    header.style.position = "relative";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "sidebar-pin-btn";
    button.setAttribute("aria-label", "Fijar barra lateral");
    button.innerHTML = '<span class="material-symbols-outlined">push_pin</span>';
    header.appendChild(button);

    const storageKey = SIDEBAR_SETTINGS_KEY;
    let pinned = localStorage.getItem(storageKey) !== "false";

    const updateState = () => {
        if (pinned) {
            aside.classList.remove(SIDEBAR_COLLAPSED_CLASS);
            main.classList.remove(SIDEBAR_COLLAPSED_CLASS);
            button.title = "Desfijar barra lateral";
            button.innerHTML = '<span class="material-symbols-outlined">push_pin</span>';
        } else {
            aside.classList.add(SIDEBAR_COLLAPSED_CLASS);
            main.classList.add(SIDEBAR_COLLAPSED_CLASS);
            button.title = "Fijar barra lateral";
            button.innerHTML = '<span class="material-symbols-outlined">push_pin</span>';
        }
        localStorage.setItem(storageKey, String(pinned));
    };

    button.addEventListener("click", () => {
        pinned = !pinned;
        updateState();
    });

    updateState();
}

export function initTransitions() {
    const quitarOverlay = () => {
        const overlay = document.getElementById('page-overlay');
        if (!overlay) return;
        overlay.style.transition = 'opacity 0.4s ease';
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 400);
    };

    if (document.readyState === 'complete') {
        quitarOverlay();
    } else {
        window.addEventListener('load', quitarOverlay);
    }

    initSidebarPin();
}

export function navegarA(ruta: string) {
    // Crear overlay de salida antes de navegar
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position:fixed; inset:0; z-index:99999;
        background:#fdfbf3;
        opacity:0; transition:opacity 0.3s ease;
    `;
    document.body.appendChild(overlay);

    // Forzar reflow para que la transición funcione
    overlay.offsetHeight;
    overlay.style.opacity = '1';

    setTimeout(() => {
        window.location.href = ruta;
    }, 350);
}