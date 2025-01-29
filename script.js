// Constants
const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snacks'];
const STORAGE_KEYS = {
    MEAL_DATA: 'mealData',
    NUTRITION_GOALS: 'nutritionGoals',
    THEME: 'theme'
};
const CALORIE_NINJA_API_KEY = '2auzuiPLEkkHzFvmOhnErYCAR4bRd1xE4kKvadQo';

// DOM Elements 
const totalCal = document.getElementById('totalCal');
const totalProtein = document.getElementById('totalProtein');
const totalCarbs = document.getElementById('totalCarbs');
const totalFat = document.getElementById('totalFat');
const editGoalsBtn = document.getElementById('editGoalsBtn');
const calorieGoalDisplay = document.getElementById('calorieCount');
const proteinGoalDisplay = document.getElementById('proteinCount');
const carbsGoalDisplay = document.getElementById('carbsCount');
const fatGoalDisplay = document.getElementById('fatCount');
const calorieProgress = document.getElementById('calorieProgress');
const proteinProgress = document.getElementById('proteinProgress');
const carbsProgress = document.getElementById('carbsProgress');
const fatProgress = document.getElementById('fatProgress');
const prevDateBtn = document.getElementById('prevDate');
const nextDateBtn = document.getElementById('nextDate');
const currentDateSpan = document.getElementById('currentDate');
const addMealModal = document.getElementById('addMealModal');
const closeBtn = document.querySelector('.close-button');
const addMealForm = document.getElementById('addMealForm');
const dishNameInput = document.getElementById('dishName');
const caloriesInput = document.getElementById('calories');
const proteinInput = document.getElementById('protein');
const carbsInput = document.getElementById('carbs');
const fatInput = document.getElementById('fat');
const photoInput = document.getElementById('photo');
const mealTypeInput = document.getElementById('mealTypeInput');
const servingsInput = document.getElementById('servings');
const searchInput = document.getElementById('foodSearch');
const searchResultsContainer = document.getElementById('searchResults');
const themeToggle = document.querySelector('.theme-toggle');
const themeIcon = themeToggle.querySelector('i');
const searchInputWrapper = document.querySelector('.search-input-wrapper');
const clearSearchBtn = document.querySelector('.clear-search');
const fileInput = document.getElementById('photo');
const previewContainer = document.querySelector('.preview-container');
const imagePreview = document.getElementById('imagePreview');
const removeBtn = document.querySelector('.remove-image-btn');
const uploadLabel = document.querySelector('.file-upload-label');
const uploadContent = document.querySelector('.upload-content');

// Goal input fields
let calorieGoalInput;
let proteinGoalInput;
let carbsGoalInput;
let fatGoalInput;
let saveGoalsBtn;
let cancelEditGoalsBtn;
let selectedSearchItem = null;
let searchTimeout;

// Global State
const state = {
    isEditingGoals: false,
    selectedDate: new Date().toISOString().split('T')[0],
    mealData: {},
    nutritionGoals: {
        calories: 2000,
        protein: 150,
        carbs: 250,
        fat: 65
    }
};

// ----- Helper Functions -----
const safeDivision = (numerator, denominator) =>
    denominator === 0 ? 0 : (numerator / denominator) * 100;

const validateNutritionInput = (value) =>
    Math.max(0, Number(value)) || 0;

const debounce = (fn, delay) => {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
};

// create the toast element and add it to the body
const toastContainer = document.createElement('div');
toastContainer.id = 'toast-container';
document.body.appendChild(toastContainer);


