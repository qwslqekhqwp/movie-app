// ==========================================
// ГЕНЕРАЦИЯ ИНТЕРФЕЙСА (render.js)
// Сборка HTML для карточек, модальных окон, статистики и коллекций
// ==========================================

// --- МАГИЯ БЕСКОНЕЧНОГО СКРОЛЛА ---
// Создаем "наблюдателя", который сработает за 400px до того, как пользователь докрутит до конца
const scrollObserver = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
        loadMoreMovies();
    }
}, { rootMargin: "400px" }); 

/**
 * Подготавливает сетку к отрисовке и запускает первую порцию (30 шт.)
 * @param {array} movies - Отфильтрованный массив фильмов
 */
function renderMovies(movies) {
    filteredMovies = movies; // Запоминаем текущий отфильтрованный список
    moviesRenderedCount = 0; // Обнуляем счетчик
    
    const grid = document.getElementById('movie-grid'); 
    grid.innerHTML = ''; 
    
    loadMoreMovies(); // Рисуем первую партию
    
    // Включаем слежку за концом списка
    const anchor = document.getElementById('scroll-anchor');
    if (anchor) scrollObserver.observe(anchor);
}

/**
 * Дорисовывает следующие 30 карточек (срабатывает при скролле)
 */
function loadMoreMovies() {
    // Если нарисовали всё - отключаем радар
    if (moviesRenderedCount >= filteredMovies.length) {
        const anchor = document.getElementById('scroll-anchor');
        if (anchor) scrollObserver.unobserve(anchor);
        return;
    }

    const grid = document.getElementById('movie-grid');
    const fragment = document.createDocumentFragment();
    
    // Берем срез (от текущего количества + 30 штук)
    const nextBatch = filteredMovies.slice(moviesRenderedCount, moviesRenderedCount + 30);
    
    nextBatch.forEach((m, index) => {
        const r = calculateRating(m);

        const hasMe = (Number(m.plot_me || 0) + Number(m.ending_me || 0) + Number(m.actors_me || 0) + Number(m.reviewability_me || 0) + Number(m.atmosphere_me || 0) + Number(m.music_me || 0)) > 0;
        const hasAny = (Number(m.plot_any || 0) + Number(m.ending_any || 0) + Number(m.actors_any || 0) + Number(m.reviewability_any || 0) + Number(m.atmosphere_any || 0) + Number(m.music_any || 0)) > 0;

        let badgeStyle = "";
        if (hasMe && hasAny) {
            badgeStyle = "background-color: #c0c0c0; color: #111;";  
        } else if (hasMe || hasAny) {
            badgeStyle = "background: linear-gradient(90deg, #c0c0c0 50%, rgba(40, 40, 40, 0.9) 50%); color: #fff; border: none;";  
        } else {
            badgeStyle = "background-color: #1a1a1a; color: #555;";  
        }

        const dateToShow = m.updated_at || m.created_at;

        let movieBadgeHTML = '';
        if (m.status === 'Просмотрено' && (m.view_type === 'both' || m.view_type === currentRole)) {
            movieBadgeHTML = `<div class="glass-badge"><span>✓</span> ПРОСМОТРЕНО</div>`;
        } else if (m.status === 'Просмотрено' && m.view_type !== 'both' && m.view_type !== currentRole && m.view_type !== 'guest') {
            const ownerName = userNicknames[m.view_type] ? userNicknames[m.view_type].toUpperCase() : 'ДРУГ';
            movieBadgeHTML = `<div class="glass-badge"><span>🛈</span> ОЦЕНИЛ ${ownerName}</div>`;
        } else if (m.status === 'В колесе') {
            movieBadgeHTML = `<div class="glass-badge"><span>♤</span> В КОЛЕСЕ</div>`;
        } else if (m.status === 'На пересмотр') {
            movieBadgeHTML = `<div class="glass-badge"><span>⟲</span> ПЕРЕСМОТР</div>`;
        } else if (m.status === 'Не просмотрено') {
            movieBadgeHTML = `<div class="glass-badge"><span>✕</span> НЕ ПРОСМОТРЕНО</div>`;
        } else if (m.status === 'СМОТРИМ СЕЙЧАС') {
            movieBadgeHTML = `<div class="glass-badge" style="border-color: #ff3333; color: #ff3333;"><span class="nw-pulse" style="display:inline-block; width:6px; height:6px; margin-right:4px;"></span> СМОТРИМ</div>`;
        }
        
        let quickRouletteBtn = '';
        if (m.status !== 'Просмотрено') {
            const isRoulette = m.status === 'В колесе';
            quickRouletteBtn = `<div class="quick-roulette-btn desktop-only" onclick="event.stopPropagation(); toggleRouletteDirectly('${m.id}')" title="${isRoulette ? 'Убрать из рулетки' : 'В рулетку'}">${isRoulette ? '✕' : '♤'}</div>`;
        }

        const card = document.createElement('div');
        card.className = 'card';
        // Каскадная анимация только для первых 30 элементов, чтобы при скролле не было скачков
        card.style.animationDelay = moviesRenderedCount === 0 ? `${index * 0.05}s` : '0s'; 
        card.onclick = () => openModalById(m.id);
        
        card.innerHTML = `
            ${movieBadgeHTML}
            ${quickRouletteBtn}
            
            <div class="card-overlay">
                <div class="overlay-score-item">
                    <div class="overlay-label">${userNicknames.me.toUpperCase()}</div>
                    <div class="overlay-val">${r.me.toFixed(1)}</div>
                </div>
                <div style="width: 30px; height: 1px; background: rgba(255,255,255,0.1); margin: 5px 0;"></div>
                <div class="overlay-score-item">
                    <div class="overlay-label">${userNicknames.any.toUpperCase()}</div>
                    <div class="overlay-val">${r.any.toFixed(1)}</div>
                </div>
            </div>

            <img src="${m.poster || 'https://via.placeholder.com/180x260?text=No+Poster'}" loading="lazy" alt="${m.title}">
            <div class="card-info">
                <div class="card-top-content">
                    <h3 style="margin: 0 0 8px 0; font-size: 0.9rem; line-height: 1.2; min-height: 2.4em; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis;" title="${m.title}">${m.title}</h3>
                    <span class="rating-badge" style="${badgeStyle}">${r.total.toFixed(1)}</span>
                </div>
                <div class="card-date">Обновлено: ${formatDate(dateToShow)}</div>
            </div>`;
            
        fragment.appendChild(card);
    });
    
    grid.appendChild(fragment);
    moviesRenderedCount += 30; // Увеличиваем счетчик
}

