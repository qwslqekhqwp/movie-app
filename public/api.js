// ==========================================
// 4. ЗАГРУЗКА И УПРАВЛЕНИЕ ФИЛЬМАМИ
// ==========================================


/**
 * Загружает все фильмы из базы данных Supabase
 * Обновляет фильтры и отображение после загрузки
 */
async function fetchMovies() {
    renderSkeletons(); // Показываем скелеты на время загрузки
    
    try {
        // 1. Сначала скачиваем ники и аватарки обоих пользователей
        const { data: users, error: userError } = await supabaseClient
            .from('users')
            .select('role, nickname, avatar_url'); 

       if (!userError && users) {
            users.forEach(u => {
                userNicknames[u.role] = u.nickname;
                allUsersData[u.role] = u; 
            });
            
            const optMe = document.querySelector('#filter-assessment option[value="only_me"]');
            const optAny = document.querySelector('#filter-assessment option[value="only_any"]');
            
            if (optMe) optMe.textContent = `Оценил ${userNicknames.me}`;
            if (optAny) optAny.textContent = `Оценил ${userNicknames.any}`;

            // --- НОВОЕ: ЖЕСТКО ОБНОВЛЯЕМ НИКИ В ПАНЕЛИ СИНХРОНИЗАЦИИ ---
            const syncNameMe = document.getElementById('sync-name-me');
            const syncNameAny = document.getElementById('sync-name-any');
            
            if (syncNameMe) syncNameMe.innerText = userNicknames.me.toUpperCase();
            if (syncNameAny) syncNameAny.innerText = userNicknames.any.toUpperCase();
            
            // --- НОВОЕ: Загружаем билеты и статусы сбора ---
            if (typeof updateSyncAndTicketsUI === 'function') updateSyncAndTicketsUI();
        }

        // 2. === МАГИЯ ПРЕЛОАДЕРА И ЗАГРУЗКИ БАЗЫ ===
        // Promise.all заставляет браузер ждать выполнения ОБЕИХ задач:
        // Задача А: Скачать фильмы
        // Задача Б: Подождать минимум 2 секунды (2000 мс), чтобы красивая анимация радара успела отыграть
        const [moviesResponse] = await Promise.all([
            supabaseClient.from('movies').select('*').order('updated_at', { ascending: false }),
            new Promise(resolve => setTimeout(resolve, 2000))
        ]);

        const { data, error } = moviesResponse;

        if (error) throw error;

        allMovies = data || [];
        
        // 3. Если мы находимся в модальном окне (перезагрузка после сохранения) - обновляем его
        if (currentMovieId) {
            const updatedMovie = allMovies.find(m => m.id === currentMovieId);
            if (updatedMovie) renderModalContent(updatedMovie);
        }

        // 4. Применяем текущие фильтры и рисуем карточки
        if (typeof updateFilterOptions === 'function') {
            updateFilterOptions(); // <-- Собираем жанры и режиссеров из скачанных фильмов
        }
        if (typeof applyFilters === 'function') {
            applyFilters(); 
        }

        // 5. ПРЯЧЕМ ЭКРАН ЗАГРУЗКИ
        // Все готово, анимация отыграла. Плавно растворяем черный экран.
        const preloader = document.getElementById('preloader');
        if (preloader) {
            preloader.classList.add('fade-out');
            // Удаляем его из DOM через 600мс (время CSS-анимации), чтобы он не блокировал клики
            setTimeout(() => preloader.style.display = 'none', 600);
        }

    } catch (err) {
        console.error("Ошибка загрузки:", err);
        const grid = document.getElementById('movie-grid');
        if (grid) grid.innerHTML = '<div style="color:#ff3333; text-align:center; width:100%; grid-column: 1/-1;">Ошибка загрузки данных. Проверьте интернет или настройки Supabase.</div>';
        
        // В случае ошибки тоже убираем прелоадер, чтобы показать текст ошибки
        const preloader = document.getElementById('preloader');
        if (preloader) preloader.style.display = 'none';
    }
}

/**
 * Ищет информацию о фильме в TMDB API и автоматически заполняет форму
 * Требует введения названия фильма
 */
