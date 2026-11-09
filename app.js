(() => {
  "use strict";

  const STORAGE_KEY = "todo-list.tasks.v1";
  const CATEGORY_LABELS = { today: "Сегодня", work: "Работа", personal: "Личное" };

  const DEFAULT_TASKS = [
    { title: "Составить план на неделю", category: "work", done: false },
    { title: "Ответить на письма", category: "work", done: false },
    { title: "Купить продукты на ужин", category: "personal", done: false },
    { title: "Прогуляться 30 минут", category: "today", done: false },
    { title: "Прочитать главу книги", category: "personal", done: false },
    { title: "Полить растения", category: "today", done: true },
    { title: "Навести порядок на рабочем столе", category: "work", done: true },
  ];

  // ---------- State ----------
  const state = {
    tasks: load(),
    filter: "all",
    category: "all",
  };

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw !== null) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.filter(isValidTask);
      }
    } catch (_) { /* storage unavailable or corrupted — fall back to defaults */ }
    return DEFAULT_TASKS.map((t) => ({ ...t, id: uid(), createdAt: Date.now() }));
  }

  function isValidTask(t) {
    return t && typeof t.id === "string" && typeof t.title === "string" && typeof t.done === "boolean";
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tasks));
    } catch (_) { /* ignore quota / private mode errors */ }
  }

  // ---------- Actions ----------
  function addTask(title, category) {
    state.tasks.unshift({ id: uid(), title, category: category || "", done: false, createdAt: Date.now() });
    commit();
  }

  function toggleTask(id) {
    const task = state.tasks.find((t) => t.id === id);
    if (!task) return;
    task.done = !task.done;
    commit();
  }

  function deleteTask(id) {
    state.tasks = state.tasks.filter((t) => t.id !== id);
    commit();
  }

  function clearDone() {
    state.tasks = state.tasks.filter((t) => !t.done);
    commit();
  }

  function commit() {
    save();
    render();
  }

  // ---------- DOM ----------
  const $ = (sel) => document.querySelector(sel);
  const listEl = $("#task-list");
  const emptyEl = $("#empty");
  const template = $("#task-template");
  const form = $("#add-form");
  const input = $("#add-input");
  const categorySelect = $("#add-category");
  const field = $(".add__field");

  function plural(n, forms) {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return forms[0];
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return forms[1];
    return forms[2];
  }

  function render() {
    const inCategory = state.tasks.filter((t) => state.category === "all" || t.category === state.category);
    const done = inCategory.filter((t) => t.done).length;
    const active = inCategory.length - done;

    const visible = inCategory
      .filter((t) => state.filter === "all" || (state.filter === "done" ? t.done : !t.done))
      // активные задачи сверху, выполненные — внизу
      .sort((a, b) => Number(a.done) - Number(b.done));

    listEl.replaceChildren(...visible.map(renderTask));

    emptyEl.hidden = visible.length > 0;
    emptyEl.textContent = state.filter === "done"
      ? "Выполненных задач пока нет."
      : state.filter === "active" && inCategory.length
        ? "Все задачи выполнены — отличная работа!"
        : "Здесь пока пусто. Добавьте первую задачу.";

    document.querySelector('[data-count="all"]').textContent = inCategory.length;
    document.querySelector('[data-count="active"]').textContent = active;
    document.querySelector('[data-count="done"]').textContent = done;

    $("#left-count").textContent = active;
    $("#left-label").textContent = `${plural(active, ["задача", "задачи", "задач"])} ${plural(active, ["осталась", "осталось", "осталось"])}`;
    $("#clear-done").disabled = done === 0;

    // карточка прогресса: кольцо + счётчики
    const pct = inCategory.length ? Math.round((done / inCategory.length) * 100) : 0;
    const ring = $("#progress-ring");
    $("#progress-value").style.strokeDashoffset = String(100 - pct);
    $("#progress-percent").textContent = `${pct}%`;
    ring.setAttribute("aria-valuenow", String(pct));
    ring.classList.toggle("is-empty", pct === 0);
    $("#stat-total").textContent = inCategory.length;
    $("#stat-active").textContent = active;
    $("#stat-done").textContent = done;

    // счётчики активных задач у категорий в боковой панели
    document.querySelectorAll("[data-cat-count]").forEach((el) => {
      const cat = el.dataset.catCount;
      el.textContent = state.tasks.filter((t) => !t.done && (cat === "all" || t.category === cat)).length;
    });

    document.querySelectorAll(".filter").forEach((b) => {
      const on = b.dataset.filter === state.filter;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-selected", String(on));
    });
    document.querySelectorAll(".category").forEach((b) =>
      b.classList.toggle("is-active", b.dataset.category === state.category));
  }

  function renderTask(task) {
    const node = template.content.firstElementChild.cloneNode(true);
    node.dataset.id = task.id;
    node.classList.toggle("is-done", task.done);
    const checkbox = node.querySelector(".check__input");
    checkbox.checked = task.done;
    checkbox.setAttribute("aria-label", task.done ? `Вернуть в работу: ${task.title}` : `Отметить выполненной: ${task.title}`);
    node.querySelector(".task__title").textContent = task.title;
    node.querySelector(".task__tag").textContent = CATEGORY_LABELS[task.category] || "";
    return node;
  }

  // ---------- Events ----------
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const title = input.value.trim().replace(/\s+/g, " ");
    if (!title) {
      field.classList.remove("is-error");
      void field.offsetWidth; // restart animation
      field.classList.add("is-error");
      input.focus();
      return;
    }
    const category = categorySelect.value || (state.category !== "all" ? state.category : "");
    addTask(title, category);
    if (state.filter === "done") state.filter = "all";
    render();
    input.value = "";
    input.focus();
  });

  input.addEventListener("input", () => field.classList.remove("is-error"));

  listEl.addEventListener("change", (e) => {
    if (!e.target.matches(".check__input")) return;
    toggleTask(e.target.closest(".task").dataset.id);
  });

  listEl.addEventListener("click", (e) => {
    const btn = e.target.closest(".task__delete");
    if (!btn) return;
    const item = btn.closest(".task");
    item.classList.add("is-removing");
    setTimeout(() => deleteTask(item.dataset.id), 180);
  });

  $("#clear-done").addEventListener("click", clearDone);

  document.querySelector(".filters").addEventListener("click", (e) => {
    const btn = e.target.closest(".filter");
    if (!btn) return;
    state.filter = btn.dataset.filter;
    render();
  });

  $("#categories").addEventListener("click", (e) => {
    const btn = e.target.closest(".category");
    if (!btn) return;
    state.category = btn.dataset.category;
    categorySelect.value = state.category === "all" ? "" : state.category;
    render();
  });

  // ---------- Theme ----------
  const THEME_KEY = "todo-list.theme";
  const themeBtn = $("#theme-toggle");

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    $("#theme-label").textContent = theme === "dark" ? "Светлая тема" : "Тёмная тема";
  }

  themeBtn.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch (_) { /* ignore */ }
    // импульс по рамке: перезапускаем анимацию при каждом клике
    themeBtn.classList.remove("is-pulsing");
    void themeBtn.offsetWidth;
    themeBtn.classList.add("is-pulsing");
  });
  themeBtn.addEventListener("animationend", (e) => {
    if (e.animationName === "star-pulse") themeBtn.classList.remove("is-pulsing");
  });

  applyTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");

  // синхронизация между вкладками
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) { state.tasks = load(); render(); }
    if (e.key === THEME_KEY && (e.newValue === "light" || e.newValue === "dark")) applyTheme(e.newValue);
  });

  // ---------- Init ----------
  $("#today-date").textContent = new Date().toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" });
  render();
})();
