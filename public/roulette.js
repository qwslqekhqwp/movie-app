// ==========================================
// РУЛЕТКА И АНИМАЦИИ (roulette.js)
// Логика выбора случайного фильма, отрисовка колеса и эффекты
// ==========================================

let eliminationAnim = { active: false, index: -1, progress: 0 };
let idleSpinId = null;
let isIdleSpinning = false;

/**
 * Функция медленного вращения в фоне (Умная версия)
 */
function startIdleSpin() {
    if (isIdleSpinning) return;
    isIdleSpinning = true;

    function idleLoop() {
        if (!isIdleSpinning) return;

        // 1. Проверяем, открыто ли модальное окно
        const modal = document.getElementById('movie-modal');
        const isModalOpen = modal && modal.style.display === 'block';

        // 2. Проверяем, видна ли рулетка вообще
        const canvas = document.getElementById('wheelCanvas');
        const isCanvasVisible = canvas && canvas.offsetParent !== null;

        // Крутим и рисуем ТОЛЬКО если на рулетку смотрят и нет открытых окон
        if (isCanvasVisible && !isModalOpen) {
            wheelAngle -= 0.004; // Отрицательное значение крутит ПРОТИВ часовой стрелки
            if (wheelAngle < 0) wheelAngle += Math.PI * 2;
            if (typeof drawWheel === 'function') drawWheel();
        }

        idleSpinId = requestAnimationFrame(idleLoop);
    }
    idleLoop();
}

/**
 * Функция остановки фонового вращения
 */
function stopIdleSpin() {
    isIdleSpinning = false;
    if (idleSpinId) cancelAnimationFrame(idleSpinId);
}

/**
 * Инициализирует рулетку, подготавливая список фильмов
 * Фильтрует фильмы по времени просмотра и статусу
 */
function initRoulette() {
    if (isSpinning) return;

    const maxTime = parseInt(document.getElementById('time-filter').value) || 999;

    currentRouletteMovies = allMovies.filter(m =>
        m.status === 'В колесе' &&
        (parseInt(m.duration) || 0) <= maxTime
    );

    if (currentRouletteMovies.length < 2) {
        showToast("Добавьте минимум 2 фильма в 'В колесе'!", "warning");
        return;
    }

    localStorage.setItem('roulette_session', JSON.stringify(currentRouletteMovies));

    const spinBtn = document.getElementById('spin-button');
    spinBtn.disabled = false;
    spinBtn.style.opacity = "1";
    spinBtn.style.cursor = "pointer";

    document.getElementById('winner-display').innerText = `Список готов: ${currentRouletteMovies.length} поз.`;
    wheelAngle = 0;
    startIdleSpin(); 
}

/**
 * Настраивает вид рулетки в зависимости от устройства (мобильное/ПК)
 */
function setupRouletteView() {
    const isMobile = window.innerWidth <= 600;

    if (isMobile) {
        document.getElementById('roulette-container').style.display = 'none';
        document.getElementById('pc-spin-controls').style.display = 'none';
        document.getElementById('mobile-roulette-container').style.display = 'block';
        if (typeof prepareDrum === "function") prepareDrum();
    } else {
        document.getElementById('roulette-container').style.display = 'block';
        document.getElementById('pc-spin-controls').style.display = 'block';
        document.getElementById('mobile-roulette-container').style.display = 'none';
        if (typeof drawWheel === "function") drawWheel();
    }
}

/**
 * Рисует колесо рулетки с названиями фильмов
 * Адаптируется под размер экрана
 */
function drawWheel() {
    if (window.innerWidth <= 600) return;

    const canvas = document.getElementById('wheelCanvas');
    if (!canvas || currentRouletteMovies.length === 0) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const size = canvas.parentElement.offsetWidth;

    if (size < 100) return;

    if (canvas.width !== size * dpr) {
        canvas.width = size * dpr;
        canvas.height = size * dpr;
        ctx.scale(dpr, dpr);
    }

    const centerX = size / 2;
    const centerY = size / 2;
    const radius = size / 2 - 30;
    const sliceAngle = (2 * Math.PI) / currentRouletteMovies.length;

    ctx.clearRect(0, 0, size, size);

    renderSectors(ctx, centerX, centerY, radius, sliceAngle, wheelAngle, 1);
}

