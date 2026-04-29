// ==========================================
// ВИЗУАЛЬНЫЕ ПОМОЩНИКИ И ИНТЕРФЕЙС (ui.js)
// Здесь лежат функции для уведомлений (тостов), скелетов загрузки и дат
// ==========================================

/**
 * Форматирует дату в формат ДД.МММ.ГГГГ
 * @param {string} dateString - ISO строка даты
 * @returns {string} Отформатированная дата или "—" если дата пуста
 */
function formatDate(dateString) {
    if (!dateString) return '—';
    
    const d = new Date(dateString);
    return d.toLocaleDateString('ru-RU', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
    });
}

/**
 * Показывает стильное всплывающее уведомление (с поддержкой нативного свайпа)
 * @param {string} message - Текст уведомления
 * @param {string} type - Тип (success, error, warning, info)
 */
function showToast(message, type = "info") {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    
    // КРИТИЧЕСКИ ВАЖНО: Запрещаем браузеру перехватывать свайпы (например, для шага "Назад")
    toast.style.touchAction = 'none';

    // Строгий монохром, меняем только иконку
    let icon = "❕"; 
    if (type === "success") icon = "✓";
    if (type === "error") icon = "✕";
    if (type === "warning") icon = "⚠";

    toast.innerHTML = `<span style="font-size: 1.1rem; font-weight: 900;">${icon}</span> ${message}`;

    // === ЛОГИКА: НАСТОЯЩИЙ СВАЙП ЧЕРЕЗ POINTER EVENTS ===
    let startX = 0;
    let currentX = 0;
    let isDragging = false;
    let startTime = 0;

    // Вспомогательная функция для плавного закрытия
    const dismissToast = (direction = 1) => {
        toast.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.2s ease';
        toast.style.transform = `translateX(${direction * 100}vw)`; // Улетает далеко за край экрана
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    };

    // Нажатие пальцем или мышкой
    toast.addEventListener('pointerdown', (e) => {
        startX = e.clientX;
        currentX = e.clientX;
        isDragging = true;
        startTime = Date.now();
        toast.style.transition = 'none'; // Отключаем CSS-анимацию на время перетаскивания
        toast.setPointerCapture(e.pointerId); // Захватываем курсор/палец, чтобы не "сорвался"
    });

    // Движение пальцем
    toast.addEventListener('pointermove', (e) => {
        if (!isDragging) return;
        currentX = e.clientX;
        let diffX = currentX - startX;

        // Эффект "резинки": добавляем сопротивление, чтобы свайп чувствовался тяжелым
        if (Math.abs(diffX) > 0) {
            diffX = diffX * 0.8; 
        }

        toast.style.transform = `translateX(${diffX}px)`;
        toast.style.opacity = Math.max(0.4, 1 - Math.abs(diffX) / 200); 
    });

    // Отпускание пальца (или если браузер прервал касание)
    const handlePointerUp = (e) => {
        if (!isDragging) return;
        isDragging = false;
        toast.releasePointerCapture(e.pointerId);
        
        const diffX = currentX - startX;
        const timeElapsed = Date.now() - startTime;
        const velocity = Math.abs(diffX) / timeElapsed; // Вычисляем силу/скорость броска

        // Если это был просто короткий тап (клик), а не свайп
        if (Math.abs(diffX) < 10 && timeElapsed < 300) {
            dismissToast(1);
            return;
        }

        // Если смахнули далеко ИЛИ смахнули быстро (инерция)
        if (Math.abs(diffX) > 80 || velocity > 0.5) {
            const direction = diffX > 0 ? 1 : -1;
            dismissToast(direction);
        } else {
            // Если передумали и не дотянули - возвращаем тост на место пружинкой
            toast.style.transition = 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease';
            toast.style.transform = `translateX(0)`;
            toast.style.opacity = '1';
        }
    };

    toast.addEventListener('pointerup', handlePointerUp);
    toast.addEventListener('pointercancel', handlePointerUp); // Страховка от системных прерываний

    container.appendChild(toast);

    // Автоматическое закрытие через 3.5 секунды, если ничего не делали
    setTimeout(() => {
        if (toast.parentElement) dismissToast(1);
    }, 3500);
}

/**
 * Отрисовывает пульсирующие скелеты на месте фильмов во время загрузки
 */
function renderSkeletons() {
    const grid = document.getElementById('movie-grid');
    if (!grid) return;
    grid.innerHTML = '';
    // Рисуем 8 заглушек
    for(let i=0; i<8; i++) {
        grid.innerHTML += `
            <div class="skeleton-card">
                <div class="skeleton-img skeleton-anim"></div>
                <div class="skeleton-text skeleton-anim"></div>
                <div class="skeleton-badge skeleton-anim"></div>
            </div>
        `;
    }
}

/**
 * Воспроизводит мягкий, тактильный звук клика для элементов интерфейса
 */
function playUIClick() {
    try {
        window.uiAudioCtx = window.uiAudioCtx || new (window.AudioContext || window.webkitAudioContext)();
        if (window.uiAudioCtx.state === 'suspended') window.uiAudioCtx.resume();
        
        const osc = window.uiAudioCtx.createOscillator();
        const gain = window.uiAudioCtx.createGain();
        
        osc.type = 'sine'; 
        // Частота чуть ниже для мягкости (200Гц вместо 300)
        osc.frequency.setValueAtTime(200, window.uiAudioCtx.currentTime); 
        osc.frequency.exponentialRampToValueAtTime(80, window.uiAudioCtx.currentTime + 0.04);
        
        // Громкость уменьшена в 2 раза (0.01 вместо 0.02)
        gain.gain.setValueAtTime(0.01, window.uiAudioCtx.currentTime); 
        gain.gain.exponentialRampToValueAtTime(0.0001, window.uiAudioCtx.currentTime + 0.04);
        
        osc.connect(gain);
        gain.connect(window.uiAudioCtx.destination);
        osc.start();
        osc.stop(window.uiAudioCtx.currentTime + 0.04);
    } catch(e) {}
}

function toggleFilters() {
    const container = document.querySelector('.filters-container');
    const isHidden = window.getComputedStyle(container).display === 'none';
    container.style.display = isHidden ? 'flex' : 'none';
}