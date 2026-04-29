// ==========================================
// 3. АУТЕНТИФИКАЦИЯ
// ==========================================

let selectedAuthEmail = null; // Запоминаем, кто пытается войти

/**
 * Проверяет статус аутентификации и обновляет никнеймы на кнопках входа
 */
async function checkAuth() {
    const savedRole = localStorage.getItem('movie_role');
    const savedData = localStorage.getItem('movie_user_data'); 
    
    // 1. Сначала быстро берем имена из памяти (чтобы кнопки не были пустыми ни секунды)
    const knownMe = localStorage.getItem('known_name_me');
    const knownAny = localStorage.getItem('known_name_any');
    if (knownMe) document.getElementById('btn-login-me').innerText = knownMe.toUpperCase();
    if (knownAny) document.getElementById('btn-login-any').innerText = knownAny.toUpperCase();

    // 2. Сразу идем в базу за самыми свежими данными (на случай, если никнейм изменили)
    try {
        const { data: users, error } = await supabaseClient.from('users').select('role, nickname');
        if (!error && users) {
            users.forEach(u => {
                const btn = document.getElementById(`btn-login-${u.role}`);
                if (btn) {
                    btn.innerText = u.nickname.toUpperCase();
                    // Сохраняем в память, чтобы при следующем рефреше имя появилось мгновенно
                    localStorage.setItem(`known_name_${u.role}`, u.nickname);
                }
            });
        }
    } catch (e) {
        console.log("Ники не подгрузились, используем стандартные");
    }
    
    // 3. Решаем, показывать экран входа или сразу пускать в приложение
    if (savedRole && savedData) {
        currentRole = savedRole;
        currentUserData = JSON.parse(savedData); 
        
        document.getElementById('auth-screen').style.display = 'none';
        updateUserProfileUI(); 
        fetchMovies(); 
    } else {
        document.getElementById('auth-screen').style.display = 'flex';
    }
    // Запускаем проверку ленты активности
    if (typeof checkNewActivity === 'function') setTimeout(checkNewActivity, 1500);
}

/**
 * Выбор пользователя на экране входа (анимация кнопок)
 */
function selectUser(role, email, btn) {
    selectedAuthEmail = email;
    
    // Сбрасываем стили обеих кнопок
    document.getElementById('btn-login-me').style.background = 'transparent';
    document.getElementById('btn-login-me').style.color = '#c0c0c0';
    document.getElementById('btn-login-any').style.background = 'transparent';
    document.getElementById('btn-login-any').style.color = '#c0c0c0';

    // Подсвечиваем выбранную кнопку стилем Silver
    btn.style.background = '#c0c0c0';
    btn.style.color = '#000';

    // Плавно показываем поле для пароля
    const passSection = document.getElementById('password-section');
    passSection.style.display = 'block';
    // Фокусируемся на поле ввода, чтобы можно было сразу печатать
    setTimeout(() => document.getElementById('secret-code').focus(), 100);
}

/**
 * Вход через Supabase Auth
 */
async function login() {
    const code = document.getElementById('secret-code').value.trim();
    if (!selectedAuthEmail) return showToast("ВЫБЕРИТЕ ПРОФИЛЬ", "warning");
    if (!code) return showToast("ВВЕДИТЕ ПАРОЛЬ", "warning");

    const submitBtn = document.getElementById('login-submit-btn');
    submitBtn.innerText = "ЗАГРУЗКА...";
    submitBtn.disabled = true;

    try {
        // НОВАЯ СИСТЕМА: Запрашиваем вход у Supabase
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: selectedAuthEmail,
            password: code
        });

        if (error) {
            showToast("НЕВЕРНЫЙ ПАРОЛЬ", "error");
            submitBtn.innerText = "ВОЙТИ";
            submitBtn.disabled = false;
            return;
        }

        // Если пароль верный, определяем роль
        currentRole = selectedAuthEmail === 'me@movie.local' ? 'me' : 'any';

        // Скачиваем актуальный никнейм и аватарку из базы данных
        const { data: userData } = await supabaseClient.from('users').select('*').eq('role', currentRole).single();

        currentUserData = userData || { role: currentRole, nickname: currentRole, avatar_url: '' };

        // Сохраняем данные для сессии
        localStorage.setItem('movie_role', currentRole);
        localStorage.setItem('movie_user_data', JSON.stringify(currentUserData));
        
        // Запоминаем имена для кнопок входа на будущее
        localStorage.setItem(`known_name_${currentRole}`, currentUserData.nickname);

        document.getElementById('auth-screen').style.display = 'none';
        updateUserProfileUI(); 
        showToast(`ДОБРО ПОЖАЛОВАТЬ, ${currentUserData.nickname.toUpperCase()}!`, "success");
        
        await fetchMovies(); 

    } catch (err) {
        console.error("Ошибка входа:", err);
        showToast("ОШИБКА СЕТИ", "error");
        submitBtn.innerText = "ВОЙТИ";
        submitBtn.disabled = false;
    }
}

/**
 * Вход в режиме гостя (только чтение)
 */
function loginAsGuest() {
    currentRole = 'guest';
    // Создаем виртуальные данные для гостя (в базу они не сохраняются)
    currentUserData = { role: 'guest', nickname: 'Гость', avatar_url: '' };

    localStorage.setItem('movie_role', currentRole);
    localStorage.setItem('movie_user_data', JSON.stringify(currentUserData));

    document.getElementById('auth-screen').style.display = 'none';
    
    updateUserProfileUI();
    showToast("ВЫ ВОШЛИ В РЕЖИМЕ ГОСТЯ", "info");
    
    fetchMovies();
}

/**
 * Выход из системы
 * Очищает localStorage и перезагружает страницу
 */
function logout() {
    localStorage.clear();
    location.reload();
}

// ==========================================
// 6. ФИЛЬТРАЦИЯ, СОРТИРОВКА И РАСЧЕТЫ
// ==========================================


function setStatusFilter(status) {
    currentStatusFilter = status;
    
    // Меняем активную таблетку
    document.querySelectorAll('.status-pill').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    // Блокируем фильтр оценок, если выбраны несмотренные фильмы
    const assessSelect = document.getElementById('filter-assessment');
    if (status === 'roulette' || status === 'unwatched') {
        assessSelect.value = 'all';
        assessSelect.disabled = true;
        assessSelect.style.opacity = '0.4';
    } else {
        assessSelect.disabled = false;
        assessSelect.style.opacity = '1';
    }
    
    applyFilters();
}
/**
 * Обновляет список опций в фильтрах (жанры, режиссеры) 
 * и собирает уникальные коллекции для автодополнения
 */