/**
 * Вспомогательная функция для отрисовки секторов колеса (МАКСИМАЛЬНАЯ ПРОИЗВОДИТЕЛЬНОСТЬ)
 */
function renderSectors(ctx, centerX, centerY, radius, sliceAngle, angleOffset, opacity) {
    const lineGradient = ctx.createRadialGradient(centerX, centerY, radius * 0.2, centerX, centerY, radius);
    lineGradient.addColorStop(0, 'rgba(192, 192, 192, 0)');
    lineGradient.addColorStop(1, 'rgba(192, 192, 192, 0.25)');

    let closestIndex = -1;
    let minDistance = Infinity;

    // Находим активный элемент (в линзе)
    currentRouletteMovies.forEach((_, i) => {
        const angle = angleOffset + i * sliceAngle;
        const midAngle = angle + sliceAngle / 2;
        let normMid = midAngle % (Math.PI * 2);
        if (normMid < 0) normMid += Math.PI * 2;
        const dist = Math.min(normMid, Math.PI * 2 - normMid);

        if (dist < minDistance) {
            minDistance = dist;
            closestIndex = i;
        }
    });

    currentRouletteMovies.forEach((movie, i) => {
        const angle = angleOffset + i * sliceAngle;
        const midAngle = angle + sliceAngle / 2;

        let currentOpacity = opacity;

        if (eliminationAnim.active && i === eliminationAnim.index) {
            currentOpacity = opacity * (1 - eliminationAnim.progress);
        }

        ctx.globalAlpha = currentOpacity;

        // 1. Рисуем фон сектора
        ctx.fillStyle = (i % 2 === 0) ? `rgba(255, 255, 255, 0.02)` : `rgba(255, 255, 255, 0.015)`;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, angle, angle + sliceAngle);
        ctx.fill();

        // 2. Рисуем границы
        ctx.strokeStyle = lineGradient;
        ctx.lineWidth = 1;
        ctx.stroke();

        // === ОПТИМИЗАЦИЯ ТЕКСТА УБРАНА ===
        let normMid = midAngle % (Math.PI * 2);
        if (normMid < 0) normMid += Math.PI * 2;
        
        ctx.save();
        ctx.translate(centerX, centerY);
            
        // Анимация выбывания
        if (eliminationAnim.active && i === eliminationAnim.index) {
            ctx.translate(eliminationAnim.progress * 250, 0); 
        }
            
        ctx.rotate(midAngle);
        ctx.textAlign = "right";

        const isActive = (i === closestIndex) && (minDistance < 0.2);

        if (isActive) {
            // УБРАЛИ shadowBlur (убийца FPS). Делаем текст чисто белым и жирным
            ctx.fillStyle = `rgba(255, 255, 255, ${currentOpacity})`;
            ctx.font = `900 ${Math.max(14, radius / 18)}px 'Segoe UI', sans-serif`;
        } else {
            ctx.fillStyle = `rgba(140, 140, 140, ${currentOpacity})`;
            ctx.font = `500 ${Math.max(11, radius / 26)}px 'Segoe UI', sans-serif`;
        }

        const shortTitle = movie.title.length > 22 ? movie.title.substring(0, 19) + '...' : movie.title;
        ctx.fillText(shortTitle, radius - 35, 5);
        ctx.restore();
    });

    // Дырка в центре
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(centerX, centerY, 40, 0, Math.PI * 2);
    ctx.fillStyle = '#0a0a0a'; 
    ctx.fill();

    ctx.beginPath();
    ctx.arc(centerX, centerY, 40, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(192, 192, 192, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
}

/**
 * Запускает вращение колеса рулетки
 */
function spinRoulette() {
    if (currentRole === 'guest') {
        showToast("ГОСТЯМ НЕЛЬЗЯ КРУТИТЬ РУЛЕТКУ", "warning");
        return;
    }

    if (isSpinning || currentRouletteMovies.length < 2) return;

    stopIdleSpin();

    isSpinning = true;
    const duration = (parseFloat(document.getElementById('spin-duration-input').value) || 5) * 1000;
    const startAngle = wheelAngle;
    
    const sliceAngle = (2 * Math.PI) / currentRouletteMovies.length;

    // === УМНАЯ ПОДКРУТКА И ТЕНЕВОЙ БАН ===
    let winningIndex;
    const mode = document.getElementById('spin-mode').value;
    
    if (mode === 'elimination') {
        // РЕЖИМ ВЫБЫВАНИЯ: Выбираем, кого ВЫКИНУТЬ с колеса

        // 1. Ищем фильмы в теневом бане (они - главные цели на уничтожение)
        const shadowbannedTargets = currentRouletteMovies
            .map((m, index) => ({ ...m, originalIndex: index }))
            .filter(m => m.shadowbanned);

        if (shadowbannedTargets.length > 0) {
            // Безжалостно выкидываем один из забаненных фильмов
            const target = shadowbannedTargets[Math.floor(Math.random() * shadowbannedTargets.length)];
            winningIndex = target.originalIndex;
        } else {
            // 2. Если забаненных нет, честно выкидываем обычные фильмы (но не трогаем Заряженный)
            const normalCandidates = currentRouletteMovies
                .map((m, index) => ({ ...m, originalIndex: index }))
                .filter(m => !m.is_rigged);

            if (normalCandidates.length > 0) {
                const randomCandidate = normalCandidates[Math.floor(Math.random() * normalCandidates.length)];
                winningIndex = randomCandidate.originalIndex;
            } else {
                winningIndex = Math.floor(Math.random() * currentRouletteMovies.length);
            }
        }
    } else {
        // ОБЫЧНЫЙ РЕЖИМ: Выбираем ПОБЕДИТЕЛЯ
        const riggedIndex = currentRouletteMovies.findIndex(m => m.is_rigged);
        
        if (riggedIndex !== -1) {
            winningIndex = riggedIndex; // Сразу отдаем победу заряженному
        } else {
            // Если подкрутки нет, честно выбираем победителя из числа НЕ забаненных
            const candidates = currentRouletteMovies
                .map((m, index) => ({ ...m, originalIndex: index }))
                .filter(m => !m.shadowbanned);
                
            if (candidates.length > 0) {
                const randomCandidate = candidates[Math.floor(Math.random() * candidates.length)];
                winningIndex = randomCandidate.originalIndex;
            } else {
                winningIndex = Math.floor(Math.random() * currentRouletteMovies.length);
            }
        }
    }

    let idealRemainder = (2 * Math.PI - (winningIndex * sliceAngle + sliceAngle / 2)) % (2 * Math.PI);
    if (idealRemainder < 0) idealRemainder += Math.PI * 2; 

    const extraSpins = 8 + Math.floor(Math.random() * 5);
    const currentBase = Math.floor(startAngle / (2 * Math.PI)) * 2 * Math.PI;
    const targetAngle = currentBase + (extraSpins * 2 * Math.PI) + idealRemainder;

    let startTime = null;

    function animate(currentTime) {
        if (!startTime) startTime = currentTime;
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        const easing = 1 - Math.pow(1 - progress, 4);
        const baseAngle = startAngle + (targetAngle - startAngle) * easing;
        const tickOffset = Math.sin((baseAngle % sliceAngle) / sliceAngle * Math.PI * 2) * 0.025;

        const oldAngle = wheelAngle;
        wheelAngle = baseAngle - tickOffset;
        const delta = wheelAngle - oldAngle;

        const currentSector = Math.floor((1.5 * Math.PI - wheelAngle) / sliceAngle);
        const lastSector = Math.floor((1.5 * Math.PI - oldAngle) / sliceAngle);

        if (currentSector !== lastSector) {
            if (typeof playTickSound === "function") playTickSound();
        }

        const canvas = document.getElementById('wheelCanvas');
        const ctx = canvas.getContext('2d');
        const size = canvas.parentElement.offsetWidth;
        ctx.clearRect(0, 0, size, size);

        // ОПТИМИЗАЦИЯ: Убрали двойной рендер (псевдо-размытие), который вешал систему
        renderSectors(ctx, size/2, size/2, size/2 - 30, sliceAngle, wheelAngle, 1);

        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            drawWheel();
            finalizeSpin();
        }
    }
    requestAnimationFrame(animate);
}