async function searchMovieData() {
    const titleInput = document.getElementById('new-title');
    const title = titleInput.value;
    const searchBtn = document.querySelector('button[onclick="searchMovieData()"]');
    
    if (!title) return showToast("Введите название фильма", "warning");
    const originalBtnText = searchBtn.innerText;
    searchBtn.innerText = "ПОИСК...";
    searchBtn.style.opacity = "0.5";
    searchBtn.disabled = true;
    
    try {
        // Читаем год (если он введен)
        const yearInput = document.getElementById('new-year').value.trim();
        let searchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}&language=ru-RU`;
        if (yearInput) searchUrl += `&primary_release_year=${yearInput}`; // <-- Добавили фильтр по году!

        // Ищем фильм в TMDB
        const searchRes = await fetch(searchUrl);
        const searchData = await searchRes.json();
        
        if (searchData.results.length === 0) {
            return showToast("Фильм не найден в TMDB", "error");
        }
        
        // Получаем полную информацию о первом найденном фильме
        const details = await (
            await fetch(
                `https://api.themoviedb.org/3/movie/${searchData.results[0].id}?api_key=${TMDB_API_KEY}&append_to_response=credits&language=ru-RU`
            )
        ).json();
        
        // Заполняем форму полученными данными
        document.getElementById('new-title').value = details.title;
        document.getElementById('new-poster').value = details.poster_path ? TMDB_IMAGE_BASE + details.poster_path : '';
        document.getElementById('new-collection').value = details.belongs_to_collection ? details.belongs_to_collection.name.replace(" - коллекция", "").replace(" (коллекция)", "") : '';
        document.getElementById('new-year').value = details.release_date ? details.release_date.split('-')[0] : '';
        document.getElementById('new-duration').value = details.runtime || '';
        document.getElementById('new-genre').value = details.genres.map(g => g.name).join(', ');
        
        tempExternalRating = details.vote_average ? details.vote_average.toFixed(1) : '0.0';
        
        const director = details.credits.crew.find(person => person.job === 'Director');
        document.getElementById('new-producer').value = director ? director.name : '';
        document.getElementById('new-actors').value = details.credits.cast.slice(0, 3).map(a => a.name).join(', ');
        
        showToast(`Данные загружены! TMDB: ${tempExternalRating}`, "success");
    } catch (err) {
        showToast("Сбой при поиске в TMDB", "error");
    } finally {
        searchBtn.innerText = originalBtnText;
        searchBtn.style.opacity = "1";
        searchBtn.disabled = false;
    }
}

/**
 * Сохраняет все изменения в оценках и данных фильма
 * Автоматически переводит статус "СМОТРИМ СЕЙЧАС" в "Просмотрено" при наличии оценок
 */
/**
 * Сохраняет все изменения в оценках и данных фильма
 * + Встроена система слежения за изменениями для Ленты активности
 */
