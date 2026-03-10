const form = document.getElementById('lessonForm');
const formTitle = document.getElementById('formTitle');
const errorEl = document.getElementById('formError');
const lessonsEl = document.getElementById('lessons');
const emptyState = document.getElementById('emptyState');
const resetBtn = document.getElementById('resetBtn');
const refreshBtn = document.getElementById('refreshBtn');

const todayEl = document.getElementById('today');
const today = new Date();
todayEl.textContent = today.toLocaleDateString('ru-RU');

function setFormMode(editing) {
  formTitle.textContent = editing ? 'Редактировать пару' : 'Добавить пару';
}

function clearForm() {
  form.reset();
  form.elements.id.value = '';
  errorEl.textContent = '';
  setFormMode(false);
}

function formatDate(dateStr) {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

function renderLessons(lessons) {
  lessonsEl.innerHTML = '';
  if (!lessons.length) {
    emptyState.style.display = 'block';
    return;
  }
  emptyState.style.display = 'none';

  lessons.forEach(lesson => {
    const card = document.createElement('div');
    card.className = 'card';

    const header = document.createElement('div');
    header.className = 'card-header';

    const title = document.createElement('div');
    title.className = 'card-title';
    title.textContent = lesson.subject;

    const time = document.createElement('div');
    time.className = 'card-time';
    time.textContent = `${formatDate(lesson.date)} • ${lesson.start}–${lesson.end}`;

    header.appendChild(title);
    header.appendChild(time);

    const meta = document.createElement('div');
    meta.className = 'card-meta';

    if (lesson.teacher) meta.appendChild(makeTag(lesson.teacher));
    if (lesson.room) meta.appendChild(makeTag(lesson.room));
    if (lesson.group) meta.appendChild(makeTag(lesson.group));

    const editBtn = document.createElement('button');
    editBtn.className = 'ghost';
    editBtn.textContent = 'Редактировать';
    editBtn.addEventListener('click', () => {
      form.elements.id.value = lesson.id;
      form.elements.date.value = lesson.date;
      form.elements.start.value = lesson.start;
      form.elements.end.value = lesson.end;
      form.elements.subject.value = lesson.subject;
      form.elements.teacher.value = lesson.teacher || '';
      form.elements.room.value = lesson.room || '';
      form.elements.group.value = lesson.group || '';
      setFormMode(true);
      errorEl.textContent = '';
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    card.appendChild(header);
    card.appendChild(meta);
    card.appendChild(editBtn);

    lessonsEl.appendChild(card);
  });
}

function makeTag(text) {
  const tag = document.createElement('span');
  tag.className = 'tag';
  tag.textContent = text;
  return tag;
}

async function loadLessons() {
  try {
    const res = await fetch('/api/lessons');
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      errorEl.textContent = data.error || 'Не удалось загрузить расписание';
      return;
    }
    renderLessons(data.lessons || []);
  } catch (err) {
    errorEl.textContent = 'Нет соединения с сервером';
  }
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  errorEl.textContent = '';

  const payload = {
    date: form.elements.date.value,
    start: form.elements.start.value,
    end: form.elements.end.value,
    subject: form.elements.subject.value.trim(),
    teacher: form.elements.teacher.value.trim(),
    room: form.elements.room.value.trim(),
    group: form.elements.group.value.trim()
  };

  const id = form.elements.id.value;
  const method = id ? 'PUT' : 'POST';
  const url = id ? `/api/lessons/${id}` : '/api/lessons';

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      errorEl.textContent = data.error || 'Ошибка сохранения';
      return;
    }

    clearForm();
    await loadLessons();
  } catch (err) {
    errorEl.textContent = 'Нет соединения с сервером';
  }
});

resetBtn.addEventListener('click', () => {
  clearForm();
});

refreshBtn.addEventListener('click', () => {
  loadLessons();
});

loadLessons();