/**
 * Завершает спин рулетки и показывает результат
 */
function finalizeSpin() {
    isSpinning = false;
    const sliceAngle = (2 * Math.PI) / currentRouletteMovies.length;
    const normalizedAngle = (2 * Math.PI - (wheelAngle % (2 * Math.PI))) % (2 * Math.PI);
    let winningIndex = Math.floor(normalizedAngle / sliceAngle);

    if (winningIndex >= currentRouletteMovies.length) winningIndex = currentRouletteMovies.length - 1;

    const winner = currentRouletteMovies[winningIndex];
    const display = document.getElementById('winner-display');
    const mode = document.getElementById('spin-mode').value;

    const showWinnerOverlay = (header, title) => {
        const overlay = document.getElementById('winner-overlay');
        document.querySelector('#winner-overlay span').innerText = header;
        document.getElementById('overlay-movie-title').innerText = title;

        overlay.style.display = 'flex';
        overlay.style.pointerEvents = 'auto';
        setTimeout(() => overlay.style.opacity = '1', 10);
        if (typeof triggerWinAnimation === "function") triggerWinAnimation();
    };

    if (mode === 'elimination') {
        if (typeof playFadeSound === "function") playFadeSound();

        eliminationAnim.active = true;
        eliminationAnim.index = winningIndex;
        eliminationAnim.progress = 0;

        function animateElimination() {
            eliminationAnim.progress += 0.02;
            if (eliminationAnim.progress >= 1) {
                currentRouletteMovies.splice(winningIndex, 1);
                eliminationAnim.active = false;

                if (currentRouletteMovies.length === 1) {
                    const finalWinner = currentRouletteMovies[0];
                    // ДОБАВЛЯЕМ ОБНОВЛЕНИЕ БАЗЫ ДАННЫХ
                    updateMovieStatusToWatching(finalWinner.id); 
                    
                    showWinnerOverlay('ПОБЕДИТЕЛЬ', finalWinner.title);
                    display.innerText = `Победитель: ${finalWinner.title}`;
                    return;
                } else {
                    display.innerText = `Выбыл: ${winner.title}. Осталось: ${currentRouletteMovies.length}`;
                    setTimeout(() => {
                        drawWheel();
                        display.innerText = `Готово к следующему спину! Осталось: ${currentRouletteMovies.length}`;
                    }, 1000);
                }
            } else {
                drawWheel();
                requestAnimationFrame(animateElimination);
            }
        }
        animateElimination();
    } else {
        // НОВАЯ ЛОГИКА: Меняем статус в базе данных на "СМОТРИМ СЕЙЧАС"
        updateMovieStatusToWatching(winner.id);
        
        showWinnerOverlay('ВЫИГРАЛ', winner.title);
        display.innerText = `Выиграл: ${winner.title}`;
    }
}