function createToast(message, type) {
    const toast = document.createElement('div');
    toast.classList.add('toast', `toast-${type}`);
    toast.textContent = message;
    toastContainer.appendChild(toast);

    //  timeout to remove the toast after a delay
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

function showToast(message, type = 'info') {
    console.log(`Toast: ${type} - ${message}`);
    createToast(message,type);
}

// ----- event listeners -----
function initializeEventListeners() {
    // static buttons
    editGoalsBtn?.addEventListener('click', toggleEditGoals);
    prevDateBtn?.addEventListener('click', () => changeDate(-1));
    nextDateBtn?.addEventListener('click', () => changeDate(1));
    closeBtn?.addEventListener('click', () => handleModal('close'));
    themeToggle?.addEventListener('click', toggleTheme);
    addMealForm?.addEventListener('submit', handleAddMealFormSubmit);

    // event  for dynamic elements
    document.body.addEventListener('click', (e) => {
        // remove buttons
        if (e.target.closest('.remove-btn')) {
            const foodItem = e.target.closest('.food-item');
            const mealContainer = foodItem.closest('.meal-container');
            const mealType = mealContainer.id;
            const index = Array.from(mealContainer.querySelectorAll('.food-item')).indexOf(foodItem);
            removeFood(mealType, index);
        }

        //  add meal buttons
        if (e.target.closest('.add-meal-btn')) {
            const mealType = e.target.closest('.add-meal-btn').dataset.mealType;
            handleModal('open', mealType);
        }
    });

    // search and file handlers 
    searchInput?.addEventListener('input', handleSearchInput);

    searchInput?.addEventListener('focus', () => {
        searchInputWrapper.classList.add('focused');
    });

    searchInput?.addEventListener('blur', () => {
        searchInputWrapper.classList.remove('focused');
    });

   clearSearchBtn?.addEventListener('click', () => {
        searchInput.value = '';
        clearSearchResults();
        clearSearchBtn.classList.add('hidden');
        document.getElementById('searchButton').classList.remove('hidden');
    });
}

// ----- theme management -----
function initializeTheme() {
    const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME);
    const prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (savedTheme) {
        setTheme(savedTheme);
    } else if (prefersDarkMode) {
        setTheme('dark');
    } else {
        setTheme('light');
    }
}

function setTheme(themeName) {
    document.documentElement.setAttribute('data-theme', themeName);
    localStorage.setItem(STORAGE_KEYS.THEME, themeName);
    updateThemeIcon(themeName);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
}

function updateThemeIcon(theme) {
    themeIcon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
}

// ----- Search functionality -----
const handleSearchInput = debounce(async (event) => {
    const query = event.target.value.trim();

    if (!query) {
        clearSearchResults();
        return;
    }

    try {
        displayLoadingState();
        const response = await fetch(`https://api.calorieninjas.com/v1/nutrition?query=${encodeURIComponent(query)}`, {
            headers: { 'X-Api-Key': CALORIE_NINJA_API_KEY }
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const data = await response.json();

        if (!data.items?.length) {
            displayEmptySearchState(query);
            return;
        }

        displaySearchResults(data.items);
    } catch (error) {
        console.error('Search Error:', error);
        displayErrorState(query);
    }
}, 300);

// search result
function displaySearchResults(results) {
    const resultsList = getSearchResultsList();
    if (!resultsList) return;

    clearSearchResults();
    searchResultsContainer.classList.add('visible');

    if (results.length === 0) {
        resultsList.innerHTML = `
            <div class="search-empty-state">
                <i class="fas fa-search-minus" aria-hidden="true"></i>
                <p>No matching foods found. Try a different search term.</p>
            </div>
        `;
        return;
    }

    results.forEach((item, index) => {
        const resultItem = document.createElement('article');
        resultItem.className = 'search-item';
        resultItem.tabIndex = 0;
        resultItem.setAttribute('role', 'option');
        resultItem.setAttribute('aria-selected', 'false');
        resultItem.innerHTML = `
            <div class="search-item-content">
                <header class="search-item-header">
                    <h4 class="search-item-name">${item.name}</h4>
                    <div class="search-item-meta">
                        <span class="calorie-badge">
                            <i class="fas fa-fire" aria-hidden="true"></i>
                            ${Math.round(item.calories)} kcal
                        </span>
                        <span class="serving-size">
                            <i class="fas fa-weight" aria-hidden="true"></i>
                            ${item.serving_size_g || 100}g
                        </span>
                    </div>
                </header>
                <div class="search-item-nutrition">
                    <div class="nutrition-pill protein">
                        <i class="fas fa-dumbbell" aria-hidden="true"></i>
                        ${Math.round(item.protein_g)}g protein
                    </div>
                    <div class="nutrition-pill carbs">
                        <i class="fas fa-bread-slice" aria-hidden="true"></i>
                        ${Math.round(item.carbohydrates_total_g)}g carbs
                    </div>
                    <div class="nutrition-pill fat">
                        <i class="fas fa-cheese" aria-hidden="true"></i>
                        ${Math.round(item.fat_total_g)}g fat
                    </div>
                </div>
            </div>
            <button class="select-result-btn" aria-label="Select ${item.name}">
                <i class="fas fa-plus" aria-hidden="true"></i>
            </button>
        `;

        // keyboard navigation 
        resultItem.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                selectSearchResult(item);
            }
        });

        // click handlers for the item and the select button
        resultItem.addEventListener('click', () => selectSearchResult(item));
        resultItem.querySelector('.select-result-btn').addEventListener('click', () => selectSearchResult(item));

        resultsList.appendChild(resultItem);
    });

    //  clear button visibility
    document.querySelector('.clear-search').classList.remove('hidden');
    document.getElementById('searchButton').classList.add('hidden');

    //  keyboard navigation between results
    resultsList.addEventListener('keydown', handleKeyboardNavigation);
}

