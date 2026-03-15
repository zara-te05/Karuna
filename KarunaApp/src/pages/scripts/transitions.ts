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