/**
 * Добавляет или удаляет фильм из рулетки (в базе)
 */
async function toggleRouletteDirectly(id, isModalOpen = false) {
    const movie = allMovies.find(m => m.id == id);
    if (!movie) return;

    let newStatus;
    let updateData = {}; // Объект с данными, которые полетят в базу

    if (movie.status === 'В колесе') {
        // === УБИРАЕМ ИЗ РУЛЕТКИ ===
        // 1. Смотрим в "кармашек" базы. 
        // 2. Если там пусто (например, для старых фильмов), используем старую проверку как запасной план
        const hasScores = (
            Number(movie.plot_me||0) + Number(movie.ending_me||0) + Number(movie.actors_me||0) + 
            Number(movie.plot_any||0) + Number(movie.ending_any||0) + Number(movie.actors_any||0)
        ) > 0;
        
        newStatus = movie.previous_status || (hasScores ? 'На пересмотр' : 'Не просмотрено');
        
        // Отправляем новый статус, а кармашек очищаем (он нам больше не нужен)
        updateData = { status: newStatus, previous_status: null };
    } else {
        // === ДОБАВЛЯЕМ В РУЛЕТКУ ===
        newStatus = 'В колесе';
        // Перед тем как перевести в колесо, аккуратно записываем текущий статус в кармашек
        updateData = { status: newStatus, previous_status: movie.status };
    }

    const { error } = await supabaseClient
        .from('movies')
        .update(updateData)
        .eq('id', id);

    if (error) {
        showToast("Ошибка обновления статуса", "error");
        console.error(error);
        return;
    }

    // Обновляем данные локально в браузере, чтобы не ждать перезагрузки
    movie.status = newStatus;
    movie.previous_status = updateData.previous_status;
    
    // === ЛОГ В ЛЕНТУ АКТИВНОСТИ ===
    if (typeof logActivity === 'function') {
        const actionText = newStatus === 'В колесе' ? "Добавил фильм в рулетку ♤" : "Убрал фильм из рулетки ✕";
        logActivity(movie.title, actionText);
    }
    
    showToast(newStatus === 'В колесе' ? "Добавлен в рулетку!" : "Удален из рулетки", "success");

    // Обновляем интерфейс
    if (isModalOpen) {
        renderModalContent(movie);
    } 
    if (typeof applyFilters === "function") applyFilters();
    if (document.getElementById('roulette-screen').style.display === 'block') {
        initRoulette();
    }
}

