// ==========================================
// МАТЕМАТИКА И ГРАФИКИ (math.js)
// Здесь хранятся формулы расчета рейтингов и логика отрисовки радаров
// ==========================================

/**
 * Рассчитывает средний рейтинг фильма по взвешенной системе
 * Веса: сюжет (40%) → концовка (25%) → пересмотрваемость (15%) → актеры (10%) → атмосфера (5%) → звук (5%)
 * @param {object} m - Объект фильма
 * @returns {object} { me, any, total } - Оценки для каждого пользователя и среднее
 */
function calculateRating(m) {
    const weights = { 
        plot: 0.40,           // Вес сюжета
        end: 0.25,            // Вес концовки
        rev: 0.15,            // Вес пересмотрваемости
        act: 0.10,            // Вес актерского мастерства
        atm: 0.05,            // Вес атмосферы
        mus: 0.05             // Вес музыки
    };
    
    const getValue = (val) => parseFloat(val) || 0;
    
    const getScore = (user) => 
        getValue(m['plot_'+user]) * weights.plot + 
        getValue(m['ending_'+user]) * weights.end + 
        getValue(m['reviewability_'+user]) * weights.rev + 
        getValue(m['actors_'+user]) * weights.act + 
        getValue(m['atmosphere_'+user]) * weights.atm + 
        getValue(m['music_'+user]) * weights.mus;
    
    const me = getScore('me');
    const any = getScore('any');
    
    return { 
        me, 
        any, 
        total: (me + any) / 2 
    };
}

/**
 * Отрисовывает большой график-паутину (радар) во вкладке "Статистика"
 */
function drawRadarChart(statsMe, statsAny) {
    const canvas = document.getElementById('radarCanvas');
    if (!canvas) return;

    // Настраиваем качество для Retina-дисплеев
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const radius = Math.min(centerX, centerY) - 35; // Отступ для текста

    const labels = ['СЮЖЕТ', 'КОНЦОВКА', 'ПЕРЕСМ.', 'АКТЕРЫ', 'АТМ.', 'ЗВУК'];
    const keys = ['plot', 'ending', 'reviewability', 'actors', 'atmosphere', 'music'];
    const angleStep = (Math.PI * 2) / 6;

    // 1. Рисуем сетку (паутину) из 5 уровней (оценки 2, 4, 6, 8, 10)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 9px "Segoe UI", sans-serif';

    for (let level = 1; level <= 5; level++) {
        const r = radius * (level / 5);
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = i * angleStep - Math.PI / 2; 
            const x = centerX + Math.cos(angle) * r;
            const y = centerY + Math.sin(angle) * r;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.stroke();
    }

    // 2. Рисуем оси от центра и подписи критериев
    for (let i = 0; i < 6; i++) {
        const angle = i * angleStep - Math.PI / 2;
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(x, y);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.stroke();

        // Подписи
        const labelX = centerX + Math.cos(angle) * (radius + 20);
        const labelY = centerY + Math.sin(angle) * (radius + 15);
        ctx.fillStyle = '#888';
        ctx.fillText(labels[i], labelX, labelY);
    }

    // 3. Функция отрисовки слоя данных
    function drawPolygon(data, fillStyle, strokeStyle, isDashed) {
        ctx.beginPath();
        keys.forEach((key, i) => {
            const r = radius * (data[key] / 10); 
            const angle = i * angleStep - Math.PI / 2;
            const x = centerX + Math.cos(angle) * r;
            const y = centerY + Math.sin(angle) * r;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.closePath();
        
        ctx.fillStyle = fillStyle;
        ctx.fill();
        
        if (isDashed) ctx.setLineDash([4, 4]); 
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.setLineDash([]); 
    }

    // Рисуем данные
    if (typeof currentRadarView !== 'undefined') {
        if (currentRadarView === 'any' || currentRadarView === 'both') {
            drawPolygon(statsAny, 'rgba(50, 50, 50, 0.4)', 'rgba(136, 136, 136, 0.8)', true);
        }
        if (currentRadarView === 'me' || currentRadarView === 'both') {
            drawPolygon(statsMe, 'rgba(192, 192, 192, 0.3)', 'rgba(255, 255, 255, 0.9)', false);
        }
    } else {
        // Запасной вариант, если currentRadarView еще не объявлена
        drawPolygon(statsAny, 'rgba(50, 50, 50, 0.4)', 'rgba(136, 136, 136, 0.8)', true);
        drawPolygon(statsMe, 'rgba(192, 192, 192, 0.3)', 'rgba(255, 255, 255, 0.9)', false);
    }
}

/**
 * Отрисовывает мини-радар для профиля пользователя
 */
function drawProfileRadar(stats) {
    const canvas = document.getElementById('profileRadarCanvas');
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.parentElement.getBoundingClientRect();
    if (rect.width === 0) return; 

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const radius = Math.min(centerX, centerY) - 15; 

    const labels = ['СЮЖ.', 'КОНЦ.', 'ПЕРЕС.', 'АКТ.', 'АТМ.', 'ЗВУК'];
    const keys = ['plot', 'ending', 'reviewability', 'actors', 'atmosphere', 'music'];
    const angleStep = (Math.PI * 2) / 6;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 8px "Segoe UI", sans-serif';

    // Сетка
    for (let level = 1; level <= 5; level++) {
        const r = radius * (level / 5);
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = i * angleStep - Math.PI / 2;
            const x = centerX + Math.cos(angle) * r;
            const y = centerY + Math.sin(angle) * r;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.stroke();
    }

    // Оси и текст
    for (let i = 0; i < 6; i++) {
        const angle = i * angleStep - Math.PI / 2;
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(x, y);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.stroke();

        const labelX = centerX + Math.cos(angle) * (radius + 10);
        const labelY = centerY + Math.sin(angle) * (radius + 10);
        ctx.fillStyle = '#777';
        ctx.fillText(labels[i], labelX, labelY);
    }

    // Рисуем сам многоугольник (Silver & Dark стиль)
    ctx.beginPath();
    keys.forEach((key, i) => {
        const r = radius * (stats[key] / 10); 
        const angle = i * angleStep - Math.PI / 2;
        const x = centerX + Math.cos(angle) * r;
        const y = centerY + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.closePath();
    
    ctx.fillStyle = 'rgba(192, 192, 192, 0.2)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
}