/**
 * Рендерит содержимое модального окна
 * Показывает информацию о фильме, ползунки оценок и поле для комментария
 * @param {object} m - Объект фильма
 */
function renderModalContent(m) {
    const body = document.getElementById('modal-body');
    const r = calculateRating(m);
    const dateToShow = m.updated_at || m.created_at;
    const isViewed = m.status === 'Просмотрено';

    body.innerHTML = `
        <div style="display:flex; gap:20px; margin-bottom:20px; position: relative;">
            <img src="${m.poster || ''}" style="width:120px; height:180px; object-fit:cover; border-radius:10px; border:1px solid #333;">
            <div style="flex:1">
                ${isEditMode ? `
                    <input type="text" id="edit-title" value="${m.title}" placeholder="Название">
                    <input type="text" id="edit-poster" value="${m.poster || ''}" placeholder="URL постера">
                    <input type="text" id="edit-year" value="${m.year || ''}" placeholder="Год">
                    <input type="number" id="edit-duration" value="${m.duration || ''}" placeholder="Длительность (мин)">
                    <input type="text" id="edit-genre" value="${m.genre || ''}" placeholder="Жанр">
                    <input type="text" id="edit-producer" value="${m.producer || ''}" placeholder="Режиссер">
                    <input type="text" id="edit-actors" value="${m.actors || ''}" placeholder="Актеры">
                    <input type="text" id="edit-external-rating" value="${m.external_rating || ''}" placeholder="Рейтинг TMDB">
                    <input type="text" id="edit-collection" list="collection-list" value="${m.collection || ''}" placeholder="Название коллекции (франшизы)" autocomplete="off">
                    <div class="score-group">
                        <label style="font-size: 0.7rem; color: #666; display: block; margin-bottom: 5px;">РЕЙТИНГ КИНОПОИСКА</label>
                        <input type="number" id="edit-kp-rating" value="${m.kp_rating || ''}" step="0.1" style="margin-bottom: 0;">
                    </div>
                ` : `
                    <h2 style="margin:0;">${m.title}</h2>
                    <p style="color:#888; font-size:0.8rem; margin:5px 0;">${m.year || ''} • ${m.genre || ''} ${m.duration ? '• ' + m.duration + ' мин' : ''}</p>
                    <div style="display: flex; align-items: center; gap: 8px; margin: 5px 0;">
                        <span style="background: #E1B22E; color: #000; padding: 2px 5px; border-radius: 4px; font-weight: bold; font-size: 0.6rem;">TMDB</span>
                        <span style="font-size: 0.9rem; color: #fff;">${m.external_rating || '—'}</span>
                        <span style="background: #ef7f1a; color: #000; padding: 2px 5px; border-radius: 4px; font-weight: bold; font-size: 0.6rem;">КП</span>
                        <span style="font-size: 0.9rem; color: #fff;">${m.kp_rating || '—'}</span>
                    </div>
                    <p style="color:#666; font-size:0.7rem; margin:2px 0;">Режиссер: ${m.producer || '—'}</p>
                    <p style="color:#666; font-size:0.7rem; margin:2px 0;">В ролях: ${m.actors || '—'}</p>
                `}

                <div style="display: flex; gap: 10px; margin-top: 15px;">
                    <div onclick="toggleMovieStatus()" 
                         style="display: inline-flex; align-items: center; gap: 8px; cursor: pointer; padding: 8px 15px; border-radius: 12px; 
                                border: 1px solid ${isViewed ? '#ccc' : '#444'}; 
                                background: ${isViewed ? 'rgba(255, 255, 255, 0.08)' : 'transparent'}; 
                                transition: all 0.3s ease;">
                        <span id="status-icon" style="color: ${isViewed ? '#ccc' : '#666'}; font-size: 1.1rem;">${isViewed ? '✓' : '○'}</span>
                        <span id="status-text" style="font-size: 0.75rem; color: ${isViewed ? '#fff' : '#888'}; font-weight: ${isViewed ? 'bold' : 'normal'}; text-transform: uppercase;">
                            ${isViewed ? 'Просмотрено' : 'Не просмотрено'}
                        </span>
                    </div>

                    ${!isViewed ? `
                    <div onclick="toggleRouletteDirectly('${m.id}', true)" 
                         style="display: inline-flex; align-items: center; gap: 8px; cursor: pointer; padding: 8px 15px; border-radius: 12px; 
                                border: 1px solid ${m.status === 'В колесе' ? '#c0c0c0' : '#444'}; 
                                background: ${m.status === 'В колесе' ? '#c0c0c0' : 'transparent'}; 
                                transition: all 0.3s ease;">
                        <span style="font-size: 1.1rem;">♤</span>
                        <span style="font-size: 0.75rem; color: ${m.status === 'В колесе' ? '#000' : '#888'}; font-weight: bold; text-transform: uppercase;">
                            ${m.status === 'В колесе' ? 'В колесе' : 'В рулетку'}
                        </span>
                    </div>
                    ` : ''}
                    <input type="hidden" id="edit-status" value="${m.status}">
                </div>

                ${m.view_type !== 'both' && m.view_type !== 'guest' ? `
                    ${m.view_type !== currentRole ? `
                        <div style="background: rgba(192, 192, 192, 0.05); border: 1px dashed #333; padding: 15px; border-radius: 12px; margin: 15px 0; text-align: center;">
                            <p style="font-size: 0.7rem; color: #888; text-transform: uppercase; margin-bottom: 10px;">Этот фильм посмотрел только ${userNicknames[m.view_type] || 'Друг'}</p>
                            <button onclick="joinMovie()" style="background: #c0c0c0; color: #000; border: none; padding: 8px 15px; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 0.7rem; text-transform: uppercase;">
                                Я тоже посмотрел!
                            </button>
                        </div>
                    ` : `
                        <div style="margin: 15px 0; text-align: center;">
                            <span style="font-size: 0.6rem; color: #555; text-transform: uppercase; letter-spacing: 1px;">Это ваш соло-просмотр</span>
                        </div>
                    `}
                ` : ''}

                <br>
                <button onclick='toggleEditMode()' style="font-size:0.6rem; background:none; border:1px solid #333; color:#555; cursor:pointer; padding:4px 8px; border-radius:4px; margin-top:10px;">
                    ${isEditMode ? 'ОТМЕНИТЬ ПРАВКУ' : 'ИЗМЕНИТЬ ДАННЫЕ'}
                </button>
            </div>
        </div>


        <div class="total-score-big" style="text-align: center;">
            <h2 id="total-val">${r.total.toFixed(1)}</h2>
        </div>

        <div style="display: flex; flex-direction: column; gap: 20px;">
            <div>
                <p style="text-align:center; font-size:0.7rem; color:#c0c0c0; text-transform:uppercase; margin-bottom:10px;">ОЦЕНКА <span onclick="openProfileModal('me')" style="cursor:pointer; text-decoration:underline; text-underline-offset:3px; transition: color 0.2s;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#c0c0c0'">${userNicknames.me.toUpperCase()}</span>: ${r.me.toFixed(1)}</p>
                <div class="${currentRole !== 'me' ? 'locked-group' : ''}">
                    ${renderSliders(m, 'me')}
                </div>
            </div>
            <div style="border-top: 1px solid #222; padding-top: 20px;">
                <p style="text-align:center; font-size:0.7rem; color:#c0c0c0; text-transform:uppercase; margin-bottom:10px;">ОЦЕНКА <span onclick="openProfileModal('any')" style="cursor:pointer; text-decoration:underline; text-underline-offset:3px; transition: color 0.2s;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#c0c0c0'">${userNicknames.any.toUpperCase()}</span>: ${r.any.toFixed(1)}</p>
                <div class="${currentRole !== 'any' ? 'locked-group' : ''}">
                    ${renderSliders(m, 'any')}
                </div>
            </div>
        </div>

        <textarea id="review-common" placeholder="Общий комментарий..." style="margin-top:20px;" ${currentRole === 'guest' ? 'disabled' : ''}>${m.review_common || ''}</textarea>
        
        ${currentRole !== 'guest' ? `
            <button onclick="saveRatings()" class="save-btn" style="margin-top:15px;">СОХРАНИТЬ</button>
            <button onclick="deleteMovie()" style="background:none; color:#333; border:none; width:100%; margin-top:10px; cursor:pointer; font-size:0.7rem;">УДАЛИТЬ ФИЛЬМ</button>
        ` : `
            <div style="text-align:center; padding:12px; color:#888; border:1px dashed #333; border-radius:10px; margin-top:20px; font-size:0.7rem; text-transform:uppercase;">
                В режиме гостя редактирование запрещено
            </div>
        `}
        
        <div style="text-align:center; color:#333; font-size:0.6rem; margin-top:15px; text-transform:uppercase; letter-spacing:1px;">
            Последнее изменение: ${formatDate(dateToShow)}
        </div>
    `;
}

