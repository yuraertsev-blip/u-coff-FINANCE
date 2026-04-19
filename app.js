import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, onSnapshot, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// === Firebase Init ===
const firebaseConfig = {
  apiKey: "AIzaSyC0rFOiAx5LEpT-6s9Bc8sxNtc59RfsOcM",
  authDomain: "u-coffee.firebaseapp.com",
  databaseURL: "https://u-coffee-default-rtdb.firebaseio.com",
  projectId: "u-coffee",
  storageBucket: "u-coffee.firebasestorage.app",
  messagingSenderId: "971000964907",
  appId: "1:971000964907:web:5763d4ced46cdd1b6ac76e",
  measurementId: "G-2DZQ429YT2"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
let unsubscribeSnapshot = null;

// === State & Default Data ===
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
    income: {}, 
    expenses: {} 
};

// === Safari Focus Lock ===
let isEditingLock = false;

document.addEventListener('focusin', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') {
        isEditingLock = true;
    }
});

document.addEventListener('focusout', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') {
        setTimeout(() => { 
            isEditingLock = false; 
        }, 300);
    }
});

// === Debounce Logic ===
function debounce(func, delay) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
}

const debouncedSave = debounce(() => {
    saveState();
}, 800);

// === Sync & Load ===
function loadState() {
    if (unsubscribeSnapshot) unsubscribeSnapshot();
    
    unsubscribeSnapshot = onSnapshot(doc(db, 'coffee_db', 'main_state'), { includeMetadataChanges: true }, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            state.categories = data.categories || [...DEFAULT_CATEGORIES];
            state.income = data.income || {};
            state.expenses = data.expenses || {};
            
            // Если данные отправлены нами
            if (docSnap.metadata.hasPendingWrites) return;
            
            // 🛑 ЖЕСТКАЯ БЛОКИРОВКА: Не трогаем экран, если открыта клавиатура
            if (isEditingLock) return;
            
            if (document.getElementById('view-data').classList.contains('active')) renderDataEntry();
            if (document.getElementById('view-settings').classList.contains('active')) renderSettings();
            if (document.getElementById('view-analytics').classList.contains('active')) renderAnalytics();
        } else {
            state.categories = [...DEFAULT_CATEGORIES];
            state.income = {};
            state.expenses = {};
            saveState(); 
        }
    }, (error) => {
        console.error("Error syncing data:", error);
    });
}

function saveState() {
    setDoc(doc(db, 'coffee_db', 'main_state'), {
        categories: state.categories,
        income: state.income,
        expenses: state.expenses
    }, { merge: true })
    .catch((error) => console.error("Error saving data:", error));
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

            if (targetId === 'view-data') renderDataEntry();
            else if (targetId === 'view-analytics') renderAnalytics();
            else if (targetId === 'view-settings') renderSettings();
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
        renderDataEntry();
    });
    
    btnNext.addEventListener('click', () => {
        state.currentDate.setMonth(state.currentDate.getMonth() + 1);
        renderCalendar();
        renderDataEntry();
    });

    renderCalendar();
}