// ==========================================
// 12.1 МОБИЛЬНАЯ РУЛЕТКА (СВАЙП И ВРАЩЕНИЕ)
// ==========================================

let currentTranslateY = 0;
let dragStartY = 0;
let isDraggingDrum = false;
let lastDragTime = 0;
let swipeVelocity = 0;
let lastTickIndex = -1;

function prepareDrum() {
    const drumList = document.getElementById('drum-list');
    if (!drumList) return;

    const maxTime = parseInt(document.getElementById('time-filter').value) || 999;
    currentRouletteMovies = allMovies.filter(m => m.status === 'В колесе' && (parseInt(m.duration) || 0) <= maxTime);

    drumList.innerHTML = '';
    currentTranslateY = 0;
    
    if (currentRouletteMovies.length < 2) {
        drumList.innerHTML = '<div class="drum-item" style="color:#ff4d4d; top:50%; transform:translateY(-50%);">НУЖНО 2 ФИЛЬМА</div>';
        return;
    }

    currentRouletteMovies.forEach((m, i) => {
        const item = document.createElement('div');
        item.className = 'drum-item';
        item.innerText = m.title;
        drumList.appendChild(item);
    });

    updateDrum3D();

    const wrapper = document.querySelector('.drum-wrapper');
    wrapper.replaceWith(wrapper.cloneNode(true));
    const newWrapper = document.querySelector('.drum-wrapper');

    newWrapper.addEventListener('touchstart', handleDrumTouchStart, {passive: false});
    newWrapper.addEventListener('touchmove', handleDrumTouchMove, {passive: false});
    newWrapper.addEventListener('touchend', handleDrumTouchEnd);
}

/**
 * Главная функция 3D трансформации (Идеальное фиксированное расстояние)
 */