/**
 * Рендерит ползунки оценок для определенного пользователя
 * @param {object} m - Объект фильма
 * @param {string} role - Роль пользователя ('me' или 'any')
 * @returns {string} HTML с ползунками
 */
function renderSliders(m, role) {
    const isLocked = (role !== currentRole);
    const fields = ['plot', 'ending', 'reviewability', 'actors', 'atmosphere', 'music'];
    const labels = ['СЮЖЕТ', 'КОНЦОВКА', 'ПЕРЕСМ.', 'АКТЕРЫ', 'АТМОСФЕРА', 'ЗВУК'];
    
    return fields.map((f, i) => {
        const v = m[f + '_' + role] || 0;
        return `
            <div class="score-group" style="margin-bottom:12px; background: #111; padding: 10px; border-radius: 8px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                    <span style="font-size:0.7rem; color:#777; letter-spacing:1px;">${labels[i]}</span>
                    <span id="val-${f}_${role}" style="font-weight:bold; color:#c0c0c0; font-size:0.9rem;">${v}</span>
                </div>
                <input type="range" min="0" max="10" step="1" value="${v}" 
                    ${isLocked ? 'disabled' : ''} 
                    style="width:100%;" 
                    oninput="document.getElementById('val-${f}_${role}').innerText=this.value; updateLiveRating();" 
                    id="input-${f}_${role}">
            </div>`;
    }).join('');
}

