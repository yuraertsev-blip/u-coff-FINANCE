// === State & LocalStorage ===
const STORE_PREFIX = 'u_coffee';
const DEFAULT_CATEGORIES = [
    { id: 'cat_1', name: 'Аренда' },
    { id: 'cat_2', name: 'Зарплата' },
    { id: 'cat_3', name: 'Хоз. товары' },
    { id: 'cat_4', name: 'Продукты' },
    { id: 'cat_5', name: 'Налоги' },
];

let state = {
    currentDate: new Date(),
    categories: [],
    income: {}, // { 'YYYY-MM-DD': amount }
    expenses: {} // { 'YYYY-MM-DD': [{ id, name, categoryId, amount }] }
};

function loadState() {
    const cats = localStorage.getItem(`${STORE_PREFIX}_categories`);
    state.categories = cats ? JSON.parse(cats) : [...DEFAULT_CATEGORIES];

    const inc = localStorage.getItem(`${STORE_PREFIX}_income`);
    state.income = inc ? JSON.parse(inc) : {};

    const exp = localStorage.getItem(`${STORE_PREFIX}_expenses`);
    state.expenses = exp ? JSON.parse(exp) : {};
    
    // Auto-save initial defaults if empty
    if (!cats) saveState('categories');
}

function saveState(key) {
    if (key === 'categories') localStorage.setItem(`${STORE_PREFIX}_categories`, JSON.stringify(state.categories));
    if (key === 'income') localStorage.setItem(`${STORE_PREFIX}_income`, JSON.stringify(state.income));
    if (key === 'expenses') localStorage.setItem(`${STORE_PREFIX}_expenses`, JSON.stringify(state.expenses));
}

// === Utils ===
function formatDateStr(date) {
    const d = new Date(date);
    let month = '' + (d.getMonth() + 1);
    let day = '' + d.getDate();
    let year = d.getFullYear();

    if (month.length < 2) month = '0' + month;
    if (day.length < 2) day = '0' + day;

    return [year, month, day].join('-');
}

function parseLocalDate(dateStr) {
    if (!dateStr) return new Date();
    const parts = dateStr.split('-');
    if (parts.length !== 3) return new Date(dateStr);
    return new Date(parts[0], parts[1] - 1, parts[2]);
}

function formatNumber(num) {
    if (!num) return '';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function parseNumber(str) {
    if (!str) return 0;
    return parseInt(str.replace(/\s/g, ''), 10) || 0;
}

// === Navigation ===
function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const views = document.querySelectorAll('.view');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetId = item.getAttribute('data-target');
            
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');

            views.forEach(v => {
                if (v.id === targetId) {
                    v.classList.add('active');
                } else {
                    v.classList.remove('active');
                }
            });

            // Refresh specific views on enter
            if (targetId === 'view-data') {
                renderDataEntry();
            } else if (targetId === 'view-analytics') {
                renderAnalytics();
            } else if (targetId === 'view-settings') {
                renderSettings();
            }
        });
    });
}

// === Calendar ===
function initCalendar() {
    const btnPrev = document.getElementById('cal-prev');
    const btnNext = document.getElementById('cal-next');
    
    btnPrev.addEventListener('click', () => {
        state.currentDate.setMonth(state.currentDate.getMonth() - 1);
        renderCalendar();
    });
    
    btnNext.addEventListener('click', () => {
        state.currentDate.setMonth(state.currentDate.getMonth() + 1);
        renderCalendar();
    });

    renderCalendar();
}