async function saveRatings() {
    const m = allMovies.find(movie => movie.id === currentMovieId);
    if (!m) return;

    const updateData = { 
        review_common: document.getElementById('review-common').value, 
        status: document.getElementById('edit-status') ? document.getElementById('edit-status').value : m.status,
        updated_at: new Date().toISOString()
    };
    
    if (isEditMode) {
        updateData.title = document.getElementById('edit-title').value;
        updateData.poster = document.getElementById('edit-poster').value;
        updateData.year = document.getElementById('edit-year').value;
        updateData.duration = parseInt(document.getElementById('edit-duration').value) || 0;
        updateData.genre = document.getElementById('edit-genre').value;
        updateData.producer = document.getElementById('edit-producer').value;
        updateData.actors = document.getElementById('edit-actors').value;
        updateData.external_rating = document.getElementById('edit-external-rating').value;
        updateData.kp_rating = document.getElementById('edit-kp-rating').value;
        updateData.collection = document.getElementById('edit-collection') ? document.getElementById('edit-collection').value.trim() : null;
    }
    
    // === АЛГОРИТМ СРАВНЕНИЯ ОЦЕНОК (DIFF) ===
    let myNewScore = 0;
    const criteriaNames = { plot: 'Сюжет', ending: 'Концовка', reviewability: 'Пересмотр', actors: 'Актеры', atmosphere: 'Атмосфера', music: 'Музыка' };
    let changes = []; // Сюда будем складывать тексты изменений (например "сюжет с 5 на 8")

    ['plot', 'ending', 'reviewability', 'actors', 'atmosphere', 'music'].forEach(f => {
        const input = document.getElementById(`input-${f}_${currentRole}`);
        if (input) {
            const val = parseInt(input.value) || 0;
            updateData[`${f}_${currentRole}`] = val;
            myNewScore += val;

            // Сравниваем старое и новое значение
            const oldVal = Number(m[`${f}_${currentRole}`] || 0);
            if (oldVal !== val && val > 0) {
                if (oldVal === 0) {
                    changes.push(`оценил ${criteriaNames[f]} на ${val}`);
                } else {
                    changes.push(`изменил ${criteriaNames[f]} с ${oldVal} на ${val}`);
                }
            }
        }
    });

    // Отправляем лог об изменении оценок (если они были)
    if (changes.length > 0) {
        const actionText = changes.join(', ');
        logActivity(m.title, actionText);
    }

    // Лог изменения статуса (например, перекинул из Колеса в Просмотрено вручную)
    if (m.status !== updateData.status && myNewScore === 0) {
        logActivity(m.title, `Изменил статус: ${m.status} ➔ ${updateData.status}`);
    }

    // === АВТОМАТИЗАЦИЯ СТАТУСОВ (Старая логика) ===
    if (myNewScore > 0) {
        const friendRole = currentRole === 'me' ? 'any' : 'me';
        const friendScore = (Number(m[`plot_${friendRole}`] || 0) + Number(m[`ending_${friendRole}`] || 0) + Number(m[`actors_${friendRole}`] || 0) + Number(m[`reviewability_${friendRole}`] || 0) + Number(m[`atmosphere_${friendRole}`] || 0) + Number(m[`music_${friendRole}`] || 0));

        if (friendScore > 0) {
            updateData.status = 'Просмотрено';
            updateData.view_type = 'both';
        } else {
            if (m.status === 'СМОТРИМ СЕЙЧАС') {
                updateData.status = 'СМОТРИМ СЕЙЧАС';
            } else {
                updateData.status = 'Просмотрено';
                updateData.view_type = currentRole;
            }
        }
    }
    
    const { error } = await supabaseClient.from('movies').update(updateData).eq('id', currentMovieId);
    
    if (error) {
        showToast("Ошибка сохранения", "error");
    } else {
        showToast("Сохранено!", "success");
        Object.assign(m, updateData);
        setTimeout(() => location.reload(), 800);
    }
}

/**
 * Удаляет фильм из базы данных
 * Требует подтверждение пользователя
 */
async function deleteMovie() {
    if (confirm("Удалить?")) {
        await supabaseClient.from('movies').delete().eq('id', currentMovieId);
        location.reload();
    }
}

// 4. Сохраняет новые данные в базу (Supabase)
async function saveProfile() {
    const newNick = document.getElementById('profile-nickname-input').value.trim();
    const newAvatar = document.getElementById('profile-avatar-input').value.trim();
    const newPass = document.getElementById('profile-password-input').value.trim();
    
    if (!newNick) {
        showToast("НИКНЕЙМ НЕ МОЖЕТ БЫТЬ ПУСТЫМ", "error");
        return;
    }

    // Подготавливаем данные для отправки в базу
    const updates = { nickname: newNick, avatar_url: newAvatar };
    if (newPass) updates.password = newPass; // Если ввели новый пароль - меняем и его

    // Обновляем строку в Supabase
    const { error } = await supabaseClient.from('users').update(updates)
        .eq('role', currentRole);

    if (error) {
        showToast("ОШИБКА СОХРАНЕНИЯ", "error");
        console.error(error);
        return;
    }

    // Обновляем данные на сайте без перезагрузки
    currentUserData.nickname = newNick;
    currentUserData.avatar_url = newAvatar;
    
    localStorage.setItem('movie_user_data', JSON.stringify(currentUserData));
    updateUserProfileUI(); // Обновляем шапку
    
    closeProfileModal();
    showToast("ПРОФИЛЬ УСПЕШНО ОБНОВЛЕН", "success");
    
    // Перерисовываем список фильмов, чтобы обновить ники на карточках
    renderMovies(filteredMovies.length ? filteredMovies : allMovies); 
}