/**
 * Генерирует и отображает статистику по всем просмотренным фильмам
 * Показывает средний рейтинг, жанры, топ лучших/худших фильмов и другие метрики
 */

function generateStatistics() {
    const container = document.getElementById('stats-container');
    // В общую статистику теперь идут ТОЛЬКО совместные фильмы ('both')
    const viewed = allMovies.filter(m => m.status === 'Просмотрено' && m.view_type === 'both');
    
    if (!viewed.length) {
        container.innerHTML = "<p style='text-align:center; color:#555;'>Нет данных.</p>";
        return;
    }
    
    // БАЗОВЫЕ МЕТРИКИ
    const avgScore = (viewed.reduce((acc, m) => acc + calculateRating(m).total, 0) / viewed.length).toFixed(1);
    const totalMinutes = viewed.reduce((acc, m) => acc + (parseInt(m.duration) || 0), 0);
    const totalMoviesCount = viewed.length;
    
    const longest = viewed.reduce((p, c) => (parseInt(c.duration || 0) > parseInt(p.duration || 0)) ? c : p);
    const oldest = viewed.reduce((p, c) => (parseInt(c.year || 3000) < parseInt(p.year || 3000)) ? c : p);

    // ==========================================
    // СОВМЕСТИМОСТЬ ВКУСОВ 
    // ==========================================
    const bothRated = viewed.filter(m => {
        const hasMe = (Number(m.plot_me||0) + Number(m.ending_me||0) + Number(m.actors_me||0) + Number(m.reviewability_me||0) + Number(m.atmosphere_me||0) + Number(m.music_me||0)) > 0;
        const hasAny = (Number(m.plot_any||0) + Number(m.ending_any||0) + Number(m.actors_any||0) + Number(m.reviewability_any||0) + Number(m.atmosphere_any||0) + Number(m.music_any||0)) > 0;
        return hasMe && hasAny;
    });

    let matchHTML = "";
    
    if (bothRated.length > 0) {
        let totalDiff = 0;
        let sumMe = 0;
        let sumAny = 0;

        bothRated.forEach(m => {
            const r = calculateRating(m);
            sumMe += r.me;
            sumAny += r.any;
            totalDiff += Math.abs(r.me - r.any);
        });

        const count = bothRated.length;
        const avgDiff = totalDiff / count;
        
        let matchPercent = Math.round(100 - (avgDiff * 10));
        if (matchPercent < 0) matchPercent = 0;

        const avgMe = (sumMe / count).toFixed(2);
        const avgAny = (sumAny / count).toFixed(2);

        let verdict = "";
        const diffAvg = Math.abs(avgMe - avgAny).toFixed(2);
        if (avgMe > avgAny) verdict = `«${userNicknames.any}» судит фильмы строже в среднем на ${diffAvg} балла.`;
        else if (avgAny > avgMe) verdict = `«${userNicknames.me}» судит фильмы строже в среднем на ${diffAvg} балла.`;
        else verdict = "В среднем вы оцениваете фильмы абсолютно одинаково.";

        const mostAgreed = bothRated.reduce((p, c) => Math.abs(calculateRating(c).me - calculateRating(c).any) < Math.abs(calculateRating(p).me - calculateRating(p).any) ? c : p);
        const mostDisagreed = bothRated.reduce((p, c) => Math.abs(calculateRating(c).me - calculateRating(c).any) > Math.abs(calculateRating(p).me - calculateRating(p).any) ? c : p);

        const agreedDiff = Math.abs(calculateRating(mostAgreed).me - calculateRating(mostAgreed).any).toFixed(2);
        const disagreedDiff = Math.abs(calculateRating(mostDisagreed).me - calculateRating(mostDisagreed).any).toFixed(2);

        matchHTML = `
        <div class="match-container">
            <h2 class="match-percent">${matchPercent}%</h2>
            <div class="match-label">СОВПАДЕНИЕ ВКУСОВ</div>

            <div class="match-stats">
                <div class="match-user">
                    <h4 onclick="openProfileModal('me')" style="cursor:pointer; text-decoration:underline; text-underline-offset:3px; transition:color 0.2s;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#666'">${userNicknames.me}</h4>
                    <div class="match-score">${avgMe}</div>
                </div>
                <div class="match-user">
                    <h4 onclick="openProfileModal('any')" style="cursor:pointer; text-decoration:underline; text-underline-offset:3px; transition:color 0.2s;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#666'">${userNicknames.any}</h4>
                    <div class="match-score">${avgAny}</div>
                </div>
            </div>

            <div class="match-verdict">${verdict}</div>

            <div class="match-extremes">
                <div class="match-card">
                    <div class="match-card-title">🤝 Единогласие</div>
                    <div class="match-card-movie">${mostAgreed.title}</div>
                    <div class="match-card-diff">Разница: ${agreedDiff} балла</div>
                </div>
                <div class="match-card">
                    <div class="match-card-title">👾 Разногласие</div>
                    <div class="match-card-movie">${mostDisagreed.title}</div>
                    <div class="match-card-diff">Разница: ${disagreedDiff} балла</div>
                </div>
            </div>
        </div>`;

        // === НОВЫЙ КОД: РАСЧЕТ ДЛЯ ГРАФИКА-ПАУТИНЫ ===
        let sMe = { plot: 0, ending: 0, reviewability: 0, actors: 0, atmosphere: 0, music: 0 };
        let sAny = { plot: 0, ending: 0, reviewability: 0, actors: 0, atmosphere: 0, music: 0 };
        
        bothRated.forEach(m => {
            sMe.plot += Number(m.plot_me||0); sMe.ending += Number(m.ending_me||0); sMe.reviewability += Number(m.reviewability_me||0);
            sMe.actors += Number(m.actors_me||0); sMe.atmosphere += Number(m.atmosphere_me||0); sMe.music += Number(m.music_me||0);
            
            sAny.plot += Number(m.plot_any||0); sAny.ending += Number(m.ending_any||0); sAny.reviewability += Number(m.reviewability_any||0);
            sAny.actors += Number(m.actors_any||0); sAny.atmosphere += Number(m.atmosphere_any||0); sAny.music += Number(m.music_any||0);
        });
        
        // Делим на количество фильмов, чтобы получить среднее
        for(let k in sMe) sMe[k] /= count;
        for(let k in sAny) sAny[k] /= count;

        // Добавляем HTML-контейнер для графика
        matchHTML += `
        <div style="background:#161616; padding:20px; border-radius:15px; border:1px solid #2a2a2a; margin-bottom:30px; text-align:center;">
            <h3 style="font-size:0.7rem; color:#555; text-transform:uppercase; letter-spacing:2px; margin:0 0 20px 0;">ДЕТАЛЬНЫЙ РАЗБОР ВКУСОВ</h3>
            <div style="position:relative; width:100%; max-width:350px; margin:0 auto; aspect-ratio:1/1;">
                <canvas id="radarCanvas" style="width:100%; height:100%;"></canvas>
            </div>
            <div class="match-stats">
                <div class="match-user">
                    <h4>${userNicknames.me}</h4>
                    <div class="match-score">${avgMe}</div>
                </div>
                <div class="match-user">
                    <h4>${userNicknames.any}</h4>
                    <div class="match-score">${avgAny}</div>
                </div>
            </div>
        </div>`;
        
        // Сохраняем данные временно, чтобы нарисовать график после загрузки HTML
        window.radarData = { me: sMe, any: sAny };
        // ===============================================
    }

    // ==========================================
    // ЖАНРЫ И ТОПЫ (НОВЫЙ БЛОК С МЕДАЛЯМИ)
    // ==========================================
    
    const genreData = {};
    viewed.forEach(m => {
        if (m.genre) {
            m.genre.split(',').forEach(g => {
                const name = g.trim().toUpperCase(); // Приводим к верхнему регистру для точной группировки
                if (!genreData[name]) genreData[name] = { count: 0, totalScore: 0 };
                genreData[name].count++;
                genreData[name].totalScore += calculateRating(m).total;
            });
        }
    });

    // Оставляем только ТОП-10 жанров
    const sortedGenres = Object.entries(genreData)
        .map(([name, data]) => ({
            name,
            count: data.count,
            avg: data.totalScore / data.count,
            score: (data.totalScore / data.count) * (1 + Math.log10(data.count))
        }))
        .sort((a, b) => b.score - a.score);

    // Ищем максимальный балл для 100% полоски
    const maxScore = sortedGenres.length > 0 ? sortedGenres[0].score : 1;

    // ==========================================
    // НОВЫЕ РАСЧЕТЫ ДЛЯ "ИНТЕРЕСНО, ЧТО..."
    // ==========================================
    
    // 1. Любимый режиссер
    const directors = {};
    viewed.forEach(m => {
        if (m.producer) {
            const prod = m.producer.trim();
            if (!directors[prod]) directors[prod] = { count: 0, sum: 0 };
            directors[prod].count++;
            directors[prod].sum += calculateRating(m).total;
        }
    });
    
    let bestDirector = { name: '—', avg: 0 };
    for (const [name, data] of Object.entries(directors)) {
        const avg = data.sum / data.count;
        if (avg > bestDirector.avg) bestDirector = { name, avg };
    }

    // Вспомогательная функция для получения оценки мира (КП в приоритете)
    const getWorldRating = (m) => parseFloat(m.kp_rating) || parseFloat(m.external_rating) || 0;

    // 2. Скрытый шедевр и Главное разочарование
    let hiddenGem = { title: '—', diff: -999, our: 0, world: 0 };
    let disappointment = { title: '—', diff: -999, our: 0, world: 0 };

    viewed.forEach(m => {
        const ourScore = calculateRating(m).total;
        const worldScore = getWorldRating(m);
        
        if (worldScore > 0) { // Считаем, только если есть оценка от мира
            // Скрытый шедевр (Наша оценка ВЫШЕ мировой)
            const gemDiff = ourScore - worldScore;
            if (gemDiff > hiddenGem.diff) {
                hiddenGem = { title: m.title, diff: gemDiff, our: ourScore, world: worldScore };
            }
            
            // Разочарование (Мировая оценка ВЫШЕ нашей)
            const disapDiff = worldScore - ourScore;
            if (disapDiff > disappointment.diff) {
                disappointment = { title: m.title, diff: disapDiff, our: ourScore, world: worldScore };
            }
        }
    });
    // ==========================================

    // Генерируем HTML полосок
    const genreBarsHTML = sortedGenres.map((g, index) => {
        const relativeWidth = (g.score / maxScore) * 100;
        
        let medalClass = "";
        if (index === 0) medalClass = "bar-gold";
        else if (index === 1) medalClass = "bar-silver";
        else if (index === 2) medalClass = "bar-bronze";

        return `
            <div class="genre-item">
                <div class="genre-name" style="${index < 3 ? 'color: #fff; font-weight: bold;' : ''}">
                    ${g.name}
                </div>
                <div class="genre-track">
                    <div class="genre-fill ${medalClass}" style="width: ${relativeWidth}%"></div>
                </div>
                <div class="genre-info">
                    <span style="color: #eee;">${g.avg.toFixed(1)} ★</span> 
                    <span style="color: #444; font-size: 0.6rem;">(${g.count})</span>
                </div>
            </div>
        `;
    }).join('');

    const renderMiniList = (movies, label, isBest = false) => `
        <div style="background:#161616; padding:20px; border-radius:15px; border:1px solid #2a2a2a; height: 100%;">
            <h3 style="font-size:0.7rem; color:#555; text-transform:uppercase; letter-spacing:2px; margin:0 0 15px 0;">${label}</h3>
            ${movies.map((m, i) => {
                let bS = "background: #2a2a2a; color: #fff;"; 
                if (isBest && i === 0) bS = "background: linear-gradient(145deg, #bf953f, #fcf6ba, #b38728); color: #000;";
                else if (isBest && i === 1) bS = "background: linear-gradient(145deg, #959595, #ffffff, #707070); color: #000;";
                else if (isBest && i === 2) bS = "background: linear-gradient(145deg, #804a00, #ecaa7e, #a45d10); color: #fff;";
                return `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; font-size:0.85rem;">
                    <span style="color:#555; font-weight:bold; width:15px;">${i+1}.</span>
                    <span style="flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin:0 10px;">${m.title}</span>
                    <span style="${bS} padding:3px 8px; border-radius:6px; font-weight:900; font-size:0.75rem;">${calculateRating(m).total.toFixed(1)}</span>
                </div>`;
            }).join('')}
        </div>`;

    container.innerHTML = `
        <h3 class="stats-group-title">ОБЩАЯ СТАТИСТИКА</h3>
        <div class="stats-grid-main">
            <div style="background:#161616; padding:15px; border-radius:20px; text-align:center; border:1px solid #2a2a2a;">
                <p style="color:#555; font-size:0.6rem; margin:0;">ФИЛЬМОВ</p>
                <h2 style="font-size:1.8rem; margin:5px 0;">${totalMoviesCount}</h2>
            </div>
            <div style="background:#161616; padding:15px; border-radius:20px; text-align:center; border:1px solid #2a2a2a;">
                <p style="color:#555; font-size:0.6rem; margin:0;">СРЕДНИЙ БАЛЛ</p>
                <h2 style="font-size:1.8rem; margin:5px 0;">${avgScore}</h2>
            </div>
            <div style="background:#161616; padding:15px; border-radius:20px; text-align:center; border:1px solid #2a2a2a;">
                <p style="color:#555; font-size:0.6rem; margin:0;">ВРЕМЯ В КИНО</p>
                <h2 style="font-size:1.8rem; margin:5px 0;">${Math.floor(totalMinutes/60)}<span style="font-size:0.8rem;">ч</span> ${totalMinutes%60}<span style="font-size:0.8rem;">м</span></h2>
            </div>
        </div>

        ${matchHTML}

        <h3 class="stats-group-title">ИНТЕРЕСНО, ЧТО...</h3>
        <div class="stats-grid-records">
            <div class="record-card">
                <p style="font-size:0.55rem; color:#555; margin:0 0 8px 0;">САМЫЙ ДОЛГИЙ</p>
                <div style="font-size:0.85rem;">${longest.title}</div>
                <span>${longest.duration || 0} мин</span>
            </div>
            <div class="record-card">
                <p style="font-size:0.55rem; color:#555; margin:0 0 8px 0;">САМЫЙ СТАРЫЙ</p>
                <div style="font-size:0.85rem;">${oldest.title}</div>
                <span>${oldest.year || '—'} год</span>
            </div>
            <div class="record-card">
                <p style="font-size:0.55rem; color:#555; margin:0 0 8px 0;">ЛЮБИМЫЙ ЖАНР</p>
                <div style="font-size:0.85rem;">${sortedGenres.length ? sortedGenres[0].name : '—'}</div>
                <span>Ср. балл: ${sortedGenres.length ? sortedGenres[0].avg.toFixed(1) : '—'}</span>
            </div>
            
            <div class="record-card">
                <p style="font-size:0.55rem; color:#555; margin:0 0 8px 0;">ЛЮБИМЫЙ РЕЖИССЕР</p>
                <div style="font-size:0.85rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${bestDirector.name}">${bestDirector.name}</div>
                <span>Ср. балл: ${bestDirector.avg.toFixed(1)}</span>
            </div>
            <div class="record-card">
                <p style="font-size:0.55rem; color:#555; margin:0 0 8px 0;">СКРЫТЫЙ ШЕДЕВР</p>
                <div style="font-size:0.85rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${hiddenGem.title}">${hiddenGem.title}</div>
                <span>Вы: ${hiddenGem.our.toFixed(1)} | Мир: ${hiddenGem.world.toFixed(1)}</span>
            </div>
            <div class="record-card">
                <p style="font-size:0.55rem; color:#555; margin:0 0 8px 0;">РАЗОЧАРОВАНИЕ</p>
                <div style="font-size:0.85rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${disappointment.title}">${disappointment.title}</div>
                <span>Вы: ${disappointment.our.toFixed(1)} | Мир: ${disappointment.world.toFixed(1)}</span>
            </div>
        </div>

        <h3 class="stats-group-title">РЕЙТИНГ ЖАНРОВ</h3>
        <div class="genre-bar-container">
            ${genreBarsHTML}
        </div>

        <div class="stats-grid-tops">
            ${renderMiniList([...viewed].sort((a,b)=>calculateRating(b).total-calculateRating(a).total).slice(0,5), "🔥 ТОП ЛУЧШИХ", true)}
            ${renderMiniList([...viewed].sort((a,b)=>calculateRating(a).total-calculateRating(b).total).slice(0,5), "💀 ТОП ХУДШИХ", false)}
        </div>`;

        // Запускаем рисование радара, если для него есть данные
    if (bothRated.length > 0 && window.radarData) {
        drawRadarChart(window.radarData.me, window.radarData.any);
    }
}