function updateFilterOptions() {
    const genres = new Set();
    const producers = new Set();
    const collections = new Set(); // НОВЫЙ СЕТ ДЛЯ ФРАНШИЗ
    
    allMovies.forEach(m => {
        // Извлекаем жанры
        if (m.genre) {
            m.genre.split(',').forEach(g => {
                let formattedGenre = g.trim();
                if (formattedGenre) {
                    formattedGenre = formattedGenre.charAt(0).toUpperCase() + formattedGenre.slice(1).toLowerCase();
                    genres.add(formattedGenre);
                }
            });
        }
        // Извлекаем режиссеров
        if (m.producer) {
            producers.add(m.producer.trim());
        }
        // Извлекаем коллекции (франшизы)
        if (m.collection && m.collection.trim() !== '') {
            collections.add(m.collection.trim());
        }
    });
    
    fillSelect('filter-genre', genres, 'жанры'); 
    fillSelect('filter-producer', producers, 'режиссеры');

    // Наполняем невидимый список для поля "Название коллекции"
    const dataList = document.getElementById('collection-list');
    if (dataList) {
        dataList.innerHTML = ''; // Очищаем старые
        Array.from(collections).sort().forEach(c => {
            dataList.innerHTML += `<option value="${c}">`;
        });
    }
}

/**
 * Заполняет select элемент опциями из Set
 * @param {string} id - ID select элемента
 * @param {Set} set - Set с опциями
 * @param {string} label - Название фильтра
 */
function fillSelect(id, set, label) {
    const s = document.getElementById(id);
    let shortLabel = label;
    
    if (label === 'жанры') shortLabel = 'жанры';
    if (label === 'режиссеры') shortLabel = 'режиссеры';
    
    s.innerHTML = `<option value="">Все ${shortLabel}</option>`;
    Array.from(set).sort().forEach(i => {
        s.innerHTML += `<option value="${i}">${i}</option>`;
    });
}



// Таймер для умного поиска
let searchTimeout = null;

function debouncedSearch() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        applyFilters();
    }, 300); // Ждем 300 миллисекунд после последнего нажатия клавиши
}
/**
 * Применяет все активные фильтры (поиск, жанр, режиссер, статус оценки)
 * и сортирует результаты
 */
function applyFilters() {
    const search = document.getElementById('search-input').value.toLowerCase();
    const genre = document.getElementById('filter-genre').value;
    const prod = document.getElementById('filter-producer').value;
    const assessment = document.getElementById('filter-assessment').value; 
    const sort = document.getElementById('sort-select').value;

    let filtered = allMovies.filter(m => {
        const matchesSearch = m.title.toLowerCase().includes(search);
        const matchesGenre = !genre || (m.genre && m.genre.toLowerCase().includes(genre.toLowerCase()));
        const matchesProd = !prod || m.producer === prod;

        // === УМНАЯ ПРОВЕРКА СОЛО-ПРОСМОТРОВ (ИСПРАВЛЕНО) ===
        // Определяем роль друга динамически
        const friendRole = currentRole === 'me' ? 'any' : 'me';

        // Считаем оценки именно относительно того, кто сейчас сидит за экраном
        const myScore = (Number(m[`plot_${currentRole}`] || 0) + Number(m[`ending_${currentRole}`] || 0) + Number(m[`actors_${currentRole}`] || 0) + Number(m[`reviewability_${currentRole}`] || 0) + Number(m[`atmosphere_${currentRole}`] || 0) + Number(m[`music_${currentRole}`] || 0));
        const friendScore = (Number(m[`plot_${friendRole}`] || 0) + Number(m[`ending_${friendRole}`] || 0) + Number(m[`actors_${friendRole}`] || 0) + Number(m[`reviewability_${friendRole}`] || 0) + Number(m[`atmosphere_${friendRole}`] || 0) + Number(m[`music_${friendRole}`] || 0));

        const isViewedByMe = (m.status === 'Просмотрено' && (m.view_type === 'both' || m.view_type === currentRole)) || myScore > 0;
        const isViewedByFriend = (m.status === 'Просмотрено' && (m.view_type === 'both' || m.view_type === friendRole)) || friendScore > 0;

        // 1. СТРОГАЯ ФИЛЬТРАЦИЯ ПО ТАБЛЕТКАМ
        let matchesStatus = true;
        if (currentStatusFilter === 'all') {
            matchesStatus = true;
        } else if (currentStatusFilter === 'watched') {
            matchesStatus = isViewedByMe; // ТОЛЬКО если я смотрел
        } else if (currentStatusFilter === 'unwatched') { 
            // СТРОГО "Не просмотрено" ИЛИ "Смотрел только друг"
            matchesStatus = (m.status === 'Не просмотрено') || (m.status === 'Просмотрено' && isViewedByFriend && !isViewedByMe); 
        } else if (currentStatusFilter === 'roulette') {
            matchesStatus = m.status === 'В колесе';
        } else if (currentStatusFilter === 'review') { 
            matchesStatus = m.status === 'На пересмотр';
        } else if (currentStatusFilter === 'watching_now') {
            matchesStatus = m.status === 'СМОТРИМ СЕЙЧАС';
        }

        // 2. ФИЛЬТРАЦИЯ ПО ОЦЕНКАМ (Только если таблетка позволяет)
        let matchesAssessment = true;
        
        // Переменные hasMe и hasAny оставляем жестко привязанными к ролям (для корректной работы самого выпадающего списка)
        const hasMe = (Number(m.plot_me||0) + Number(m.ending_me||0) + Number(m.actors_me||0) + Number(m.reviewability_me||0) + Number(m.atmosphere_me||0) + Number(m.music_me||0)) > 0;
        const hasAny = (Number(m.plot_any||0) + Number(m.ending_any||0) + Number(m.actors_any||0) + Number(m.reviewability_any||0) + Number(m.atmosphere_any||0) + Number(m.music_any||0)) > 0;

        // === ИСПРАВЛЕННАЯ ЛОГИКА ОЦЕНОК (Теперь работает для всех статусов без ограничений) ===
        if (assessment === 'both') {
            matchesAssessment = hasMe && hasAny;
        } else if (assessment === 'only_me') {
            matchesAssessment = hasMe && !hasAny;
        } else if (assessment === 'only_any') {
            matchesAssessment = !hasMe && hasAny;
        } else if (assessment === 'none') {
            matchesAssessment = !hasMe && !hasAny;
        } else if (assessment === 'all') {
            // Если выбрано "Все оценки", мы показываем всё, НО:
            // Прячем соло-просмотры друга на главной вкладке, чтобы не засорять твой список
            if (m.status === 'Просмотрено' && currentStatusFilter !== 'unwatched' && m.view_type !== 'both' && m.view_type !== currentRole && currentRole !== 'guest') {
                matchesAssessment = false;
            }
        }

        return matchesSearch && matchesGenre && matchesProd && matchesStatus && matchesAssessment;
    });

    // Сортировка результатов
    filtered.sort((a, b) => {
        // VIP-статус для фильма "СМОТРИМ СЕЙЧАС" (всегда наверху)
        if (a.status === 'СМОТРИМ СЕЙЧАС' && b.status !== 'СМОТРИМ СЕЙЧАС') return -1;
        if (b.status === 'СМОТРИМ СЕЙЧАС' && a.status !== 'СМОТРИМ СЕЙЧАС') return 1;

        if (sort === 'rating-desc') return calculateRating(b).total - calculateRating(a).total;
        if (sort === 'title-asc') return a.title.localeCompare(b.title);
        
        if (sort === 'controversial') {
            const rA = calculateRating(a);
            const rB = calculateRating(b);
            const diffA = Math.abs(rA.me - rA.any);
            const diffB = Math.abs(rB.me - rB.any);
            return diffB - diffA; 
        }

        if (sort === 'agreed') {
            const rA = calculateRating(a);
            const rB = calculateRating(b);
            const diffA = Math.abs(rA.me - rA.any);
            const diffB = Math.abs(rB.me - rB.any);
            return diffA - diffB; 
        }

        return new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at);
    });

    renderMovies(filtered);
    
    // Проверяем и рисуем баннер при КАЖДОМ обновлении списка
    if (typeof renderNowWatching === 'function') renderNowWatching();
}

