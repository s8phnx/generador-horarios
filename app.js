const DATA = window.COURSE_DATA;

if (!DATA || !Array.isArray(DATA.courses)) {
  throw new Error("No se cargó COURSE_DATA. Revisa que data.js esté antes de app.js en index.html.");
}

const FAVORITES_KEY = "generador-ramos:favoritos:v1";
const BLOCKED_SLOTS_KEY = "generador-ramos:bloqueos:v1";
const CAREER_KEY = "generador-ramos:carrera:v1";

const CAREERS = Array.isArray(DATA.meta?.careers) && DATA.meta.careers.length
  ? DATA.meta.careers
  : [{ id: "engineering", name: "Ingeniería Civil", shortName: "Ingeniería" }];

const DEFAULT_CAREER = CAREERS.some(career => career.id === localStorage.getItem(CAREER_KEY))
  ? localStorage.getItem(CAREER_KEY)
  : CAREERS[0].id;

const state = {
  activeCareer: DEFAULT_CAREER,
  selected: new Map(), // courseRef -> Set(option ids)
  results: [],
  current: 0,
  favorites: loadFavorites(),
  blockedSlots: loadBlockedSlots(),
};

const els = {
  careerLabel: document.getElementById("careerLabel"),
  careerSelect: document.getElementById("careerSelect"),
  attendanceInfo: document.getElementById("attendanceInfo"),
  courseCount: document.getElementById("courseCount"),
  formationCount: document.getElementById("formationCount"),
  optionCount: document.getElementById("optionCount"),
  courseSearch: document.getElementById("courseSearch"),
  courseList: document.getElementById("courseList"),
  addCourseBtn: document.getElementById("addCourseBtn"),
  selectedCourses: document.getElementById("selectedCourses"),
  formationEnabled: document.getElementById("formationEnabled"),
  formationOptions: document.getElementById("formationOptions"),
  formationType: document.getElementById("formationType"),
  formationModality: document.getElementById("formationModality"),
  formationSelectionMode: document.getElementById("formationSelectionMode"),
  formationCourseWrap: document.getElementById("formationCourseWrap"),
  formationCourseSearch: document.getElementById("formationCourseSearch"),
  formationCourseList: document.getElementById("formationCourseList"),
  formationSummary: document.getElementById("formationSummary"),
  preference: document.getElementById("preference"),
  freeDay: document.getElementById("freeDay"),
  preferredProfessors: document.getElementById("preferredProfessors"),
  blockedProfessors: document.getElementById("blockedProfessors"),
  blockDay: document.getElementById("blockDay"),
  blockTime: document.getElementById("blockTime"),
  blockReason: document.getElementById("blockReason"),
  addBlockBtn: document.getElementById("addBlockBtn"),
  clearBlocksBtn: document.getElementById("clearBlocksBtn"),
  blockedSlotsList: document.getElementById("blockedSlotsList"),
  generateBtn: document.getElementById("generateBtn"),
  clearBtn: document.getElementById("clearBtn"),
  status: document.getElementById("status"),
  summary: document.getElementById("summary"),
  prevBtn: document.getElementById("prevBtn"),
  nextBtn: document.getElementById("nextBtn"),
  pageLabel: document.getElementById("pageLabel"),
  saveFavoriteBtn: document.getElementById("saveFavoriteBtn"),
  clearFavoritesBtn: document.getElementById("clearFavoritesBtn"),
  favoritesList: document.getElementById("favoritesList"),
  scoreCards: document.getElementById("scoreCards"),
  comboList: document.getElementById("comboList"),
  unscheduledNotice: document.getElementById("unscheduledNotice"),
  scheduleTable: document.getElementById("scheduleTable"),
};

const ALL_NORMAL_COURSES = DATA.courses.filter(course => !course.isFormationAcademic);
const FORMATION_COURSES = DATA.courses.filter(course => course.isFormationAcademic);
const allCoursesByRef = new Map(DATA.courses.map(course => [courseRef(course), course]));
const allOptionsById = new Map();
DATA.courses.forEach(course => {
  course.options.forEach(option => {
    allOptionsById.set(option.id, { course, option });
  });
});

let NORMAL_COURSES = [];
let coursesByCode = new Map();
refreshCareerContext();

function courseRef(course) {
  const career = course.career || (course.isFormationAcademic ? "formation" : "engineering");
  return `${career}::${normalize(course.code)}::${normalize(course.name)}`;
}

function currentCareerMeta() {
  return CAREERS.find(career => career.id === state.activeCareer) || CAREERS[0];
}

function refreshCareerContext() {
  if (!CAREERS.some(career => career.id === state.activeCareer)) {
    state.activeCareer = CAREERS[0].id;
  }

  NORMAL_COURSES = ALL_NORMAL_COURSES.filter(course =>
    (course.career || "engineering") === state.activeCareer
  );

  coursesByCode = new Map();
  NORMAL_COURSES.forEach(course => {
    const key = normalize(course.code);
    if (!coursesByCode.has(key)) coursesByCode.set(key, []);
    coursesByCode.get(key).push(course);
  });

}

function populateCareerSelect() {
  els.careerSelect.innerHTML = "";
  CAREERS.forEach(career => {
    const option = document.createElement("option");
    option.value = career.id;
    option.textContent = career.period ? `${career.name} · ${career.period}` : career.name;
    els.careerSelect.appendChild(option);
  });
  els.careerSelect.value = state.activeCareer;
}

function refreshCareerUI() {
  const career = currentCareerMeta();
  const normalOptionCount = NORMAL_COURSES.reduce((sum, course) => sum + course.options.length, 0);

  els.careerLabel.textContent = career.period ? `${career.name} · ${career.period}` : career.name;
  els.courseCount.textContent = `${NORMAL_COURSES.length} ramos de ${career.shortName || career.name}`;
  els.formationCount.textContent = `${DATA.meta.formationCourseCount ?? FORMATION_COURSES.length} cursos de formación`;
  els.optionCount.textContent = `${normalOptionCount} secciones de ${career.shortName || career.name}`;

  els.courseSearch.placeholder = state.activeCareer === "design"
    ? "Ej: DIS09122 o Cultura del Diseño"
    : "Ej: CBE2000 o Probabilidades";

  els.courseList.innerHTML = "";
  const datalistValues = new Set();
  NORMAL_COURSES.forEach(course => {
    addCourseListOption(`${course.code} — ${course.name}`, datalistValues);
  });

  if (els.attendanceInfo) {
    els.attendanceInfo.hidden = state.activeCareer === "design";
  }

}

