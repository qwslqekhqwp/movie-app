// ==========================================
// КОНФИГУРАЦИЯ И ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ (config.js)
// База данных, ключи API и глобальные состояния приложения
// ==========================================

// TMDB API конфигурация для поиска фильмов
const TMDB_API_KEY = window.ENV_TMDB_API_KEY; 
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

// Supabase конфигурация для хранения данных
const supabaseUrl = window.ENV_SUPABASE_URL; 
const supabaseKey = window.ENV_SUPABASE_KEY;
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// Коды доступа: "777" для "я" и "888" для "сашок-петушок"
const ACCESS_CODES = { 
	"777": { role: "me", name: "я" },
	"888": { role: "any", name: "сашок-петушок" }
};

// ==========================================
// ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ (Стейт приложения)
// ==========================================
var currentRole = localStorage.getItem('movie_role');          
var currentUserData = null;                                   
var userNicknames = { me: "УМНЫЙ", any: "НЕ УМНЫЙ" };        

var allMovies = [];                                           
var filteredMovies = [];                                      
var currentMovieId = null;                                    
var isEditMode = false;                                       
var tempExternalRating = null;                                
var currentRouletteMovies = [];                               
var isSpinning = false;                                       
var wheelAngle = 0;
var currentRadarView = 'both';
var allUsersData = {};
var currentMainView = 'movies'; // Для переключателя коллекций
var currentStatusFilter = 'all'; // Для таблеток статуса

var allUsersData = {};
var currentMainView = 'movies'; // Для переключателя коллекций
var currentStatusFilter = 'all'; // Для таблеток статуса

// Переменные для бесконечного скролла
var moviesRenderedCount = 0;