export function createChecklistItem(text = "") {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text,
    completed: false,
  };
}

export function normalizeChecklist(checklist) {
  if (!Array.isArray(checklist)) return [];
  return checklist.map((item, index) => ({
    id:
      item && (typeof item.id === "string" || typeof item.id === "number")
        ? String(item.id)
        : `check-${Date.now()}-${index}`,
    text: item && typeof item.text === "string" ? item.text : "",
    completed: Boolean(item?.completed),
  }));
}

export function normalizeTask(task) {
  return {
    ...task,
    name: typeof task?.name === "string" ? task.name : "",
    notes: typeof task?.notes === "string" ? task.notes : "",
    checklist: normalizeChecklist(task?.checklist),
    createdAt: typeof task?.createdAt === "string" ? task.createdAt : new Date().toISOString(),
    notesUpdatedAt:
      typeof task?.notesUpdatedAt === "string" || task?.notesUpdatedAt === null
        ? task.notesUpdatedAt
        : null,
  };
}

export function normalizeTaskList(tasks) {
  return Array.isArray(tasks) ? tasks.map(normalizeTask) : [];
}

export function normalizeArchive(archive) {
  if (!archive || typeof archive !== "object") return {};
  return Object.fromEntries(
    Object.entries(archive).map(([dateKey, list]) => [dateKey, normalizeTaskList(list)])
  );
}

export function taskHasDetails(task) {
  return Boolean((task?.notes || "").trim()) || (task?.checklist || []).length > 0;
}

export function isValidArchivedTask(task, dateKey) {
  if (!dateKey || typeof dateKey !== "string" || !dateKey.trim()) return false;
  if (!task || typeof task !== "object") return false;
  if (!task.name || typeof task.name !== "string" || !task.name.trim()) return false;
  if (!task.completedAt || typeof task.completedAt !== "string" || !task.completedAt.trim()) {
    return false;
  }
  return true;
}

export function calculateStarCountFromArchive(archive) {
  return Object.entries(archive || {}).reduce((total, [dateKey, list]) => {
    const validCount = (Array.isArray(list) ? list : []).filter((task) =>
      isValidArchivedTask(task, dateKey)
    ).length;
    return total + validCount;
  }, 0);
}

export function getEffectiveStarTotal(manualValue, calculatedValue) {
  return manualValue !== null ? manualValue : calculatedValue;
}

export function buildStoragePayload(nextTasks, nextArchive, nextManualStars) {
  const calculated = calculateStarCountFromArchive(nextArchive);

  return {
    app: "TaskyPuppy",
    version: 2,
    savedAt: new Date().toISOString(),
    stars: {
      userModifiedTotal: nextManualStars,
      appCountedTotal: calculated,
      effectiveTotal: getEffectiveStarTotal(nextManualStars, calculated),
    },
    tasks: normalizeTaskList(nextTasks),
    dailyArchive: normalizeArchive(nextArchive),
  };
}

export function mergeUniqueById(listA, listB) {
  const map = new Map();
  [...normalizeTaskList(listA), ...normalizeTaskList(listB)].forEach((item) => {
    map.set(item.id, item);
  });
  return Array.from(map.values());
}

export function mergeArchives(currentArchive, importedArchive) {
  const merged = { ...normalizeArchive(currentArchive) };

  for (const [date, importedList] of Object.entries(normalizeArchive(importedArchive))) {
    const currentList = merged[date] || [];
    merged[date] = mergeUniqueById(currentList, importedList);
  }

  return merged;
}

export function normalizeImportData(data) {
  const importedArchive = normalizeArchive(data?.dailyArchive);
  const importedCalculated = calculateStarCountFromArchive(importedArchive);

  const importedManual =
    data?.stars &&
    typeof data.stars === "object" &&
    (data.stars.userModifiedTotal === null || typeof data.stars.userModifiedTotal === "number")
      ? data.stars.userModifiedTotal
      : null;

  return {
    tasks: normalizeTaskList(data?.tasks),
    dailyArchive: importedArchive,
    starCountManual: importedManual,
    starCountCalculated: importedCalculated,
  };
}

export function normalizeToISODate(value) {
  if (!value || typeof value !== "string") return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const mdyMatch = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdyMatch) {
    const [, month, day, year] = mdyMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    const localMidnight = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
    return [
      localMidnight.getFullYear(),
      String(localMidnight.getMonth() + 1).padStart(2, "0"),
      String(localMidnight.getDate()).padStart(2, "0"),
    ].join("-");
  }

  return "";
}

export function parseArchiveISO(task, dateKey) {
  if (task?.archivedDateISO) {
    return normalizeToISODate(task.archivedDateISO);
  }

  if (task?.completedAt) {
    const completedISO = normalizeToISODate(task.completedAt);
    if (completedISO) return completedISO;
  }

  return normalizeToISODate(dateKey);
}

export function getArchiveGroupISO(dateKey, list) {
  const dates = (Array.isArray(list) ? list : [])
    .map((task) => parseArchiveISO(task, dateKey))
    .filter(Boolean)
    .sort((a, b) => b.localeCompare(a));

  if (dates.length > 0) return dates[0];
  return normalizeToISODate(dateKey);
}

export function getTaskPriority(task) {
  if (task.critical) return 2;
  if (task.star) return 1;
  return 0;
}

export function sortTasks(list, autoSort) {
  if (!autoSort) return list;

  return [...list].sort((a, b) => {
    if (a.critical !== b.critical) return Number(b.critical) - Number(a.critical);
    if (a.star !== b.star) return Number(b.star) - Number(a.star);
    return 0;
  });
}