/**
 * Рассчитывает средний рейтинг фильма по взвешенной системе
 * Веса: сюжет (40%) → концовка (25%) → пересмотрваемость (15%) → актеры (10%) → атмосфера (5%) → звук (5%)
 * @param {object} m - Объект фильма
 * @returns {object} { me, any, total } - Оценки для каждого пользователя и среднее
 */


// ==========================================
// 7. РЕНДЕРИНГ ФИЛЬМОВ В СЕТКУ
// ==========================================



// ==========================================
// 8. МОДАЛЬНОЕ ОКНО И РЕДАКТИРОВАНИЕ ОЦЕНОК
// ==========================================

/**
 * Открывает модальное окно для фильма по ID
 * @param {number} id - ID фильма
 */
function openModalById(id) {
    const movie = allMovies.find(m => m.id == id);
    if (!movie) return;
    
    currentMovieId = movie.id;
    isEditMode = false;
    renderModalContent(movie);
    document.getElementById('movie-modal').style.display = 'block';

    // --- АМБИЛАЙТ: Включаем свечение ---
    const ambilight = document.getElementById('modal-ambilight');
    if (ambilight) {
        ambilight.style.backgroundImage = `url('${movie.poster || ''}')`;
        setTimeout(() => ambilight.style.opacity = '1', 50); // Небольшая задержка для плавности
    }
}

/**
 * Закрывает модальное окно с анимацией
 */
function closeModal() {
    const modal = document.getElementById('movie-modal');
    const modalContent = modal.querySelector('.modal-content');
    
    // --- АМБИЛАЙТ: Выключаем свечение ---
    const ambilight = document.getElementById('modal-ambilight');
    if (ambilight) ambilight.style.opacity = '0';
    
    modalContent.classList.add('closing');
    modal.classList.add('fade-out');
    
    setTimeout(() => {
        modal.style.display = 'none';
        modalContent.classList.remove('closing');
        modal.classList.remove('fade-out');
        modal.style.opacity = '1';
    }, 300);
}



/**
 * Переключает статус Просмотрено / Не просмотрено с учетом соло-просмотров
 */
async function toggleMovieStatus() {
    const m = allMovies.find(movie => movie.id === currentMovieId);
    if (!m) return;

    // Считаем суммы оценок, чтобы понять, кто реально оценивал
    const myScore = (Number(m.plot_me || 0) + Number(m.ending_me || 0) + Number(m.actors_me || 0) + Number(m.reviewability_me || 0) + Number(m.atmosphere_me || 0) + Number(m.music_me || 0));
    const friendScore = (Number(m.plot_any || 0) + Number(m.ending_any || 0) + Number(m.actors_any || 0) + Number(m.reviewability_any || 0) + Number(m.atmosphere_any || 0) + Number(m.music_any || 0));

    // Умная проверка: смотрел ли каждый из нас по отдельности
    const isViewedByMe = (m.status === 'Просмотрено' && (m.view_type === 'both' || m.view_type === currentRole)) || myScore > 0;
    const isViewedByFriend = (m.status === 'Просмотрено' && (m.view_type === 'both' || (m.view_type !== currentRole && m.view_type !== 'guest'))) || friendScore > 0;

    try {
        if (isViewedByMe) {
            // СЦЕНАРИЙ 1: Я смотрел, и хочу ОТМЕНИТЬ свой просмотр
            let newStatus = 'Не просмотрено';
            let newViewType = 'none';

            // Если друг смотрел, оставляем статус "Просмотрено", но отдаем ему соло-роль
            if (isViewedByFriend) {
                newStatus = 'Просмотрено';
                newViewType = currentRole === 'me' ? 'any' : 'me';
            }

            const updates = {
                status: newStatus,
                view_type: newViewType,
                // Обнуляем мои оценки при отмене
                [`plot_${currentRole}`]: 0,
                [`ending_${currentRole}`]: 0,
                [`actors_${currentRole}`]: 0,
                [`reviewability_${currentRole}`]: 0,
                [`atmosphere_${currentRole}`]: 0,
                [`music_${currentRole}`]: 0
            };

            const { error } = await supabaseClient.from('movies').update(updates).eq('id', currentMovieId);
            if (error) throw error;
            Object.assign(m, updates);
            if (typeof logActivity === 'function') logActivity(m.title, "Снял отметку 'Просмотрено' ✕");
            showToast("ОТМЕТКА СНЯТА", "info");

        } else {
            // СЦЕНАРИЙ 2: Я НЕ смотрел, и хочу отметить
            let newViewType = currentRole;
            
            // Если друг УЖЕ смотрел, то теперь мы смотрели ОБА
            if (isViewedByFriend) {
                newViewType = 'both';
            }

            const updates = {
                status: 'Просмотрено',
                view_type: newViewType
            };

            const { error } = await supabaseClient.from('movies').update(updates).eq('id', currentMovieId);
            if (error) throw error;
            Object.assign(m, updates);
            if (typeof logActivity === 'function') logActivity(m.title, "Отметил как 'Просмотрено' ✓");
            showToast("ОТМЕЧЕНО КАК ПРОСМОТРЕННОЕ", "success");
        }

        setTimeout(() => {
            const updatedMovie = allMovies.find(movie => movie.id === currentMovieId);
            renderModalContent(updatedMovie);
            fetchMovies(); 
        }, 500);
    } catch (err) {
        console.error(err);
        showToast("СБОЙ СЕТИ", "error");
    }
}