function switchCareer(careerId, { announce = true } = {}) {
  if (!CAREERS.some(career => career.id === careerId)) return;

  state.activeCareer = careerId;
  localStorage.setItem(CAREER_KEY, careerId);
  state.selected.clear();
  state.results = [];
  state.current = 0;
  els.courseSearch.value = "";

  refreshCareerContext();
  refreshCareerUI();
  renderSelected();
  renderEmptySchedule(`Carrera cambiada a ${currentCareerMeta().name}. Agrega tus ramos y vuelve a generar.`);
  renderFavorites();

  if (announce) {
    setStatus(`Carrera cambiada a ${currentCareerMeta().name}.`);
  }
}

function init() {
  populateCareerSelect();
  refreshCareerUI();
  populateFormationCourseList();
  updateFormationUI();
  populateBlockInputs();
  bindEvents();
  renderSelected();
  renderBlockedSlots();
  renderFavorites();
  renderEmptySchedule();
}

function bindEvents() {
  els.careerSelect.addEventListener("change", event => {
    switchCareer(event.target.value);
  });

  els.addCourseBtn.addEventListener("click", addCourseFromInput);

  [els.formationEnabled, els.formationType, els.formationModality, els.formationSelectionMode].forEach(control => {
    control.addEventListener("change", () => {
      populateFormationCourseList();
      updateFormationUI();
      resetResultsAfterConstraintChange("Formación Académica actualizada. Vuelve a generar horarios.");
    });
  });

  els.formationCourseSearch.addEventListener("input", () => {
    updateFormationSummary();
    resetResultsAfterConstraintChange("Curso de Formación Académica actualizado. Vuelve a generar horarios.");
  });

  els.courseSearch.addEventListener("keydown", e => {
    if (e.key === "Enter") addCourseFromInput();
  });

  els.generateBtn.addEventListener("click", generateSchedules);

  els.clearBtn.addEventListener("click", () => {
    state.selected.clear();
    state.results = [];
    state.current = 0;
    els.courseSearch.value = "";
    els.formationEnabled.value = "no";
    els.formationType.value = "any";
    els.formationModality.value = "any";
    els.formationSelectionMode.value = "automatic";
    els.formationCourseSearch.value = "";
    populateFormationCourseList();
    updateFormationUI();
    renderSelected();
    renderEmptySchedule();
    setStatus("Selecciona al menos un ramo.");
  });

  els.prevBtn.addEventListener("click", () => {
    if (!state.results.length) return;
    state.current = Math.max(0, state.current - 1);
    renderCurrentResult();
  });

  els.nextBtn.addEventListener("click", () => {
    if (!state.results.length) return;
    state.current = Math.min(state.results.length - 1, state.current + 1);
    renderCurrentResult();
  });

  els.saveFavoriteBtn.addEventListener("click", saveCurrentFavorite);

  els.clearFavoritesBtn.addEventListener("click", () => {
    if (!state.favorites.length) return;
    const ok = window.confirm("¿Seguro que quieres borrar todos los horarios favoritos guardados en este navegador?");
    if (!ok) return;
    state.favorites = [];
    persistFavorites();
    renderFavorites();
    updateFavoriteButton();
    setStatus("Favoritos borrados.");
  });


  els.addBlockBtn.addEventListener("click", addBlockedSlot);

  els.blockReason.addEventListener("keydown", e => {
    if (e.key === "Enter") addBlockedSlot();
  });

  els.clearBlocksBtn.addEventListener("click", () => {
    if (!state.blockedSlots.length) return;
    state.blockedSlots = [];
    persistBlockedSlots();
    renderBlockedSlots();
    resetResultsAfterConstraintChange("Bloqueos eliminados. Vuelve a generar horarios.");
  });
}

function resetResultsAfterConstraintChange(message = "Vuelve a generar horarios para aplicar el cambio.") {
  state.results = [];
  state.current = 0;
  renderEmptySchedule(message);
  setStatus(message);
}