function renderCalendar() {
    const monthYearStr = state.currentDate.toLocaleString('ru-RU', { month: 'long', year: 'numeric' });
    document.getElementById('cal-month-year').textContent = monthYearStr.charAt(0).toUpperCase() + monthYearStr.slice(1);

    const grid = document.getElementById('cal-days-grid');
    grid.innerHTML = '';

    // Generate a simple week view for prototype (centered around selected date)
    // For a full app, we would make a swipable calendar. Here we show 7 days.
    const startOfWeek = new Date(state.currentDate);
    const dayOfWeek = startOfWeek.getDay() === 0 ? 6 : startOfWeek.getDay() - 1; // Mon=0
    startOfWeek.setDate(startOfWeek.getDate() - dayOfWeek);

    const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

    for (let i = 0; i < 7; i++) {
        const d = new Date(startOfWeek);
        d.setDate(d.getDate() + i);
        const dateStr = formatDateStr(d);
        
        const el = document.createElement('div');
        el.className = 'cal-day';
        if (dateStr === formatDateStr(state.currentDate)) {
            el.classList.add('active');
        }
        
        // Has data marker
        if (state.income[dateStr] > 0 || (state.expenses[dateStr] && state.expenses[dateStr].some(e => e.amount > 0))) {
            el.classList.add('has-data');
        }

        el.innerHTML = `
            <span class="weekday">${weekdays[i]}</span>
            <span class="day-num">${d.getDate()}</span>
        `;
        
        el.addEventListener('click', () => {
            state.currentDate = new Date(d);
            renderCalendar();
            renderDataEntry();
        });
        
        grid.appendChild(el);
    }
}

// === Data Entry ===
function setupInputFormatting(inputEl, callback) {
    inputEl.addEventListener('input', (e) => {
        let val = e.target.value.replace(/[^\d]/g, ''); // Remove non-digits
        
        // Format with spaces
        if (val !== '') {
            e.target.value = formatNumber(val);
        } else {
            e.target.value = '';
        }
        
        if (callback) callback(parseNumber(e.target.value));
    });
}

function renderDataEntry() {
    const dateStr = formatDateStr(state.currentDate);
    
    // Income
    const incomeInput = document.getElementById('income-input');
    const incomeVal = state.income[dateStr] || '';
    incomeInput.value = formatNumber(incomeVal);
    
    // Clone to remove previous event listeners
    const newIncomeInput = incomeInput.cloneNode(true);
    incomeInput.parentNode.replaceChild(newIncomeInput, incomeInput);
    
    setupInputFormatting(newIncomeInput, (val) => {
        state.income[dateStr] = val;
        saveState('income');
        renderCalendar(); // Update dots
    });

    // Expenses
    const rowsContainer = document.getElementById('expenses-rows');
    rowsContainer.innerHTML = '';
    
    let dayExpenses = state.expenses[dateStr] || Array(15).fill().map(() => ({ name: '', categoryId: '', amount: 0 }));
    
    dayExpenses.forEach((exp, idx) => {
        const row = document.createElement('div');
        row.className = 'table-row';
        
        let catOptions = `<option value="">Выбрать...</option>`;
        state.categories.forEach(cat => {
            catOptions += `<option value="${cat.id}" ${cat.id === exp.categoryId ? 'selected' : ''}>${cat.name}</option>`;
        });

        row.innerHTML = `
            <div class="row-num">${idx + 1}</div>
            <div>
                <input type="text" class="table-input exp-name" value="${exp.name || ''}" placeholder="Название...">
            </div>
            <div>
                <select class="table-select exp-cat">
                    ${catOptions}
                </select>
            </div>
            <div class="amount-wrapper">
                <input type="text" class="table-input amount-input exp-amount" value="${formatNumber(exp.amount)}" placeholder="0" inputmode="numeric">
            </div>
            <div>
                <button class="icon-btn danger btn-clear-row" title="Очистить строку">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
                </button>
            </div>
        `;
        
        rowsContainer.appendChild(row);

        const nameInput = row.querySelector('.exp-name');
        const catSelect = row.querySelector('.exp-cat');
        const amountInput = row.querySelector('.exp-amount');
        
        // Autocomplete logic for name
        nameInput.addEventListener('input', (e) => {
            updateExpense(dateStr, idx, 'name', e.target.value);
            handleAutocomplete(e.target, idx, dateStr);
        });
        nameInput.addEventListener('blur', (e) => {
            setTimeout(() => { document.getElementById('autocomplete-popup').classList.add('hidden'); }, 200);
            updateExpense(dateStr, idx, 'name', e.target.value);
        });

        catSelect.addEventListener('change', (e) => {
            updateExpense(dateStr, idx, 'categoryId', e.target.value);
        });

        setupInputFormatting(amountInput, (val) => {
            updateExpense(dateStr, idx, 'amount', val);
        });

        // Clear row logic
        const clearBtn = row.querySelector('.btn-clear-row');
        clearBtn.addEventListener('click', () => {
            state.expenses[dateStr][idx] = { name: '', categoryId: '', amount: 0 };
            saveState('expenses');
            renderDataEntry();
            document.getElementById('autocomplete-popup').classList.add('hidden');
        });
    });

    updateExpenseTotal(dateStr);
}