/**
 * Обновляет общий рейтинг в реальном времени при изменении ползунков
 */
function updateLiveRating() {
    const v = (id) => parseFloat(document.getElementById(id)?.value) || 0;
    const weights = { plot: 0.40, end: 0.25, rev: 0.15, act: 0.10, atm: 0.05, mus: 0.05 };
    
    const getScore = (role) => {
        return v(`input-plot_${role}`)*weights.plot + 
               v(`input-ending_${role}`)*weights.end + 
               v(`input-reviewability_${role}`)*weights.rev + 
               v(`input-actors_${role}`)*weights.act + 
               v(`input-atmosphere_${role}`)*weights.atm + 
               v(`input-music_${role}`)*weights.mus;
    };
    
    const scoreMe = getScore('me');
    const scoreAny = getScore('any');
    document.getElementById('total-val').innerText = ((scoreMe + scoreAny) / 2).toFixed(1);
}

/**
 * Переключает режим редактирования данных фильма
 */
function toggleEditMode() { 
    isEditMode = !isEditMode; 
    const movie = allMovies.find(m => m.id == currentMovieId);
    renderModalContent(movie); 
}

// ==========================================
// 9. ДОБАВЛЕНИЕ НОВЫХ ФИЛЬМОВ
// ==========================================

/**
 * Переключает видимость формы добавления фильма
 */
function toggleForm() {
    const f = document.getElementById('form-container');
    f.style.display = f.style.display === 'none' ? 'block' : 'none';
}

// === УМНЫЕ ГАЛОЧКИ (Глобальная привязка) ===

window.toggleNewViewed = function() {
    const input = document.getElementById('new-is-viewed');
    const box = document.getElementById('new-viewed-checkbox');
    const select = document.getElementById('new-status');
    
    // Предохранитель: если элементов нет, не ломаем скрипт
    if (!input || !box) return; 
    
    if (input.value === 'false') {
        input.value = 'true';
        box.style.color = '#000';
        box.style.background = '#c0c0c0';
        box.style.borderColor = '#c0c0c0';
        
        if (select) {
            select.disabled = true;
            select.style.opacity = '0.3';
        }
    } else {
        input.value = 'false';
        box.style.color = 'transparent';
        box.style.background = 'transparent';
        box.style.borderColor = '#555';
        
        if (select) {
            select.disabled = false;
            select.style.opacity = '1';
        }
        
        const soloInput = document.getElementById('new-solo-view');
        const soloBox = document.getElementById('new-solo-checkbox');
        if (soloInput && soloInput.value === 'true') {
            soloInput.value = 'false';
            soloBox.style.color = 'transparent';
            soloBox.style.background = 'transparent';
            soloBox.style.borderColor = '#555';
        }
    }
};

window.toggleNewSoloView = function() {
    const input = document.getElementById('new-solo-view');
    const box = document.getElementById('new-solo-checkbox');
    
    if (!input || !box) return;
    
    if (input.value === 'false') {
        input.value = 'true';
        box.style.color = '#000';
        box.style.background = '#c0c0c0';
        box.style.borderColor = '#c0c0c0';
        
        const viewedInput = document.getElementById('new-is-viewed');
        if (viewedInput && viewedInput.value === 'false') {
            window.toggleNewViewed(); // Вызываем соседнюю функцию через window
        }
    } else {
        input.value = 'false';
        box.style.color = 'transparent';
        box.style.background = 'transparent';
        box.style.borderColor = '#555';
    }
};



/**
 * Обработчик отправки формы добавления фильма
 * Создает новый фильм в базе данных
 */
document.getElementById('add-movie-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // === НОВАЯ ЛОГИКА: ПРОВЕРКА НА ДУБЛИКАТЫ ===
    const newTitle = document.getElementById('new-title').value.trim();
    
    // Ищем совпадения, игнорируя большие/маленькие буквы
    const isDuplicate = allMovies.some(m => m.title.toLowerCase() === newTitle.toLowerCase());
    
    if (isDuplicate) {
        showToast("ЭТОТ ФИЛЬМ УЖЕ ЕСТЬ В СПИСКЕ", "error"); // Показываем стильную ошибку с крестиком
        return; // Останавливаем выполнение кода, фильм не добавится
    }
    // ==========================================
    
    // Проверяем, нажата ли галочка "Соло"
    const isSolo = document.getElementById('new-solo-view').value === 'true';
    // Если нажата - записываем роль того, кто добавляет. Если нет - записываем 'both'
    const viewType = isSolo ? currentRole : 'both';

    const newMovie = {
        collection: document.getElementById('new-collection').value.trim(), 
        title: newTitle, 
        poster: document.getElementById('new-poster').value,
        year: document.getElementById('new-year').value, 
        duration: parseInt(document.getElementById('new-duration').value) || 0,
        genre: document.getElementById('new-genre').value, 
        producer: document.getElementById('new-producer').value, 
        actors: document.getElementById('new-actors').value, 
        external_rating: tempExternalRating,
        kp_rating: document.getElementById('new-kp-rating') ? document.getElementById('new-kp-rating').value : null,
        status: document.getElementById('new-is-viewed').value === 'true' ? 'Просмотрено' : document.getElementById('new-status').value, 
        view_type: viewType, // <--- ОТПРАВЛЯЕМ ТИП ПРОСМОТРА В БАЗУ
        updated_at: new Date().toISOString()
         
    };
    
    await supabaseClient.from('movies').insert([newMovie]);
    
    // === ЛОГ В ЛЕНТУ АКТИВНОСТИ ===
    if (typeof logActivity === 'function') {
        const actionText = (newMovie.status === 'В колесе') ? "Добавил новый фильм сразу в рулетку ♤" : "Добавил новый фильм в базу";
        await logActivity(newTitle, actionText);
    }
    location.reload();
});

