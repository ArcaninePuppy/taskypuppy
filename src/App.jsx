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
        @keyframes starDriftPrimary {0% { background-position: center bottom; } 100% { background-position: center 28px; }}
        @keyframes starDriftSecondary {0% { background-position: center bottom; } 100% { background-position: center -22px; }}
        .pressable:hover { transform: translateY(-2px); box-shadow: 0 6px 14px rgba(0,0,0,0.18); }
        .pressable:active { transform: scale(0.96); box-shadow: inset 0 2px 4px rgba(0,0,0,0.2); }
        * { box-sizing: border-box; }
        @media (max-width: 640px) { input[type="date"] { min-width: 0; width: 100%; max-width: 100%; min-height: 44px; box-sizing: border-box; display: block; -webkit-appearance: none; appearance: none; font-size: 16px; line-height: 1.2; } .pressable:hover { transform: none; box-shadow: none; } }
      `}</style>

      <div style={styles.wrapper}><div style={styles.bottomStarField} /><div style={styles.bottomStarFieldSecondary} />
        <!-- remainder unchanged -->
      </div>
    </div>
  );
}