/**
 * Переводит фильм из Соло в Общий просмотр
 */
async function joinMovie() {
    // Тот самый вопрос "Вы уверены?"
    const confirmed = confirm("Вы подтверждаете, что тоже посмотрели этот фильм? Это разблокирует ваши оценки и добавит фильм в общую статистику.");
    
    if (!confirmed) return;

    try {
        const { error } = await supabaseClient
            .from('movies')
            .update({ view_type: 'both' })
            .eq('id', currentMovieId);

        if (error) {
            showToast("ОШИБКА ОБНОВЛЕНИЯ", "error");
            console.error(error);
        } else {
            showToast("ТЕПЕРЬ ЭТО ОБЩИЙ ПРОСМОТР!", "success");
            
            // Обновляем данные локально и перерисовываем окно
            const movie = allMovies.find(m => m.id === currentMovieId);
            if (movie) movie.view_type = 'both';
            
            // Маленькая пауза для красоты и закрываем/открываем для обновления UI
            setTimeout(() => {
                const updatedMovie = allMovies.find(m => m.id === currentMovieId);
                renderModalContent(updatedMovie);
                fetchMovies(); // Обновляем сетку, чтобы убрать замок
            }, 500);
        }
    } catch (err) {
        showToast("СБОЙ СЕТИ", "error");
    }
}

/**
 * Кнопка "Завершить": открывает оценки
 */
function finishWatching(id) {
    // Открываем модалку фильма, где уже можно нажать "Просмотрено" и поставить оценки
    openModalById(id);
}

/**
 * Кнопка "Отменить": возвращает фильм в колесо
 */
async function cancelWatching(id) {
    if (!confirm("Отменить просмотр и вернуть фильм в рулетку?")) return;

    try {
        const { error } = await supabaseClient
            .from('movies')
            .update({ status: 'В колесе' })
            .eq('id', id);

        if (error) throw error;

        if (typeof logActivity === 'function') {
            const movie = allMovies.find(m => m.id == id);
            if (movie) logActivity(movie.title, "Отменил просмотр (вернул в колесо)");
        }

        showToast("ПРОСМОТР ОТМЕНЕН", "info");
        
        // Обновляем данные и интерфейс
        const movie = allMovies.find(m => m.id == id);
        if (movie) {
            movie.status = 'В колесе';
            // Заставляем интерфейс перерисоваться
            if (typeof renderNowWatching === 'function') renderNowWatching();
            if (typeof applyFilters === 'function') applyFilters();
        }
    } catch (err) {
        showToast("ОШИБКА ОТМЕНЫ", "error");
    }
}

/**
 * Переключает статус Просмотрено / Не просмотрено с учетом соло-просмотров
 */