//  function for keyboard navigation
function handleKeyboardNavigation(e) {
    const items = Array.from(document.querySelectorAll('.search-item'));
    const currentIndex = items.indexOf(document.activeElement);
    
    if (e.key === 'ArrowDown') {
        const nextIndex = (currentIndex + 1) % items.length;
        items[nextIndex].focus();
    } else if (e.key === 'ArrowUp') {
        const prevIndex = (currentIndex - 1 + items.length) % items.length;
        items[prevIndex].focus();
    }
}
// rror state display
function displayErrorState(query) {
    const resultsList = getSearchResultsList();
    if (!resultsList) return;

    resultsList.innerHTML = `
        <div class="search-error-state" role="alert">
            <i class="fas fa-exclamation-circle" aria-hidden="true"></i>
            <p>Unable to search for "${query}". Please try again later.</p>
        </div>
    `;
    searchResultsContainer.classList.add('visible');
}

// ate limiting and error handling to search
const rateLimiter = {
    lastCall: 0,
    minInterval: 500, // ms between calls

    canMakeCall() {
        const now = Date.now();
        if (now - this.lastCall >= this.minInterval) {
            this.lastCall = now;
            return true;
        }
        return false;
    }
};

async function performSearch(query) {
    if (!rateLimiter.canMakeCall()) {
        console.log('Rate limited, skipping search');
        return;
    }

    try {
        const resultsList = getSearchResultsList();
        if (!resultsList) return;

        displayLoadingState();
        debouncedSearch(query); // call debouncedsearch directly
    } catch (error) {
        console.error('Search failed:', error);
        displayErrorState(query);
    }
}
function displayLoadingState() {
    const resultsList = getSearchResultsList();
    resultsList.innerHTML = `
        <div class="search-loading">
            <div class="loading-dot"></div>
            <div class="loading-dot"></div>
            <div class="loading-dot"></div>
        </div>
    `;
    searchResultsContainer.classList.add('visible');
}
function displayEmptySearchState(query) {
    const resultsList = getSearchResultsList();
     resultsList.innerHTML = `
                <div class="search-empty-state">
                    <i class="fas fa-search-minus"></i>
                    <p>No results found for "${query}"</p>
                </div>
            `;
}
function clearSearchResults() {
    searchResultsContainer?.classList.remove('visible');
    const resultsList = getSearchResultsList();
    if(resultsList) {
        resultsList.innerHTML = '';
    }
    clearSearchBtn?.classList.add('hidden'); // hide clear button
    document.getElementById('searchButton')?.classList.remove('hidden'); // show search button
     selectedSearchItem = null;
}