function updateDrum3D() {
    const items = document.querySelectorAll('.drum-item');
    const radius = 160; 
    const anglePerItem = 20; 
    const totalDegrees = items.length * anglePerItem;
    const anglePerPixel = 0.4; 
    const currentAngle = currentTranslateY * anglePerPixel;

    items.forEach((item, i) => {
        const itemAngle = (i * anglePerItem) + currentAngle;
        let wrappedAngle = ((itemAngle % totalDegrees) + totalDegrees) % totalDegrees;
        if (wrappedAngle > totalDegrees / 2) {
            wrappedAngle -= totalDegrees;
        }

        if (Math.abs(wrappedAngle) > 85) {
            item.style.opacity = 0;
            item.style.transform = `rotateX(${wrappedAngle}deg) translateZ(${radius}px)`;
            item.classList.remove('active');
            return;
        }

        item.style.transform = `rotateX(${wrappedAngle}deg) translateZ(${radius}px)`;
        const opacity = Math.max(0, 1 - (Math.abs(wrappedAngle) / 70));
        
        // ЛОГИКА ЩЕЛЧКА
        if (Math.abs(wrappedAngle) < (anglePerItem / 2)) {
            item.classList.add('active');
            item.style.opacity = 1;
            
            // Если этот элемент только что стал активным — щелкаем
            if (lastTickIndex !== i) {
                playTickSound(); // Звук теперь вызывается только при смене индекса
                lastTickIndex = i;
                if (window.navigator.vibrate) window.navigator.vibrate(5); // Легкая вибрация для тактильности
            }
        } else {
            item.classList.remove('active');
            item.style.opacity = opacity;
        }
    });
}

function handleDrumTouchStart(e) {
    if (isSpinning || currentRouletteMovies.length < 2) return;
    isDraggingDrum = true;
    dragStartY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
    lastDragTime = Date.now();
    swipeVelocity = 0;
}

function handleDrumTouchMove(e) {
    if (!isDraggingDrum || isSpinning) return;
    e.preventDefault();

    const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
    const deltaY = clientY - dragStartY;
    dragStartY = clientY;

    const now = Date.now();
    const deltaTime = now - lastDragTime;
    lastDragTime = now;
    if (deltaTime > 0) swipeVelocity = deltaY / deltaTime;

    currentTranslateY -= deltaY;
    updateDrum3D();
}

function handleDrumTouchEnd() {
    if (!isDraggingDrum || isSpinning) return;
    isDraggingDrum = false;
    isSpinning = true;
    
    // 1. Увеличиваем начальный импульс (было 16, сделаем 24 для большей дальности)
    let velocity = -swipeVelocity * 1.5; 
    const pixelsPerItem = 20 / 0.4;

    function step() {
        if (Math.abs(velocity) > 0.05) {
            currentTranslateY += velocity * 16;
            
            // 2. Уменьшаем трение (было 0.96, ставим 0.985)
            // Чем ближе к 1.0, тем дольше будет крутиться барабан
            velocity *= 0.985; 
            
            updateDrum3D();
            requestAnimationFrame(step);
        } else {
            // Магнитный довод до ближайшего фильма
            const targetY = Math.round(currentTranslateY / pixelsPerItem) * pixelsPerItem;
            const startTime = performance.now();
            const startY = currentTranslateY;

            function snap(now) {
                const progress = Math.min((now - startTime) / 500, 1); // Чуть замедлим финальный "довод"
                currentTranslateY = startY + (targetY - startY) * progress;
                updateDrum3D();
                if (progress < 1) requestAnimationFrame(snap);
                else finishSpin();
            }
            requestAnimationFrame(snap);
        }
    }
    requestAnimationFrame(step);
}

/**
 * Автоматическое вращение по кнопке "КРУТИТЬ БАРАБАН"
 */