async function toggleMovieStatus() {
    const m = allMovies.find(movie => movie.id === currentMovieId);
    if (!m) return;

    const myScore = (Number(m.plot_me || 0) + Number(m.ending_me || 0) + Number(m.actors_me || 0) + Number(m.reviewability_me || 0) + Number(m.atmosphere_me || 0) + Number(m.music_me || 0));
    const friendScore = (Number(m.plot_any || 0) + Number(m.ending_any || 0) + Number(m.actors_any || 0) + Number(m.reviewability_any || 0) + Number(m.atmosphere_any || 0) + Number(m.music_any || 0));

    const isViewedByMe = (m.status === 'Просмотрено' && (m.view_type === 'both' || m.view_type === currentRole)) || myScore > 0;
    const isViewedByFriend = (m.status === 'Просмотрено' && (m.view_type === 'both' || (m.view_type !== currentRole && m.view_type !== 'guest'))) || friendScore > 0;

    try {
        if (isViewedByMe) {
            // СЦЕНАРИЙ 1: Я хочу ОТМЕНИТЬ свой просмотр
            let newStatus = 'Не просмотрено';
            let newViewType = 'none';

            // Если друг смотрел, фильм остается "Просмотрено", но только для него
            if (isViewedByFriend) {
                newStatus = 'Просмотрено';
                newViewType = currentRole === 'me' ? 'any' : 'me';
            }

            const updates = {
                status: newStatus,
                view_type: newViewType,
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
            showToast("ОТМЕТКА СНЯТА", "info");

        } else {
            // СЦЕНАРИЙ 2: Я хочу ОТМЕТИТЬ фильм (автоматически удаляет из рулетки/пересмотра)
            let newViewType = currentRole;
            
            if (isViewedByFriend) {
                newViewType = 'both';
            }

            const updates = {
                status: 'Просмотрено', // Жестко ставим Просмотрено
                view_type: newViewType
            };

            const { error } = await supabaseClient.from('movies').update(updates).eq('id', currentMovieId);
            if (error) throw error;
            Object.assign(m, updates);
            showToast("ОТМЕЧЕНО КАК ПРОСМОТРЕННОЕ", "success");
        }

        setTimeout(() => {
            const updatedMovie = allMovies.find(movie => movie.id === currentMovieId);
            renderModalContent(updatedMovie);
            if (typeof fetchMovies === 'function') fetchMovies(); 
        }, 500);
    } catch (err) {
        console.error(err);
        showToast("СБОЙ СЕТИ", "error");
    }
}

// Установить "заряженный" фильм
async function setRiggedMovie() {
    const movieId = document.getElementById('admin-movie-select').value;
    if (!movieId) return;

    // ИСПРАВЛЕНО: Снимаем метки только с тех фильмов, где они реально стоят
    await supabaseClient.from('movies').update({ is_rigged: false }).eq('is_rigged', true);

    // Ставим новую метку
    const { error } = await supabaseClient.from('movies').update({ is_rigged: true }).eq('id', movieId);

    if (error) {
        showToast("Ошибка подкрутки", "error");
    } else {
        showToast("ФИЛЬМ ЗАРЯЖЕН НА ПОБЕДУ", "success");
        closeAdminModal();
        fetchMovies(); // Обновляем локальные данные
    }
}

// Сбросить подкрутку
async function resetRiggedMovie() {
    // ИСПРАВЛЕНО: Снимаем метки только с тех фильмов, где они реально стоят
    const { error } = await supabaseClient.from('movies').update({ is_rigged: false }).eq('is_rigged', true);
    
    if (!error) {
        showToast("ПОДКРУТКА СБРОШЕНА", "info");
        closeAdminModal();
        fetchMovies();
    } else {
        showToast("Ошибка при сбросе", "error");
        console.error(error);
    }
}

// ==========================================
// ЛЕНТА АКТИВНОСТИ
// ==========================================

/**
 * Отправляет запись о действии в базу данных
 */
async function logActivity(movieTitle, actionText) {
    // Гостей не отслеживаем
    if (currentRole !== 'me' && currentRole !== 'any') return;
    
    await supabaseClient.from('activity_logs').insert([{
        user_role: currentRole,
        movie_title: movieTitle,
        action_text: actionText
    }]);
}

/**
 * Проверяет, есть ли новые события для серебряной точки
 */
async function checkNewActivity() {
    // Берем время последнего открытия ленты (или очень старую дату, если открываем впервые)
    const lastView = localStorage.getItem('last_activity_view') || '2000-01-01T00:00:00.000Z';
    
    // Ищем хотя бы одну запись, которая новее этого времени и сделана НЕ нами
    const { data, error } = await supabaseClient
        .from('activity_logs')
        .select('created_at')
        .gt('created_at', lastView)
        .neq('user_role', currentRole) 
        .limit(1);

    const dot = document.getElementById('activity-dot');
    if (dot) {
        if (!error && data && data.length > 0) {
            dot.style.display = 'block'; // Зажигаем точку!
        } else {
            dot.style.display = 'none';
        }
    }
}