function getSearchResultsList() {
    if (!searchResultsContainer) {
            console.error('Search results container not found');
              return null;
        }

        let resultsList = searchResultsContainer.querySelector('.search-results-list');
         if (!resultsList) {
             resultsList = document.createElement('div');
              resultsList.className = 'search-results-list';
            searchResultsContainer.appendChild(resultsList);
        }

     return resultsList;
}

function selectSearchResult(item) {
    selectedSearchItem = item;
    dishNameInput.value = item.name;
    caloriesInput.value = Math.round(item.calories);
    proteinInput.value = Math.round(item.protein_g);
    carbsInput.value = Math.round(item.carbohydrates_total_g);
    fatInput.value = Math.round(item.fat_total_g);

    // clean search results
    clearSearchResults();
    document.getElementById('searchButton').classList.remove('hidden');
    clearSearchBtn.classList.add('hidden');

    // Remove the handleSearch() function
    const resultsList = getSearchResultsList();
    if(resultsList){
        resultsList.querySelectorAll('.search-item').forEach(el => el.classList.remove('selected'));
        const selectedElement = Array.from(resultsList.children).find(el =>
            el.querySelector('.search-item-name').textContent === item.name
        );
        if (selectedElement) {
            selectedElement.classList.add('selected');
        }
    }
}
// ----- date management -----
const changeDate = (offset) => {
    const date = new Date(state.selectedDate);
    date.setDate(date.getDate() + offset);

    // Prevent future dates selection
    const today = new Date();
    today.setHours(0,0,0,0);
    if (date > today && offset > 0) {
        showToast("Can't select future dates", 'warning');
        return;
    }

    state.selectedDate = date.toISOString().split('T')[0];
    updateDateDisplay();
    loadDayData();
    updateUI();
};

function updateDateDisplay() {
    const date = new Date(state.selectedDate);
    currentDateSpan.textContent = date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// ----- data management -----
function loadDayData() {
    const storedData = localStorage.getItem(STORAGE_KEYS.MEAL_DATA);
    if (storedData) {
        state.mealData = JSON.parse(storedData);
    }
    if (!state.mealData[state.selectedDate]) {
        state.mealData[state.selectedDate] = {
            breakfast: [],
            lunch: [],
            dinner: [],
            snacks: []
        };
    }
}

function saveDayData() {
    localStorage.setItem(STORAGE_KEYS.MEAL_DATA, JSON.stringify(state.mealData));
}

function loadSavedGoals() {
    const savedGoals = localStorage.getItem(STORAGE_KEYS.NUTRITION_GOALS);
    if (savedGoals) {
        state.nutritionGoals = JSON.parse(savedGoals);
    }
}

// ----- UI functions -----
function updateMealContainers() {
    MEAL_TYPES.forEach(mealType => {
        const container = document.getElementById(mealType);
        const items = state.mealData[state.selectedDate][mealType];
        const itemsContainer = container.querySelector('.meal-items');
        itemsContainer.innerHTML = '';

        if (items.length === 0) {
            const emptyState = document.createElement('div');
            emptyState.className = 'empty-meal-state';
            emptyState.innerHTML = `No ${mealType} items added yet`;
            itemsContainer.appendChild(emptyState);
            return;
        }

        items.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'food-item';
            div.innerHTML = `
                <div class="food-image">
                    ${item.photo ? `<img src="${item.photo}" alt="${item.name}">` : ''}
                </div>
                <div class="food-content">
                    <div class="food-name"><strong>${item.name}</strong></div>
                    <div class="food-details">
                        <div>Calories: ${item.calories}</div>
                        <div>Protein: ${item.protein}g</div>
                        <div>Carbs: ${item.carbs}g</div>
                        <div>Fat: ${item.fat}g</div>
                    </div>
                </div>
                <span class="food-servings">Servings: ${item.servings}</span>
                <button class="remove-btn">
                    <i class="fas fa-trash"></i>
                </button>
            `;
            itemsContainer.appendChild(div);
        });
    });
}