function updateExpense(dateStr, index, field, value) {
    if (!state.expenses[dateStr]) {
        state.expenses[dateStr] = Array(15).fill().map(() => ({ name: '', categoryId: '', amount: 0 }));
    }
    state.expenses[dateStr][index][field] = value;
    saveState('expenses');
    
    if (field === 'amount') {
        updateExpenseTotal(dateStr);
        renderCalendar(); // Update dots
    }
}

function updateExpenseTotal(dateStr) {
    const exps = state.expenses[dateStr] || [];
    const total = exps.reduce((acc, curr) => acc + (parseInt(curr.amount) || 0), 0);
    document.getElementById('expense-total').textContent = `${formatNumber(total)} ₽`;
}

// === Autocomplete ===
function handleAutocomplete(inputEl, index, dateStr) {
    const val = inputEl.value.toLowerCase();
    const popup = document.getElementById('autocomplete-popup');
    const list = document.getElementById('autocomplete-list');
    list.innerHTML = '';
    
    if (!val) {
        popup.classList.add('hidden');
        return;
    }

    // Collect unique names from all history
    const allNames = new Set();
    Object.values(state.expenses).forEach(dayArr => {
        dayArr.forEach(exp => {
            if (exp.name && exp.name.toLowerCase().includes(val) && exp.name !== inputEl.value) {
                allNames.add(exp.name);
            }
        });
    });

    if (allNames.size === 0) {
        popup.classList.add('hidden');
        return;
    }

    // Position popup
    const rect = inputEl.getBoundingClientRect();
    popup.style.top = `${rect.bottom + window.scrollY + 4}px`;
    popup.style.left = `${rect.left + window.scrollX}px`;
    popup.style.width = `${rect.width}px`;
    popup.classList.remove('hidden');

    Array.from(allNames).slice(0, 5).forEach(name => {
        const li = document.createElement('li');
        li.textContent = name;
        li.addEventListener('click', () => {
            inputEl.value = name;
            updateExpense(dateStr, index, 'name', name);
            popup.classList.add('hidden');
            
            // Auto-fill category if possible
            const match = Object.values(state.expenses).flat().find(e => e.name === name && e.categoryId);
            if (match) {
                const select = inputEl.closest('.table-row').querySelector('.exp-cat');
                select.value = match.categoryId;
                updateExpense(dateStr, index, 'categoryId', match.categoryId);
            }
        });
        list.appendChild(li);
    });
}

