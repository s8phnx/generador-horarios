const DATA = window.COURSE_DATA;
const FAVORITES_KEY = "generador-ramos:favoritos:v1";

const state = {
  selected: new Map(), // code -> Set(option ids)
  results: [],
  current: 0,
  favorites: loadFavorites(),
};

const els = {
  courseCount: document.getElementById("courseCount"),
  optionCount: document.getElementById("optionCount"),
  courseSearch: document.getElementById("courseSearch"),
  courseList: document.getElementById("courseList"),
  addCourseBtn: document.getElementById("addCourseBtn"),
  selectedCourses: document.getElementById("selectedCourses"),
  preference: document.getElementById("preference"),
  freeDay: document.getElementById("freeDay"),
  preferredProfessors: document.getElementById("preferredProfessors"),
  blockedProfessors: document.getElementById("blockedProfessors"),
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
  scheduleTable: document.getElementById("scheduleTable"),
};

if (!DATA || !Array.isArray(DATA.courses)) {
  throw new Error("No se cargó COURSE_DATA. Revisa que data.js esté antes de app.js en index.html.");
}

const coursesByCode = new Map(DATA.courses.map(c => [c.code, c]));
const allOptionsById = new Map();
DATA.courses.forEach(course => {
  course.options.forEach(option => {
    allOptionsById.set(option.id, { course, option });
  });
});

function init() {
  els.courseCount.textContent = `${DATA.meta.courseCount} ramos`;
  els.optionCount.textContent = `${DATA.meta.optionCount} secciones/paquetes`;

  DATA.courses.forEach(course => {
    const opt = document.createElement("option");
    opt.value = `${course.code} — ${course.name}`;
    els.courseList.appendChild(opt);
  });

  bindEvents();
  renderSelected();
  renderFavorites();
  renderEmptySchedule();
}