function spinDrum() {

    if (currentRole === 'guest') {
        showToast("ГОСТЯМ НЕЛЬЗЯ КРУТИТЬ РУЛЕТКУ", "warning");
        return;
    }

    if (isSpinning || currentRouletteMovies.length < 2) return;
    isSpinning = true;
    
    const extraSpins = 4 + Math.floor(Math.random() * 3); // 4-6 полных кругов
    const randomIndex = Math.floor(Math.random() * currentRouletteMovies.length);
    const pixelsPerItem = 20 / 0.4;
    const totalPixels = currentRouletteMovies.length * pixelsPerItem;
    
    const targetY = -(randomIndex * pixelsPerItem) - (extraSpins * totalPixels);
    const startY = currentTranslateY;
    const startTime = performance.now();
    const duration = 3500; 

    function animate(now) {
        const progress = Math.min((now - startTime) / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 4); 
        
        currentTranslateY = startY + (targetY - startY) * easeOut;
        updateDrum3D();
        
        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            finishSpin();
        }
    }
    requestAnimationFrame(animate);
}

function finishSpin() {
    isSpinning = false;
    const pixelsPerItem = 20 / 0.4;
    let index = Math.round(-currentTranslateY / pixelsPerItem) % currentRouletteMovies.length;
    if (index < 0) index += currentRouletteMovies.length;
    
    finalizeMobileSpin(index);
}

function finalizeMobileSpin(winningIndex) {
    if (!currentRouletteMovies || !currentRouletteMovies[winningIndex]) return;

    const winner = currentRouletteMovies[winningIndex];
    const modeSelect = document.getElementById('spin-mode');
    const mode = modeSelect ? modeSelect.value : 'classic';

    const overlay = document.getElementById('winner-overlay');
    const overlayTitle = document.getElementById('overlay-movie-title');
    const overlayHeader = document.querySelector('#winner-overlay span');

    if (!overlay || !overlayTitle) return;

    if (mode === 'elimination') {
        currentRouletteMovies.splice(winningIndex, 1);
        if (currentRouletteMovies.length === 1) {
            const finalWinner = currentRouletteMovies[0];
            setTimeout(() => {
                overlayHeader.innerText = "ФИНАЛЬНЫЙ ПОБЕДИТЕЛЬ:";
                overlayTitle.innerText = finalWinner.title;
                overlay.style.display = 'flex';
                overlay.style.pointerEvents = 'auto'; 
                setTimeout(() => overlay.style.opacity = '1', 50);
                if (typeof triggerWinAnimation === "function") triggerWinAnimation();
            }, 1000); 
        } else {
            setTimeout(() => {
                overlayHeader.innerText = "ВЫБЫЛ ФИЛЬМ:";
                overlayTitle.innerText = winner.title;
                overlay.style.display = 'flex';
                overlay.style.pointerEvents = 'auto'; 
                setTimeout(() => overlay.style.opacity = '1', 50);
                prepareDrum();
            }, 500);
        }
    } else {
        // НОВАЯ ЛОГИКА: Меняем статус в базе данных на "СМОТРИМ СЕЙЧАС"
        updateMovieStatusToWatching(winner.id);

        setTimeout(() => {
            overlayHeader.innerText = "ВЫПАЛ ФИЛЬМ:";
            overlayTitle.innerText = winner.title;
            overlay.style.display = 'flex';
            overlay.style.pointerEvents = 'auto'; 
            setTimeout(() => overlay.style.opacity = '1', 50);
            if (typeof triggerWinAnimation === "function") triggerWinAnimation();
        }, 500);
    }
}


// ==========================================
// 13. ЗВУКИ И ВИЗУАЛЬНЫЕ ЭФФЕКТЫ
// ==========================================