function updateNutritionTotals() {
    const totals = calculateDayTotals();

    totalCal.textContent = Math.round(totals.calories);
    totalProtein.textContent = `${Math.round(totals.protein)}g`;
    totalCarbs.textContent = `${Math.round(totals.carbs)}g`;
    totalFat.textContent = `${Math.round(totals.fat)}g`;

    calorieGoalDisplay.innerHTML = state.isEditingGoals ? `<input type="number" id="calorieGoalInput" value="${state.nutritionGoals.calories}" class="goal-input-field"> / ${state.nutritionGoals.calories}` : `${Math.round(totals.calories)} / ${state.nutritionGoals.calories}`;
    proteinGoalDisplay.innerHTML = state.isEditingGoals ? `<input type="number" id="proteinGoalInput" value="${state.nutritionGoals.protein}" class="goal-input-field">g / ${state.nutritionGoals.protein}g` : `${Math.round(totals.protein)}g / ${state.nutritionGoals.protein}g`;
    carbsGoalDisplay.innerHTML = state.isEditingGoals ? `<input type="number" id="carbsGoalInput" value="${state.nutritionGoals.carbs}" class="goal-input-field">g / ${state.nutritionGoals.carbs}g` : `${Math.round(totals.carbs)}g / ${state.nutritionGoals.carbs}g`;
    fatGoalDisplay.innerHTML = state.isEditingGoals ? `<input type="number" id="fatGoalInput" value="${state.nutritionGoals.fat}" class="goal-input-field">g / ${state.nutritionGoals.fat}g` : `${Math.round(totals.fat)}g / ${state.nutritionGoals.fat}g`;


    updateProgressBars(totals);
}

function updateProgressBars(totals) {
    const caloriePercentage = safeDivision(totals.calories, state.nutritionGoals.calories);
    const proteinPercentage = safeDivision(totals.protein, state.nutritionGoals.protein);
    const carbsPercentage = safeDivision(totals.carbs, state.nutritionGoals.carbs);
    const fatPercentage = safeDivision(totals.fat, state.nutritionGoals.fat);

    calorieProgress.style.width = `${caloriePercentage}%`;
    proteinProgress.style.width = `${proteinPercentage}%`;
    carbsProgress.style.width = `${carbsPercentage}%`;
    fatProgress.style.width = `${fatPercentage}%`;

    calorieProgress.style.backgroundColor = caloriePercentage > 100 ? '#e74c3c' : '';
    proteinProgress.style.backgroundColor = proteinPercentage > 100 ? '#e74c3c' : '';
    carbsProgress.style.backgroundColor = carbsPercentage > 100 ? '#e74c3c' : '';
    fatProgress.style.backgroundColor = fatPercentage > 100 ? '#e74c3c' : '';
}

// ----- goals management -----
function toggleEditGoals() {
    state.isEditingGoals = !state.isEditingGoals;
    updateNutritionTotals();
    renderGoalEditElements();
}

function renderGoalEditElements() {
    const goalsHeader = document.querySelector('.goals-header');
    if (state.isEditingGoals) {
        editGoalsBtn.classList.add('hidden');
        editGoalsBtn.setAttribute('aria-label', 'Edit nutrition goals');

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'edit-actions';

        saveGoalsBtn = document.createElement('button');
        saveGoalsBtn.textContent = 'Save';
        saveGoalsBtn.className = 'primary-btn small-btn';
        saveGoalsBtn.addEventListener('click', saveGoals);
        actionsDiv.appendChild(saveGoalsBtn);

        cancelEditGoalsBtn = document.createElement('button');
        cancelEditGoalsBtn.textContent = 'Cancel';
        cancelEditGoalsBtn.className = 'secondary-btn small-btn';
        cancelEditGoalsBtn.addEventListener('click', cancelEditGoals);
        actionsDiv.appendChild(cancelEditGoalsBtn);

        goalsHeader.appendChild(actionsDiv);
    } else {
        editGoalsBtn.classList.remove('hidden');
        editGoalsBtn.setAttribute('aria-label', 'Edit nutrition goals');
        const actionsDiv = goalsHeader.querySelector('.edit-actions');
        if (actionsDiv) {
            goalsHeader.removeChild(actionsDiv);
        }
    }
}

