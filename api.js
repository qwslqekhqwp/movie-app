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
            .select('role, nickname, avatar_url'); // <--- ДОБАВИЛИ avatar_url

        if (!userError && users) {
            users.forEach(u => {
                userNicknames[u.role] = u.nickname;
                allUsersData[u.role] = u; // <--- СОХРАНЯЕМ ВСЕ ДАННЫЕ В ПАМЯТЬ
            });
            
            // --- Динамически переименовываем фильтры ---
            const optMe = document.querySelector('#filter-assessment option[value="only_me"]');
            const optAny = document.querySelector('#filter-assessment option[value="only_any"]');
            
            if (optMe) optMe.textContent = `Оценил ${userNicknames.me}`;
            if (optAny) optAny.textContent = `Оценил ${userNicknames.any}`;
        }

        // 2. Теперь скачиваем сами фильмы
        const { data: movies, error: movieError } = await supabaseClient
            .from('movies')
            .select('*');

        if (movieError) {
            showToast("ОШИБКА ЗАГРУЗКИ ФИЛЬМОВ", "error");
            console.error(movieError);
            return;
        }

        // 3. Сохраняем и отображаем
        allMovies = movies;
        updateFilterOptions();
        applyFilters(); // Эта функция уберет скелеты и нарисует карточки

    } catch (err) {
        console.error("Критическая ошибка:", err);
        showToast("СБОЙ ПРИ ЗАГРУЗКЕ", "error");
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
 * Обновляет базу данных и перезагружает страницу
 */
async function saveRatings() {
    const updateData = { 
        review_common: document.getElementById('review-common').value, 
        status: document.getElementById('edit-status').value,
        updated_at: new Date().toISOString()
    };
    
    if (isEditMode) {
        // Сохраняем данные фильма если находимся в режиме редактирования
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
    
    // Сохраняем оценки текущего пользователя
    ['plot', 'ending', 'reviewability', 'actors', 'atmosphere', 'music'].forEach(f => {
        const input = document.getElementById(`input-${f}_${currentRole}`);
        if (input) updateData[`${f}_${currentRole}`] = parseInt(input.value) || 0;
    });
    
    const { error } = await supabaseClient.from('movies').update(updateData).eq('id', currentMovieId);
    if (error) showToast("Ошибка сохранения", "error"); else { showToast("Сохранено!", "success"); setTimeout(() => location.reload(), 800); }
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