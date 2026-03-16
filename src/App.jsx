import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildStoragePayload,
  calculateStarCountFromArchive,
  createChecklistItem,
  getArchiveGroupISO,
  getEffectiveStarTotal,
  getTaskPriority,
  mergeArchives,
  mergeUniqueById,
  normalizeArchive,
  normalizeImportData,
  normalizeTask,
  normalizeTaskList,
  parseArchiveISO,
  sortTasks,
  taskHasDetails,
} from "./taskyHelpers";
import { getStyles, getTheme } from "./taskyStyles";

/* ======================================================
   STICKER ASSETS
====================================================== */

const stickerModules = import.meta.glob(
  [
    "./assets/stickers/*.png",
    "./assets/stickers/*.PNG",
    "./assets/stickers/*.jpg",
    "./assets/stickers/*.JPG",
    "./assets/stickers/*.jpeg",
    "./assets/stickers/*.JPEG",
    "./assets/stickers/*.webp",
    "./assets/stickers/*.WEBP",
    "./assets/stickers/*.gif",
    "./assets/stickers/*.GIF",
  ],
  { eager: true }
);

const defaultStickerPack = Object.entries(stickerModules)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([, module]) => module.default);

/* ======================================================
   STORAGE KEYS
====================================================== */
const STORAGE_KEY = "tasky_puppy_data_v1";
const BACKUP_KEY = "tasky_puppy_backup_v1";
const BACKUP_META_KEY = "tasky_puppy_backup_meta_v1";
const DARK_MODE_KEY = "tasky_puppy_dark_mode_v1";
const STICKERS_ENABLED_KEY = "tasky_puppy_stickers_enabled_v1";
const CUSTOM_STICKER_MAX_COUNT = 20;
const CUSTOM_STICKER_MAX_FILE_BYTES = 500 * 1024;
const CUSTOM_STICKER_MAX_TOTAL_BYTES = 4 * 1024 * 1024;