function cancelEditGoals() {
    state.isEditingGoals = false;
    updateNutritionTotals();
    renderGoalEditElements();
}

function saveGoals() {
    calorieGoalInput = document.getElementById('calorieGoalInput');
    proteinGoalInput = document.getElementById('proteinGoalInput');
    carbsGoalInput = document.getElementById('carbsGoalInput');
    fatGoalInput = document.getElementById('fatGoalInput');

    state.nutritionGoals = {
        calories: validateNutritionInput(calorieGoalInput.value) || 2000,
        protein: validateNutritionInput(proteinGoalInput.value) || 150,
        carbs: validateNutritionInput(carbsGoalInput.value) || 250,
        fat: validateNutritionInput(fatGoalInput.value) || 65
    };
    localStorage.setItem(STORAGE_KEYS.NUTRITION_GOALS, JSON.stringify(state.nutritionGoals));
    state.isEditingGoals = false;
    updateNutritionTotals();
    renderGoalEditElements();
}

// ----- Modal Handling -----
function handleModal(action, mealType) {
    switch(action) {
        case 'open':
            addMealModal.classList.add('show');
            addMealModal.classList.remove('hidden');
            mealTypeInput.value = mealType;
            addMealForm.reset();
            clearSearchResults(); // Changed from handleSearch()
            resetImagePreview();
            selectedSearchItem = null;
            break;
        case 'close':
            addMealModal.classList.remove('show');
            addMealModal.classList.add('hidden');
            addMealForm.reset();
            clearSearchResults(); // Changed from handleSearch()
            resetImagePreview();
            selectedSearchItem = null;
            break;
        default:
          break;
    }
}

function outsideClick(event) {
    if (event.target === addMealModal) {
        handleModal('close')
    }
}

// -----  add meal form submission -----
function handleAddMealFormSubmit(event) {
    event.preventDefault();

    // add validation before submission
    if (!mealTypeInput.value || !dishNameInput.value.trim() || !caloriesInput.value || !proteinInput.value || !carbsInput.value || !fatInput.value) {
        showToast('Please fill required fields', 'error');
        return;
    }

    if (servingsInput.value < 1) {
        showToast('Servings must be at least 1', 'error');
        return;
    }

    const mealType = mealTypeInput.value;
    const dishName = selectedSearchItem ? selectedSearchItem.name : dishNameInput.value;
    const servings = Number(servingsInput.value);
    const caloriesPerServing = validateNutritionInput(caloriesInput.value);
    const proteinPerServing = validateNutritionInput(proteinInput.value);
    const carbsPerServing = validateNutritionInput(carbsInput.value);
    const fatPerServing = validateNutritionInput(fatInput.value);
    const photoFile = photoInput.files[0];

    const totalCalories = caloriesPerServing * servings;
    const totalProtein = proteinPerServing * servings;
    const totalCarbs = carbsPerServing * servings;
    const totalFat = fatPerServing * servings;
    let photoBase64 = null;

    if (photoFile) {
        // file size validation moved to file input change listener
        const reader = new FileReader();
        reader.onload = function (e) {
            photoBase64 = e.target.result;
            addMealItem(mealType, dishName, totalCalories, totalProtein, totalCarbs, totalFat, servings, photoBase64);
        }
        reader.readAsDataURL(photoFile);
    } else {
        addMealItem(mealType, dishName, totalCalories, totalProtein, totalCarbs, totalFat, servings, null);
    }

   handleModal('close');
}