// Создаем единый аудио-контекст для всего приложения (Singleton)
let globalAudioCtx = null;
function getAudioContext() {
    if (!globalAudioCtx) {
        globalAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    // В некоторых браузерах звук "засыпает", если нет активности
    if (globalAudioCtx.state === 'suspended') {
        globalAudioCtx.resume();
    }
    return globalAudioCtx;
}

/**
 * Воспроизводит звук трещотки (клик) при вращении
 */
function playTickSound() {
    const actx = getAudioContext();
    const osc = actx.createOscillator();
    const gain = actx.createGain();
    
    osc.type = 'sine'; // Более мягкий звук
    osc.frequency.setValueAtTime(150, actx.currentTime); // Низкая частота (басовитый щелчок)
    osc.frequency.exponentialRampToValueAtTime(40, actx.currentTime + 0.03); 
    
    gain.gain.setValueAtTime(0.1, actx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 0.03);
    
    osc.connect(gain);
    gain.connect(actx.destination);
    osc.start();
    osc.stop(actx.currentTime + 0.03);
}

/**
 * Воспроизводит звук "улетающего ветра" (очень тихий и мягкий)
 */
function playFadeSound() {
    const actx = getAudioContext();
    const duration = 1.0; 
    const bufferSize = actx.sampleRate * duration;
    const buffer = actx.createBuffer(1, bufferSize, actx.sampleRate);
    const data = buffer.getChannelData(0);
    
    // Генерируем базовый шум
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1; 
    }

    const noise = actx.createBufferSource();
    noise.buffer = buffer;

    const filter = actx.createBiquadFilter();
    filter.type = 'lowpass';
    
    // Имитация порыва ветра
    filter.frequency.setValueAtTime(100, actx.currentTime);
    filter.frequency.linearRampToValueAtTime(800, actx.currentTime + 0.3); 
    filter.frequency.exponentialRampToValueAtTime(100, actx.currentTime + duration); 

    const gain = actx.createGain();
    
    // ДЕЛАЕМ ЗВУК НАМНОГО ТИШЕ: Пиковая громкость теперь всего 0.03 (вместо 0.15)
    gain.gain.setValueAtTime(0.001, actx.currentTime); 
    gain.gain.linearRampToValueAtTime(0.03, actx.currentTime + 0.3); // Пик громкости стал еле заметным
    gain.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + duration); 

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(actx.destination);
    
    noise.start();
}

/**
 * Звук победы (перезвон)
 */
function triggerWinAnimation() {
    const actx = getAudioContext();
    [880, 1108, 1318, 1760].forEach((freq, i) => {
        const osc = actx.createOscillator();
        const gain = actx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, actx.currentTime + i * 0.1);
        gain.gain.setValueAtTime(0.05, actx.currentTime + i * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.01, actx.currentTime + i * 0.1 + 1);
        osc.connect(gain);
        gain.connect(actx.destination);
        osc.start(actx.currentTime + i * 0.1);
        osc.stop(actx.currentTime + i * 0.1 + 1);
    });
}

/**
 * Закрывает оверлей с результатом победителя
 */
function closeWinnerOverlay() {
    const overlay = document.getElementById('winner-overlay');
    overlay.style.opacity = '0';
    setTimeout(() => {
        overlay.style.display = 'none';
        overlay.style.pointerEvents = 'none'; // Защита от случайных кликов
    }, 500);
}

/**
 * Вспомогательная функция: меняет статус фильма на "СМОТРИМ СЕЙЧАС" в Supabase
 */
async function updateMovieStatusToWatching(id) {
    try {
        const { error } = await supabaseClient
            .from('movies')
            .update({ status: 'СМОТРИМ СЕЙЧАС' })
            .eq('id', id);

        if (error) throw error;

        // Обновляем данные локально
        const movie = allMovies.find(m => m.id == id);
        if (movie) {
            movie.status = 'СМОТРИМ СЕЙЧАС';
            // ЗАСТАВЛЯЕМ САЙТ ПЕРЕРИСОВАТЬСЯ МГНОВЕННО:
            if (typeof renderNowWatching === "function") renderNowWatching();
            if (typeof applyFilters === "function") applyFilters(); 
        }
        
    } catch (err) {
        console.error("Ошибка при смене статуса на 'Смотрим сейчас':", err);
    }
}