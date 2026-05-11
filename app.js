import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, onSnapshot, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

// === Firebase Init ===
console.log("App Version: 3.0.0 - U Coffee (with Auth)");
let app, db, auth;
let unsubscribeSnapshot = null;
let currentUser = null;

try {
    const firebaseConfig = {
      apiKey: "AIzaSyA3dem18WFrq2mNA1_pCJfIWBYcGsS0i6Q",
      authDomain: "ucoffeefinance.firebaseapp.com",
      projectId: "ucoffeefinance",
      storageBucket: "ucoffeefinance.firebasestorage.app",
      messagingSenderId: "944990472119",
      appId: "1:944990472119:web:21e00ba400c9cd91dd4a32",
      measurementId: "G-VX2T9S465Y"
    };
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    console.log('[UC-INIT] Firebase initialized, projectId:', firebaseConfig.projectId);
} catch (e) {
    console.error("[UC-INIT] Firebase init fallback error:", e);
    showToast('Ошибка инициализации Firebase', 'error');
}

// === Toast Notification System ===
function showToast(message, type = 'info', durationMs = 4000) {
    const existing = document.getElementById('dc-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'dc-toast';
    toast.className = `dc-toast dc-toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, durationMs);
}
// === State & LocalStorage ===
const STORE_PREFIX = 'u_coffee';
const DEFAULT_CATEGORIES = [
    { id: 'cat_1', name: 'Аренда', items: [] },
    { id: 'cat_2', name: 'Зарплата', items: [] },
    { id: 'cat_3', name: 'Хоз. товары', items: [] },
    { id: 'cat_4', name: 'Продукты', items: [] },
    { id: 'cat_5', name: 'Налоги', items: [] },
];
let state = {
    currentDate: new Date(),
    categories: [],
    income: {}, // { 'YYYY-MM-DD': { cash: 0, terminal: 0 } }
    expenses: {} // { 'YYYY-MM-DD': [{ id, name, categoryId, amount }] }
};
// Auto-migrate old income format (number → {cash, terminal})
function migrateIncome(income) {
    if (!income) return {};
    for (const key of Object.keys(income)) {
        if (typeof income[key] === 'number') {
            income[key] = { cash: income[key], terminal: 0 };
        }
    }
    return income;
}
// Helper: total daily income from cash + terminal
function getDailyTotalIncome(dateStr) {
    const inc = state.income[dateStr];
    if (!inc) return 0;
    return (parseInt(inc.cash) || 0) + (parseInt(inc.terminal) || 0);
}
function loadState() {
    if (unsubscribeSnapshot) unsubscribeSnapshot();
    
    unsubscribeSnapshot = onSnapshot(doc(db, 'coffee_db', 'main_state'), (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            state.categories = data.categories || [...DEFAULT_CATEGORIES];
            state.income = migrateIncome(data.income || {});
            state.expenses = data.expenses || {};
            
            // Skip DOM rebuild if user is actively typing — only update values
            const active = document.activeElement;
            const isUserTyping = active && (active.tagName === 'INPUT' || active.tagName === 'SELECT');
            
            if (document.getElementById('view-data')?.classList.contains('active')) {
                if (!isUserTyping) {
                    renderCalendar();
                }
                updateValuesOnly();
            }
            if (document.getElementById('view-settings')?.classList.contains('active')) renderSettings();
            if (document.getElementById('view-analytics')?.classList.contains('active')) renderAnalytics();
        } else {
            state.categories = [...DEFAULT_CATEGORIES];
            state.income = {};
            state.expenses = {};
            saveState(); // push defaults to cloud
        }
    }, (error) => {
        console.error("Error syncing data:", error);
        showToast('Ошибка загрузки данных: ' + error.message, 'error');
    });
}
function saveState(key) {
    const payload = {
        categories: state.categories,
        income: state.income,
        expenses: state.expenses
    };

    const payloadSize = JSON.stringify(payload).length;
    if (payloadSize > 900000) {
        showToast('Внимание: база данных почти заполнена', 'error', 6000);
    }

    setDoc(doc(db, 'coffee_db', 'main_state'), payload, { merge: true })
    .catch((error) => {
        console.error("Error saving data:", error);
        showToast('Ошибка сохранения: ' + error.message, 'error');
    });
}

let _saveTimer = null;
function debouncedSave() {
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(() => saveState(), 600);
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
                updateValuesOnly();
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
        state.currentDate = new Date(state.currentDate.getFullYear(), state.currentDate.getMonth() - 1, 1);
        renderCalendar();
        renderDataEntry();
        updateValuesOnly();
    });
    
    btnNext.addEventListener('click', () => {
        state.currentDate = new Date(state.currentDate.getFullYear(), state.currentDate.getMonth() + 1, 1);
        renderCalendar();
        renderDataEntry();
        updateValuesOnly();
    });
    renderCalendar();
}
function renderCalendar() {
    const monthYearStr = state.currentDate.toLocaleString('ru-RU', { month: 'long', year: 'numeric' });
    document.getElementById('cal-month-year').textContent = monthYearStr.charAt(0).toUpperCase() + monthYearStr.slice(1);
    const grid = document.getElementById('cal-days-grid');
    grid.innerHTML = '';
    const year = state.currentDate.getFullYear();
    const month = state.currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const weekdays = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    let activeElement = null;
    for (let i = 1; i <= daysInMonth; i++) {
        const d = new Date(year, month, i);
        const dateStr = formatDateStr(d);
        
        const el = document.createElement('div');
        el.className = 'cal-day';
        
        if (dateStr === formatDateStr(state.currentDate)) {
            el.classList.add('active');
            activeElement = el;
        }
        
        // Has data marker
        if (getDailyTotalIncome(dateStr) > 0 || (state.expenses[dateStr] && state.expenses[dateStr].some(e => e.amount > 0))) {
            el.classList.add('has-data');
        }
        const weekdayIndex = d.getDay();
        
        el.innerHTML = `
            <span class="weekday">${weekdays[weekdayIndex]}</span>
            <span class="day-num">${d.getDate()}</span>
        `;
        
        el.addEventListener('click', () => {
            state.currentDate = new Date(d);
            renderCalendar();
            renderDataEntry();
            updateValuesOnly();
        });
        
        grid.appendChild(el);
    }
    
    if (activeElement) {
        requestAnimationFrame(() => {
            activeElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        });
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
// Update income day total display without rebuilding DOM
function updateIncomeDayTotal() {
    const dateStr = formatDateStr(state.currentDate);
    const total = getDailyTotalIncome(dateStr);
    const el = document.getElementById('income-day-total');
    if (el) el.textContent = `${formatNumber(total)} ₽`;
}
function renderDataEntry() {
    // Setup cash input
    const cashInput = document.getElementById('inc-cash');
    if (cashInput && !cashInput.dataset.listenerAttached) {
        cashInput.dataset.listenerAttached = 'true';
        cashInput.addEventListener('focus', function() { this.select(); });
        setupInputFormatting(cashInput, (val) => {
            const dateStr = formatDateStr(state.currentDate);
            if (!state.income[dateStr]) state.income[dateStr] = { cash: 0, terminal: 0 };
            state.income[dateStr].cash = val;
            debouncedSave();
            updateIncomeDayTotal();
        });
        // Refresh calendar only on blur to avoid scroll jumps
        cashInput.addEventListener('blur', () => renderCalendar());
    }
    // Setup terminal input
    const terminalInput = document.getElementById('inc-terminal');
    if (terminalInput && !terminalInput.dataset.listenerAttached) {
        terminalInput.dataset.listenerAttached = 'true';
        terminalInput.addEventListener('focus', function() { this.select(); });
        setupInputFormatting(terminalInput, (val) => {
            const dateStr = formatDateStr(state.currentDate);
            if (!state.income[dateStr]) state.income[dateStr] = { cash: 0, terminal: 0 };
            state.income[dateStr].terminal = val;
            debouncedSave();
            updateIncomeDayTotal();
        });
        terminalInput.addEventListener('blur', () => renderCalendar());
    }
    const rowsContainer = document.getElementById('expenses-rows');
    if (!rowsContainer) return;
    rowsContainer.innerHTML = '';
    
    for (let idx = 0; idx < 15; idx++) {
        const row = document.createElement('div');
        row.className = 'table-row';
        row.setAttribute('data-idx', idx);
        
        row.innerHTML = `
            <div class="row-num">${idx + 1}</div>
            <div>
                <select class="table-select exp-cat"></select>
            </div>
            <div>
                <select class="table-select exp-name"></select>
            </div>
            <div class="amount-wrapper">
                <input type="text" class="table-input amount-input exp-amount" placeholder="0" inputmode="numeric">
            </div>
            <div>
                <button class="icon-btn danger btn-clear-row" title="Очистить строку">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
                </button>
            </div>
        `;
        
        const nameSelect = row.querySelector('.exp-name');
        const catSelect = row.querySelector('.exp-cat');
        const amountInput = row.querySelector('.exp-amount');
        const clearBtn = row.querySelector('.btn-clear-row');
        amountInput.addEventListener('focus', function() { this.select(); });
        catSelect.addEventListener('change', (e) => {
            const dateStr = formatDateStr(state.currentDate);
            updateExpense(dateStr, idx, 'categoryId', e.target.value);
            updateExpense(dateStr, idx, 'name', '');
            updateValuesOnly(); 
        });
        nameSelect.addEventListener('change', (e) => {
            const dateStr = formatDateStr(state.currentDate);
            if (e.target.value === '__add__') {
                const exps = state.expenses[dateStr] || [];
                e.target.value = (exps[idx] && exps[idx].name) || '';
                openModal(catSelect.value, idx, dateStr);
            } else {
                updateExpense(dateStr, idx, 'name', e.target.value);
            }
        });
        setupInputFormatting(amountInput, (val) => {
            const dateStr = formatDateStr(state.currentDate);
            updateExpenseLocal(dateStr, idx, 'amount', val);
        });
        clearBtn.addEventListener('click', () => {
            const dateStr = formatDateStr(state.currentDate);
            if (!state.expenses[dateStr]) return;
            state.expenses[dateStr][idx] = { name: '', categoryId: '', amount: 0 };
            saveState('expenses');
            updateValuesOnly();
        });
        rowsContainer.appendChild(row);
    }
}
function updateValuesOnly() {
    const dateStr = formatDateStr(state.currentDate);
    const activeEl = document.activeElement;
    
    // Income — cash & terminal
    const incData = state.income[dateStr] || { cash: 0, terminal: 0 };
    const cashInput = document.getElementById('inc-cash');
    const terminalInput = document.getElementById('inc-terminal');
    
    if (cashInput && activeEl !== cashInput) {
        cashInput.value = formatNumber(incData.cash) || '';
    }
    if (terminalInput && activeEl !== terminalInput) {
        terminalInput.value = formatNumber(incData.terminal) || '';
    }
    updateIncomeDayTotal();
    
    // Expenses
    let dayExpenses = state.expenses[dateStr] || [];
    const rowsContainer = document.getElementById('expenses-rows');
    if (!rowsContainer) return;
    const rows = rowsContainer.children;
    
    for (let idx = 0; idx < 15; idx++) {
        if (idx >= rows.length) break;
        const exp = dayExpenses[idx] || { name: '', categoryId: '', amount: 0 };
        const row = rows[idx];
        const catSelect = row.querySelector('.exp-cat');
        const nameSelect = row.querySelector('.exp-name');
        const amountInput = row.querySelector('.exp-amount');
        const activeEl = document.activeElement;
        if (catSelect && activeEl !== catSelect) {
            let catOptions = `<option value="">Выбрать...</option>`;
            state.categories.forEach(cat => {
                catOptions += `<option value="${cat.id}" ${cat.id === exp.categoryId ? 'selected' : ''}>${cat.name}</option>`;
            });
            catSelect.innerHTML = catOptions;
        }
        if (nameSelect && activeEl !== nameSelect) {
            nameSelect.disabled = !exp.categoryId;
            let nameOptions = `<option value="">Выбрать...</option>`;
            let hasItems = false;
            
            if (exp.categoryId) {
                const cat = state.categories.find(c => c.id === exp.categoryId);
                if (cat && cat.items && cat.items.length > 0) {
                    hasItems = true;
                    cat.items.forEach(item => {
                        nameOptions += `<option value="${item}" ${item.toLowerCase() === (exp.name || '').toLowerCase() ? 'selected' : ''}>${item}</option>`;
                    });
                }
                
                if (!hasItems) {
                    nameOptions = `<option value="__add__" style="font-weight: 600; color: var(--accent-income);">+ Добавить наименование</option>`;
                } else {
                    nameOptions += `<option value="__add__" style="font-weight: 600; color: var(--accent-income);">+ Добавить наименование</option>`;
                }
            }
            nameSelect.innerHTML = nameOptions;
        }
        if (amountInput && activeEl !== amountInput) {
            amountInput.value = formatNumber(exp.amount) || '';
        }
    }
    updateExpenseTotal(dateStr);
}
function updateExpense(dateStr, index, field, value) {
    if (!state.expenses[dateStr]) {
        state.expenses[dateStr] = Array(15).fill().map(() => ({ name: '', categoryId: '', amount: 0 }));
    }
    state.expenses[dateStr][index][field] = value;
    saveState('expenses');
    
    if (field === 'amount') {
        // Smart focus: only update total text, don't rebuild expense table
        updateExpenseTotal(dateStr);
        // Defer calendar dot update to avoid scroll jumps during typing
    }
}

function updateExpenseLocal(dateStr, index, field, value) {
    if (!state.expenses[dateStr]) {
        state.expenses[dateStr] = Array(15).fill().map(() => ({ name: '', categoryId: '', amount: 0 }));
    }
    state.expenses[dateStr][index][field] = value;
    debouncedSave();
    
    if (field === 'amount') {
        updateExpenseTotal(dateStr);
    }
}
function updateExpenseTotal(dateStr) {
    const exps = state.expenses[dateStr] || [];
    const total = exps.reduce((acc, curr) => acc + (parseInt(curr.amount) || 0), 0);
    document.getElementById('expense-total').textContent = `${formatNumber(total)} ₽`;
}
// === Modal (Names) ===
let currentModalContext = { categoryId: null, rowIndex: null, dateStr: null };
function openModal(categoryId, rowIndex = null, dateStr = null) {
    currentModalContext = { categoryId, rowIndex, dateStr };
    const modal = document.getElementById('add-name-modal');
    const input = document.getElementById('new-item-name');
    input.value = '';
    modal.classList.remove('hidden');
    setTimeout(() => input.focus(), 100);
}
function initModal() {
    const modal = document.getElementById('add-name-modal');
    const cancelBtn = document.getElementById('modal-cancel-btn');
    const saveBtn = document.getElementById('modal-save-btn');
    const input = document.getElementById('new-item-name');
    const closeModal = () => modal.classList.add('hidden');
    cancelBtn.onclick = closeModal;
    saveBtn.onclick = () => {
        const val = input.value.trim();
        if (!val || !currentModalContext.categoryId) {
            closeModal();
            return;
        }
        
        const cat = state.categories.find(c => c.id === currentModalContext.categoryId);
        if (cat) {
            const valUpper = val.charAt(0).toUpperCase() + val.slice(1);
            if (!cat.items) cat.items = [];
            
            const exists = cat.items.find(i => i.toLowerCase() === valUpper.toLowerCase());
            if (!exists) {
                cat.items.push(valUpper);
                saveState('categories');
            }
            
            if (currentModalContext.rowIndex !== null && currentModalContext.dateStr) {
                updateExpense(currentModalContext.dateStr, currentModalContext.rowIndex, 'name', valUpper);
                updateValuesOnly();
            } else {
                renderSettings();
            }
        }
        closeModal();
    };
}
// === Analytics ===
// Store period totals for the income detail modal
let analyticsTotals = { cash: 0, terminal: 0 };
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
        let totalCash = 0;
        let totalTerminal = 0;
        let totalExp = 0;
        const catTotals = {};
        const catDetails = {};
        const dailyIncomes = [];
        // Loop through all days in range
        let curr = new Date(from);
        while (curr <= to) {
            const dStr = formatDateStr(curr);
            const incData = state.income[dStr] || { cash: 0, terminal: 0 };
            const cash = parseInt(incData.cash) || 0;
            const terminal = parseInt(incData.terminal) || 0;
            const inc = cash + terminal;
            totalCash += cash;
            totalTerminal += terminal;
            totalInc += inc;
            dailyIncomes.push({ date: dStr, val: inc });
            const exps = state.expenses[dStr] || [];
            exps.forEach(e => {
                const am = parseInt(e.amount) || 0;
                totalExp += am;
                if (am > 0 && e.categoryId) {
                    catTotals[e.categoryId] = (catTotals[e.categoryId] || 0) + am;
                    
                    if (!catDetails[e.categoryId]) catDetails[e.categoryId] = {};
                    const n = (e.name || 'Без названия').trim();
                    const nLower = n.toLowerCase();
                    if (!catDetails[e.categoryId][nLower]) {
                        catDetails[e.categoryId][nLower] = { name: n.charAt(0).toUpperCase() + n.slice(1), amount: 0 };
                    }
                    catDetails[e.categoryId][nLower].amount += am;
                }
            });
            curr.setDate(curr.getDate() + 1);
        }
        // Save for income detail modal
        analyticsTotals = { cash: totalCash, terminal: totalTerminal };
        // Summary Cards
        document.getElementById('summary-income').textContent = `${formatNumber(totalInc)} ₽`;
        document.getElementById('summary-expense').textContent = `${formatNumber(totalExp)} ₽`;
        // Render Chart
        renderChart(dailyIncomes);
        // Build category report HTML for modal
        const sortedCats = Object.entries(catTotals).sort((a,b) => b[1] - a[1]);
        let reportHtml = '';
        
        if (sortedCats.length === 0) {
            reportHtml = '<p class="muted">Нет расходов за этот период</p>';
        } else {
            sortedCats.forEach(([catId, amount]) => {
                const cat = state.categories.find(c => c.id === catId);
                const name = cat ? cat.name : 'Удаленная категория';
                const perc = totalExp > 0 ? ` <span class="muted" style="font-weight:400; font-size:13px; margin-left:4px;">(${Math.round(amount/totalExp*100)}%)</span>` : '';
                
                let detailItems = '';
                if (catDetails[catId]) {
                    const sorted = Object.values(catDetails[catId]).sort((a,b) => b.amount - a.amount);
                    detailItems = sorted.map(d => `
                        <div class="modal-cat-subitem">
                            <span>${d.name}</span>
                            <span>${formatNumber(d.amount)} ₽</span>
                        </div>
                    `).join('');
                }
                
                const chevron = detailItems ? '<svg class="cat-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>' : '';
                
                reportHtml += `
                    <div class="modal-cat-wrapper">
                        <div class="modal-cat-header">
                            <div class="cat-item-info">
                                <div class="cat-color"></div>
                                <div class="cat-name">${name}</div>
                            </div>
                            <div class="cat-amount-wrapper">
                                <div class="cat-amount">${formatNumber(amount)} ₽${perc}</div>
                                ${chevron}
                            </div>
                        </div>
                        ${detailItems ? `<div class="modal-cat-details">${detailItems}</div>` : ''}
                    </div>
                `;
            });
        }
        
        document.getElementById('expense-modal-list').innerHTML = reportHtml;
        
        // Attach accordion toggle listeners after HTML is set
        document.querySelectorAll('.modal-cat-wrapper').forEach(wrapper => {
            const header = wrapper.querySelector('.modal-cat-header');
            const details = wrapper.querySelector('.modal-cat-details');
            if (header && details) {
                header.addEventListener('click', () => wrapper.classList.toggle('expanded'));
            }
        });
    };
    dateFromEl.addEventListener('change', calcAndRender);
    dateToEl.addEventListener('change', calcAndRender);
    
    // Expense detail modal — open on summary card click
    const expenseCard = document.querySelector('.summary-card.expense');
    if (expenseCard) {
        expenseCard.onclick = () => {
            document.getElementById('expense-details-modal').classList.remove('hidden');
        };
    }
    document.getElementById('expense-modal-close').onclick = () => {
        document.getElementById('expense-details-modal').classList.add('hidden');
    };
    // Income detail modal — open on summary card click
    const incomeCard = document.querySelector('.summary-card.income');
    if (incomeCard) {
        incomeCard.onclick = () => {
            document.getElementById('detail-cash').textContent = `${formatNumber(analyticsTotals.cash)} ₽`;
            document.getElementById('detail-terminal').textContent = `${formatNumber(analyticsTotals.terminal)} ₽`;
            document.getElementById('income-detail-modal').classList.remove('hidden');
        };
    }
    document.getElementById('income-modal-close').onclick = () => {
        document.getElementById('income-detail-modal').classList.add('hidden');
    };
    document.getElementById('btn-export-excel').onclick = exportToExcel;
    calcAndRender();
}
async function exportToExcel() {
    if (typeof ExcelJS === 'undefined') {
        alert('Библиотека ExcelJS не загружена');
        return;
    }
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Ю кофе';
    workbook.created = new Date();
    const monthsSet = new Set();
    Object.keys(state.income).forEach(d => monthsSet.add(d.substring(0, 7)));
    Object.keys(state.expenses).forEach(d => {
        if (state.expenses[d].some(e => e.amount > 0)) {
            monthsSet.add(d.substring(0, 7));
        }
    });
    const monthsArr = Array.from(monthsSet).sort();
    
    if (monthsArr.length === 0) {
        alert('Нет данных для выгрузки');
        return;
    }
    const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
    monthsArr.forEach(monthStr => {
        const [year, month] = monthStr.split('-');
        const sheetName = `${monthNames[parseInt(month) - 1]} ${year}`;
        const ws = workbook.addWorksheet(sheetName);
        
        ws.properties.outlineProperties = { summaryBelow: false };
        
        // Define Columns widths
        ws.getColumn('A').width = 15; // Дата доходы
        ws.getColumn('B').width = 20; // Сумма доходы
        ws.getColumn('C').width = 5;  // Spacer
        ws.getColumn('D').width = 25; // Категория
        ws.getColumn('E').width = 28; // Наименование
        ws.getColumn('F').width = 20; // Сумма расходы
        let totalInc = 0;
        let totalExp = 0;
        
        const monthIncomes = [];
        const monthExpensesByCategory = {};
        const daysInMonth = new Date(year, month, 0).getDate();
        for (let i = 1; i <= daysInMonth; i++) {
            const dStr = `${year}-${month}-${i.toString().padStart(2, '0')}`;
            
            const incData = state.income[dStr] || { cash: 0, terminal: 0 };
            const inc = (parseInt(incData.cash) || 0) + (parseInt(incData.terminal) || 0);
            if (inc > 0) {
                totalInc += inc;
                monthIncomes.push({ date: dStr, val: inc });
            }
            const exps = state.expenses[dStr] || [];
            exps.forEach(e => {
                const am = parseInt(e.amount) || 0;
                if (am > 0 && e.categoryId) {
                    totalExp += am;
                    if (!monthExpensesByCategory[e.categoryId]) {
                        monthExpensesByCategory[e.categoryId] = { total: 0, items: [] };
                    }
                    monthExpensesByCategory[e.categoryId].total += am;
                    
                    const name = (e.name || 'Без названия').trim();
                    const nameCap = name.charAt(0).toUpperCase() + name.slice(1);
                    
                    const existing = monthExpensesByCategory[e.categoryId].items.find(item => item.name.toLowerCase() === nameCap.toLowerCase());
                    if (existing) {
                        existing.amount += am;
                    } else {
                        monthExpensesByCategory[e.categoryId].items.push({ name: nameCap, amount: am });
                    }
                }
            });
        }
        // Headers row 1
        ws.mergeCells('A1:B1');
        ws.getCell('A1').value = `ИТОГО ДОХОДЫ: ${totalInc} ₽`;
        ws.getCell('A1').font = { bold: true, color: { argb: 'FF059669' }, size: 14 };
        ws.getCell('A1').alignment = { vertical: 'middle', horizontal: 'center' };
        
        ws.mergeCells('D1:F1');
        ws.getCell('D1').value = `ИТОГО РАСХОДЫ: ${totalExp} ₽`;
        ws.getCell('D1').font = { bold: true, color: { argb: 'FFE11D48' }, size: 14 };
        ws.getCell('D1').alignment = { vertical: 'middle', horizontal: 'center' };
        // Headers row 2
        ws.getCell('A2').value = 'Дата';
        ws.getCell('B2').value = 'Сумма выручки';
        ws.getCell('D2').value = 'Категория';
        ws.getCell('E2').value = 'Наименование';
        ws.getCell('F2').value = 'Сумма';
        ['A2', 'B2', 'D2', 'E2', 'F2'].forEach(c => {
            ws.getCell(c).font = { bold: true };
            ws.getCell(c).border = { bottom: { style: 'medium' } };
        });
        // Fill Income (Left)
        let incRow = 3;
        monthIncomes.forEach(inc => {
            ws.getCell(`A${incRow}`).value = inc.date;
            ws.getCell(`B${incRow}`).value = inc.val;
            ws.getCell(`B${incRow}`).numFmt = '#,##0 \\₽';
            incRow++;
        });
        // Fill Expenses (Right)
        let expRow = 3;
        const sortedCats = Object.entries(monthExpensesByCategory).sort((a,b) => b[1].total - a[1].total);
        
        sortedCats.forEach(([catId, data]) => {
            const cat = state.categories.find(c => c.id === catId);
            const catName = cat ? cat.name : 'Удаленная категория';
            
            ws.getCell(`D${expRow}`).value = catName;
            ws.getCell(`F${expRow}`).value = data.total;
            
            ws.getCell(`D${expRow}`).font = { bold: true };
            ws.getCell(`F${expRow}`).font = { bold: true };
            ws.getCell(`F${expRow}`).numFmt = '#,##0 \\₽';
            ws.getCell(`D${expRow}`).border = { top: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
            ws.getCell(`E${expRow}`).border = { top: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
            ws.getCell(`F${expRow}`).border = { top: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
            
            ws.getRow(expRow).outlineLevel = 0;
            const parentRow = expRow;
            expRow++;
            
            data.items.sort((a,b) => b.amount - a.amount).forEach(item => {
                ws.getCell(`E${expRow}`).value = item.name;
                ws.getCell(`F${expRow}`).value = item.amount;
                ws.getCell(`F${expRow}`).numFmt = '#,##0 \\₽';
                ws.getCell(`E${expRow}`).font = { color: { argb: 'FF64748B' } }; 
                
                ws.getRow(expRow).outlineLevel = 1;
                expRow++;
            });
        });
    });
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const now = new Date();
    const dateString = `${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2,'0')}${now.getDate().toString().padStart(2,'0')}`;
    a.download = `u_coffee_report_${dateString}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
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
        
        let itemsHtml = '<div class="settings-items-list">';
        if (cat.items && cat.items.length > 0) {
            cat.items.forEach((item, itemIdx) => {
                itemsHtml += `
                    <div class="settings-subitem">
                        <span>${item}</span>
                        <button class="icon-btn danger delete-subitem" data-item="${itemIdx}">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
                        </button>
                    </div>
                `;
            });
        }
        itemsHtml += `
            <button class="btn-add-item" data-catid="${cat.id}">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
                Добавить наименование
            </button>
        </div>`;
        li.innerHTML = `
            <div style="display:flex; flex-direction:column; width:100%;">
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border); padding-bottom:8px;">
                    <input type="text" value="${cat.name}" data-idx="${idx}" style="font-weight:600; font-size:18px; outline:none; border:none; background:transparent;">
                    <button class="icon-btn danger delete-cat">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                </div>
                ${itemsHtml}
            </div>
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
            if (confirm(`Вы действительно хотите удалить всю категорию "${cat.name}" со всеми вложенными пунктами?`)) {
                state.categories.splice(idx, 1);
                saveState('categories');
                renderSettings();
            }
        });
        const deleteSubItemBtns = li.querySelectorAll('.delete-subitem');
        deleteSubItemBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const iIdx = parseInt(btn.getAttribute('data-item'));
                const itemName = state.categories[idx].items[iIdx];
                if (confirm(`Вы уверены, что хотите удалить "${itemName}"?`)) {
                    state.categories[idx].items.splice(iIdx, 1);
                    saveState('categories');
                    renderSettings();
                }
            });
        });
        const btnAdd = li.querySelector('.btn-add-item');
        btnAdd.addEventListener('click', () => {
            openModal(cat.id);
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
    // Backup Export
    document.getElementById('btn-export-backup').onclick = () => {
        const dataStr = JSON.stringify(state, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        const d = new Date();
        const dateString = `${d.getFullYear()}${(d.getMonth()+1).toString().padStart(2,'0')}${d.getDate().toString().padStart(2,'0')}`;
        a.download = `u_coffee_backup_${dateString}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };
    // Backup Import
    const importBtn = document.getElementById('btn-import-backup');
    const importFile = document.getElementById('input-import-backup');
    
    importBtn.onclick = () => importFile.click();
    
    importFile.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!confirm('Вы уверены? Загрузка резервной копии ПЕРЕЗАПИШЕТ все текущие данные. Это действие нельзя отменить.')) {
            importFile.value = ''; // reset
            return;
        }
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const importedState = JSON.parse(event.target.result);
                if (importedState && typeof importedState === 'object') {
                    if (importedState.categories) state.categories = importedState.categories;
                    if (importedState.income) state.income = importedState.income;
                    if (importedState.expenses) state.expenses = importedState.expenses;
                    
                    saveState('categories');
                    saveState('income');
                    saveState('expenses');
                    
                    alert('Данные успешно восстановлены!');
                    window.location.reload();
                } else {
                    alert('Неверный формат файла резервной копии.');
                }
            } catch (err) {
                alert('Ошибка чтения файла. Возможно, он поврежден.');
            }
        };
        reader.readAsText(file);
    };
}
// === Auth ===
function initAuth() {
    const authScreen = document.getElementById('auth-screen');
    const appEl = document.getElementById('app');
    const loginBtn = document.getElementById('login-btn');
    const loginError = document.getElementById('login-error');

    if (!authScreen || !loginBtn) {
        // Auth UI not present — run in open mode (legacy)
        console.log('[UC-AUTH] Auth screen not found, running in open mode');
        bootApp();
        return;
    }

    loginBtn.addEventListener('click', async () => {
        const username = document.getElementById('login-username').value.trim().toLowerCase();
        const password = document.getElementById('login-password').value;
        loginError.textContent = '';
        loginBtn.disabled = true;
        loginBtn.textContent = 'Вход...';
        
        if (username === 'coffee' && password === '2015redbull@') {
            const email = 'ucoffee@ucoffee.app';
            try {
                // Пытаемся авторизоваться в Firebase, чтобы база данных разрешила сохранение
                await signInWithEmailAndPassword(auth, email, password);
            } catch (err) {
                if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
                    try {
                        await createUserWithEmailAndPassword(auth, email, password);
                    } catch (createErr) {
                        console.error('[UC-AUTH] Create user failed:', createErr);
                    }
                } else {
                    console.error('[UC-AUTH] Firebase Login failed:', err);
                }
            }
            
            // В любом случае пускаем в интерфейс
            localStorage.setItem('uc_auth_bypass', 'true');
            document.getElementById('login-password').value = '';
            authScreen.classList.add('hidden');
            appEl.classList.remove('hidden');
            bootApp();
        } else {
            loginError.textContent = 'Неверный логин или пароль';
        }
        
        loginBtn.disabled = false;
        loginBtn.textContent = 'Войти';
    });

    // Добавляем вход по кнопке Enter
    document.getElementById('login-password').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            loginBtn.click();
        }
    });

    // Listen for auth state
    onAuthStateChanged(auth, (user) => {
        if (user || localStorage.getItem('uc_auth_bypass') === 'true') {
            console.log('[UC-AUTH] User signed in or bypassed');
            if (user) currentUser = user;
            authScreen.classList.add('hidden');
            appEl.classList.remove('hidden');
            bootApp();
        } else {
            console.log('[UC-AUTH] No user — showing login');
            currentUser = null;
            if (unsubscribeSnapshot) unsubscribeSnapshot();
            authScreen.classList.remove('hidden');
            appEl.classList.add('hidden');
        }
    });
}

function handleLogout() {
    if (confirm('Выйти из аккаунта?')) {
        localStorage.removeItem('uc_auth_bypass');
        signOut(auth).then(() => {
            console.log('[UC-AUTH] Signed out');
            window.location.reload();
        }).catch(() => {
            window.location.reload();
        });
    }
}
// Expose to global scope for inline onclick in HTML (module scripts are scoped)
window.handleLogout = handleLogout;

let appBooted = false;
function bootApp() {
    if (appBooted) return; // Prevent double init
    appBooted = true;
    initNavigation();
    initCalendar();
    initModal();
    renderDataEntry();
    loadState();
    console.log('[UC-INIT] App booted successfully');
}

// === Init ===
document.addEventListener('DOMContentLoaded', () => {
    try {
        initAuth();
    } catch (e) {
        console.error('[UC-INIT] Critical Init Error:', e);
        showToast('Критическая ошибка запуска', 'error');
    }
});