function renderCollections() {
    const grid = document.getElementById('collections-grid');
    grid.innerHTML = '';
    const collectionsMap = {};

    // Группируем фильмы по полю collection
    allMovies.forEach(m => {
        if (m.collection && m.collection.trim() !== '') {
            const cName = m.collection.trim().toUpperCase();
            if (!collectionsMap[cName]) collectionsMap[cName] = [];
            collectionsMap[cName].push(m);
        }
    });

    const fragment = document.createDocumentFragment();

    Object.keys(collectionsMap).sort().forEach(cName => {
        const cMovies = collectionsMap[cName];
        // Сортируем фильмы внутри папки по году
        cMovies.sort((a, b) => parseInt(a.year || 3000) - parseInt(b.year || 3000));
        
        let totalScore = 0; let countRated = 0; let countWatched = 0;
        cMovies.forEach(m => {
            if (m.status === 'Просмотрено') countWatched++;
            const r = calculateRating(m).total;
            if (r > 0) { totalScore += r; countRated++; }
        });

        const avg = countRated > 0 ? (totalScore / countRated).toFixed(2) : "0.00";
        
        // Достаем постеры (до 3 штук для красивой стопки)
        let postersHTML = '';
        const posters = cMovies.map(m => m.poster).filter(p => p).slice(0, 3);
        if (posters.length === 1) postersHTML = `<img src="${posters[0]}" style="z-index: 2; width: 110px; height: 165px; transform: none;">`;
        else if (posters.length === 2) postersHTML = `<img src="${posters[0]}"><img src="${posters[1]}">`;
        else if (posters.length >= 3) postersHTML = `<img src="${posters[0]}"><img src="${posters[1]}"><img src="${posters[2]}">`;

        const card = document.createElement('div');
        card.className = 'collection-card';
        card.onclick = () => openCollectionModal(cName, cMovies);
        card.innerHTML = `
            <div class="collection-posters">${postersHTML}</div>
            <h3 style="margin: 0 0 10px 0; font-size: 0.95rem; color: #fff; text-transform: uppercase; letter-spacing: 1px;">${cName}</h3>
            <div style="background: #1a1a1a; padding: 10px; border-radius: 8px; font-size: 0.75rem; color: #888; text-align: left; border: 1px solid #333;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;"><span>Фильмов:</span> <span style="color:#fff; font-weight:bold;">${cMovies.length}</span></div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;"><span>Просмотрено:</span> <span style="color:#fff; font-weight:bold;">${countWatched}</span></div>
                <div style="display: flex; justify-content: space-between;"><span>Ср. балл:</span> <span style="color:#c0c0c0; font-weight:900; font-size:0.85rem;">${avg}</span></div>
            </div>
        `;
        fragment.appendChild(card);
    });

    if (Object.keys(collectionsMap).length === 0) {
        grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #666; padding: 40px; text-transform: uppercase;">Нет коллекций. Добавьте название коллекции при редактировании фильма.</div>';
    } else {
        grid.appendChild(fragment);
    }
}

/**
 * Ищет фильм со статусом "СМОТРИМ СЕЙЧАС" и отрисовывает баннер сверху
 */
function renderNowWatching() {
    const container = document.getElementById('now-watching-container');
    if (!container) return;

    // Ищем фильм с нужным статусом
    const activeMovie = allMovies.find(m => m.status === 'СМОТРИМ СЕЙЧАС');

    // Если такого фильма нет - очищаем контейнер и выходим
    if (!activeMovie) {
        container.innerHTML = '';
        return;
    }

    // Если фильм есть - рисуем баннер
    container.innerHTML = `
        <div class="now-watching-banner">
            <div class="nw-info">
                <div class="nw-status">
                    <div class="nw-pulse"></div>
                    СМОТРИМ СЕЙЧАС
                </div>
                <h2 class="nw-title">${activeMovie.title}</h2>
            </div>
            <div class="nw-actions">
                <button class="nw-btn-finish" onclick="finishWatching('${activeMovie.id}')">ЗАВЕРШИТЬ ПРОСМОТР</button>
                <button class="nw-btn-cancel" onclick="cancelWatching('${activeMovie.id}')">ОТМЕНИТЬ</button>
            </div>
        </div>
    `;
}