// ==========================================
// 10. НАВИГАЦИЯ И ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК
// ==========================================

/**
 * Переключает между вкладками (Фильмы, Рулетка, Статистика)
 * @param {string} tab - Название вкладки ('grid', 'roulette' или 'stats')
 */
function switchTab(tab) {
    const screens = ['main-view', 'stats-container', 'roulette-screen'];
    
    // Скрываем все экраны
    screens.forEach(id => {
        // НОВОЕ: Если мы переключаемся на обычные вкладки, закрываем профиль (если он был открыт как вкладка)
        const profileModal = document.getElementById('profile-modal');
        if (profileModal && profileModal.classList.contains('is-tab')) {
            profileModal.style.display = 'none';
            profileModal.classList.remove('is-tab');
        }
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    
    
    // Удаляем класс active со всех кнопок
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    
    // Показываем нужный экран и активируем кнопку
    const targetScreen = document.getElementById(tab === 'grid' ? 'main-view' : (tab === 'stats' ? 'stats-container' : 'roulette-screen'));
    const targetBtn = document.getElementById(`tab-${tab}`);
    
    if (targetScreen) targetScreen.style.display = 'block';
    if (targetBtn) targetBtn.classList.add('active');

    // --- Логика для мобильного нижнего меню ---
    // Удаляем класс active со всех иконок
    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
    
    // Подсвечиваем ту иконку, которую нажали
    const mobileTargetBtn = document.getElementById(`mobile-tab-${tab}`);
    if (mobileTargetBtn) mobileTargetBtn.classList.add('active');

    // Загружаем статистику при переходе на её вкладку
    if (tab === 'stats' && typeof generateStatistics === "function") {
        generateStatistics();
    }

    // Настраиваем рулетку при переходе на её вкладку
    if (tab === 'roulette') {
        const isMobile = window.innerWidth <= 600;
        
        if (isMobile) {
            if (typeof setupRouletteView === "function") {
                setupRouletteView();
            }
        } else {
            const mobileContainer = document.getElementById('mobile-roulette-container');
            const pcContainer = document.getElementById('roulette-container');
            const pcControls = document.getElementById('pc-spin-controls');
            
            if (mobileContainer) mobileContainer.style.display = 'none';
            if (pcContainer) pcContainer.style.display = 'block';
            if (pcControls) pcControls.style.display = 'block';
            
            if (typeof drawWheel === "function") drawWheel();
        }
    }
}


// ==========================================
// 14. СОБЫТИЯ И ИНИЦИАЛИЗАЦИЯ
// ==========================================

/**
 * Обновляет размер колеса при изменении размера окна
 */
window.addEventListener('resize', drawWheel);

// Инициализация при загрузке страницы
checkAuth();

/**
 * Переключает режим видимости графиков
 */
function setRadarView(mode) {
    currentRadarView = mode;
    
    // Сбрасываем стили всех кнопок
    ['me', 'any', 'both'].forEach(m => {
        const btn = document.getElementById(`btn-radar-${m}`);
        if (btn) {
            btn.style.background = 'none';
            btn.style.color = '#888';
            btn.style.borderColor = '#444';
            btn.style.fontWeight = 'normal';
        }
    });

    // Активируем выбранную кнопку
    const activeBtn = document.getElementById(`btn-radar-${mode}`);
    if (activeBtn) {
        activeBtn.style.background = mode === 'both' ? '#c0c0c0' : 'rgba(255,255,255,0.1)';
        activeBtn.style.color = mode === 'both' ? '#000' : '#fff';
        activeBtn.style.borderColor = mode === 'both' ? '#c0c0c0' : '#fff';
        activeBtn.style.fontWeight = 'bold';
    }

    // Перерисовываем график с новыми данными
    if (window.radarData) {
        drawRadarChart(window.radarData.me, window.radarData.any);
    }
}

// ==========================================
// ЛОГИКА ПРОФИЛЯ ПОЛЬЗОВАТЕЛЯ
// ==========================================

// 1. Обновляет кнопку в шапке сайта
function updateUserProfileUI() {
    if (!currentUserData) return;
    
    // Вставляем никнейм
    document.getElementById('nav-nickname').innerText = currentUserData.nickname.toUpperCase();
    
    // Вставляем аватарку (если ссылки нет, генерируем заглушку с первой буквой имени)
    const avatarImg = document.getElementById('nav-avatar');
    if (currentUserData.avatar_url && currentUserData.avatar_url.trim() !== "") {
        avatarImg.src = currentUserData.avatar_url;
    } else {
        avatarImg.src = `https://ui-avatars.com/api/?name=${currentUserData.nickname}&background=1a1a1a&color=c0c0c0`;
    }

    // --- Ограничения гостя: скрываем админ-панель добавления фильмов ---
    const adminPanel = document.querySelector('.admin-panel');
    if (adminPanel) {
        adminPanel.style.display = currentRole === 'guest' ? 'none' : 'block';
    }

    // Показываем корону только тебе (в обычном меню и в мобильном)
    const crown = document.getElementById('admin-crown-btn');
    const mobileCrown = document.getElementById('mobile-admin-crown');
    
    if (crown) crown.style.display = (currentRole === 'me') ? 'block' : 'none';
    if (mobileCrown) mobileCrown.style.display = (currentRole === 'me') ? 'flex' : 'none';
}



// Открывает окно профиля (своего или чужого)
async function openProfileModal(targetRole = currentRole) {
    if (targetRole === 'guest') {
        showToast("У ГОСТЯ НЕТ ПРОФИЛЯ", "warning");
        return;
    }
    
    const isOwnProfile = (targetRole === currentRole);

    // 1. АВТО-ЗАГРУЗКА ДАННЫХ ДРУГА (если их нет в памяти)
    if (typeof allUsersData === 'undefined') window.allUsersData = {}; 
    if (!allUsersData[targetRole]) {
        const { data } = await supabaseClient.from('users').select('*').eq('role', targetRole).single();
        if (data) allUsersData[targetRole] = data;
    }
    const userData = allUsersData[targetRole] || currentUserData;

    // 2. АВТО-СОЗДАНИЕ HTML БЛОКА (если он случайно потерялся в index.html)
    let editSection = document.getElementById('profile-edit-section');
    let readonlySection = document.getElementById('profile-readonly-section');
    
    if (!readonlySection && editSection) {
        readonlySection = document.createElement('div');
        readonlySection.id = 'profile-readonly-section';
        readonlySection.style.textAlign = 'center';
        readonlySection.style.marginBottom = '25px';
        readonlySection.innerHTML = `
            <img id="profile-readonly-avatar" src="" style="width: 100px; height: 100px; border-radius: 15px; object-fit: cover; border: 2px solid #c0c0c0; margin-bottom: 15px; box-shadow: 0 5px 15px rgba(0,0,0,0.5);">
            <h3 id="profile-readonly-nickname" style="font-size: 1.8rem; color: #fff; margin: 0; text-transform: uppercase; letter-spacing: 2px;">ИМЯ</h3>
        `;
        editSection.parentNode.insertBefore(readonlySection, editSection.nextSibling);
    }

    // Переключаем интерфейс: настройки для себя или визитка для друга
    if (editSection) editSection.style.display = isOwnProfile ? 'block' : 'none';
    if (readonlySection) readonlySection.style.display = isOwnProfile ? 'none' : 'block';
    
    const mainTitle = document.getElementById('profile-main-title');
    if (mainTitle) mainTitle.innerText = isOwnProfile ? 'ЛИЧНЫЙ ПРОФИЛЬ' : 'ПРОФИЛЬ ПОЛЬЗОВАТЕЛЯ';

    if (isOwnProfile) {
        document.getElementById('profile-nickname-input').value = userData.nickname || "Без имени";
        document.getElementById('profile-avatar-input').value = userData.avatar_url || "";
        document.getElementById('profile-avatar-preview').src = userData.avatar_url || `https://ui-avatars.com/api/?name=${userData.nickname}&background=1a1a1a&color=c0c0c0`;
    } else {
        document.getElementById('profile-readonly-nickname').innerText = userData.nickname || "Без имени";
        document.getElementById('profile-readonly-avatar').src = userData.avatar_url || `https://ui-avatars.com/api/?name=${userData.nickname}&background=1a1a1a&color=c0c0c0`;
    }

    // === УМНЫЕ РАСЧЕТЫ (с учетом соло-фильмов) ===
    const myWatchedMovies = allMovies.filter(m => 
        m.status === 'Просмотрено' && (m.view_type === 'both' || m.view_type === targetRole)
    );

    const myRatedMovies = myWatchedMovies.filter(m => {
        const scoreSum = (Number(m['plot_' + targetRole] || 0) + Number(m['ending_' + targetRole] || 0) + 
                          Number(m['reviewability_' + targetRole] || 0) + Number(m['actors_' + targetRole] || 0) + 
                          Number(m['atmosphere_' + targetRole] || 0) + Number(m['music_' + targetRole] || 0));
        return scoreSum > 0;
    });

    let totalScore = 0; let totalMinutes = 0; let myScoresData = []; 
    let radarScores = { plot: 0, ending: 0, reviewability: 0, actors: 0, atmosphere: 0, music: 0 };

    myWatchedMovies.forEach(m => totalMinutes += (parseInt(m.duration) || 0));

    myRatedMovies.forEach(m => {
        const weights = { plot: 0.40, end: 0.25, rev: 0.15, act: 0.10, atm: 0.05, mus: 0.05 };
        const score = (Number(m['plot_'+targetRole]||0)*weights.plot + Number(m['ending_'+targetRole]||0)*weights.end + 
                       Number(m['reviewability_'+targetRole]||0)*weights.rev + Number(m['actors_'+targetRole]||0)*weights.act + 
                       Number(m['atmosphere_'+targetRole]||0)*weights.atm + Number(m['music_'+targetRole]||0)*weights.mus);
        
        totalScore += score;
        myScoresData.push({ movie: m, score: score });
        for (let k in radarScores) radarScores[k] += Number(m[k + '_' + targetRole] || 0);
    });
    
    const countWatched = myWatchedMovies.length;
    const countRated = myRatedMovies.length;
    const avgScore = countRated > 0 ? (totalScore / countRated).toFixed(2) : "0.00";
    
    document.getElementById('profile-stat-count').innerText = countWatched;
    document.getElementById('profile-stat-avg').innerText = avgScore;
    document.getElementById('profile-stat-time').innerHTML = `${Math.floor(totalMinutes/60)}<span style="font-size:0.8rem">ч</span> ${totalMinutes%60}<span style="font-size:0.8rem">м</span>`;

    // --- Любимые фильмы ---
    const favMoviesContainer = document.getElementById('profile-fav-movies');
    favMoviesContainer.innerHTML = '';
    if (countRated > 0) {
        myScoresData.sort((a, b) => b.score - a.score || new Date(b.movie.updated_at) - new Date(a.movie.updated_at));
        myScoresData.slice(0, 3).forEach(item => {
            favMoviesContainer.innerHTML += `
                <div style="flex: 0 0 100px; text-align: center;">
                    <img src="${item.movie.poster || ''}" style="width: 100px; height: 150px; object-fit: cover; border-radius: 8px; border: 1px solid #333; margin-bottom: 5px;">
                    <div style="font-size: 0.65rem; color: #ccc; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: bold;">${item.movie.title}</div>
                    <div style="font-size: 0.8rem; color: #c0c0c0; font-weight: 900;">${item.score.toFixed(1)}</div>
                </div>`;
        });
    } else { favMoviesContainer.innerHTML = '<div style="color: #555; font-size: 0.8rem;">Нет фильмов</div>'; }

    // --- Топ-10 Жанров ---
    const genreData = {};
    myRatedMovies.forEach(m => {
        if (m.genre) {
            m.genre.split(',').forEach(g => {
                const name = g.trim().toUpperCase();
                if (!genreData[name]) genreData[name] = { count: 0, totalScore: 0 };
                genreData[name].count++;
                const weights = { plot: 0.40, end: 0.25, rev: 0.15, act: 0.10, atm: 0.05, mus: 0.05 };
                genreData[name].totalScore += (Number(m['plot_'+targetRole]||0)*weights.plot + Number(m['ending_'+targetRole]||0)*weights.end + 
                       Number(m['reviewability_'+targetRole]||0)*weights.rev + Number(m['actors_'+targetRole]||0)*weights.act + 
                       Number(m['atmosphere_'+targetRole]||0)*weights.atm + Number(m['music_'+targetRole]||0)*weights.mus);
            });
        }
    });

    const sortedGenres = Object.entries(genreData)
        .map(([name, data]) => ({ name, count: data.count, avg: data.totalScore / data.count, score: (data.totalScore / data.count) * (1 + Math.log10(data.count)) }))
        .sort((a, b) => b.score - a.score).slice(0, 10);

    const genresContainer = document.getElementById('profile-genres');
    if (sortedGenres.length > 0) {
        const maxScore = sortedGenres[0].score;
        genresContainer.innerHTML = sortedGenres.map((g, index) => {
            const relativeWidth = (g.score / maxScore) * 100;
            let medalClass = "genre-fill"; 
            if (index === 0) medalClass += " bar-gold"; else if (index === 1) medalClass += " bar-silver"; else if (index === 2) medalClass += " bar-bronze";
            return `
                <div class="genre-item" style="margin-bottom: 8px;">
                    <div class="genre-name" style="${index < 3 ? 'color: #fff; font-weight: bold;' : 'font-size: 0.65rem;'} width: 90px;">${g.name}</div>
                    <div class="genre-track" style="height: 6px;"><div class="${medalClass}" style="width: ${relativeWidth}%; height: 100%;"></div></div>
                    <div class="genre-info" style="min-width: 50px; font-size: 0.6rem;"><span style="color: #eee;">${g.avg.toFixed(1)}</span> <span style="color: #444;">(${g.count})</span></div>
                </div>`;
        }).join('');
    } else { genresContainer.innerHTML = '<div style="color: #555; font-size: 0.8rem;">Нет данных</div>'; }

    document.getElementById('profile-modal').style.display = 'block';

    if (countRated > 0) {
        for (let k in radarScores) radarScores[k] /= countRated; 
        setTimeout(() => drawProfileRadar(radarScores), 50);
    }
}



// 3. Закрывает окно профиля
function closeProfileModal() {
    document.getElementById('profile-modal').style.display = 'none';
}

// ==========================================
// 15. КОЛЛЕКЦИИ (ФРАНШИЗЫ)
// ==========================================



function switchMainView(view) {
    currentMainView = view;
    const btnMovies = document.getElementById('btn-view-movies');
    const btnCollections = document.getElementById('btn-view-collections');
    const gridMovies = document.getElementById('movie-grid');
    const gridCollections = document.getElementById('collections-grid');

    if (view === 'movies') {
        btnMovies.style.background = '#c0c0c0'; btnMovies.style.color = '#000'; btnMovies.style.borderColor = '#c0c0c0';
        btnCollections.style.background = '#161616'; btnCollections.style.color = '#c0c0c0'; btnCollections.style.borderColor = '#333';
        gridMovies.style.display = 'grid';
        gridCollections.style.display = 'none';
        applyFilters(); // Обновляем сетку фильмов
    } else {
        btnCollections.style.background = '#c0c0c0'; btnCollections.style.color = '#000'; btnCollections.style.borderColor = '#c0c0c0';
        btnMovies.style.background = '#161616'; btnMovies.style.color = '#c0c0c0'; btnMovies.style.borderColor = '#333';
        gridMovies.style.display = 'none';
        gridCollections.style.display = 'grid';
        renderCollections(); // Строим папки
    }
}



function openCollectionModal(cName, cMovies) {
    document.getElementById('collection-modal-title').innerText = cName;
    
    // Статистика коллекции
    let totalScore = 0; let countRated = 0; let countWatched = 0; let totalMinutes = 0;
    cMovies.forEach(m => {
        if (m.status === 'Просмотрено') countWatched++;
        totalMinutes += parseInt(m.duration) || 0;
        const r = calculateRating(m).total;
        if (r > 0) { totalScore += r; countRated++; }
    });

    document.getElementById('collection-modal-stats').innerHTML = `
        <div style="background:#111; padding:15px; border-radius:12px; text-align:center; border:1px solid #222;">
            <p style="color:#555; font-size:0.55rem; margin:0; letter-spacing: 1px;">ФИЛЬМОВ</p>
            <h2 style="font-size:1.5rem; margin:5px 0 0 0; color: #fff;">${countWatched} <span style="font-size:0.8rem; color:#666;">/ ${cMovies.length}</span></h2>
        </div>
        <div style="background:#111; padding:15px; border-radius:12px; text-align:center; border:1px solid #222;">
            <p style="color:#555; font-size:0.55rem; margin:0; letter-spacing: 1px;">СР. БАЛЛ</p>
            <h2 style="font-size:1.5rem; margin:5px 0 0 0; color: #fff;">${countRated > 0 ? (totalScore/countRated).toFixed(2) : "0.00"}</h2>
        </div>
        <div style="background:#111; padding:15px; border-radius:12px; text-align:center; border:1px solid #222;">
            <p style="color:#555; font-size:0.55rem; margin:0; letter-spacing: 1px;">ВРЕМЯ</p>
            <h2 style="font-size:1.5rem; margin:5px 0 0 0; color: #fff;">${Math.floor(totalMinutes/60)}<span style="font-size:0.8rem">ч</span> ${totalMinutes%60}<span style="font-size:0.8rem">м</span></h2>
        </div>
    `;

    // Отрисовываем сетку внутри модалки
    const grid = document.getElementById('collection-modal-grid');
    grid.innerHTML = '';
    const fragment = document.createDocumentFragment();
    
    // Переиспользуем логику создания карточек (немного адаптированную)
    cMovies.forEach(m => {
        const r = calculateRating(m);
        let badgeStyle = (r.total > 0) ? "background: linear-gradient(90deg, #c0c0c0 50%, rgba(40, 40, 40, 0.9) 50%); color: #fff; border: none;" : "background-color: #1a1a1a; color: #555;";
        let movieBadgeHTML = '';
        if (m.status === 'Просмотрено' && (m.view_type === 'both' || m.view_type === currentRole)) movieBadgeHTML = `<div class="glass-badge"><span>✓</span> ПРОСМОТРЕНО</div>`;
        else if (m.view_type !== 'both' && m.view_type !== currentRole && m.view_type !== 'guest') {
            const ownerName = userNicknames[m.view_type] ? userNicknames[m.view_type].toUpperCase() : 'ДРУГ';
            movieBadgeHTML = `<div class="glass-badge"><span>🛈</span> ОЦЕНИЛ ${ownerName}</div>`;
        }

        const card = document.createElement('div');
        card.className = 'card';
        card.style.opacity = '1'; card.style.animation = 'none'; // Убираем задержку анимации для модалки
        card.onclick = () => { closeCollectionModal(); setTimeout(() => openModalById(m.id), 300); };
        
        card.innerHTML = `
            ${movieBadgeHTML}
            <img src="${m.poster || 'https://via.placeholder.com/180x260?text=No+Poster'}">
            <div class="card-info" style="height: 125px;">
                <div class="card-top-content">
                    <h3 style="margin: 0 0 8px 0; font-size: 0.8rem; line-height: 1.2; min-height: 2.4em; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis;">${m.title}</h3>
                    <span class="rating-badge" style="${badgeStyle}">${r.total.toFixed(1)}</span>
                </div>
                <div class="card-date" style="padding-top: 10px;">${m.year || '—'} год</div>
            </div>`;
        fragment.appendChild(card);
    });
    grid.appendChild(fragment);

    // Амбилайт для коллекции
    const ambilight = document.getElementById('collection-ambilight');
    if (ambilight && cMovies.length > 0) {
        ambilight.style.backgroundImage = `url('${cMovies[0].poster}')`;
        setTimeout(() => ambilight.style.opacity = '1', 50);
    }

    document.getElementById('collection-modal').style.display = 'block';
}

function closeCollectionModal() {
    const modal = document.getElementById('collection-modal');
    const ambilight = document.getElementById('collection-ambilight');
    if (ambilight) ambilight.style.opacity = '0';
    
    modal.querySelector('.modal-content').classList.add('closing');
    modal.classList.add('fade-out');
    setTimeout(() => {
        modal.style.display = 'none';
        modal.querySelector('.modal-content').classList.remove('closing');
        modal.classList.remove('fade-out');
    }, 300);
}

// ==========================================
// ГЛОБАЛЬНЫЕ СЛУШАТЕЛИ (script.js)
// ==========================================

// Озвучка интерфейса: ловим клики по интерактивным элементам
document.addEventListener('click', (e) => {
    // Список классов и тегов, которые должны "звучать"
    const target = e.target.closest('button, .card, .glass-badge, .status-pill, .nav-btn, .quick-roulette-btn, .toast, .drum-item');
    if (target && typeof playUIClick === 'function') {
        playUIClick();
    }
});

function openAdminModal() {
    const select = document.getElementById('admin-movie-select');
    select.innerHTML = '<option value="">-- Выберите фильм --</option>';
    
    // Берем только фильмы, которые сейчас в колесе
    const wheelMovies = allMovies.filter(m => m.status === 'В колесе');
    
    wheelMovies.forEach(m => {
        const isRigged = m.is_rigged ? " (ЗАРЯЖЕН)" : "";
        select.innerHTML += `<option value="${m.id}">${m.title}${isRigged}</option>`;
    });

    document.getElementById('admin-modal').style.display = 'block';
}

function closeAdminModal() {
    document.getElementById('admin-modal').style.display = 'none';
}

// ==========================================
// ЛОГИКА ЛЕНТЫ АКТИВНОСТИ
// ==========================================

async function openActivityModal() {
    const modal = document.getElementById('activity-modal');
    const list = document.getElementById('activity-list');
    const dot = document.getElementById('activity-dot');
    
    modal.style.display = 'block';
    list.innerHTML = '<div style="text-align: center; color: #666; margin-top: 20px;">Загрузка истории...</div>';
    
    // Прячем серебряную точку и запоминаем время захода
    if (dot) dot.style.display = 'none';
    localStorage.setItem('last_activity_view', new Date().toISOString());

    // Качаем последние 50 записей
    const { data, error } = await supabaseClient
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

    if (error) {
        list.innerHTML = '<div style="color: #ff3333; text-align: center; margin-top: 20px;">Ошибка загрузки базы данных</div>';
        return;
    }

    if (!data || data.length === 0) {
        list.innerHTML = '<div style="text-align: center; color: #666; margin-top: 20px;">Пока нет активности. Сделайте что-нибудь!</div>';
        return;
    }

    // Рисуем список
    list.innerHTML = '';
    data.forEach(log => {
        // Форматируем дату
        const date = new Date(log.created_at).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
        const authorName = userNicknames[log.user_role] || (log.user_role === 'me' ? 'УМНЫЙ' : 'НЕ УМНЫЙ');
        
        // --- Достаем аватарку ---
        let avatarUrl = `https://ui-avatars.com/api/?name=${authorName}&background=1a1a1a&color=c0c0c0`;
        if (typeof allUsersData !== 'undefined' && allUsersData[log.user_role] && allUsersData[log.user_role].avatar_url) {
            avatarUrl = allUsersData[log.user_role].avatar_url;
        }
        
        list.innerHTML += `
            <div class="activity-item role-${log.user_role}">
                <div class="act-date">${date}</div>
                <div style="display: flex; align-items: flex-start; gap: 8px; margin-top: 5px;">
                    <img src="${avatarUrl}" onclick="openProfileModal('${log.user_role}')" style="width: 20px; height: 20px; border-radius: 4px; object-fit: cover; border: 1px solid #444; flex-shrink: 0; margin-top: 1px; cursor: pointer; transition: border-color 0.2s;" onmouseover="this.style.borderColor='#c0c0c0'" onmouseout="this.style.borderColor='#444'" title="Открыть профиль">
                    <div style="line-height: 1.4;">
                        <span class="act-user" onclick="openProfileModal('${log.user_role}')" style="cursor: pointer; text-decoration: underline; text-underline-offset: 3px; transition: color 0.2s;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='inherit'" title="Открыть профиль">${authorName}</span>
                        <span class="act-text"> • ${log.action_text}</span>
                        <span class="act-movie">«${log.movie_title}»</span>
                    </div>
                </div>
            </div>
        `;
    });
}

function closeActivityModal() {
    document.getElementById('activity-modal').style.display = 'none';
}

// ==========================================
// ЛОГИКА ВКЛАДКИ ПРОФИЛЯ НА МОБИЛКАХ
// ==========================================
window.openMobileProfileTab = function() {
    // 1. Скрываем основные экраны (Кино, Рулетка, Итоги)
    const screens = ['main-view', 'stats-container', 'roulette-screen'];
    screens.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
    
    // 2. Переключаем серебряную подсветку в нижнем меню
    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
    const mobileTargetBtn = document.getElementById('mobile-tab-profile');
    if (mobileTargetBtn) mobileTargetBtn.classList.add('active');

    // 3. Открываем профиль, но вешаем на него маскировочный класс "is-tab"
    const modal = document.getElementById('profile-modal');
    modal.classList.add('is-tab');
    openProfileModal('me'); // Загружаем твои данные
};