function bindEvents() {
  els.addCourseBtn.addEventListener("click", addCourseFromInput);

  els.courseSearch.addEventListener("keydown", e => {
    if (e.key === "Enter") addCourseFromInput();
  });

  els.generateBtn.addEventListener("click", generateSchedules);

  els.clearBtn.addEventListener("click", () => {
    state.selected.clear();
    state.results = [];
    state.current = 0;
    els.courseSearch.value = "";
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
}

function normalize(str) {
  return String(str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

function extractCode(input) {
  const text = normalize(input);
  const direct = text.split(" ")[0];
  if (coursesByCode.has(direct)) return direct;
  const found = DATA.courses.find(c => normalize(`${c.code} ${c.name}`).includes(text));
  return found ? found.code : null;
}

function addCourseFromInput() {
  const code = extractCode(els.courseSearch.value);

  if (!code) {
    setStatus("No encontré ese ramo. Prueba con código o nombre exacto.", true);
    return;
  }

  const course = coursesByCode.get(code);
  state.selected.set(code, new Set(course.options.map(o => o.id)));
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

  for (const [code, selectedOptionIds] of state.selected.entries()) {
    const course = coursesByCode.get(code);
    const card = document.createElement("article");
    card.className = "course-card";
    card.innerHTML = `
      <div class="course-card-head">
        <h3 class="course-title">${course.code} · ${course.name}<br><span>${course.credits ?? "—"} créditos · ${course.options.length} secciones</span></h3>
        <button class="ghost" data-remove="${course.code}">Quitar</button>
      </div>
      <div class="option-list"></div>
    `;

    card.querySelector("[data-remove]").addEventListener("click", () => {
      state.selected.delete(code);
      state.results = [];
      state.current = 0;
      renderSelected();
      renderEmptySchedule();
    });

    const list = card.querySelector(".option-list");

    course.options.forEach(option => {
      const events = option.events
        .filter(e => e.rawSchedule)
        .map(e => `${e.name}: ${e.rawSchedule}`)
        .join(" · ");
      const professors = option.professors.length ? option.professors.join(", ") : "Profesor no informado";
      const vac = option.vacancies === null || option.vacancies === undefined ? "—" : option.vacancies;
      const row = document.createElement("label");
      row.className = "option-row";
      row.innerHTML = `
        <input type="checkbox" ${selectedOptionIds.has(option.id) ? "checked" : ""} data-code="${course.code}" data-option="${option.id}">
        <span><strong>${option.section}</strong> · Vacantes: ${vac}<small>${professors}</small><small>${events || "Sin horario informado"}</small></span>
      `;

      row.querySelector("input").addEventListener("change", (e) => {
        const set = state.selected.get(course.code);
        if (e.target.checked) set.add(option.id);
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

function setStatus(text, isError = false) {
  els.status.textContent = text;
  els.status.style.color = isError ? "var(--danger)" : "var(--muted)";
}

function getMeetings(item) {
  const meetings = [];

  item.option.events.forEach(event => {
    event.meetings.forEach(m => {
      meetings.push({
        ...m,
        eventName: event.name,
        professor: event.professor,
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
      if (overlaps(a, b)) return true;
    }
  }
  return false;
}

function buildInputGroups() {
  const groups = [];

  for (const [code, selectedIds] of state.selected.entries()) {
    const course = coursesByCode.get(code);
    const options = course.options
      .filter(o => selectedIds.has(o.id))
      .map(option => ({ course, option, meetings: getMeetings({ course, option }) }));

    if (!options.length) return { error: `No dejaste ninguna sección activa en ${code}.` };
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
  if (!state.selected.size) {
    setStatus("Selecciona al menos un ramo.", true);
    return;
  }

  const { groups, error } = buildInputGroups();

  if (error) {
    setStatus(error, true);
    return;
  }

  const maxResults = 2500;
  const maxExplored = 180000;
  let explored = 0;
  const results = [];
  const rules = getProfessorRules();

  function backtrack(idx, combo, meetings) {
    if (explored > maxExplored || results.length >= maxResults) return;

    if (idx === groups.length) {
      results.push(scoreCombo(combo, meetings, rules));
      return;
    }

    for (const item of groups[idx].options) {
      explored += 1;

      if (!hasConflict(meetings, item.meetings)) {
        backtrack(idx + 1, combo.concat(item), meetings.concat(item.meetings));
      }
    }
  }

  backtrack(0, [], []);

  const pref = els.preference.value;
  const freeDay = els.freeDay.value;
  results.sort((a, b) => compareResults(a, b, pref, freeDay));

  state.results = results;
  state.current = 0;

  if (!results.length) {
    setStatus("No encontré combinaciones sin topes con esas secciones.", true);
    els.summary.textContent = "Prueba activando más secciones o quitando un ramo.";
    renderEmptySchedule("Sin combinaciones posibles.");
    return;
  }

  const limited = explored > maxExplored || results.length >= maxResults;

  if (rules.preferred.length || rules.avoided.length) {
    const best = results[0];
    setStatus(
      limited
        ? `Encontré ${results.length} horarios antes del límite. El primero tiene ${best.professorStats.preferredMatches} preferidos y ${best.professorStats.avoidedMatches} evitados.`
        : `Encontré ${results.length} horarios posibles. El primero tiene ${best.professorStats.preferredMatches} preferidos y ${best.professorStats.avoidedMatches} evitados.`
    );
  } else {
    setStatus(
      limited
        ? `Encontré ${results.length} horarios antes del límite de búsqueda. Puedes filtrar secciones para más precisión.`
        : `Encontré ${results.length} horarios posibles.`
    );
  }

  renderCurrentResult();
}

function scoreCombo(combo, meetings, rules = getProfessorRules()) {
  const byDay = groupMeetingsByDay(meetings);
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

  return {
    combo,
    meetings,
    windowMinutes,
    totalSpan,
    earliestStart: earliestStart === Infinity ? 0 : earliestStart,
    latestEnd,
    daysWithClass,
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

  if (freeDay) {
    const aPenalty = a.meetings.some(m => m.day === freeDay) ? 1 : 0;
    const bPenalty = b.meetings.some(m => m.day === freeDay) ? 1 : 0;
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
    <div class="score"><b>${fmtMin(result.earliestStart)}</b><span>primera clase</span></div>
    <div class="score"><b>${fmtMin(result.latestEnd)}</b><span>última salida</span></div>
    <div class="score"><b>${result.daysWithClass}</b><span>días con clases</span></div>
    ${professorCard}
  `;

  els.comboList.innerHTML = "";

  result.combo.forEach(item => {
    const chip = document.createElement("div");
    chip.className = "combo-chip";
    chip.innerHTML = `<strong>${item.course.code}</strong> ${item.option.section}`;
    els.comboList.appendChild(chip);
  });

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
  els.scheduleTable.innerHTML = `<tr><td class="empty-msg">${message}</td></tr>`;
}

function renderSchedule(meetings) {
  const usedSlotsMap = new Map();
  meetings.forEach(m => usedSlotsMap.set(`${m.startMin}-${m.endMin}`, { startMin: m.startMin, endMin: m.endMin, time: m.time }));
  const usedSlots = [...usedSlotsMap.values()].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
  const days = DATA.days.filter(day => meetings.some(m => m.day === day));
  const visibleDays = days.length ? days : DATA.days.slice(0, 5);

  let html = `<thead><tr><th>Bloque</th>${visibleDays.map(d => `<th>${d}</th>`).join("")}</tr></thead><tbody>`;

  usedSlots.forEach(slot => {
    html += `<tr><td class="time">${slot.time}</td>`;
    visibleDays.forEach(day => {
      const cellMeetings = meetings.filter(m => m.day === day && m.startMin === slot.startMin && m.endMin === slot.endMin);
      html += `<td>${cellMeetings.map(renderMeetingCard).join("")}</td>`;
    });
    html += `</tr>`;
  });

  html += `</tbody>`;
  els.scheduleTable.innerHTML = html;
}

function renderMeetingCard(m) {
  const prof = m.professor ? `<span>${m.professor}</span>` : "";
  return `<div class="class-card"><b>${m.course.code} · ${m.option.section}</b><span>${m.course.name}</span><br><span>${m.eventName}</span><br>${prof}</div>`;
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

    item.innerHTML = `
      <div class="favorite-head">
        <h3>Favorito ${index + 1}</h3>
        <small>${fav.metrics.daysWithClass} días · salida ${fmtMin(fav.metrics.latestEnd)} · ${Math.round(fav.metrics.windowMinutes / 10) * 10} min ventanas</small>
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