// ----- meal management -----
function addMealItem(mealType, name, calories, protein, carbs, fat, servings, photo) {
    const newItem = { name, calories, protein, carbs, fat, servings, photo };
    state.mealData[state.selectedDate][mealType].push(newItem);
    saveDayData();
    updateUI();
}

// ----- utility funct -----
function calculateDayTotals() {
    const totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    const dayData = state.mealData[state.selectedDate];

    MEAL_TYPES.forEach(mealType => {
        if (dayData && dayData[mealType]) {
            dayData[mealType].forEach(item => {
                totals.calories += Number(item.calories) || 0;
                totals.protein += Number(item.protein) || 0;
                totals.carbs += Number(item.carbs) || 0;
                totals.fat += Number(item.fat) || 0;
            });
        }
    });

    return totals;
}

function updateUI() {
    updateDateDisplay();
    updateMealContainers();
    updateNutritionTotals();
}

// ----- Init -----
function init() {
    // check  critical elements
    if (!editGoalsBtn || !prevDateBtn || !nextDateBtn || !closeBtn) {
        console.error('Critical elements missing from DOM!');
        return;
    }

    initializeTheme();
    loadSavedGoals();
    loadDayData();
    initializeEventListeners();
    initializeFileUpload();
    updateUI();
     editGoalsBtn.setAttribute('aria-label', 'Edit nutrition goals');
}

document.addEventListener('DOMContentLoaded', init);
// file upload 
function initializeFileUpload() {
    //  validation
    fileInput?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) { // 2MB limit
            showToast('Image must be smaller than 2MB', 'error');
            resetImagePreview();
            return;
        }

        const validTypes = ['image/jpeg', 'image/png'];
        if (!validTypes.includes(file.type)) {
            showToast('Only JPG/PNG images allowed', 'error');
            resetImagePreview();
            return;
        }

        handleFileSelect(file);
    });

    // drag and drop handlers
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        uploadLabel?.addEventListener(eventName, preventDefaults, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        uploadLabel?.addEventListener(eventName, highlightDropzone, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        uploadLabel?.addEventListener(eventName, unhighlightDropzone, false);
    });

    uploadLabel?.addEventListener('drop', handleDrop, false);
}

function handleFileSelect(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        imagePreview.src = e.target.result;
        previewContainer.classList.remove('hidden');
        uploadContent.classList.add('hidden');
    };
    reader.readAsDataURL(file);
}

function resetImagePreview() {
    fileInput.value = '';
    imagePreview.src = '';
    previewContainer.classList.add('hidden');
    uploadContent.classList.remove('hidden');
     if (imagePreview.src.startsWith('blob:')) {
        URL.revokeObjectURL(imagePreview.src);
    }
}

// H functions for drag and drop
function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

function highlightDropzone() {
    uploadLabel.classList.add('dragover');
}

function unhighlightDropzone() {
    uploadLabel.classList.remove('dragover');
}

function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;

    if (files.length > 0) {
        const file = files[0];
        if (file.type.startsWith('image/')) {
            fileInput.files = files;
            fileInput.dispatchEvent(new Event('change'));
        } else {
            showToast('Only image files allowed', 'error');
        }
    }
}
function removeFood(mealType, index) {
    if (!MEAL_TYPES.includes(mealType)) {
        console.error('Invalid meal type:', mealType);
        showToast('Error removing food item', 'error');
        return;
    }

    if (index >= 0 && index < state.mealData[state.selectedDate][mealType].length) {
        // Remove item from the array
        state.mealData[state.selectedDate][mealType].splice(index, 1);
        // save the updated data
        saveDayData();
        // update the UI
        updateUI();
        showToast('Food item removed', 'success');
    } else {
        console.error('Invalid index for removal:', index);
         showToast('Error removing food item', 'error');
    }
}