// === Analytics ===
function renderAnalytics() {
    const dateFromEl = document.getElementById('date-from');
    const dateToEl = document.getElementById('date-to');
    
    // Set default range to current month if empty
    if (!dateFromEl.value) {
        const d = new Date(state.currentDate);
        d.setDate(1);
        dateFromEl.value = formatDateStr(d);
    }
    if (!dateToEl.value) {
        const d = new Date(state.currentDate);
        d.setMonth(d.getMonth() + 1);
        d.setDate(0);
        dateToEl.value = formatDateStr(d);
    }

    const calcAndRender = () => {
        const from = parseLocalDate(dateFromEl.value);
        const to = parseLocalDate(dateToEl.value);
        if (from > to) return;

        let totalInc = 0;
        let totalExp = 0;
        const catTotals = {};
        const dailyIncomes = [];

        // Loop through all days in range
        let curr = new Date(from);
        while (curr <= to) {
            const dStr = formatDateStr(curr);
            const inc = parseInt(state.income[dStr]) || 0;
            totalInc += inc;
            dailyIncomes.push({ date: dStr, val: inc });

            const exps = state.expenses[dStr] || [];
            exps.forEach(e => {
                const am = parseInt(e.amount) || 0;
                totalExp += am;
                if (am > 0 && e.categoryId) {
                    catTotals[e.categoryId] = (catTotals[e.categoryId] || 0) + am;
                }
            });
            curr.setDate(curr.getDate() + 1);
        }

        // Summary Cards
        document.getElementById('summary-income').textContent = `${formatNumber(totalInc)} ₽`;
        document.getElementById('summary-expense').textContent = `${formatNumber(totalExp)} ₽`;

        // Render Chart
        renderChart(dailyIncomes);

        // Render Category Report
        const reportContainer = document.getElementById('category-report');
        reportContainer.innerHTML = '';
        
        // Sort categories by amount desc
        const sortedCats = Object.entries(catTotals).sort((a,b) => b[1] - a[1]);
        
        sortedCats.forEach(([catId, amount]) => {
            const cat = state.categories.find(c => c.id === catId);
            const name = cat ? cat.name : 'Удаленная категория';
            
            const el = document.createElement('div');
            el.className = 'cat-item';
            el.innerHTML = `
                <div class="cat-item-info">
                    <div class="cat-color"></div>
                    <div class="cat-name">${name}</div>
                </div>
                <div class="cat-amount">${formatNumber(amount)} ₽</div>
            `;
            reportContainer.appendChild(el);
        });
        
        if (sortedCats.length === 0) {
            reportContainer.innerHTML = '<p class="muted">Нет расходов за этот период</p>';
        }
    };

    dateFromEl.addEventListener('change', calcAndRender);
    dateToEl.addEventListener('change', calcAndRender);
    
    // Toggle Report
    document.getElementById('toggle-report-btn').onclick = function() {
        this.classList.toggle('open');
        document.getElementById('category-report').classList.toggle('hidden');
    };

    calcAndRender();
}

function renderChart(data) {
    const container = document.getElementById('bar-chart');
    container.innerHTML = '';
    
    if (data.length === 0) return;
    
    const maxVal = Math.max(...data.map(d => d.val), 1000); // min max for scale

    data.forEach(item => {
        const heightPct = (item.val / maxVal) * 100;
        const dObj = new Date(item.date);
        const label = `${dObj.getDate()}.${dObj.getMonth()+1}`;
        
        const wrapper = document.createElement('div');
        wrapper.className = 'chart-bar-wrapper';
        wrapper.innerHTML = `
            <div class="chart-tooltip">${formatNumber(item.val)} ₽</div>
            <div class="chart-bar" style="height: ${Math.max(heightPct, 1)}%"></div>
            <div class="chart-label">${label}</div>
        `;
        container.appendChild(wrapper);
    });
}

// === Settings ===
function renderSettings() {
    const list = document.getElementById('categories-list');
    list.innerHTML = '';

    state.categories.forEach((cat, idx) => {
        const li = document.createElement('li');
        li.className = 'settings-item';
        
        li.innerHTML = `
            <input type="text" value="${cat.name}" data-idx="${idx}">
            <button class="icon-btn danger delete-cat">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
        `;
        
        const input = li.querySelector('input');
        const delBtn = li.querySelector('.delete-cat');

        input.addEventListener('blur', (e) => {
            const newName = e.target.value.trim();
            if (newName) {
                state.categories[idx].name = newName;
                saveState('categories');
            } else {
                e.target.value = state.categories[idx].name; // revert
            }
        });

        delBtn.addEventListener('click', () => {
            if (confirm(`Удалить категорию "${cat.name}"?`)) {
                state.categories.splice(idx, 1);
                saveState('categories');
                renderSettings();
            }
        });

        list.appendChild(li);
    });

    const addBtn = document.getElementById('add-category-btn');
    // Replace element to clear listeners
    const newAddBtn = addBtn.cloneNode(true);
    addBtn.parentNode.replaceChild(newAddBtn, addBtn);
    
    newAddBtn.addEventListener('click', () => {
        state.categories.push({
            id: 'cat_' + Date.now(),
            name: 'Новая категория'
        });
        saveState('categories');
        renderSettings();
    });
}

// === Init ===
document.addEventListener('DOMContentLoaded', () => {
    loadState();
    initNavigation();
    initCalendar();
    renderDataEntry();
});