function removeAccents(str) {
  return String(str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalize(str) {
  return removeAccents(str)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function eventAttendanceKind(eventName) {
  const text = normalize(eventName);

  if (!text.includes("AYUDANTIA")) return "required";
  if (text.includes("OPCIONAL")) return "optional";
  if (text.includes("OBLIGATORIA")) return "mandatory";

  // Si el archivo solo dice "Ayudantía" y no aclara si es opcional,
  // se considera obligatoria por seguridad para no mostrar falsos horarios compatibles.
  return "unspecified";
}

function eventScheduleDescription(event) {
  const kind = eventAttendanceKind(event.name);
  const suffix = kind === "optional"
    ? " · opcional, no genera tope"
    : kind === "mandatory"
      ? " · obligatoria"
      : kind === "unspecified"
        ? " · sin especificar, se considera obligatoria"
        : "";

  return `${event.name}${suffix}: ${event.rawSchedule}`;
}

function courseSearchText(course) {
  const aliases = Array.isArray(course.aliases) ? course.aliases.join(" ") : "";
  return normalize(`${course.code} ${course.name} ${aliases}`);
}

function matchingCourses(input) {
  const text = normalize(input);
  if (!text) return [];

  const exact = NORMAL_COURSES.filter(course =>
    normalize(`${course.code} ${course.name}`) === text ||
    (course.aliases || []).some(alias => normalize(alias) === text)
  );
  if (exact.length) return exact;

  const words = text.split(/\s+/).filter(Boolean);
  const directCode = words[0];
  const codeMatches = coursesByCode.get(directCode) || [];

  if (words.length === 1 && codeMatches.length) {
    return codeMatches;
  }

  return NORMAL_COURSES.filter(course => {
    const haystack = courseSearchText(course);
    if (haystack.includes(text)) return true;
    return words.every(word => haystack.includes(word));
  });
}

function courseMetaText(course) {
  const parts = [];
  if (course.credits !== null && course.credits !== undefined && course.credits !== "" && Number.isFinite(Number(course.credits))) {
    parts.push(`${course.credits} créditos`);
  }
  if (course.category) parts.push(course.category);
  parts.push(`${course.options.length} secciones`);
  return parts.join(" · ");
}

function addCourseFromInput() {
  const matches = matchingCourses(els.courseSearch.value);

  if (!matches.length) {
    setStatus("No encontré ese ramo en la carrera seleccionada. Prueba con código o nombre.", true);
    return;
  }

  if (matches.length > 1) {
    setStatus("Encontré más de un curso. Escribe también parte del nombre para elegir el correcto.", true);
    return;
  }

  const course = matches[0];
  const ref = courseRef(course);
  state.selected.set(ref, new Set(course.options.map(option => option.id)));
  els.courseSearch.value = "";
  state.results = [];
  state.current = 0;

  renderSelected();
  renderEmptySchedule();
  setStatus(`${course.code} agregado con ${course.options.length} secciones activas.`);
}

function renderSelected() {
  els.selectedCourses.innerHTML = "";

  if (!state.selected.size) {
    els.selectedCourses.className = "selected-list empty";
    els.selectedCourses.innerHTML = "<p>Aún no agregas ramos.</p>";
    return;
  }

  els.selectedCourses.className = "selected-list";

  for (const [ref, selectedOptionIds] of state.selected.entries()) {
    const course = allCoursesByRef.get(ref);
    if (!course) continue;

    const card = document.createElement("article");
    card.className = "course-card";
    const aliases = (course.aliases || []).length
      ? `<small class="course-aliases">También se encuentra por: ${(course.aliases || []).join(" · ")}</small>`
      : "";
    card.innerHTML = `
      <div class="course-card-head">
        <h3 class="course-title">${course.code} · ${course.name}<br><span>${courseMetaText(course)}</span>${aliases}</h3>
        <button class="ghost remove-course">Quitar</button>
      </div>
      <div class="option-list"></div>
    `;

    card.querySelector(".remove-course").addEventListener("click", () => {
      state.selected.delete(ref);
      state.results = [];
      state.current = 0;
      renderSelected();
      renderEmptySchedule();
    });

    const list = card.querySelector(".option-list");

    course.options.forEach(option => {
      const events = option.events
        .filter(event => event.rawSchedule)
        .map(eventScheduleDescription)
        .join(" · ");
      const professors = option.professors.length ? option.professors.join(", ") : "Profesor no informado";
      const row = document.createElement("label");
      row.className = "option-row";
      row.innerHTML = `
        <input type="checkbox" ${selectedOptionIds.has(option.id) ? "checked" : ""} data-option="${option.id}">
        <span><strong>${option.section}</strong><small>${professors}</small><small>${events || "Sin horario fijo informado"}</small></span>
      `;

      row.querySelector("input").addEventListener("change", event => {
        const set = state.selected.get(ref);
        if (!set) return;
        if (event.target.checked) set.add(option.id);
        else set.delete(option.id);
        state.results = [];
        state.current = 0;
        renderEmptySchedule("Vuelve a generar horarios para aplicar el cambio de secciones.");
      });

      list.appendChild(row);
    });

    els.selectedCourses.appendChild(card);
  }
}

function formationFilters() {
  return {
    enabled: els.formationEnabled.value === "yes",
    type: els.formationType.value,
    modality: els.formationModality.value,
    mode: els.formationSelectionMode.value,
  };
}

function optionMatchesFormationFilters(course, option, filters = formationFilters()) {
  const typeOk = filters.type === "any" || course.formationType === filters.type;
  const modalityOk = filters.modality === "any" || option.modality === filters.modality;
  return typeOk && modalityOk;
}

function eligibleFormationCourses(filters = formationFilters()) {
  return FORMATION_COURSES.filter(course =>
    course.options.some(option => optionMatchesFormationFilters(course, option, filters))
  );
}

function populateFormationCourseList() {
  if (!els.formationCourseList) return;
  const current = els.formationCourseSearch.value;
  els.formationCourseList.innerHTML = "";
  const seen = new Set();
  eligibleFormationCourses().forEach(course => {
    addCourseListOption(`${course.code} — ${course.name}`, seen, els.formationCourseList);
  });
  els.formationCourseSearch.value = current;
  updateFormationSummary();
}

function addCourseListOption(value, seen, target = els.courseList) {
  if (seen.has(value)) return;
  seen.add(value);
  const opt = document.createElement("option");
  opt.value = value;
  target.appendChild(opt);
}

function extractFormationCode(input) {
  const text = normalize(input);
  if (!text) return null;
  const direct = text.split(" ")[0];
  const candidates = eligibleFormationCourses();
  if (candidates.some(course => course.code === direct)) return direct;
  const words = text.split(/\s+/).filter(Boolean);
  const found = candidates.find(course => {
    const haystack = normalize(`${course.code} ${course.name}`);
    return haystack.includes(text) || words.every(word => haystack.includes(word));
  });
  return found ? found.code : null;
}

function formationCandidateItems(filters = formationFilters()) {
  const courses = eligibleFormationCourses(filters);
  const selectedCode = filters.mode === "specific" ? extractFormationCode(els.formationCourseSearch.value) : null;
  const chosenCourses = selectedCode ? courses.filter(course => course.code === selectedCode) : courses;
  const items = [];
  chosenCourses.forEach(course => {
    course.options
      .filter(option => optionMatchesFormationFilters(course, option, filters))
      .forEach(option => items.push({ course, option, meetings: getMeetings({ course, option }) }));
  });
  return { items, selectedCode };
}

function updateFormationUI() {
  const filters = formationFilters();
  els.formationOptions.hidden = !filters.enabled;
  els.formationCourseWrap.hidden = !filters.enabled || filters.mode !== "specific";
  updateFormationSummary();
}

function updateFormationSummary() {
  if (!els.formationSummary) return;
  const filters = formationFilters();
  if (!filters.enabled) {
    els.formationSummary.textContent = "No se agregará Formación Académica.";
    return;
  }
  const { items, selectedCode } = formationCandidateItems(filters);
  if (filters.mode === "specific" && !selectedCode) {
    els.formationSummary.textContent = "Escribe un curso específico válido para aplicar los filtros.";
    return;
  }
  const courseCount = new Set(items.map(item => item.course.code)).size;
  const typeText = filters.type === "deportivo" ? "deportivos" : filters.type === "no-deportivo" ? "no deportivos" : "deportivos y no deportivos";
  const modalityText = filters.modality === "b-learning" ? "B-learning" : filters.modality === "presencial" ? "presenciales" : "presenciales o B-learning";
  els.formationSummary.textContent = filters.mode === "automatic"
    ? `${courseCount} cursos ${typeText} y ${items.length} secciones ${modalityText} disponibles para buscar el mejor encaje.`
    : `${courseCount ? "Curso listo" : "Sin coincidencias"}: ${items.length} secciones compatibles con los filtros.`;
}

function setStatus(text, isError = false) {
  els.status.textContent = text;
  els.status.style.color = isError ? "var(--danger)" : "var(--muted)";
}

function populateBlockInputs() {
  els.blockDay.innerHTML = "";
  DATA.days.forEach(day => {
    const opt = document.createElement("option");
    opt.value = day;
    opt.textContent = day;
    els.blockDay.appendChild(opt);
  });

  els.blockTime.innerHTML = "";
  const uniqueSlots = [...new Map((DATA.slots || [])
    .map(slot => [`${slot.startMin}-${slot.endMin}`, slot]))
    .values()]
    .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);

  uniqueSlots.forEach(slot => {
    const opt = document.createElement("option");
    opt.value = `${slot.startMin}-${slot.endMin}`;
    opt.textContent = slot.time;
    opt.dataset.startMin = slot.startMin;
    opt.dataset.endMin = slot.endMin;
    opt.dataset.time = slot.time;
    els.blockTime.appendChild(opt);
  });
}

function selectedBlockSlot() {
  const opt = els.blockTime.selectedOptions[0];
  if (!opt) return null;

  return {
    startMin: Number(opt.dataset.startMin),
    endMin: Number(opt.dataset.endMin),
    time: opt.dataset.time,
  };
}

function addBlockedSlot() {
  const day = els.blockDay.value;
  const slot = selectedBlockSlot();
  const label = els.blockReason.value.trim();

  if (!day || !slot) {
    setStatus("Elige día y horario para bloquear.", true);
    return;
  }

  const exists = state.blockedSlots.some(block =>
    block.day === day && block.startMin === slot.startMin && block.endMin === slot.endMin
  );

  if (exists) {
    setStatus("Ese horario ya está bloqueado.", true);
    return;
  }

  state.blockedSlots.push({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    day,
    label,
    ...slot,
  });

  state.blockedSlots.sort((a, b) => DATA.days.indexOf(a.day) - DATA.days.indexOf(b.day) || a.startMin - b.startMin);
  els.blockReason.value = "";
  persistBlockedSlots();
  renderBlockedSlots();
  resetResultsAfterConstraintChange("Horario bloqueado. Vuelve a generar para descartar topes con ese bloque.");
}

function removeBlockedSlot(id) {
  state.blockedSlots = state.blockedSlots.filter(block => block.id !== id);
  persistBlockedSlots();
  renderBlockedSlots();
  resetResultsAfterConstraintChange("Bloqueo eliminado. Vuelve a generar horarios.");
}

function renderBlockedSlots() {
  els.blockedSlotsList.innerHTML = "";

  if (!state.blockedSlots.length) {
    els.blockedSlotsList.className = "blocked-slots-list empty";
    els.blockedSlotsList.innerHTML = "<p>No tienes horarios bloqueados.</p>";
    return;
  }

  els.blockedSlotsList.className = "blocked-slots-list";

  state.blockedSlots.forEach(block => {
    const chip = document.createElement("div");
    chip.className = "blocked-chip";
    chip.innerHTML = `
      <span><strong>${block.day}</strong> ${block.time}${block.label ? ` · ${block.label}` : ""}</span>
      <button class="ghost small-btn" data-remove-block="${block.id}" aria-label="Quitar bloqueo">×</button>
    `;
    chip.querySelector("button").addEventListener("click", () => removeBlockedSlot(block.id));
    els.blockedSlotsList.appendChild(chip);
  });
}

function getBlockedMeetings() {
  return state.blockedSlots.map(block => ({
    ...block,
    isBlocked: true,
    eventName: "Horario bloqueado",
    professor: block.label || "Bloqueado",
  }));
}

function loadBlockedSlots() {
  try {
    const raw = localStorage.getItem(BLOCKED_SLOTS_KEY);
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistBlockedSlots() {
  localStorage.setItem(BLOCKED_SLOTS_KEY, JSON.stringify(state.blockedSlots));
}

function getMeetings(item) {
  const meetings = [];

  item.option.events.forEach(event => {
    const attendanceKind = eventAttendanceKind(event.name);

    event.meetings.forEach(m => {
      meetings.push({
        ...m,
        eventName: event.name,
        professor: event.professor,
        attendanceKind,
        isOptional: attendanceKind === "optional",
        course: item.course,
        option: item.option,
      });
    });
  });

  return meetings;
}

function overlaps(a, b) {
  return a.day === b.day && a.startMin < b.endMin && b.startMin < a.endMin;
}

function hasConflict(existingMeetings, newMeetings) {
  for (const a of existingMeetings) {
    for (const b of newMeetings) {
      // Las ayudantías opcionales se muestran en el horario, pero no bloquean
      // la inscripción de una cátedra, laboratorio u otro ramo en el mismo bloque.
      if (a.isOptional || b.isOptional) continue;
      if (overlaps(a, b)) return true;
    }
  }
  return false;
}

function buildInputGroups() {
  const groups = [];

  for (const [ref, selectedIds] of state.selected.entries()) {
    const course = allCoursesByRef.get(ref);
    if (!course) continue;

    const options = course.options
      .filter(option => selectedIds.has(option.id))
      .map(option => ({ course, option, meetings: getMeetings({ course, option }) }));

    if (!options.length) return { error: `No dejaste ninguna sección activa en ${course.code}.` };
    groups.push({ course, options });
  }

  groups.sort((a, b) => a.options.length - b.options.length);
  return { groups };
}

function parseProfessorTokens(value) {
  return String(value || "")
    .split(",")
    .map(part => normalize(part))
    .filter(Boolean);
}

function getProfessorRules() {
  return {
    preferred: parseProfessorTokens(els.preferredProfessors.value),
    avoided: parseProfessorTokens(els.blockedProfessors.value),
  };
}

function optionProfessorText(option) {
  const names = new Set();

  (option.professors || []).forEach(p => {
    if (p) names.add(p);
  });

  (option.events || []).forEach(event => {
    if (event.professor) names.add(event.professor);
  });

  return normalize([...names].join(" "));
}

function professorStats(combo, rules) {
  let preferredMatches = 0;
  let avoidedMatches = 0;
  const preferredDetails = [];
  const avoidedDetails = [];

  combo.forEach(item => {
    const text = optionProfessorText(item.option);

    const preferredHit = rules.preferred.some(token => text.includes(token));
    const avoidedHit = rules.avoided.some(token => text.includes(token));

    if (preferredHit) {
      preferredMatches += 1;
      preferredDetails.push(`${item.course.code} ${item.option.section}`);
    }

    if (avoidedHit) {
      avoidedMatches += 1;
      avoidedDetails.push(`${item.course.code} ${item.option.section}`);
    }
  });

  return {
    preferredMatches,
    avoidedMatches,
    preferredDetails,
    avoidedDetails,
    hasRules: Boolean(rules.preferred.length || rules.avoided.length),
  };
}

function generateSchedules() {
  const formation = formationFilters();

  if (!state.selected.size && !formation.enabled) {
    setStatus("Selecciona al menos un ramo o activa Formación Académica.", true);
    return;
  }

  const { groups, error } = buildInputGroups();

  if (error) {
    setStatus(error, true);
    return;
  }

  const formationCandidates = formation.enabled ? formationCandidateItems(formation) : { items: [], selectedCode: null };
  if (formation.enabled && formation.mode === "specific" && !formationCandidates.selectedCode) {
    setStatus("Elige un curso específico de Formación Académica válido.", true);
    return;
  }
  if (formation.enabled && !formationCandidates.items.length) {
    setStatus("No hay cursos de Formación Académica que cumplan esos filtros.", true);
    return;
  }

  const maxResults = 2500;
  const maxExplored = 180000;
  let explored = 0;
  const results = [];
  const rules = getProfessorRules();
  const blockedMeetings = getBlockedMeetings();
  const pref = els.preference.value;
  const freeDay = els.freeDay.value;

  function finishCombo(combo, meetings) {
    if (!formation.enabled) {
      results.push(scoreCombo(combo, meetings, rules));
      return;
    }

    if (formation.mode === "specific") {
      formationCandidates.items.forEach(item => {
        if (results.length >= maxResults) return;
        if (!hasConflict(meetings, item.meetings) && !hasConflict(blockedMeetings, item.meetings)) {
          results.push(scoreCombo(combo.concat(item), meetings.concat(item.meetings), rules));
        }
      });
      return;
    }

    // En modo automático se agrega solo la opción de Formación Académica
    // que mejor calza con cada combinación base.
    let best = null;
    formationCandidates.items.forEach(item => {
      if (hasConflict(meetings, item.meetings) || hasConflict(blockedMeetings, item.meetings)) return;
      const candidate = scoreCombo(combo.concat(item), meetings.concat(item.meetings), rules);
      if (!best || compareResults(candidate, best, pref, freeDay) < 0) best = candidate;
    });
    if (best) results.push(best);
  }

  function backtrack(idx, combo, meetings) {
    if (explored > maxExplored || results.length >= maxResults) return;

    if (idx === groups.length) {
      finishCombo(combo, meetings);
      return;
    }

    for (const item of groups[idx].options) {
      explored += 1;

      if (!hasConflict(meetings, item.meetings) && !hasConflict(blockedMeetings, item.meetings)) {
        backtrack(idx + 1, combo.concat(item), meetings.concat(item.meetings));
      }
    }
  }

  backtrack(0, [], []);
  results.sort((a, b) => compareResults(a, b, pref, freeDay));

  state.results = results;
  state.current = 0;

  if (!results.length) {
    setStatus("No encontré combinaciones sin topes con esas condiciones.", true);
    els.summary.textContent = formation.enabled
      ? "Prueba cambiando el tipo/modalidad de Formación Académica o activando más secciones."
      : "Prueba activando más secciones o quitando un ramo.";
    renderEmptySchedule("Sin combinaciones posibles.");
    return;
  }

  const limited = explored > maxExplored || results.length >= maxResults;
  const formationText = formation.enabled ? " Cada alternativa incluye un curso de Formación Académica." : "";

  if (rules.preferred.length || rules.avoided.length) {
    const best = results[0];
    setStatus(
      (limited
        ? `Encontré ${results.length} horarios antes del límite. El primero tiene ${best.professorStats.preferredMatches} preferidos y ${best.professorStats.avoidedMatches} evitados.`
        : `Encontré ${results.length} horarios posibles. El primero tiene ${best.professorStats.preferredMatches} preferidos y ${best.professorStats.avoidedMatches} evitados.`) + formationText
    );
  } else {
    setStatus(
      (limited
        ? `Encontré ${results.length} horarios antes del límite de búsqueda. Puedes filtrar secciones para más precisión.`
        : `Encontré ${results.length} horarios posibles.`) + formationText
    );
  }

  renderCurrentResult();
}

function scoreCombo(combo, meetings, rules = getProfessorRules()) {
  const requiredMeetings = meetings.filter(meeting => !meeting.isOptional);
  const optionalMeetings = meetings.filter(meeting => meeting.isOptional);
  const byDay = groupMeetingsByDay(requiredMeetings);
  let windowMinutes = 0;
  let totalSpan = 0;
  let earliestStart = Infinity;
  let latestEnd = 0;
  let daysWithClass = 0;

  Object.values(byDay).forEach(list => {
    if (!list.length) return;
    daysWithClass += 1;
    list.sort((a, b) => a.startMin - b.startMin);
    earliestStart = Math.min(earliestStart, list[0].startMin);
    latestEnd = Math.max(latestEnd, list[list.length - 1].endMin);
    const merged = mergeIntervals(list);
    const daySpan = merged[merged.length - 1].endMin - merged[0].startMin;
    const classMinutes = merged.reduce((sum, m) => sum + (m.endMin - m.startMin), 0);
    totalSpan += daySpan;
    windowMinutes += Math.max(0, daySpan - classMinutes);
  });

  const freeDays = DATA.days.filter(day => !(byDay[day] || []).length);

  return {
    combo,
    meetings,
    requiredMeetings,
    optionalMeetingCount: optionalMeetings.length,
    windowMinutes,
    totalSpan,
    earliestStart: earliestStart === Infinity ? 0 : earliestStart,
    latestEnd,
    daysWithClass,
    freeDays,
    professorStats: professorStats(combo, rules),
  };
}

function groupMeetingsByDay(meetings) {
  const obj = {};
  DATA.days.forEach(d => obj[d] = []);

  meetings.forEach(m => {
    if (!obj[m.day]) obj[m.day] = [];
    obj[m.day].push(m);
  });

  return obj;
}

function mergeIntervals(list) {
  const sorted = [...list].sort((a, b) => a.startMin - b.startMin);
  const merged = [];

  sorted.forEach(m => {
    const last = merged[merged.length - 1];
    if (!last || m.startMin > last.endMin) merged.push({ startMin: m.startMin, endMin: m.endMin });
    else last.endMin = Math.max(last.endMin, m.endMin);
  });

  return merged;
}

function compareResults(a, b, pref, freeDay) {
  const aStats = a.professorStats;
  const bStats = b.professorStats;

  if (aStats.hasRules || bStats.hasRules) {
    if (aStats.avoidedMatches !== bStats.avoidedMatches) {
      return aStats.avoidedMatches - bStats.avoidedMatches;
    }

    if (aStats.preferredMatches !== bStats.preferredMatches) {
      return bStats.preferredMatches - aStats.preferredMatches;
    }
  }


  if (freeDay === "__any__") {
    const aHasFreeDay = a.freeDays.length > 0 ? 0 : 1;
    const bHasFreeDay = b.freeDays.length > 0 ? 0 : 1;
    if (aHasFreeDay !== bHasFreeDay) return aHasFreeDay - bHasFreeDay;

    // Si ambos tienen día libre, prioriza el que tenga menos días con clases.
    if (a.daysWithClass !== b.daysWithClass) return a.daysWithClass - b.daysWithClass;
  } else if (freeDay) {
    const aPenalty = a.requiredMeetings.some(m => m.day === freeDay) ? 1 : 0;
    const bPenalty = b.requiredMeetings.some(m => m.day === freeDay) ? 1 : 0;
    if (aPenalty !== bPenalty) return aPenalty - bPenalty;
  }

  if (pref === "early") return (a.latestEnd - b.latestEnd) || (a.windowMinutes - b.windowMinutes) || (a.totalSpan - b.totalSpan);
  if (pref === "late") return (b.earliestStart - a.earliestStart) || (a.windowMinutes - b.windowMinutes) || (a.totalSpan - b.totalSpan);
  if (pref === "compact") return (a.totalSpan - b.totalSpan) || (a.windowMinutes - b.windowMinutes) || (a.latestEnd - b.latestEnd);

  return (a.windowMinutes - b.windowMinutes) || (a.totalSpan - b.totalSpan) || (a.latestEnd - b.latestEnd);
}

function fmtMin(total) {
  const h = Math.floor(total / 60).toString().padStart(2, "0");
  const m = (total % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

function comboSignatureFromResult(result) {
  return result.combo
    .map(item => item.option.id)
    .sort()
    .join("|");
}

function comboSignatureFromFavorite(fav) {
  return fav.items
    .map(item => item.optionId)
    .sort()
    .join("|");
}

function renderCurrentResult() {
  const result = state.results[state.current];

  if (!result) {
    renderEmptySchedule();
    return;
  }

  els.summary.textContent = `Mostrando alternativa ${state.current + 1} de ${state.results.length}.`;
  els.pageLabel.textContent = `${state.current + 1} / ${state.results.length}`;
  els.prevBtn.disabled = state.current === 0;
  els.nextBtn.disabled = state.current === state.results.length - 1;

  const professorCard = result.professorStats.hasRules
    ? `<div class="score ${result.professorStats.avoidedMatches ? "score-danger" : "score-ok"}"><b>${result.professorStats.preferredMatches}/${result.professorStats.avoidedMatches}</b><span>preferidos / evitados</span></div>`
    : "";


  els.scoreCards.innerHTML = `
    <div class="score"><b>${Math.round(result.windowMinutes / 10) * 10} min</b><span>ventanas aprox.</span></div>
    <div class="score"><b>${result.daysWithClass ? fmtMin(result.earliestStart) : "—"}</b><span>primera clase</span></div>
    <div class="score"><b>${result.daysWithClass ? fmtMin(result.latestEnd) : "—"}</b><span>última salida</span></div>
    <div class="score"><b>${result.daysWithClass}</b><span>días con clases</span></div>
    <div class="score"><b>${result.freeDays.length ? result.freeDays.join(", ") : "—"}</b><span>días libres</span></div>
    <div class="score ${result.optionalMeetingCount ? "score-optional" : ""}"><b>${result.optionalMeetingCount}</b><span>bloques de ayudantía opcional</span></div>
    ${professorCard}
  `;

  els.comboList.innerHTML = "";

  result.combo.forEach(item => {
    const chip = document.createElement("div");
    chip.className = `combo-chip${item.course.isFormationAcademic ? " formation-chip" : ""}`;
    const formationLabel = item.course.isFormationAcademic
      ? ` · ${item.course.formationType === "deportivo" ? "Deportivo" : "No deportivo"} · ${item.option.modality === "b-learning" ? "B-learning" : "Presencial"}`
      : "";
    chip.innerHTML = `<strong>${item.course.code}</strong> ${item.option.section}${formationLabel}`;
    els.comboList.appendChild(chip);
  });

  const unscheduled = result.combo.flatMap(item =>
    item.option.events
      .filter(event => event.rawSchedule && !(event.meetings || []).length)
      .map(event => ({
        course: item.course,
        option: item.option,
        schedule: event.rawSchedule,
      }))
  );

  if (els.unscheduledNotice) {
    if (unscheduled.length) {
      els.unscheduledNotice.hidden = false;
      els.unscheduledNotice.innerHTML = `
        <strong>Atención: hay cursos sin horario fijo.</strong>
        <span>Estos cursos no generan topes automáticamente hasta que se confirme su bloque:</span>
        <ul>${unscheduled.map(item => `<li><b>${item.course.code} · ${item.course.name}</b> (${item.option.section}): ${item.schedule}</li>`).join("")}</ul>
      `;
    } else {
      els.unscheduledNotice.hidden = true;
      els.unscheduledNotice.innerHTML = "";
    }
  }

  renderSchedule(result.meetings);
  updateFavoriteButton();
}

function renderEmptySchedule(message = "Genera un horario para verlo aquí.") {
  els.summary.textContent = "Aquí aparecerán las combinaciones posibles.";
  els.pageLabel.textContent = "0 / 0";
  els.prevBtn.disabled = true;
  els.nextBtn.disabled = true;
  els.saveFavoriteBtn.disabled = true;
  els.saveFavoriteBtn.textContent = "Guardar favorito";
  els.scoreCards.innerHTML = "";
  els.comboList.innerHTML = "";
  if (els.unscheduledNotice) {
    els.unscheduledNotice.hidden = true;
    els.unscheduledNotice.innerHTML = "";
  }
  els.scheduleTable.innerHTML = `<tr><td class="empty-msg">${message}</td></tr>`;
}

function renderSchedule(meetings) {
  const blockedMeetings = getBlockedMeetings();
  const displayMeetings = meetings.concat(blockedMeetings);
  const usedSlotsMap = new Map();
  displayMeetings.forEach(m => usedSlotsMap.set(`${m.startMin}-${m.endMin}`, { startMin: m.startMin, endMin: m.endMin, time: m.time }));
  const usedSlots = [...usedSlotsMap.values()].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
  const days = DATA.days.filter(day => displayMeetings.some(m => m.day === day));
  const visibleDays = days.length ? days : DATA.days.slice(0, 5);

  if (!usedSlots.length) {
    els.scheduleTable.innerHTML = `<tr><td class="empty-msg">Este horario no tiene bloques fijos informados.</td></tr>`;
    return;
  }

  let html = `<thead><tr><th>Bloque</th>${visibleDays.map(d => `<th>${d}</th>`).join("")}</tr></thead><tbody>`;

  usedSlots.forEach(slot => {
    html += `<tr><td class="time">${slot.time}</td>`;
    visibleDays.forEach(day => {
      const cellMeetings = displayMeetings.filter(m => m.day === day && m.startMin === slot.startMin && m.endMin === slot.endMin);
      html += `<td>${cellMeetings.map(renderMeetingCard).join("")}</td>`;
    });
    html += `</tr>`;
  });

  html += `</tbody>`;
  els.scheduleTable.innerHTML = html;
}

function eventTypeLabel(eventName) {
  const text = normalize(eventName);
  if (text.includes("B LEARNING") || text.includes("BLEARNING")) return "B-LEARNING";
  if (text.includes("AYUDANTIA") && text.includes("OPCIONAL")) return "AYUDANTÍA OPCIONAL";
  if (text.includes("AYUDANTIA") && text.includes("OBLIGATORIA")) return "AYUDANTÍA OBLIGATORIA";
  if (text.includes("AYUDANTIA")) return "AYUDANTÍA · SIN ESPECIFICAR";
  if (text.includes("LABORATORIO")) return "LAB";
  if (text.includes("TALLER")) return "TALLER";
  if (text.includes("PRACTICA")) return "PRÁCTICA";
  if (text.includes("SEMINARIO")) return "SEMINARIO";
  if (text.includes("PROYECTO")) return "PROYECTO";
  if (text.includes("CATEDRA")) return "CÁTEDRA";
  return eventName || "CLASE";
}

function eventTypeClass(eventName) {
  const kind = eventAttendanceKind(eventName);
  const label = normalize(eventTypeLabel(eventName));
  if (label.includes("B LEARNING") || label.includes("BLEARNING")) return "tag-blearning";
  if (kind === "optional") return "tag-ayudantia-opcional";
  if (kind === "mandatory") return "tag-ayudantia-obligatoria";
  if (kind === "unspecified") return "tag-ayudantia-sin-especificar";
  if (label.includes("LAB")) return "tag-lab";
  if (label.includes("TALLER")) return "tag-taller";
  if (label.includes("PRACTICA")) return "tag-practica";
  if (label.includes("SEMINARIO")) return "tag-seminario";
  if (label.includes("PROYECTO")) return "tag-proyecto";
  if (label.includes("CATEDRA")) return "tag-catedra";
  return "";
}

function renderMeetingCard(m) {
  if (m.isBlocked) {
    return `
      <div class="class-card blocked-card">
        <div class="class-card-top">
          <b>Horario bloqueado</b>
          <span class="event-tag tag-blocked">BLOQUEADO</span>
        </div>
        <span>${m.label || "Ocupado"}</span>
      </div>
    `;
  }

  const meetingProfessorNames = splitProfessorNames(m.professor);
  const prof = meetingProfessorNames.length
    ? `<span class="class-prof">${meetingProfessorNames.map(name => `<span class="professor-line">${name}</span>`).join("")}</span>`
    : "";
  const label = eventTypeLabel(m.eventName);
  const tagClass = eventTypeClass(m.eventName);
  const attendanceKind = m.attendanceKind || eventAttendanceKind(m.eventName);
  const attendanceNote = attendanceKind === "optional"
    ? `<span class="attendance-note optional-note">No genera tope: puedes inscribir otro ramo en este bloque.</span>`
    : attendanceKind === "mandatory"
      ? `<span class="attendance-note mandatory-note">Asistencia obligatoria: sí genera tope.</span>`
      : attendanceKind === "unspecified"
        ? `<span class="attendance-note unspecified-note">El archivo no indica si es opcional; se considera obligatoria por seguridad.</span>`
        : "";
  const formationMeta = m.course.isFormationAcademic
    ? `<span class="class-prof formation-meta">Formación ${m.course.formationType === "deportivo" ? "deportiva" : "no deportiva"} · ${m.option.modality === "b-learning" ? "B-learning" : "Presencial"}</span>`
    : "";
  return `
    <div class="class-card${m.course.isFormationAcademic ? " formation-class-card" : ""}${attendanceKind === "optional" ? " optional-class-card" : ""}${attendanceKind === "unspecified" ? " unspecified-class-card" : ""}">
      <div class="class-card-top">
        <b>${m.course.code} · ${m.option.section}</b>
        <span class="event-tag ${tagClass}">${label}</span>
      </div>
      <span>${m.course.name}</span>
      ${formationMeta}
      ${attendanceNote}
      ${prof}
    </div>
  `;
}


function normalizeProfessorName(name) {
  return normalize(name)
    .replace(/\b(PROFESOR|PROFESORA|DOCENTE)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isUsableProfessorName(name) {
  const key = normalizeProfessorName(name);
  if (!key) return false;
  return !["POR DEFINIR", "SIN INFORMACION", "NO INFORMADO", "TBA", "N N"].includes(key);
}

function splitProfessorNames(value) {
  return String(value || "")
    .split(/\s*\/\s*|\s*;\s*|\s+[Y&]\s+/i)
    .map(name => name.trim())
    .filter(isUsableProfessorName);
}

function loadFavorites() {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistFavorites() {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(state.favorites));
}

function favoriteTitle(result) {
  const codes = result.combo.map(item => `${item.course.code} ${item.option.section}`).join(" · ");
  const date = new Date().toLocaleString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${date} · ${codes}`;
}

function saveCurrentFavorite() {
  const result = state.results[state.current];
  if (!result) return;

  const signature = comboSignatureFromResult(result);
  const exists = state.favorites.some(fav => comboSignatureFromFavorite(fav) === signature);

  if (exists) {
    setStatus("Este horario ya está guardado como favorito.");
    updateFavoriteButton();
    return;
  }

  const favorite = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title: favoriteTitle(result),
    careerId: state.activeCareer,
    createdAt: new Date().toISOString(),
    items: result.combo.map(item => ({
      code: item.course.code,
      courseName: item.course.name,
      optionId: item.option.id,
      section: item.option.section,
      professors: item.option.professors || [],
    })),
    metrics: {
      windowMinutes: result.windowMinutes,
      earliestStart: result.earliestStart,
      latestEnd: result.latestEnd,
      daysWithClass: result.daysWithClass,
      freeDays: result.freeDays || [],
      preferredMatches: result.professorStats.preferredMatches,
      avoidedMatches: result.professorStats.avoidedMatches,
    },
  };

  state.favorites.unshift(favorite);
  persistFavorites();
  renderFavorites();
  updateFavoriteButton();
  setStatus("Horario guardado en favoritos.");
}

function rebuildFavoriteResult(fav) {
  const combo = [];
  const missing = [];

  fav.items.forEach(item => {
    const found = allOptionsById.get(item.optionId);
    if (found) combo.push(found);
    else missing.push(`${item.code} ${item.section}`);
  });

  if (missing.length) {
    throw new Error(`Faltan secciones en los datos actuales: ${missing.join(", ")}`);
  }

  const meetings = combo.flatMap(item => getMeetings(item));
  return scoreCombo(combo, meetings, getProfessorRules());
}

function showFavorite(favId) {
  const fav = state.favorites.find(item => item.id === favId);
  if (!fav) return;

  try {
    const favoriteCareer = fav.careerId || "engineering";
    if (favoriteCareer !== state.activeCareer && CAREERS.some(career => career.id === favoriteCareer)) {
      state.activeCareer = favoriteCareer;
      localStorage.setItem(CAREER_KEY, favoriteCareer);
      els.careerSelect.value = favoriteCareer;
      state.selected.clear();
      refreshCareerContext();
      refreshCareerUI();
      renderSelected();
    }

    const result = rebuildFavoriteResult(fav);
    state.results = [result];
    state.current = 0;
    renderCurrentResult();
    setStatus("Mostrando horario favorito guardado.");
  } catch (err) {
    setStatus(err.message, true);
  }
}

function deleteFavorite(favId) {
  state.favorites = state.favorites.filter(item => item.id !== favId);
  persistFavorites();
  renderFavorites();
  updateFavoriteButton();
  setStatus("Favorito eliminado.");
}

function renderFavorites() {
  els.favoritesList.innerHTML = "";

  if (!state.favorites.length) {
    els.favoritesList.className = "favorites-list empty";
    els.favoritesList.innerHTML = "<p>Aún no guardas horarios.</p>";
    return;
  }

  els.favoritesList.className = "favorites-list";

  state.favorites.forEach((fav, index) => {
    const item = document.createElement("article");
    item.className = "favorite-card";

    const chips = fav.items
      .map(course => `<span>${course.code} ${course.section.replace("Sección ", "S")}</span>`)
      .join("");

    const career = CAREERS.find(record => record.id === (fav.careerId || "engineering"));

    item.innerHTML = `
      <div class="favorite-head">
        <h3>Favorito ${index + 1} <span class="favorite-career">${career?.shortName || career?.name || "Ingeniería"}</span></h3>
        <small>${fav.metrics.daysWithClass} días · libre: ${(fav.metrics.freeDays || []).join(", ") || "—"} · salida ${fav.metrics.daysWithClass ? fmtMin(fav.metrics.latestEnd) : "por confirmar"}</small>
      </div>
      <div class="favorite-chips">${chips}</div>
      <div class="favorite-actions">
        <button class="primary small-btn" data-view="${fav.id}">Ver</button>
        <button class="ghost small-btn" data-delete="${fav.id}">Quitar</button>
      </div>
    `;

    item.querySelector("[data-view]").addEventListener("click", () => showFavorite(fav.id));
    item.querySelector("[data-delete]").addEventListener("click", () => deleteFavorite(fav.id));
    els.favoritesList.appendChild(item);
  });
}

function updateFavoriteButton() {
  const result = state.results[state.current];

  if (!result) {
    els.saveFavoriteBtn.disabled = true;
    els.saveFavoriteBtn.textContent = "Guardar favorito";
    return;
  }

  const signature = comboSignatureFromResult(result);
  const exists = state.favorites.some(fav => comboSignatureFromFavorite(fav) === signature);

  els.saveFavoriteBtn.disabled = exists;
  els.saveFavoriteBtn.textContent = exists ? "Ya guardado" : "Guardar favorito";
}

init();