function renderCalendar() {
    const monthYearStr = state.currentDate.toLocaleString('ru-RU', { month: 'long', year: 'numeric' });
    document.getElementById('cal-month-year').textContent = monthYearStr.charAt(0).toUpperCase() + monthYearStr.slice(1);

    const grid = document.getElementById('cal-days-grid');
    grid.innerHTML = '';

    const startOfWeek = new Date(state.currentDate);
    const dayOfWeek = startOfWeek.getDay() === 0 ? 6 : startOfWeek.getDay() - 1; 
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
        let val = e.target.value.replace(/[^\d]/g, ''); 
        
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
    
    const newIncomeInput = incomeInput.cloneNode(true);
    incomeInput.parentNode.replaceChild(newIncomeInput, incomeInput);
    
    newIncomeInput.addEventListener('focus', function() { this.select(); });
    
    setupInputFormatting(newIncomeInput, (val) => {
        state.income[dateStr] = val;
        debouncedSave(); // Отложенное сохранение
        renderCalendar(); 
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

        let nameOptions = `<option value="">Выбрать...</option>`;
        if (exp.categoryId) {
            const cat = state.categories.find(c => c.id === exp.categoryId);
            if (cat && cat.items) {
                cat.items.forEach(item => {
                    nameOptions += `<option value="${item}" ${item.toLowerCase() === (exp.name || '').toLowerCase() ? 'selected' : ''}>${item}</option>`;
                });
            }
            nameOptions += `<option value="__add__" style="font-weight: 600; color: var(--accent-income);">+ Добавить наименование</option>`;
        }

        row.innerHTML = `
            <div class="row-num">${idx + 1}</div>
            <div>
                <select class="table-select exp-cat">
                    ${catOptions}
                </select>
            </div>
            <div>
                <select class="table-select exp-name" ${!exp.categoryId ? 'disabled' : ''}>
                    ${nameOptions}
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

        const nameSelect = row.querySelector('.exp-name');
        const catSelect = row.querySelector('.exp-cat');
        const amountInput = row.querySelector('.exp-amount');
        amountInput.addEventListener('focus', function() { this.select(); });

        catSelect.addEventListener('change', (e) => {
            updateExpense(dateStr, idx, 'categoryId', e.target.value, true);
            updateExpense(dateStr, idx, 'name', '', true); 
            renderDataEntry(); 
        });

        nameSelect.addEventListener('change', (e) => {
            if (e.target.value === '__add__') {
                e.target.value = exp.name || ''; 
                openModal(exp.categoryId, idx, dateStr);
            } else {
                updateExpense(dateStr, idx, 'name', e.target.value, true);
            }
        });

        setupInputFormatting(amountInput, (val) => {
            updateExpense(dateStr, idx, 'amount', val, false); // false = с задержкой
        });

        const clearBtn = row.querySelector('.btn-clear-row');
        clearBtn.addEventListener('click', () => {
            state.expenses[dateStr][idx] = { name: '', categoryId: '', amount: 0 };
            saveState(); // Мгновенное удаление
            renderDataEntry();
            updateExpenseTotal(dateStr);
            renderCalendar();
        });
    });

    updateExpenseTotal(dateStr);
}

function updateExpense(dateStr, index, field, value, immediate = false) {
    if (!state.expenses[dateStr]) {
        state.expenses[dateStr] = Array(15).fill().map(() => ({ name: '', categoryId: '', amount: 0 }));
    }
    state.expenses[dateStr][index][field] = value;
    
    if (immediate) {
        saveState();
    } else {
        debouncedSave();
    }
    
    if (field === 'amount') {
        updateExpenseTotal(dateStr);
        renderCalendar(); 
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
                saveState();
            }
            
            if (currentModalContext.rowIndex !== null && currentModalContext.dateStr) {
                updateExpense(currentModalContext.dateStr, currentModalContext.rowIndex, 'name', valUpper, true);
                renderDataEntry();
            } else {
                renderSettings();
            }
        }
        closeModal();
    };
}

// === Analytics ===
function renderAnalytics() {
    const dateFromEl = document.getElementById('date-from');
    const dateToEl = document.getElementById('date-to');
    
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
        const catDetails = {};
        const dailyIncomes = [];

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

        document.getElementById('summary-income').textContent = `${formatNumber(totalInc)} ₽`;
        document.getElementById('summary-expense').textContent = `${formatNumber(totalExp)} ₽`;

        renderChart(dailyIncomes);

        const reportContainer = document.getElementById('category-report');
        reportContainer.innerHTML = '';
        
        const sortedCats = Object.entries(catTotals).sort((a,b) => b[1] - a[1]);
        
        sortedCats.forEach(([catId, amount]) => {
            const cat = state.categories.find(c => c.id === catId);
            const name = cat ? cat.name : 'Удаленная категория';
            
            let detailsHtml = '';
            if (catDetails[catId]) {
                const sortedDetails = Object.values(catDetails[catId]).sort((a,b) => b.amount - a.amount);
                const detailItemsHtml = sortedDetails.map(d => `
                    <div class="cat-detail-item">
                        <span>${d.name}</span>
                        <span>${formatNumber(d.amount)} ₽</span>
                    </div>
                `).join('');
                detailsHtml = `<div class="cat-details-list">${detailItemsHtml}</div>`;
            }

            const percHtml = totalExp > 0 ? ` <span class="muted" style="font-weight:400; font-size:13px; margin-left:4px;">(${Math.round(amount/totalExp*100)}%)</span>` : '';
            const chevronHtml = detailsHtml ? `<svg class="cat-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>` : '';
            
            const wrapper = document.createElement('div');
            wrapper.className = 'cat-wrapper';
            
            wrapper.innerHTML = `
                <div class="cat-item">
                    <div class="cat-item-info">
                        <div class="cat-color"></div>
                        <div class="cat-name">${name}</div>
                    </div>
                    <div class="cat-amount-wrapper">
                        <div class="cat-amount">${formatNumber(amount)} ₽${percHtml}</div>
                        ${chevronHtml}
                    </div>
                </div>
                ${detailsHtml}
            `;
            
            if (detailsHtml) {
                const header = wrapper.querySelector('.cat-item');
                header.addEventListener('click', () => {
                    wrapper.classList.toggle('expanded');
                });
            }
            
            reportContainer.appendChild(wrapper);
        });
        
        if (sortedCats.length === 0) {
            reportContainer.innerHTML = '<p class="muted">Нет расходов за этот период</p>';
        }
    };

    dateFromEl.addEventListener('change', calcAndRender);
    dateToEl.addEventListener('change', calcAndRender);
    
    document.getElementById('toggle-report-btn').onclick = function() {
        this.classList.toggle('open');
        document.getElementById('category-report').classList.toggle('hidden');
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
        
        ws.getColumn('A').width = 15; 
        ws.getColumn('B').width = 20; 
        ws.getColumn('C').width = 5;  
        ws.getColumn('D').width = 25; 
        ws.getColumn('E').width = 28; 
        ws.getColumn('F').width = 20; 

        let totalInc = 0;
        let totalExp = 0;
        
        const monthIncomes = [];
        const monthExpensesByCategory = {};

        const daysInMonth = new Date(year, month, 0).getDate();
        for (let i = 1; i <= daysInMonth; i++) {
            const dStr = `${year}-${month}-${i.toString().padStart(2, '0')}`;
            
            const inc = parseInt(state.income[dStr]) || 0;
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

        ws.mergeCells('A1:B1');
        ws.getCell('A1').value = `ИТОГО ДОХОДЫ: ${totalInc} ₽`;
        ws.getCell('A1').font = { bold: true, color: { argb: 'FF059669' }, size: 14 };
        ws.getCell('A1').alignment = { vertical: 'middle', horizontal: 'center' };
        
        ws.mergeCells('D1:F1');
        ws.getCell('D1').value = `ИТОГО РАСХОДЫ: ${totalExp} ₽`;
        ws.getCell('D1').font = { bold: true, color: { argb: 'FFE11D48' }, size: 14 };
        ws.getCell('D1').alignment = { vertical: 'middle', horizontal: 'center' };

        ws.getCell('A2').value = 'Дата';
        ws.getCell('B2').value = 'Сумма выручки';
        ws.getCell('D2').value = 'Категория';
        ws.getCell('E2').value = 'Наименование';
        ws.getCell('F2').value = 'Сумма';

        ['A2', 'B2', 'D2', 'E2', 'F2'].forEach(c => {
            ws.getCell(c).font = { bold: true };
            ws.getCell(c).border = { bottom: { style: 'medium' } };
        });

        let incRow = 3;
        monthIncomes.forEach(inc => {
            ws.getCell(`A${incRow}`).value = inc.date;
            ws.getCell(`B${incRow}`).value = inc.val;
            ws.getCell(`B${incRow}`).numFmt = '#,##0 \\₽';
            incRow++;
        });

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
    
    const maxVal = Math.max(...data.map(d => d.val), 1000); 

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
                saveState();
            } else {
                e.target.value = state.categories[idx].name; 
            }
        });

        delBtn.addEventListener('click', () => {
            if (confirm(`Удалить категорию "${cat.name}" и все её наименования?`)) {
                state.categories.splice(idx, 1);
                saveState();
                renderSettings();
            }
        });

        const deleteSubItemBtns = li.querySelectorAll('.delete-subitem');
        deleteSubItemBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const iIdx = parseInt(btn.getAttribute('data-item'));
                state.categories[idx].items.splice(iIdx, 1);
                saveState();
                renderSettings();
            });
        });

        const btnAdd = li.querySelector('.btn-add-item');
        btnAdd.addEventListener('click', () => {
            openModal(cat.id);
        });

        list.appendChild(li);
    });

    const addBtn = document.getElementById('add-category-btn');
    const newAddBtn = addBtn.cloneNode(true);
    addBtn.parentNode.replaceChild(newAddBtn, addBtn);
    
    newAddBtn.addEventListener('click', () => {
        state.categories.push({
            id: 'cat_' + Date.now(),
            name: 'Новая категория',
            items: [] // исправлено, чтобы не было ошибки при добавлении
        });
        saveState();
        renderSettings();
    });

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

    const importBtn = document.getElementById('btn-import-backup');
    const importFile = document.getElementById('input-import-backup');
    
    importBtn.onclick = () => importFile.click();
    
    importFile.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!confirm('Вы уверены? Загрузка резервной копии ПЕРЕЗАПИШЕТ все текущие данные. Это действие нельзя отменить.')) {
            importFile.value = ''; 
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
                    
                    saveState();
                    
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

// === Init ===
document.addEventListener('DOMContentLoaded', () => {
    loadState();
    initNavigation();
    initCalendar();
    initModal();
});