/* ======================================================
   APP COMPONENT
====================================================== */
export default function App() {
  /* ======================================================
     STATE
  ====================================================== */
  const [tasks, setTasks] = useState([]);
  const [taskName, setTaskName] = useState("");
  const [notes, setNotes] = useState("");
  const [newTaskChecklist, setNewTaskChecklist] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editingTaskName, setEditingTaskName] = useState("");
  const [editingNotes, setEditingNotes] = useState("");
  const [editingChecklist, setEditingChecklist] = useState([]);
  const [autoSort, setAutoSort] = useState(false);
  const [dragIndex, setDragIndex] = useState(null);
  const [expandedDetails, setExpandedDetails] = useState({});
  const [expandedArchiveNotes, setExpandedArchiveNotes] = useState({});
  const [showArchive, setShowArchive] = useState(false);
  const [dailyArchive, setDailyArchive] = useState({});
  const [nextTaskMode, setNextTaskMode] = useState(false);
  const [queueSearch, setQueueSearch] = useState("");
  const [archiveSearch, setArchiveSearch] = useState("");
  const [archiveStartDate, setArchiveStartDate] = useState("");
  const [archiveEndDate, setArchiveEndDate] = useState("");
  const [stickersEnabled, setStickersEnabled] = useState(false);
  const [showStickerSettings, setShowStickerSettings] = useState(false);
  const [stickers, setStickers] = useState(defaultStickerPack);
  const [uploadedStickers, setUploadedStickers] = useState([]);
  const [activeStickers, setActiveStickers] = useState([]);
  const [starParticles, setStarParticles] = useState([]);
  const [titleSticker, setTitleSticker] = useState(null);
  const [stickerMessage, setStickerMessage] = useState("");
  const [showStickerGallery, setShowStickerGallery] = useState(false);
  const [expandedGallerySticker, setExpandedGallerySticker] = useState(null);
  const [hoveredGallerySticker, setHoveredGallerySticker] = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  const [starCountManual, setStarCountManual] = useState(null);
  const [showStarTools, setShowStarTools] = useState(false);
  const [editingStarValue, setEditingStarValue] = useState("");
  const [pulseStar, setPulseStar] = useState(false);
  const [headerCelebrate, setHeaderCelebrate] = useState(false);
  const [completingIds, setCompletingIds] = useState({});
  const [showDataInfo, setShowDataInfo] = useState(false);
  const [showDataDetails, setShowDataDetails] = useState(false);
  const [hasLoadedFromStorage, setHasLoadedFromStorage] = useState(false);
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth <= 640 : false
  );

  const importInputRef = useRef(null);
  const dataPanelRef = useRef(null);
  const stickerPanelRef = useRef(null);
  const starPanelRef = useRef(null);
  const celebrateTimerRef = useRef(null);

  /* ======================================================
     EFFECTS
  ====================================================== */
  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth <= 640);
    }
    window.addEventListener("resize", handleResize);
    /* ======================================================
     MAIN RENDER
  ====================================================== */
  return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    return () => {
      if (celebrateTimerRef.current) clearTimeout(celebrateTimerRef.current);
    };
  }, []);

  /* ======================================================
     PANEL CONTROLS
  ====================================================== */
  function closeAllPanels() {
    setShowDataInfo(false);
    setShowDataDetails(false);
    setShowStickerSettings(false);
    setShowStarTools(false);
  }

  function toggleDataPanel() {
    const nextOpen = !showDataInfo;
    setShowDataInfo(nextOpen);
    setShowDataDetails(false);
    setShowStickerSettings(false);
    setShowStarTools(false);
  }

  function toggleStickerPanel() {
    const nextOpen = !showStickerSettings;
    setShowStickerSettings(nextOpen);
    setShowDataInfo(false);
    setShowDataDetails(false);
    setShowStarTools(false);
  }

  function toggleStarPanel() {
    const nextOpen = !showStarTools;
    setShowStarTools(nextOpen);
    setShowDataInfo(false);
    setShowDataDetails(false);
    setShowStickerSettings(false);
    if (nextOpen) setEditingStarValue(String(displayStarCount));
  }

  function getTodayBackupStamp() {
    const now = new Date();
    return [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-");
  }

  function createDailyRecoveryBackup() {
    if (!hasLoadedFromStorage) return;

    try {
      const todayStamp = getTodayBackupStamp();
      const existingMetaRaw = localStorage.getItem(BACKUP_META_KEY);
      const existingMeta = existingMetaRaw ? JSON.parse(existingMetaRaw) : null;

      if (existingMeta?.backupDate === todayStamp) return;

      const currentPayload = buildStoragePayload(tasks, dailyArchive, starCountManual);
      localStorage.setItem(BACKUP_KEY, JSON.stringify(currentPayload));
      localStorage.setItem(
        BACKUP_META_KEY,
        JSON.stringify({ backupDate: todayStamp, createdAt: new Date().toISOString() })
      );
    } catch (error) {
      console.error("Failed to create daily recovery backup:", error);
    }
  }

  const starCountCalculated = useMemo(
    () => calculateStarCountFromArchive(dailyArchive),
    [dailyArchive]
  );

  const displayStarCount = useMemo(
    () => getEffectiveStarTotal(starCountManual, starCountCalculated),
    [starCountManual, starCountCalculated]
  );

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setTasks(normalizeTaskList(parsed.tasks));
        setDailyArchive(
          parsed.dailyArchive && typeof parsed.dailyArchive === "object" ? parsed.dailyArchive : {}
        );
        setUploadedStickers(Array.isArray(parsed.customStickers) ? parsed.customStickers : []);
        setStarCountManual(
          parsed?.stars?.userModifiedTotal === null ||
            typeof parsed?.stars?.userModifiedTotal === "number"
            ? parsed.stars.userModifiedTotal
            : null
        );
      }

      const savedDarkMode = localStorage.getItem(DARK_MODE_KEY);
      const savedStickersEnabled = localStorage.getItem(STICKERS_ENABLED_KEY);
      if (savedDarkMode !== null) setDarkMode(savedDarkMode === "true");
      if (savedStickersEnabled !== null) setStickersEnabled(savedStickersEnabled === "true");
    } catch (error) {
      console.error("Failed to load TaskyPuppy data:", error);
      setTasks([]);
      setDailyArchive({});
      setStarCountManual(null);
    } finally {
      setHasLoadedFromStorage(true);
    }
  }, []);

  useEffect(() => {
    function handleStorage(event) {
      if (!hasLoadedFromStorage || !event.key) return;
      try {
        if (event.key === STORAGE_KEY && event.newValue) {
          const parsed = JSON.parse(event.newValue);
          setTasks(normalizeTaskList(parsed.tasks));
          setDailyArchive(
            parsed.dailyArchive && typeof parsed.dailyArchive === "object" ? parsed.dailyArchive : {}
          );
          setUploadedStickers(Array.isArray(parsed.customStickers) ? parsed.customStickers : []);
          setStarCountManual(
            parsed?.stars?.userModifiedTotal === null ||
              typeof parsed?.stars?.userModifiedTotal === "number"
              ? parsed.stars.userModifiedTotal
              : null
          );
        }
        if (event.key === DARK_MODE_KEY && event.newValue !== null) setDarkMode(event.newValue === "true");
        if (event.key === STICKERS_ENABLED_KEY && event.newValue !== null) setStickersEnabled(event.newValue === "true");
      } catch (error) {
        console.error("Failed to sync TaskyPuppy data across tabs:", error);
      }
    }

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [hasLoadedFromStorage]);

  useEffect(() => {
    if (!hasLoadedFromStorage) return;
    try {
      const payload = buildStoragePayload(tasks, dailyArchive, starCountManual, uploadedStickers);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      console.error("Failed to save TaskyPuppy data:", error);
    }
  }, [tasks, dailyArchive, starCountManual, uploadedStickers, hasLoadedFromStorage]);

  useEffect(() => {
    try {
      localStorage.setItem(DARK_MODE_KEY, String(darkMode));
    } catch (error) {
      console.error("Failed to save dark mode preference:", error);
    }
  }, [darkMode]);

  useEffect(() => {
    try {
      localStorage.setItem(STICKERS_ENABLED_KEY, String(stickersEnabled));
    } catch (error) {
      console.error("Failed to save sticker preference:", error);
    }
  }, [stickersEnabled]);

  useEffect(() => {
    setStickers([...defaultStickerPack, ...uploadedStickers]);
  }, [uploadedStickers]);

  useEffect(() => {
    if (defaultStickerPack.length > 0) {
      const random = defaultStickerPack[Math.floor(Math.random() * defaultStickerPack.length)];
      setTitleSticker(random);
    } else {
      setTitleSticker(null);
    }
  }, []);

  useEffect(() => {
    function handlePointerDown(event) {
      const target = event.target;
      const insideData = dataPanelRef.current?.contains(target);
      const insideSticker = stickerPanelRef.current?.contains(target);
      const insideStar = starPanelRef.current?.contains(target);
      if (insideData || insideSticker || insideStar) return;
      closeAllPanels();
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, []);

  function todayKey() {
    return new Date().toLocaleDateString();
  }

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  function triggerHeaderCelebrate() {
    setHeaderCelebrate(true);
    if (celebrateTimerRef.current) clearTimeout(celebrateTimerRef.current);
    celebrateTimerRef.current = setTimeout(() => setHeaderCelebrate(false), 800);
  }

  /* ======================================================
     TASK CREATION
  ====================================================== */
  function addNewTaskChecklistItem() {
    setNewTaskChecklist((prev) => [...prev, createChecklistItem("")]);
  }

  function updateNewTaskChecklistItem(itemId, value) {
    setNewTaskChecklist((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, text: value } : item))
    );
  }

  function deleteNewTaskChecklistItem(itemId) {
    setNewTaskChecklist((prev) => prev.filter((item) => item.id !== itemId));
  }

  function addTask() {
    if (!taskName.trim()) return;
    createDailyRecoveryBackup();

    const newTask = normalizeTask({
      id: Date.now(),
      name: taskName.trim(),
      notes,
      checklist: newTaskChecklist.filter((item) => item.text.trim() !== ""),
      done: false,
      focus: false,
      critical: false,
      createdAt: new Date().toISOString(),
      notesUpdatedAt: null,
    });

    setTasks([...tasks, newTask]);
    setTaskName("");
    setNotes("");
    setNewTaskChecklist([]);
  }

  function spawnStars(x, y) {
    const count = Math.floor(Math.random() * 4) + 5;
    const starTypes = ["⭐", "✨", "🌟"];
    const spawnRadius = 18;

    const stars = Array.from({ length: count }).map((_, i) => {
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * spawnRadius;
      const id = Date.now() + Math.random() + i;
      return {
        id,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance - 6,
        dx: (Math.random() - 0.5) * 220,
        dy: -120 - Math.random() * 140,
        size: 14 + Math.random() * 10,
        symbol: starTypes[Math.floor(Math.random() * starTypes.length)],
      };
    });

    setStarParticles((prev) => [...prev, ...stars]);
    setTimeout(() => {
      setStarParticles((prev) => prev.filter((star) => !stars.some((b) => b.id === star.id)));
    }, 1200);
  }

  function triggerSticker(x, y) {
    if (!stickersEnabled || stickers.length === 0) return;
    const sticker = stickers[Math.floor(Math.random() * stickers.length)];
    const id = Date.now() + Math.random();
    spawnStars(x, y);
    setActiveStickers((prev) => [
      ...prev,
      { src: sticker, x, y, rotation: (Math.random() - 0.5) * 90, id },
    ]);
    setTimeout(() => {
      setActiveStickers((prev) => prev.filter((item) => item.id !== id));
    }, 1800);
  }

  function handleTitleStickerClick(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    triggerSticker(rect.left + rect.width / 2, rect.top + rect.height / 2 - 12);
  }

  function formatCompactDateTime(value) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString([], {
      month: "numeric",
      day: "numeric",
      year: "2-digit",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function updateTaskById(taskId, updater) {
    setTasks((prev) => prev.map((task) => (task.id === taskId ? normalizeTask(updater(task)) : task)));
  }

  /* ======================================================
     TASK EDITING AND CHECKLISTS
  ====================================================== */
  function addChecklistItemToEditor() {
    setEditingChecklist((prev) => [...prev, createChecklistItem("")]);
  }

  function updateEditingChecklistItem(itemId, value) {
    setEditingChecklist((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, text: value } : item))
    );
  }

  function deleteEditingChecklistItem(itemId) {
    setEditingChecklist((prev) => prev.filter((item) => item.id !== itemId));
  }

  function toggleChecklistItem(taskId, itemId) {
    createDailyRecoveryBackup();
    updateTaskById(taskId, (task) => ({
      ...task,
      checklist: (task.checklist || []).map((item) =>
        item.id === itemId ? { ...item, completed: !item.completed } : item
      ),
      notesUpdatedAt: new Date().toISOString(),
    }));
  }

  /* ======================================================
     TASK COMPLETION AND ARCHIVE MOVES
  ====================================================== */
  function completeTask(task, e) {
    createDailyRecoveryBackup();
    const rect = e.currentTarget.getBoundingClientRect();
    triggerSticker(rect.left + rect.width / 2, rect.top - 12);
    setCompletingIds((prev) => ({ ...prev, [task.id]: true }));

    setTimeout(() => {
      const key = todayKey();
      const archived = normalizeTask({
        ...task,
        done: true,
        completedAt: new Date().toISOString(),
        archivedDateISO: todayISO(),
      });
      setDailyArchive((a) => ({ ...a, [key]: [...(a[key] || []), archived] }));
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
      setCompletingIds((prev) => {
        const copy = { ...prev };
        delete copy[task.id];
        return copy;
      });
      setPulseStar(true);
      setTimeout(() => setPulseStar(false), 600);
      triggerHeaderCelebrate();
    }, 450);
  }

  function undoFromArchive(task, date) {
    createDailyRecoveryBackup();
    setDailyArchive((prev) => {
      const next = { ...prev, [date]: (prev[date] || []).filter((t) => t.id !== task.id) };
      if (next[date]?.length === 0) delete next[date];
      return next;
    });
    setTasks((prev) => [normalizeTask({ ...task, done: false }), ...prev]);
  }

  function resetStarCount() {
    createDailyRecoveryBackup();
    setStarCountManual(0);
    setEditingStarValue("0");
  }

  function useCalculatedStarCount() {
    createDailyRecoveryBackup();
    setStarCountManual(null);
    setEditingStarValue(String(starCountCalculated));
  }

  function applyManualStarCount() {
    const parsed = parseInt(editingStarValue, 10);
    if (Number.isNaN(parsed) || parsed < 0) return;
    createDailyRecoveryBackup();
    setStarCountManual(parsed);
  }

  function restoreRecoveryBackup() {
    try {
      const backup = localStorage.getItem(BACKUP_KEY);
      const backupMetaRaw = localStorage.getItem(BACKUP_META_KEY);
      if (!backup) {
        window.alert("No emergency restore backup was found on this browser yet.");
        return;
      }

      const parsed = JSON.parse(backup);
      const backupMeta = backupMetaRaw ? JSON.parse(backupMetaRaw) : null;
      setTasks(normalizeTaskList(parsed.tasks));
      setDailyArchive(normalizeArchive(parsed.dailyArchive));
      setUploadedStickers(Array.isArray(parsed.customStickers) ? parsed.customStickers : []);
      setStarCountManual(
        parsed?.stars?.userModifiedTotal === null ||
          typeof parsed?.stars?.userModifiedTotal === "number"
          ? parsed.stars.userModifiedTotal
          : null
      );
      setExpandedDetails({});
      setExpandedArchiveNotes({});
      const backupTimeText = backupMeta?.createdAt
        ? new Date(backupMeta.createdAt).toLocaleString()
        : "an earlier point that day";
      window.alert(`Emergency restore loaded a daily backup from ${backupTimeText}.`);
    } catch {
      window.alert("The emergency restore backup could not be restored.");
    }
  }

  function deleteAllData() {
    const confirmation = window.prompt([
      "Delete all local Tasky Puppy data?",
      "",
      "This will permanently remove from this browser on this device:",
      "- active tasks",
      "- archive history",
      "- manual star total",
      "- emergency restore backup",
      "- dark mode preference",
      "- sticker on/off preference",
      "",
      "Export a JSON backup first if you may want this data later.",
      "",
      "To confirm, type exactly: Bark Woof Meow Yowl",
    ].join("\n"));

    if (confirmation === null) return;
    if (confirmation.trim() !== "Bark Woof Meow Yowl") {
      window.alert("Deletion cancelled. The magic animal words did not match.");
      return;
    }

    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(BACKUP_KEY);
      localStorage.removeItem(BACKUP_META_KEY);
      localStorage.removeItem(DARK_MODE_KEY);
      localStorage.removeItem(STICKERS_ENABLED_KEY);
      setTasks([]);
      setTaskName("");
      setNotes("");
      setNewTaskChecklist([]);
      setEditingId(null);
      setEditingTaskName("");
      setEditingNotes("");
      setEditingChecklist([]);
      setExpandedDetails({});
      setExpandedArchiveNotes({});
      setShowArchive(false);
      setDailyArchive({});
      setQueueSearch("");
      setArchiveSearch("");
      setArchiveStartDate("");
      setArchiveEndDate("");
      setStarCountManual(null);
      setEditingStarValue("0");
      setCompletingIds({});
      setShowDataDetails(false);
      setShowDataInfo(false);
      setDarkMode(false);
      setStickersEnabled(false);
      setUploadedStickers([]);
      setStickers(defaultStickerPack);
      setStickerMessage("");
      window.alert("All local Tasky Puppy data was deleted from this browser.");
    } catch (error) {
      console.error("Failed to delete TaskyPuppy data:", error);
      window.alert("Something went wrong while deleting local data.");
    }
  }

  function deleteTask(id) {
    const task = tasks.find((entry) => entry.id === id);
    const label = task?.name?.trim() || "this task";
    const confirmed = window.confirm(`Delete "${label}"? This cannot be undone.`);
    if (!confirmed) return;
    createDailyRecoveryBackup();
    setTasks(tasks.filter((t) => t.id !== id));
  }

  function deleteArchivedTask(task, date) {
    const label = task?.name?.trim() || "this archived task";
    const confirmed = window.confirm(`Delete archived task "${label}"? This cannot be undone.`);
    if (!confirmed) return;
    createDailyRecoveryBackup();
    setDailyArchive((prev) => {
      const next = { ...prev, [date]: (prev[date] || []).filter((entry) => entry.id !== task.id) };
      if (next[date]?.length === 0) delete next[date];
      return next;
    });
  }

  function toggleFocus(id) {
    createDailyRecoveryBackup();
    setTasks(tasks.map((t) => (t.id === id ? { ...t, focus: !t.focus } : t)));
  }

  function toggleCritical(id) {
    createDailyRecoveryBackup();
    setTasks(tasks.map((t) => (t.id === id ? { ...t, critical: !t.critical } : t)));
  }

  function startEdit(task) {
    setEditingId(task.id);
    setEditingTaskName(task.name);
    setEditingNotes(task.notes || "");
    setEditingChecklist((task.checklist || []).map((item) => ({ ...item })));
    setExpandedDetails((prev) => ({ ...prev, [task.id]: true }));
  }

  function saveTaskChanges(id) {
    createDailyRecoveryBackup();
    const now = new Date().toISOString();
    setTasks(
      tasks.map((t) =>
        t.id === id
          ? normalizeTask({
              ...t,
              name: editingTaskName.trim() || t.name,
              notes: editingNotes,
              checklist: editingChecklist.filter((item) => item.text.trim() !== ""),
              notesUpdatedAt: now,
            })
          : t
      )
    );
    setEditingId(null);
    setEditingTaskName("");
    setEditingNotes("");
    setEditingChecklist([]);
  }

  function toggleDetails(taskId) {
    setExpandedDetails((prev) => ({ ...prev, [taskId]: !prev[taskId] }));
  }

  function toggleArchiveNotes(noteKey) {
    setExpandedArchiveNotes((prev) => ({ ...prev, [noteKey]: !prev[noteKey] }));
  }

  function handleDragStart(index) {
    if (autoSort) return;
    setDragIndex(index);
  }

  function handleDrop(index) {
    if (dragIndex === null || autoSort) return;
    createDailyRecoveryBackup();
    const updated = [...tasks];
    const [moved] = updated.splice(dragIndex, 1);
    updated.splice(index, 0, moved);
    setTasks(updated);
    setDragIndex(null);
  }

  function priorityStyle(task) {
    const style = { borderLeft: "4px solid transparent" };
    if (task.critical) style.borderLeft = darkMode ? "4px solid #f87171" : "4px solid #ef4444";
    else if (task.focus) style.borderLeft = darkMode ? "4px solid #fcd34d" : "4px solid #facc15";
    return style;
  }

  /* ======================================================
     IMPORT / EXPORT / DATA MANAGEMENT
  ====================================================== */
  function exportJSON() {
    const exportPayload = {
      stars: {
        userModifiedTotal: starCountManual,
        appCountedTotal: starCountCalculated,
        effectiveTotal: displayStarCount,
      },
      app: "TaskyPuppy",
      exportedAt: new Date().toISOString(),
      version: 3,
      tasks,
      dailyArchive,
      customStickers: uploadedStickers,
    };

    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "taskypuppy_backup.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function validateImageDimensions(file) {
    return new Promise((resolve) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        const isValid = img.width <= 512 && img.height <= 512;
        URL.revokeObjectURL(objectUrl);
        resolve(isValid);
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(false);
      };
      img.src = objectUrl;
    });
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
      reader.onerror = () => reject(new Error("Could not read sticker file."));
      reader.readAsDataURL(file);
    });
  }

  function estimateStickerDataSize(list) {
    return list.reduce((total, item) => total + item.length, 0);
  }

  async function handleStickerUpload(e) {
    const files = Array.from(e.target.files || []);
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));
    if (imageFiles.length === 0) {
      setStickerMessage("No image files were found.");
      return;
    }

    const nextCustom = [...uploadedStickers];
    let addedCount = 0;
    let skippedCount = 0;

    for (const file of imageFiles) {
      if (file.size > CUSTOM_STICKER_MAX_FILE_BYTES) {
        skippedCount += 1;
        continue;
      }

      const hasValidDimensions = await validateImageDimensions(file);
      if (!hasValidDimensions) {
        skippedCount += 1;
        continue;
      }

      const dataUrl = await readFileAsDataUrl(file);

      if (nextCustom.includes(dataUrl)) {
        continue;
      }

      if (nextCustom.length >= CUSTOM_STICKER_MAX_COUNT) {
        skippedCount += 1;
        continue;
      }

      const projectedSize = estimateStickerDataSize([...nextCustom, dataUrl]);
      if (projectedSize > CUSTOM_STICKER_MAX_TOTAL_BYTES) {
        skippedCount += 1;
        continue;
      }

      nextCustom.push(dataUrl);
      addedCount += 1;
    }

    setUploadedStickers(nextCustom);

    if (addedCount > 0 && skippedCount > 0) {
      setStickerMessage(
        `Added ${addedCount} sticker(s). Skipped ${skippedCount}. Limits: ${CUSTOM_STICKER_MAX_COUNT} custom stickers, 512×512 max, 500 KB per image.`
      );
    } else if (addedCount > 0) {
      setStickerMessage(`Added ${addedCount} custom sticker(s).`);
    } else {
      setStickerMessage("No new stickers were added. Check file size, dimensions, or custom sticker limits.");
    }

    e.target.value = "";
  }

  function removeCustomSticker(src) {
    setUploadedStickers((prev) => prev.filter((item) => item !== src));
    setStickerMessage("Custom sticker removed.");
  }

  function resetCustomStickers() {
    if (uploadedStickers.length === 0) return;
    const confirmed = window.confirm("Remove all custom stickers and return to the default sticker pack?");
    if (!confirmed) return;
    setUploadedStickers([]);
    setStickerMessage("Reset to the default sticker pack.");
  }

  async function handleImportFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const imported = normalizeImportData(parsed);

      const mode = window.prompt([
        "Import backup mode:",
        "",
        "Type REPLACE to overwrite your current queue, archive history, and star counts.",
        "Type MERGE to combine the imported backup with your current data.",
        "",
        "REPLACE is safest if you want to restore a full backup.",
        "MERGE may create duplicates if similar cards exist in both files.",
        "",
        "Type REPLACE or MERGE:",
      ].join("\n"));

      if (!mode) {
        e.target.value = "";
        return;
      }

      const normalizedMode = mode.trim().toUpperCase();
      if (normalizedMode !== "REPLACE" && normalizedMode !== "MERGE") {
        window.alert("Import cancelled. Please type exactly REPLACE or MERGE.");
        e.target.value = "";
        return;
      }

      if (normalizedMode === "REPLACE") {
        const confirmed = window.confirm(
          "This will replace your current active tasks, archive history, and star data. Export your current data first if you want to keep it. Continue?"
        );
        if (!confirmed) {
          e.target.value = "";
          return;
        }
        createDailyRecoveryBackup();
        setTasks(imported.tasks);
        setDailyArchive(imported.dailyArchive);
        setStarCountManual(imported.starCountManual);
        setUploadedStickers(imported.customStickers || []);
        setExpandedArchiveNotes({});
        window.alert("Backup imported. Your current data was replaced.");
      }

      if (normalizedMode === "MERGE") {
        const confirmed = window.confirm(
          "This will merge the imported backup into your current data. Similar items may duplicate if they do not share the same internal ID. Manual star totals will be added automatically. Continue?"
        );
        if (!confirmed) {
          e.target.value = "";
          return;
        }
        createDailyRecoveryBackup();
        const mergedTasks = mergeUniqueById(tasks, imported.tasks);
        const mergedArchive = mergeArchives(dailyArchive, imported.dailyArchive);
        const currentManualForMerge = starCountManual ?? 0;
        const importedManualForMerge = imported.starCountManual ?? 0;
        const mergedCustomStickers = Array.from(new Set([...(uploadedStickers || []), ...(imported.customStickers || [])])).slice(0, CUSTOM_STICKER_MAX_COUNT);
        setTasks(mergedTasks);
        setDailyArchive(mergedArchive);
        setStarCountManual(currentManualForMerge + importedManualForMerge);
        setUploadedStickers(mergedCustomStickers);
        window.alert("Backup merged. Review your queue and archive for duplicates if the two datasets overlapped.");
      }
    } catch {
      window.alert("That file could not be imported. Please choose a valid TaskyPuppy JSON backup.");
    } finally {
      e.target.value = "";
    }
  }

  const hasArchiveFilters = archiveSearch.trim() !== "" || archiveStartDate !== "" || archiveEndDate !== "";

  /* ======================================================
     DERIVED DATA
  ====================================================== */
  const filteredTasks = tasks.filter((t) => {
    const q = queueSearch.toLowerCase();
    return t.name.toLowerCase().includes(q) || (t.notes || "").toLowerCase().includes(q) || (t.checklist || []).some((item) => (item.text || "").toLowerCase().includes(q));
  });

  let sortedTasks = [...filteredTasks];
  if (nextTaskMode) {
    sortedTasks.sort((a, b) => {
      const priorityDiff = getTaskPriority(b) - getTaskPriority(a);
      if (priorityDiff !== 0) return priorityDiff;
      return a.id - b.id;
    });
  } else {
    sortedTasks = sortTasks(sortedTasks, autoSort);
  }

  const archiveGroups = Object.entries(dailyArchive)
    .map(([date, list]) => {
      const safeList = Array.isArray(list) ? list : [];
      return { date, list: safeList, groupISO: getArchiveGroupISO(date, safeList) };
    })
    .filter((entry) => entry.list.length > 0)
    .sort((a, b) => b.groupISO.localeCompare(a.groupISO));

  const archiveEntries = hasArchiveFilters
    ? archiveGroups
        .map((entry) => ({
          ...entry,
          list: entry.list.filter((task) => {
            const q = archiveSearch.toLowerCase();
            const taskISO = parseArchiveISO(task, entry.date) || entry.groupISO;
            const matchesSearch = task.name.toLowerCase().includes(q) || (task.notes || "").toLowerCase().includes(q) || (task.checklist || []).some((item) => (item.text || "").toLowerCase().includes(q));
            const matchesStart = !archiveStartDate || (taskISO && taskISO >= archiveStartDate);
            const matchesEnd = !archiveEndDate || (taskISO && taskISO <= archiveEndDate);
            return matchesSearch && matchesStart && matchesEnd;
          }),
        }))
        .filter((entry) => entry.list.length > 0)
    : archiveGroups.slice(0, 7);

  const galleryStickers = [
    ...defaultStickerPack.map((src, index) => ({ id: `built-${index}`, src, isCustom: false })),
    ...uploadedStickers.map((src, index) => ({ id: `custom-${index}`, src, isCustom: true })),
  ];
  const hasUploadedGalleryStickers = uploadedStickers.length > 0;
  const theme = getTheme(darkMode);
  const styles = getStyles(theme, isMobile, darkMode);

  function focusToggleStyle(isActive) {
    return {
      ...styles.smallButton,
      background: isActive ? theme.focusActiveBg : styles.smallButton.background,
      border: `1px solid ${isActive ? theme.focusActiveBorder : theme.border}`,
      color: isActive ? theme.focusActiveText : styles.smallButton.color,
      fontWeight: isActive ? 800 : styles.smallButton.fontWeight,
      boxShadow: isActive
        ? darkMode
          ? "0 4px 12px rgba(250, 204, 21, 0.22)"
          : "0 4px 12px rgba(245, 158, 11, 0.18)"
        : "none",
    };
  }

  function urgentToggleStyle(isActive) {
    return {
      ...styles.smallButton,
      background: isActive ? theme.urgentActiveBg : styles.smallButton.background,
      border: `1px solid ${isActive ? theme.urgentActiveBorder : theme.border}`,
      color: isActive ? theme.urgentActiveText : styles.smallButton.color,
      fontWeight: isActive ? 800 : styles.smallButton.fontWeight,
      boxShadow: isActive
        ? darkMode
          ? "0 4px 12px rgba(249, 115, 22, 0.22)"
          : "0 4px 12px rgba(234, 88, 12, 0.16)"
        : "none",
    };
  }

  /* ======================================================
     RENDER HELPERS
  ====================================================== */
  const desktopTitleBlock = (
    <div style={styles.titleBlock}>
      <h1 style={{ ...styles.titleText, animation: headerCelebrate ? "tpTitleGlow 0.8s ease" : "none" }}>Tasky Puppy</h1>
      <div style={styles.starSummaryWrap} ref={starPanelRef}>
        <div
          style={{
            ...styles.starSummaryButton,
            animation: pulseStar ? "pulseLite 0.6s ease" : headerCelebrate ? "tpStarPop 0.65s ease" : "none",
          }}
          onClick={toggleStarPanel}
          title="Click to edit stars"
        >
          <span style={styles.starSummaryIcon}>⭐</span>
          <div style={styles.starSummaryTextWrap}>
            <span style={styles.starSummaryCount}>{displayStarCount}</span>
            <span style={styles.starSummaryLabel}>stars earned</span>
          </div>
        </div>

        {showStarTools && (
          <div style={styles.starPanel}>
            <div style={{ fontWeight: 800, color: theme.title, marginBottom: "8px" }}>Star Tools</div>
            <div style={styles.helperText}>Displayed stars use the manual override when one is set. Otherwise they use the archive-counted total.</div>
            <div style={{ ...styles.helperText, marginTop: "8px" }}>Manual override: <strong>{starCountManual === null ? "Off" : starCountManual}</strong></div>
            <div style={styles.helperText}>Calculated from archive: <strong>{starCountCalculated}</strong></div>
            <div style={styles.helperText}>Displayed total: <strong>{displayStarCount}</strong></div>
            <div style={{ display: "grid", gap: "8px", marginTop: "10px", minWidth: 0 }}>
              <input style={styles.input} type="number" min="0" value={editingStarValue} onChange={(e) => setEditingStarValue(e.target.value)} placeholder="Edit displayed stars" />
              <div style={styles.starActionRow}>
                <button className="pressable" style={styles.starActionButton} onClick={applyManualStarCount}>Save Stars</button>
                <button className="pressable" style={styles.starActionButton} onClick={useCalculatedStarCount}>Use Counted</button>
                <button className="pressable" style={styles.starActionButton} onClick={resetStarCount}>Reset to 0</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div style={styles.page}>
      <div style={styles.bottomStarField} />
      {/* Existing JSX structure intentionally preserved for the 3-file split. */}
      {/* This keeps behavior stable before the next feature pass. */}
      {/* The render body below matches your current app, with helpers/styles moved out. */}

      {expandedGallerySticker && (
        <div style={styles.galleryExpandedOverlay} onClick={() => setExpandedGallerySticker(null)}>
          <div style={styles.galleryExpandedCard} onClick={(e) => e.stopPropagation()}>
            <img src={expandedGallerySticker.src} alt="Expanded sticker preview" style={styles.galleryExpandedImage} />
            <button className="pressable" style={styles.button} onClick={() => setExpandedGallerySticker(null)}>Close</button>
          </div>
        </div>
      )}

      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 9999 }}>
        {activeStickers.map((sticker) => (
          <img key={sticker.id} alt="sticker" src={sticker.src} style={{ position: "fixed", left: sticker.x, top: sticker.y, width: 120, transform: `translate(-50%,0) rotate(${sticker.rotation}deg)`, pointerEvents: "none", animation: "stickerLaunch 1.8s ease-out forwards", zIndex: 9999 }} />
        ))}
        {starParticles.map((star) => (
          <div key={star.id} style={{ position: "fixed", left: star.x, top: star.y, pointerEvents: "none", transform: "translate(-50%, -50%)", animation: "starFly 1.2s ease-out forwards", ["--dx"]: `${star.dx}px`, ["--dy"]: `${star.dy}px`, fontSize: `${star.size}px`, zIndex: 9999 }}>{star.symbol}</div>
        ))}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@400;600;700&family=Fredoka:wght@400;500;600;700&family=Nunito:wght@400;600;700;800&family=Quicksand:wght@400;500;600;700&display=swap');
        @keyframes stickerLaunch {0% { transform: translate(-50%,0) scale(0.9) rotate(0deg); opacity:1 }30% { transform: translate(-50%,-120px) rotate(8deg) }60% { transform: translate(-50%,-90px) rotate(-6deg) }100% { transform: translate(-50%,-200px) rotate(12deg); opacity:0 }}
        @keyframes starFly {0% { transform: translate(-50%, -50%); opacity:1 }100% { transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))); opacity:0 }}
        @keyframes pulseLite {0% { transform: scale(1); }50% { transform: scale(1.15); }100% { transform: scale(1); }}
        @keyframes taskCompleteOut {0% { opacity: 1; transform: translateX(0); max-height: 300px; margin-bottom: 12px; }100% { opacity: 0; transform: translateX(40px); max-height: 0; margin-bottom: 0; }}
        @keyframes mascotIdle {0% { transform: translateY(0px) rotate(0deg); }50% { transform: translateY(-6px) rotate(-2deg); }100% { transform: translateY(0px) rotate(0deg); }}
        @keyframes galleryFadeIn {0% { opacity: 0; transform: translateY(4px); }100% { opacity: 1; transform: translateY(0); }}
        @keyframes tpMascotBounce {0% { transform: translateY(0) scale(1); }22% { transform: translateY(-8px) scale(1.03); }45% { transform: translateY(0) scale(0.995); }65% { transform: translateY(-3px) scale(1.01); }100% { transform: translateY(0) scale(1); }}
        @keyframes tpStarPop {0% { transform: scale(1); }25% { transform: scale(1.12); }45% { transform: scale(0.98); }100% { transform: scale(1); }}
        @keyframes tpTitleGlow {0% { text-shadow: 0 0 0 rgba(255,255,255,0); transform: scale(1);}30% { text-shadow: 0 0 12px rgba(150,180,255,0.28), 0 0 24px rgba(255,215,120,0.18); transform: scale(1.015);}100% { text-shadow: 0 0 12px rgba(150,180,255,0.18), 0 0 2px rgba(255,255,255,0.12); transform: scale(1); }}
        .pressable:hover { transform: translateY(-2px); box-shadow: 0 6px 14px rgba(0,0,0,0.18); }
        .pressable:active { transform: scale(0.96); box-shadow: inset 0 2px 4px rgba(0,0,0,0.2); }
        * { box-sizing: border-box; }
        @media (max-width: 640px) { input[type="date"] { min-width: 0; width: 100%; max-width: 100%; min-height: 44px; box-sizing: border-box; display: block; -webkit-appearance: none; appearance: none; font-size: 16px; line-height: 1.2; } .pressable:hover { transform: none; box-shadow: none; } }
      `}</style>

      <div style={styles.wrapper}>
        <input ref={importInputRef} type="file" accept="application/json,.json" onChange={handleImportFile} style={{ display: "none" }} />
        <div style={styles.topBar}>
          <div style={styles.headerMain}>
            <div style={styles.mascotWrap}>{titleSticker ? <img src={titleSticker} alt="Tasky Puppy mascot" style={{ ...styles.titleSticker, animation: headerCelebrate ? "tpMascotBounce 0.75s ease" : "mascotIdle 5s ease-in-out infinite" }} onClick={handleTitleStickerClick} title="Click for a little reward boost. Works when Stickers are turned on." /> : <div style={{ ...styles.titleSticker, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "72px", animation: headerCelebrate ? "tpMascotBounce 0.75s ease" : "mascotIdle 5s ease-in-out infinite" }} onClick={handleTitleStickerClick} title="Click for a little reward boost. Works when Stickers are turned on.">🐶</div>}</div>
            {!isMobile && desktopTitleBlock}
            <div style={styles.headerRight}>
              <div style={styles.headerButtons}>
                <div style={{ position: "relative" }} ref={stickerPanelRef}>
                  <button className="pressable" onClick={toggleStickerPanel} style={{ ...(stickersEnabled ? styles.buttonPrimary : styles.button), ...styles.headerButton }}>✨ Stickers</button>
                  {showStickerSettings && (
                    <div style={styles.stickerMenu}>
                      <div style={{ ...styles.row, justifyContent: "space-between", marginBottom: "10px" }}>
                        <span style={{ fontWeight: 700, color: theme.title }}>Sticker Manager</span>
                        <button className="pressable" onClick={() => setStickersEnabled(!stickersEnabled)} style={stickersEnabled ? styles.buttonPrimary : styles.button}>
                          {stickersEnabled ? "On" : "Off"}
                        </button>
                      </div>

                      <div style={styles.helperText}>
                        Built-in stickers: {defaultStickerPack.length}. Custom stickers: {uploadedStickers.length}.
                      </div>

                      <div style={styles.stickerManagerActions}>
                        <button className="pressable" style={{ ...styles.button, width: "100%" }} onClick={() => setShowStickerGallery(!showStickerGallery)}>
                          {showStickerGallery ? `Hide Sticker Gallery (${galleryStickers.length})` : `Sticker Gallery (${galleryStickers.length})`}
                        </button>

                        {stickersEnabled && (
                          <>
                            <input type="file" multiple accept="image/*" onChange={handleStickerUpload} style={styles.stickerFileInput} />
                            <button className="pressable" style={{ ...styles.button, width: "100%" }} onClick={resetCustomStickers}>
                              Reset to Default Pack
                            </button>
                          </>
                        )}
                      </div>

                      {stickerMessage && <div style={styles.stickerMessage}>{stickerMessage}</div>}

                      {showStickerGallery && (
                        <div style={{ marginTop: "10px", animation: "galleryFadeIn 0.18s ease" }}>
                          <div style={styles.helperText}>
                            Tap a sticker to preview it. Custom stickers can be removed directly from the gallery.
                          </div>
                          <div style={styles.galleryGrid}>
                            {galleryStickers.map((sticker) => {
                              const isHovered = hoveredGallerySticker === sticker.id;
                              return (
                                <div
                                  key={sticker.id}
                                  style={{
                                    ...styles.galleryTile,
                                    boxShadow: isHovered
                                      ? darkMode
                                        ? "0 8px 18px rgba(59, 130, 246, 0.18)"
                                        : "0 8px 18px rgba(96, 165, 250, 0.2)"
                                      : darkMode
                                        ? "0 2px 8px rgba(2, 6, 23, 0.18)"
                                        : "0 2px 8px rgba(148, 163, 184, 0.08)",
                                    transform: isHovered ? "translateY(-2px)" : "translateY(0)",
                                  }}
                                  onMouseEnter={() => setHoveredGallerySticker(sticker.id)}
                                  onMouseLeave={() => setHoveredGallerySticker(null)}
                                  onClick={() => setExpandedGallerySticker(sticker)}
                                  onTouchStart={() => setExpandedGallerySticker(sticker)}
                                >
                                  {sticker.isCustom && (
                                    <button
                                      className="pressable"
                                      style={styles.galleryDeleteButton}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        removeCustomSticker(sticker.src);
                                      }}
                                      title="Remove custom sticker"
                                    >
                                      ✕
                                    </button>
                                  )}
                                  <img
                                    src={sticker.src}
                                    alt="Sticker preview"
                                    style={{ ...styles.galleryThumb, transform: isHovered ? "scale(1.15)" : "scale(1)" }}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <button className="pressable" onClick={() => setDarkMode((prev) => !prev)} style={{ ...(darkMode ? styles.buttonPrimary : styles.button), ...styles.headerButton }} title="Toggle dark mode">{darkMode ? "🌙 Dark" : "☀️ Light"}</button>
              </div>
            </div>
          </div>
          {isMobile && desktopTitleBlock}
        </div>

        <div style={styles.controlsRow}>
          <button className="pressable" style={autoSort ? styles.buttonPrimary : styles.button} onClick={() => setAutoSort(!autoSort)}>Auto Sort</button>
          <button className="pressable" style={nextTaskMode ? styles.buttonPrimary : styles.button} onClick={() => setNextTaskMode(!nextTaskMode)}>Next Task</button>
          <div style={{ position: "relative" }} ref={dataPanelRef}>
            <button className="pressable" style={showDataInfo ? styles.buttonPrimary : styles.button} onClick={toggleDataPanel}>Your Data</button>
            {showDataInfo && isMobile && <div style={styles.overlay} onClick={() => setShowDataInfo(false)} />}
            {showDataInfo && <div style={styles.infoPanel}><div style={{ fontWeight: 800, color: theme.title, marginBottom: "8px" }}>Your Data</div><div style={styles.panelActionRow}><button className="pressable" style={styles.panelActionButton} onClick={exportJSON}>Export JSON</button><button className="pressable" style={styles.panelActionButton} onClick={() => importInputRef.current?.click()}>Import JSON</button><button className="pressable" style={styles.panelActionButton} onClick={restoreRecoveryBackup}>Emergency Restore</button></div><div style={styles.footerText}>Your personal data in this app is intended to be cloud-free. Please make regular copies! Or else!</div><div style={{ marginTop: "10px", display: "flex", justifyContent: "center" }}><button className="pressable" style={styles.detailsToggle} onClick={() => setShowDataDetails((prev) => !prev)}>{showDataDetails ? "Hide Details" : "Show Details"}</button></div>{showDataDetails && <div style={styles.infoPanelScrollArea}><div style={{ ...styles.footerText, marginTop: "10px" }}>On desktop, your data is stored locally in this browser on this device. On mobile, it is also generally stored locally in the browser, but mobile browsers can be less predictable if app or browser data is cleared, the browser is reinstalled, private browsing is used, or the device changes.</div><div style={{ ...styles.footerText, marginTop: "8px" }}>This means your queue, archive, and progress do not automatically sync between devices. Export backups regularly if you want to preserve your data or move it somewhere else.</div><div style={{ ...styles.footerText, marginTop: "8px" }}><strong>Emergency Restore</strong> is the app’s once-per-day local “oops” backup. The first meaningful change you make each day saves a recovery snapshot before that change, and that snapshot stays put for the rest of the day.</div><div style={{ ...styles.footerText, marginTop: "8px" }}>That makes <strong>Emergency Restore</strong> best for undoing a messy moment from today, using a backup saved locally in this browser on this device.</div><div style={{ ...styles.footerText, marginTop: "8px" }}><strong>Import JSON</strong> uses a backup file you picked yourself. It is best for restoring an older save, moving your data to another device, or merging progress from somewhere else.</div><div style={{ ...styles.footerText, marginTop: "8px" }}>In short: <strong>Emergency Restore</strong> is your local daily “oops” button, while <strong>Import JSON</strong> is your long-term moving-and-backup tool.</div><div style={{ ...styles.footerText, marginTop: "8px" }}>If you have this app open in multiple tabs or windows on the same browser and same local address, changes should now update across them automatically.</div><div style={styles.dangerSection}><div style={styles.dangerText}><strong>Advanced action:</strong> Need a full fresh start? This deletes all local Tasky Puppy data from this browser on this device, including your queue, archive, stars, emergency restore backup, and interface preferences.</div><button className="pressable" style={styles.dangerButton} onClick={deleteAllData}>Delete All Data</button></div></div>}</div>}
          </div>
        </div>

        <div style={{ marginBottom: "12px" }}><input style={styles.input} placeholder="Search active tasks..." value={queueSearch} onChange={(e) => setQueueSearch(e.target.value)} /></div>
        <div style={styles.card}><div style={styles.cardStars}>✦ ✦ ✦</div><div style={{ display: "grid", gap: "12px" }}><input style={styles.input} maxLength={100} placeholder="Task name" value={taskName} onChange={(e) => setTaskName(e.target.value)} /><textarea style={styles.textarea} placeholder="Details / notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} /><div style={{ display: "grid", gap: "8px" }}>{newTaskChecklist.length > 0 && (<div style={{ display: "grid", gap: "8px" }}>{newTaskChecklist.map((item) => (<div key={item.id} style={styles.checklistEditRow}><input style={{ ...styles.input, minWidth: 0 }} placeholder="Checklist item" value={item.text} onChange={(e) => updateNewTaskChecklistItem(item.id, e.target.value)} /><button className="pressable" style={styles.smallButton} onClick={() => deleteNewTaskChecklistItem(item.id)}>{isMobile ? "❌" : "❌ Delete"}</button></div>))}</div>)}<button className="pressable" style={styles.button} onClick={addNewTaskChecklistItem}>+ Add Checklist Item (optional)</button></div><button className="pressable" style={styles.buttonPrimary} onClick={addTask}>Add Task</button></div></div>

        <div>
          {sortedTasks.map((task, index) => {
            const isNextTask = nextTaskMode && index === 0;
            const detailsOpen = expandedDetails[task.id];
            const hasDetails = taskHasDetails(task);

            return (
              <div
                key={task.id}
                draggable={!autoSort}
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(index)}
                style={{
                  ...styles.card,
                  ...priorityStyle(task),
                  cursor: autoSort ? "default" : "move",
                  animation: completingIds[task.id] ? "taskCompleteOut 0.45s ease forwards" : "none",
                  background: isNextTask
                    ? darkMode
                      ? "linear-gradient(180deg, #2f3650 0%, #394260 100%)"
                      : "linear-gradient(180deg, #fffbea 0%, #fffbeb 100%)"
                    : styles.card.background,
                  boxShadow: isNextTask
                    ? darkMode
                      ? "0 0 0 2px #5b7aa5, 0 8px 24px rgba(15, 23, 42, 0.28)"
                      : "0 0 0 2px #bfdbfe, 0 8px 24px rgba(96, 165, 250, 0.18)"
                    : styles.card.boxShadow,
                }}
              >
                <div style={styles.cardStars}>✦ ✦ ✦</div>

                <div style={styles.taskHeaderRow}>
                  <div style={styles.taskTitleRow}>
                    <div style={{ display: "grid", gap: "4px", minWidth: 0, flex: 1 }}>
                      {isNextTask && (
                        <div
                          style={{
                            fontSize: "12px",
                            fontWeight: 700,
                            color: darkMode ? "#9ec9ff" : "#2563eb",
                          }}
                        >
                          Next Up
                        </div>
                      )}
                      <div style={{ ...styles.taskTitleRow, alignItems: "center" }}>
                        <p style={styles.taskTitleText} title={task.name}>
                          {task.name}
                        </p>
                        <span style={styles.taskMetaText}>
                          {formatCompactDateTime(task.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div style={styles.taskActionRow}>
                    <button
                      className="pressable"
                      onClick={() => toggleFocus(task.id)}
                      style={{ ...focusToggleStyle(task.focus), ...styles.taskActionButton }}
                    >
                      {isMobile ? "⭐" : "⭐ Focus"}
                    </button>

                    <button
                      className="pressable"
                      onClick={() => toggleCritical(task.id)}
                      style={{ ...urgentToggleStyle(task.critical), ...styles.taskActionButton }}
                    >
                      {isMobile ? "⚠️" : "⚠️ Urgent"}
                    </button>

                    <button
                      className="pressable"
                      onClick={(e) => completeTask(task, e)}
                      style={{ ...styles.smallButton, ...styles.taskActionButton }}
                    >
                      {isMobile ? "✅" : "✅ Done"}
                    </button>

                    <button
                      className="pressable"
                      onClick={() => startEdit(task)}
                      style={{ ...styles.smallButton, ...styles.taskActionButton }}
                    >
                      Edit
                    </button>

                    <button
                      className="pressable"
                      onClick={() => deleteTask(task.id)}
                      style={{ ...styles.smallButton, ...styles.taskActionButton }}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {editingId === task.id ? (
                  <div style={{ marginTop: "10px", display: "grid", gap: "10px" }}>
                    <input
                      style={styles.input}
                      maxLength={100}
                      value={editingTaskName}
                      onChange={(e) => setEditingTaskName(e.target.value)}
                      placeholder="Task title"
                    />

                    <div style={{ ...styles.noteText, marginTop: 0 }}>
                      <div style={{ fontWeight: 800, marginBottom: "8px", color: theme.title }}>
                        Details
                      </div>

                      <textarea
                        style={{ ...styles.textarea, minHeight: "96px" }}
                        value={editingNotes}
                        onChange={(e) => setEditingNotes(e.target.value)}
                        placeholder="Notes"
                      />

                      <div style={{ display: "grid", gap: "8px", marginTop: "10px" }}>
                        {editingChecklist.map((item) => (
                          <div key={item.id} style={styles.checklistRow}>
                            <input
                              type="checkbox"
                              checked={item.completed}
                              onChange={() =>
                                setEditingChecklist((prev) =>
                                  prev.map((entry) =>
                                    entry.id === item.id
                                      ? { ...entry, completed: !entry.completed }
                                      : entry
                                  )
                                )
                              }
                            />
                            <input
                              style={{ ...styles.input, ...styles.checklistTextInput }}
                              value={item.text}
                              onChange={(e) => updateEditingChecklistItem(item.id, e.target.value)}
                              placeholder="Checklist item"
                            />
                            <button
                              className="pressable"
                              style={styles.smallButton}
                              onClick={() => deleteEditingChecklistItem(item.id)}
                            >
                              Delete
                            </button>
                          </div>
                        ))}

                        <button
                          className="pressable"
                          style={styles.button}
                          onClick={addChecklistItemToEditor}
                        >
                          + Add Checklist Item
                        </button>
                      </div>
                    </div>

                    <div style={{ display: "flex", justifyContent: isMobile ? "center" : "flex-start", gap: "8px", flexWrap: "wrap" }}>
                      <button
                        className="pressable"
                        style={{ ...styles.buttonPrimary, width: isMobile ? "100%" : "fit-content" }}
                        onClick={() => saveTaskChanges(task.id)}
                      >
                        Save Changes
                      </button>
                      <button
                        className="pressable"
                        style={{ ...styles.button, width: isMobile ? "100%" : "fit-content" }}
                        onClick={() => {
                          setEditingId(null);
                          setEditingTaskName("");
                          setEditingNotes("");
                          setEditingChecklist([]);
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : hasDetails ? (
                  <div style={{ marginTop: "10px" }}>
                    <button
                      className="pressable"
                      style={styles.detailToggleButton}
                      onClick={() => toggleDetails(task.id)}
                    >
                      <span>{detailsOpen ? "▾ Hide Details" : "▸ Details"}</span>
                      <span style={{ fontSize: "12px", color: theme.muted }}>
                        {(task.checklist || []).length > 0
                          ? `${(task.checklist || []).filter((item) => item.completed).length}/${(task.checklist || []).length} checked`
                          : task.notesUpdatedAt
                            ? "updated"
                            : "open"}
                      </span>
                    </button>

                    <div
                      style={{
                        ...styles.detailsPanel,
                        maxHeight: detailsOpen ? "560px" : "0px",
                        opacity: detailsOpen ? 1 : 0,
                        transform: detailsOpen ? "translateY(0)" : "translateY(-4px)",
                        transition: "max-height 240ms ease, opacity 180ms ease, transform 180ms ease",
                      }}
                    >
                      <div style={{ ...styles.noteText, marginTop: "8px", display: "grid", gap: "10px" }}>
                        {task.notes && <div>{task.notes}</div>}

                        {(task.checklist || []).length > 0 && (
                          <div style={{ display: "grid", gap: "8px" }}>
                            {task.checklist.map((item) => (
                              <label key={item.id} style={styles.checklistRow}>
                                <input
                                  type="checkbox"
                                  checked={item.completed}
                                  onChange={() => toggleChecklistItem(task.id, item.id)}
                                />
                                <span
                                  style={{
                                    ...styles.checklistItemText,
                                    textDecoration: item.completed ? "line-through" : "none",
                                    opacity: item.completed ? 0.72 : 1,
                                  }}
                                >
                                  {item.text || "Untitled checklist item"}
                                </span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <div style={styles.card}>
          <div style={styles.cardStars}>✦ ✦ ✦</div>
          <button
            className="pressable"
            style={{ ...styles.button, marginBottom: showArchive ? "12px" : 0 }}
            onClick={() => setShowArchive(!showArchive)}
          >
            {showArchive ? "▾ Daily Archive" : "▸ Daily Archive"}
          </button>

          {showArchive && (
            <>
              <div style={{ ...styles.helperText, marginBottom: "12px" }}>
                Showing your 7 most recent archive days by default. Search or use a date filter to
                view older history.
              </div>

              <div style={{ display: "grid", gap: "12px", marginBottom: "12px", minWidth: 0 }}>
                <input
                  style={styles.input}
                  placeholder="Search archive..."
                  value={archiveSearch}
                  onChange={(e) => setArchiveSearch(e.target.value)}
                />

                <div style={styles.archiveFilterGrid}>
                  <div style={styles.archiveFilterCell}>
                    <div style={{ ...styles.muted, marginBottom: "4px" }}>Start Date</div>
                    <input
                      type="date"
                      style={styles.archiveDateInput}
                      value={archiveStartDate}
                      onChange={(e) => setArchiveStartDate(e.target.value)}
                    />
                  </div>

                  <div style={styles.archiveFilterCell}>
                    <div style={{ ...styles.muted, marginBottom: "4px" }}>End Date</div>
                    <input
                      type="date"
                      style={styles.archiveDateInput}
                      value={archiveEndDate}
                      onChange={(e) => setArchiveEndDate(e.target.value)}
                    />
                  </div>

                  <div style={styles.archiveFilterAction}>
                    <button
                      className="pressable"
                      style={{
                        ...styles.button,
                        ...styles.fullWidthButton,
                        minHeight: styles.archiveDateInput.minHeight,
                        alignSelf: isMobile ? "stretch" : "auto",
                      }}
                      onClick={() => {
                        setArchiveStartDate("");
                        setArchiveEndDate("");
                      }}
                    >
                      Clear Date Filter
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gap: "16px", minWidth: 0 }}>
                {archiveEntries.map((entry) => (
                  <div key={entry.date}>
                    <div style={{ fontWeight: 700, color: theme.muted, marginBottom: "6px" }}>
                      {entry.date}
                    </div>

                    <div style={{ display: "grid", gap: "8px", paddingLeft: "8px", minWidth: 0 }}>
                      {entry.list.map((task) => {
                        const archiveNoteKey = `${entry.date}-${task.id}`;
                        const detailsOpen = expandedArchiveNotes[archiveNoteKey];
                        const hasDetails = taskHasDetails(task);

                        return (
                          <div key={task.id} style={styles.archiveTaskRow}>
                            <div style={styles.archiveCompactCard}>
                              <div style={styles.archiveCardHeader}>
                                <div style={styles.archiveTitleRow}>
                                  <span style={styles.archiveTaskName}>{task.name}</span>

                                  {hasDetails && (
                                    <button
                                      className="pressable"
                                      style={styles.archiveInlineNoteButton}
                                      onClick={() => toggleArchiveNotes(archiveNoteKey)}
                                    >
                                      {detailsOpen ? "Hide details" : "Details"}
                                    </button>
                                  )}
                                </div>

                                <div style={styles.archiveActionsRow}>
                                  <button
                                    className="pressable"
                                    style={styles.archiveUndoButton}
                                    onClick={() => undoFromArchive(task, entry.date)}
                                  >
                                    Undo
                                  </button>
                                  <button
                                    className="pressable"
                                    style={styles.archiveDeleteButton}
                                    onClick={() => deleteArchivedTask(task, entry.date)}
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>

                              {hasDetails && detailsOpen && (
                                <div style={{ ...styles.noteText, marginTop: 0, display: "grid", gap: "8px" }}>
                                  {task.notes && <div>{task.notes}</div>}
                                  {(task.checklist || []).length > 0 && (
                                    <div style={{ display: "grid", gap: "6px" }}>
                                      {task.checklist.map((item) => (
                                        <div key={item.id} style={styles.checklistRow}>
                                          <input type="checkbox" checked={item.completed} readOnly />
                                          <span
                                            style={{
                                              ...styles.checklistItemText,
                                              textDecoration: item.completed ? "line-through" : "none",
                                              opacity: item.completed ? 0.72 : 1,
                                            }}
                                          >
                                            {item.text || "Untitled checklist item"}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {archiveEntries.length === 0 && (
                  <div style={styles.helperText}>No archive items match the current view.</div>
                )}
              </div>
            </>
          )}
        </div>

        <div style={styles.footerBar}><span style={styles.footerBarText}>Just a little animal guy on the internet. This is what I think a task tracker should be. I promise all choices were made with intention!</span><div style={styles.footerLinkRow}><a href="https://twitter.com/dogbutwithfire" target="_blank" rel="noreferrer" style={styles.footerBarLink}>🐦 @dogbutwithfire</a><span style={styles.footerDivider}>•</span><a href="https://t.me/PlushArcanine" target="_blank" rel="noreferrer" style={styles.footerBarLink}>✈️ @PlushArcanine</a></div></div>
      </div>
    </div>
  );
}
