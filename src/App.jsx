import { useEffect, useMemo, useRef, useState } from "react";

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

const TITLE_FONT = '"Fredoka", "Baloo 2", "Nunito", sans-serif';
const BODY_FONT = '"Nunito", "Quicksand", Arial, sans-serif';

const STORAGE_KEY = "tasky_puppy_data_v1";
const BACKUP_KEY = "tasky_puppy_backup_v1";
const BACKUP_META_KEY = "tasky_puppy_backup_meta_v1";
const DARK_MODE_KEY = "tasky_puppy_dark_mode_v1";
const STICKERS_ENABLED_KEY = "tasky_puppy_stickers_enabled_v1";

// legacy keys for migration
const LEGACY_TASKS_KEY = "adhd_tasks_v5";
const LEGACY_ARCHIVE_KEY = "adhd_tasks_archive_v3";
const LEGACY_MANUAL_STARS_KEY = "adhd_tasks_star_count_manual";

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [taskName, setTaskName] = useState("");
  const [notes, setNotes] = useState("");

  const [editingId, setEditingId] = useState(null);
  const [editingTaskName, setEditingTaskName] = useState("");
  const [editingNotes, setEditingNotes] = useState("");

  const [autoSort, setAutoSort] = useState(false);
  const [dragIndex, setDragIndex] = useState(null);
  const [expandedNotes, setExpandedNotes] = useState({});
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

  // null means no manual override is active
  const [starCountManual, setStarCountManual] = useState(null);
  const [showStarTools, setShowStarTools] = useState(false);
  const [editingStarValue, setEditingStarValue] = useState("");
  const [pulseStar, setPulseStar] = useState(false);

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

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth <= 640);
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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
    if (nextOpen) {
      setEditingStarValue(String(displayStarCount));
    }
  }

  function isValidArchivedTask(task, dateKey) {
    if (!dateKey || typeof dateKey !== "string" || !dateKey.trim()) return false;
    if (!task || typeof task !== "object") return false;
    if (!task.name || typeof task.name !== "string" || !task.name.trim()) return false;
    if (!task.completedAt || typeof task.completedAt !== "string" || !task.completedAt.trim()) {
      return false;
    }
    return true;
  }

  function calculateStarCountFromArchive(archive) {
    return Object.entries(archive || {}).reduce((total, [dateKey, list]) => {
      const validCount = (Array.isArray(list) ? list : []).filter((task) =>
        isValidArchivedTask(task, dateKey)
      ).length;
      return total + validCount;
    }, 0);
  }

  function getEffectiveStarTotal(manualValue, calculatedValue) {
    return manualValue !== null ? manualValue : calculatedValue;
  }

  function buildStoragePayload(nextTasks, nextArchive, nextManualStars) {
    const calculated = calculateStarCountFromArchive(nextArchive);

    return {
      app: "TaskyPuppy",
      version: 1,
      savedAt: new Date().toISOString(),
      stars: {
        userModifiedTotal: nextManualStars,
        appCountedTotal: calculated,
        effectiveTotal: getEffectiveStarTotal(nextManualStars, calculated),
      },
      tasks: nextTasks,
      dailyArchive: nextArchive,
    };
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

      let existingMeta = null;
      if (existingMetaRaw) {
        existingMeta = JSON.parse(existingMetaRaw);
      }

      if (existingMeta?.backupDate === todayStamp) {
        return;
      }

      const currentPayload = buildStoragePayload(tasks, dailyArchive, starCountManual);

      localStorage.setItem(BACKUP_KEY, JSON.stringify(currentPayload));
      localStorage.setItem(
        BACKUP_META_KEY,
        JSON.stringify({
          backupDate: todayStamp,
          createdAt: new Date().toISOString(),
        })
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

        setTasks(Array.isArray(parsed.tasks) ? parsed.tasks : []);
        setDailyArchive(
          parsed.dailyArchive && typeof parsed.dailyArchive === "object"
            ? parsed.dailyArchive
            : {}
        );

        const savedManual =
          parsed?.stars?.userModifiedTotal === null ||
          typeof parsed?.stars?.userModifiedTotal === "number"
            ? parsed.stars.userModifiedTotal
            : null;

        setStarCountManual(savedManual);

        const savedDarkMode = localStorage.getItem(DARK_MODE_KEY);
        const savedStickersEnabled = localStorage.getItem(STICKERS_ENABLED_KEY);

        if (savedDarkMode !== null) {
          setDarkMode(savedDarkMode === "true");
        }

        if (savedStickersEnabled !== null) {
          setStickersEnabled(savedStickersEnabled === "true");
        }

        setHasLoadedFromStorage(true);
        return;
      }

      const legacyTasks = localStorage.getItem(LEGACY_TASKS_KEY);
      const legacyArchive = localStorage.getItem(LEGACY_ARCHIVE_KEY);
      const legacyManualStars = localStorage.getItem(LEGACY_MANUAL_STARS_KEY);

      const parsedTasks = legacyTasks ? JSON.parse(legacyTasks) : [];
      const parsedArchive = legacyArchive ? JSON.parse(legacyArchive) : {};

      setTasks(Array.isArray(parsedTasks) ? parsedTasks : []);
      setDailyArchive(parsedArchive && typeof parsedArchive === "object" ? parsedArchive : {});

      if (legacyManualStars !== null) {
        const parsedManual = parseInt(legacyManualStars, 10);
        setStarCountManual(Number.isNaN(parsedManual) ? null : parsedManual);
      } else {
        setStarCountManual(null);
      }

      const savedDarkMode = localStorage.getItem(DARK_MODE_KEY);
      const savedStickersEnabled = localStorage.getItem(STICKERS_ENABLED_KEY);

      if (savedDarkMode !== null) {
        setDarkMode(savedDarkMode === "true");
      }

      if (savedStickersEnabled !== null) {
        setStickersEnabled(savedStickersEnabled === "true");
      }
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
      if (!hasLoadedFromStorage) return;
      if (!event.key) return;

      try {
        if (event.key === STORAGE_KEY && event.newValue) {
          const parsed = JSON.parse(event.newValue);

          setTasks(Array.isArray(parsed.tasks) ? parsed.tasks : []);
          setDailyArchive(
            parsed.dailyArchive && typeof parsed.dailyArchive === "object"
              ? parsed.dailyArchive
              : {}
          );

          setStarCountManual(
            parsed?.stars?.userModifiedTotal === null ||
            typeof parsed?.stars?.userModifiedTotal === "number"
              ? parsed.stars.userModifiedTotal
              : null
          );
        }

        if (event.key === DARK_MODE_KEY && event.newValue !== null) {
          setDarkMode(event.newValue === "true");
        }

        if (event.key === STICKERS_ENABLED_KEY && event.newValue !== null) {
          setStickersEnabled(event.newValue === "true");
        }
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
      const payload = buildStoragePayload(tasks, dailyArchive, starCountManual);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      console.error("Failed to save TaskyPuppy data:", error);
    }
  }, [tasks, dailyArchive, starCountManual, hasLoadedFromStorage]);

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
      const random =
        defaultStickerPack[Math.floor(Math.random() * defaultStickerPack.length)];
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

  function addTask() {
    if (!taskName.trim()) return;

    createDailyRecoveryBackup();

    const now = new Date().toLocaleString();

    const newTask = {
      id: Date.now(),
      name: taskName,
      notes,
      done: false,
      star: false,
      critical: false,
      createdAt: now,
      notesUpdatedAt: null,
    };

    setTasks([...tasks, newTask]);
    setTaskName("");
    setNotes("");
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
      setStarParticles((prev) =>
        prev.filter((star) => !stars.some((batchStar) => batchStar.id === star.id))
      );
    }, 1200);
  }

  function triggerSticker(x, y) {
    if (!stickersEnabled || stickers.length === 0) return;

    const sticker = stickers[Math.floor(Math.random() * stickers.length)];
    const id = Date.now() + Math.random();

    spawnStars(x, y);

    const newSticker = {
      src: sticker,
      x,
      y,
      rotation: (Math.random() - 0.5) * 90,
      id,
    };

    setActiveStickers((prev) => [...prev, newSticker]);

    setTimeout(() => {
      setActiveStickers((prev) => prev.filter((stickerItem) => stickerItem.id !== id));
    }, 1800);
  }

  function handleTitleStickerClick(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    triggerSticker(rect.left + rect.width / 2, rect.top + rect.height / 2 - 12);
  }

  function completeTask(task, e) {
    createDailyRecoveryBackup();

    const rect = e.currentTarget.getBoundingClientRect();
    triggerSticker(rect.left + rect.width / 2, rect.top - 12);

    setCompletingIds((prev) => ({ ...prev, [task.id]: true }));

    setTimeout(() => {
      const key = todayKey();

      const archived = {
        ...task,
        done: true,
        completedAt: new Date().toLocaleString(),
        archivedDateISO: todayISO(),
      };

      setDailyArchive((a) => ({
        ...a,
        [key]: [...(a[key] || []), archived],
      }));

      setTasks((prev) => prev.filter((t) => t.id !== task.id));

      setCompletingIds((prev) => {
        const copy = { ...prev };
        delete copy[task.id];
        return copy;
      });

      setPulseStar(true);
      setTimeout(() => setPulseStar(false), 600);
    }, 450);
  }

  function undoFromArchive(task, date) {
    createDailyRecoveryBackup();

    setDailyArchive((prev) => {
      const next = {
        ...prev,
        [date]: (prev[date] || []).filter((t) => t.id !== task.id),
      };

      if (next[date]?.length === 0) {
        delete next[date];
      }

      return next;
    });

    setTasks((prev) => [{ ...task, done: false }, ...prev]);
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

      setTasks(Array.isArray(parsed.tasks) ? parsed.tasks : []);
      setDailyArchive(
        parsed.dailyArchive && typeof parsed.dailyArchive === "object"
          ? parsed.dailyArchive
          : {}
      );
      setStarCountManual(
        parsed?.stars?.userModifiedTotal === null ||
        typeof parsed?.stars?.userModifiedTotal === "number"
          ? parsed.stars.userModifiedTotal
          : null
      );

      setExpandedNotes({});
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
    const confirmation = window.prompt(
      [
        "Delete all local Tasky Puppy data?",
        "",
        "This will permanently remove from this browser on this device:",
        "- active tasks",
        "- archive history",
        "- manual star total",
        "- emergency restore backup",
        "- older legacy saved data",
        "- dark mode preference",
        "- sticker on/off preference",
        "",
        "Export a JSON backup first if you may want this data later.",
        "",
        "To confirm, type exactly: Bark Woof Meow Yowl",
      ].join("\n")
    );

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
      localStorage.removeItem(LEGACY_TASKS_KEY);
      localStorage.removeItem(LEGACY_ARCHIVE_KEY);
      localStorage.removeItem(LEGACY_MANUAL_STARS_KEY);

      setTasks([]);
      setTaskName("");
      setNotes("");
      setEditingId(null);
      setEditingTaskName("");
      setEditingNotes("");
      setExpandedNotes({});
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

      window.alert("All local Tasky Puppy data was deleted from this browser.");
    } catch (error) {
      console.error("Failed to delete TaskyPuppy data:", error);
      window.alert("Something went wrong while deleting local data.");
    }
  }

  function deleteTask(id) {
    createDailyRecoveryBackup();
    setTasks(tasks.filter((t) => t.id !== id));
  }

  function toggleStar(id) {
    createDailyRecoveryBackup();
    setTasks(tasks.map((t) => (t.id === id ? { ...t, star: !t.star } : t)));
  }

  function toggleCritical(id) {
    createDailyRecoveryBackup();
    setTasks(tasks.map((t) => (t.id === id ? { ...t, critical: !t.critical } : t)));
  }

  function startEdit(task) {
    setEditingId(task.id);
    setEditingTaskName(task.name);
    setEditingNotes(task.notes || "");
  }

  function saveNotes(id) {
    createDailyRecoveryBackup();

    const now = new Date().toLocaleString();

    setTasks(
      tasks.map((t) =>
        t.id === id
          ? {
              ...t,
              name: editingTaskName.trim() || t.name,
              notes: editingNotes,
              notesUpdatedAt: now,
            }
          : t
      )
    );

    setEditingId(null);
    setEditingTaskName("");
    setEditingNotes("");
  }

  function toggleNotes(taskId) {
    setExpandedNotes((prev) => ({ ...prev, [taskId]: !prev[taskId] }));
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

  function sortTasks(list) {
    if (!autoSort) return list;

    return [...list].sort((a, b) => {
      if (a.critical !== b.critical) return Number(b.critical) - Number(a.critical);
      if (a.star !== b.star) return Number(b.star) - Number(a.star);
      return 0;
    });
  }

  function getTaskPriority(task) {
    if (task.critical) return 2;
    if (task.star) return 1;
    return 0;
  }

  function priorityStyle(task) {
    const style = {
      borderLeft: "4px solid transparent",
    };

    if (task.critical) {
      style.borderLeft = darkMode ? "4px solid #f87171" : "4px solid #ef4444";
    } else if (task.star) {
      style.borderLeft = darkMode ? "4px solid #fcd34d" : "4px solid #facc15";
    }

    return style;
  }

  function exportJSON() {
    const exportPayload = {
      stars: {
        userModifiedTotal: starCountManual,
        appCountedTotal: starCountCalculated,
        effectiveTotal: displayStarCount,
      },
      app: "TaskyPuppy",
      exportedAt: new Date().toISOString(),
      version: 1,
      tasks,
      dailyArchive,
    };

    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
      type: "application/json",
    });

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

  async function handleStickerFolder(e) {
    const files = Array.from(e.target.files || []);
    const imageFiles = files.filter((f) => f.type.startsWith("image/"));

    if (imageFiles.length === 0) {
      setStickerMessage("No image files were found.");
      return;
    }

    const validFiles = [];
    let rejectedCount = 0;

    for (const file of imageFiles) {
      const isValid = await validateImageDimensions(file);
      if (isValid) validFiles.push(file);
      else rejectedCount += 1;
    }

    const urls = validFiles.map((file) => URL.createObjectURL(file));
    setUploadedStickers(urls);

    if (validFiles.length > 0 && rejectedCount > 0) {
      setStickerMessage(
        `Loaded ${validFiles.length} sticker(s). Skipped ${rejectedCount} file(s) over 512×512.`
      );
    } else if (validFiles.length > 0) {
      setStickerMessage(`Loaded ${validFiles.length} sticker(s).`);
    } else {
      setStickerMessage("No valid stickers found. Images must be 512×512 or smaller.");
    }

    e.target.value = "";
  }

  function notePreview(text) {
    if (!text) return "";
    if (text.length <= 80) return text;
    return text.substring(0, 80) + "...";
  }

  function mergeUniqueById(listA, listB) {
    const map = new Map();
    [...listA, ...listB].forEach((item) => {
      map.set(item.id, item);
    });
    return Array.from(map.values());
  }

  function mergeArchives(currentArchive, importedArchive) {
    const merged = { ...currentArchive };

    for (const [date, importedList] of Object.entries(importedArchive || {})) {
      const currentList = merged[date] || [];
      merged[date] = mergeUniqueById(currentList, importedList);
    }

    return merged;
  }

  function normalizeImportData(data) {
    const importedArchive =
      data.dailyArchive && typeof data.dailyArchive === "object"
        ? data.dailyArchive
        : {};

    const importedCalculated = calculateStarCountFromArchive(importedArchive);

    let importedManual = null;

    if (data.stars && typeof data.stars === "object") {
      if (
        data.stars.userModifiedTotal === null ||
        typeof data.stars.userModifiedTotal === "number"
      ) {
        importedManual = data.stars.userModifiedTotal;
      } else if (typeof data.stars.manual === "number") {
        importedManual = data.stars.manual;
      }
    }

    return {
      tasks: Array.isArray(data.tasks) ? data.tasks : [],
      dailyArchive: importedArchive,
      starCountManual: importedManual,
      starCountCalculated: importedCalculated,
    };
  }

  async function handleImportFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const imported = normalizeImportData(parsed);

      const mode = window.prompt(
        [
          "Import backup mode:",
          "",
          "Type REPLACE to overwrite your current queue, archive history, and star counts.",
          "Type MERGE to combine the imported backup with your current data.",
          "",
          "REPLACE is safest if you want to restore a full backup.",
          "MERGE may create duplicates if similar cards exist in both files.",
          "",
          "Type REPLACE or MERGE:",
        ].join("\n")
      );

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

        setTasks(mergedTasks);
        setDailyArchive(mergedArchive);
        setStarCountManual(currentManualForMerge + importedManualForMerge);

        window.alert(
          "Backup merged. Review your queue and archive for duplicates if the two datasets overlapped."
        );
      }
    } catch {
      window.alert("That file could not be imported. Please choose a valid TaskyPuppy JSON backup.");
    } finally {
      e.target.value = "";
    }
  }

  function normalizeToISODate(value) {
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
      const localMidnight = new Date(
        parsed.getFullYear(),
        parsed.getMonth(),
        parsed.getDate()
      );
      return [
        localMidnight.getFullYear(),
        String(localMidnight.getMonth() + 1).padStart(2, "0"),
        String(localMidnight.getDate()).padStart(2, "0"),
      ].join("-");
    }

    return "";
  }

  function parseArchiveISO(task, dateKey) {
    if (task?.archivedDateISO) {
      return normalizeToISODate(task.archivedDateISO);
    }

    if (task?.completedAt) {
      const completedISO = normalizeToISODate(task.completedAt);
      if (completedISO) return completedISO;
    }

    return normalizeToISODate(dateKey);
  }

  function getArchiveGroupISO(dateKey, list) {
    const dates = (Array.isArray(list) ? list : [])
      .map((task) => parseArchiveISO(task, dateKey))
      .filter(Boolean)
      .sort((a, b) => b.localeCompare(a));

    if (dates.length > 0) return dates[0];
    return normalizeToISODate(dateKey);
  }

  const hasArchiveFilters =
    archiveSearch.trim() !== "" || archiveStartDate !== "" || archiveEndDate !== "";

  const filteredTasks = tasks.filter((t) => {
    const q = queueSearch.toLowerCase();
    return t.name.toLowerCase().includes(q) || (t.notes || "").toLowerCase().includes(q);
  });

  let sortedTasks = [...filteredTasks];

  if (nextTaskMode) {
    sortedTasks.sort((a, b) => {
      const priorityDiff = getTaskPriority(b) - getTaskPriority(a);
      if (priorityDiff !== 0) return priorityDiff;
      return a.id - b.id;
    });
  } else {
    sortedTasks = sortTasks(sortedTasks);
  }

  const archiveGroups = Object.entries(dailyArchive)
    .map(([date, list]) => {
      const safeList = Array.isArray(list) ? list : [];
      const groupISO = getArchiveGroupISO(date, safeList);

      return {
        date,
        list: safeList,
        groupISO,
      };
    })
    .filter((entry) => entry.list.length > 0)
    .sort((a, b) => b.groupISO.localeCompare(a.groupISO));

  const archiveEntries = hasArchiveFilters
    ? archiveGroups
        .map((entry) => {
          const filtered = entry.list.filter((task) => {
            const q = archiveSearch.toLowerCase();
            const taskISO = parseArchiveISO(task, entry.date) || entry.groupISO;

            const matchesSearch =
              task.name.toLowerCase().includes(q) ||
              (task.notes || "").toLowerCase().includes(q);

            const matchesStart =
              !archiveStartDate || (taskISO && taskISO >= archiveStartDate);

            const matchesEnd =
              !archiveEndDate || (taskISO && taskISO <= archiveEndDate);

            return matchesSearch && matchesStart && matchesEnd;
          });

          return {
            ...entry,
            list: filtered,
          };
        })
        .filter((entry) => entry.list.length > 0)
    : archiveGroups.slice(0, 7);

  const galleryStickers = stickers.map((src, index) => ({
    id: `${src}-${index}`,
    src,
  }));

  const hasUploadedGalleryStickers = uploadedStickers.length > 0;

  const theme = darkMode
    ? {
        pageBg: "linear-gradient(180deg, #0f172a 0%, #162033 35%, #1b263b 100%)",
        cardBg: "linear-gradient(180deg, #1d2a3f 0%, #22324a 100%)",
        cardBgSoft: "#23324a",
        panelBg: "linear-gradient(180deg, #1d2a3f 0%, #22324a 100%)",
        border: "#3b4f6a",
        borderSoft: "#4a5d78",
        text: "#e5eefc",
        title: "#9bc4ff",
        muted: "#a9bdd8",
        inputBg: "#162033",
        inputBorder: "#41546f",
        inputText: "#f8fbff",
        buttonBg: "#22324a",
        buttonBorder: "#4b6584",
        buttonText: "#dbeafe",
        buttonPrimaryBg: "linear-gradient(180deg, #4f8fd8 0%, #3b73b9 100%)",
        buttonPrimaryBorder: "#72a7e5",
        buttonPrimaryText: "#ffffff",
        noteBg: "#162033",
        noteBorder: "#3b4f6a",
        noteText: "#d7e4f7",
        dangerBg: "linear-gradient(180deg, #3a2328 0%, #47292f 100%)",
        dangerBorder: "#8b5a63",
        dangerText: "#ffd7df",
        footerBorder: "#3b4f6a",
        starTint: "rgba(147, 197, 253, 0.16)",
        starActiveBg: "linear-gradient(180deg, #ffe58f 0%, #facc15 100%)",
        starActiveBorder: "#fbbf24",
        starActiveText: "#1f2937",
        urgentActiveBg: "linear-gradient(180deg, #ffb072 0%, #fb923c 100%)",
        urgentActiveBorder: "#f97316",
        urgentActiveText: "#1f2937",
      }
    : {
        pageBg: "linear-gradient(180deg, #eef6ff 0%, #f8fbff 35%, #f4f8fc 100%)",
        cardBg: "linear-gradient(180deg, #ffffff 0%, #f7fbff 100%)",
        cardBgSoft: "#ffffff",
        panelBg: "linear-gradient(180deg, #ffffff 0%, #f7fbff 100%)",
        border: "#dbeafe",
        borderSoft: "#bfdbfe",
        text: "#1f2937",
        title: "#1e3a8a",
        muted: "#64748b",
        inputBg: "#ffffff",
        inputBorder: "#cbd5e1",
        inputText: "#0f172a",
        buttonBg: "#f8fbff",
        buttonBorder: "#bfdbfe",
        buttonText: "#1e3a8a",
        buttonPrimaryBg: "linear-gradient(180deg, #60a5fa 0%, #3b82f6 100%)",
        buttonPrimaryBorder: "#60a5fa",
        buttonPrimaryText: "#ffffff",
        noteBg: "#f8fbff",
        noteBorder: "#e0f2fe",
        noteText: "#475569",
        dangerBg: "linear-gradient(180deg, #fff4f5 0%, #ffe8eb 100%)",
        dangerBorder: "#f7b6c2",
        dangerText: "#8a1c35",
        footerBorder: "#dbeafe",
        starTint: "rgba(96, 165, 250, 0.18)",
        starActiveBg: "linear-gradient(180deg, #fde68a 0%, #facc15 100%)",
        starActiveBorder: "#f59e0b",
        starActiveText: "#1f2937",
        urgentActiveBg: "linear-gradient(180deg, #fdba74 0%, #fb923c 100%)",
        urgentActiveBorder: "#ea580c",
        urgentActiveText: "#1f2937",
      };

  const styles = {
    page: {
      minHeight: "100vh",
      background: theme.pageBg,
      padding: isMobile ? "16px 12px 24px" : "24px",
      fontFamily: BODY_FONT,
      display: "flex",
      justifyContent: "center",
      color: theme.text,
      boxSizing: "border-box",
    },
    wrapper: {
      width: "100%",
      maxWidth: "1020px",
      position: "relative",
      minWidth: 0,
    },
    row: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      flexWrap: "wrap",
      minWidth: 0,
    },
    topBar: {
      display: "grid",
      gap: isMobile ? "8px" : "10px",
      marginBottom: "20px",
    },
    headerMain: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: isMobile ? "center" : "flex-start",
      gap: isMobile ? "12px" : "16px",
      flexWrap: "nowrap",
    },
    titleWrap: {
      display: "flex",
      alignItems: "center",
      gap: isMobile ? "12px" : "18px",
      minWidth: 0,
      transform: isMobile ? "translateY(-1px)" : "none",
    },
    titleMobileRow: {
      marginTop: "2px",
      display: "flex",
      justifyContent: "center",
    },
    titleTextMobile: {
      margin: 0,
      fontSize: "34px",
      color: theme.title,
      fontFamily: TITLE_FONT,
      fontWeight: 800,
      letterSpacing: "0.3px",
      lineHeight: 1.05,
      textAlign: "center",
      whiteSpace: "nowrap",
      transform: "translateY(-2px)",
    },
    headerRight: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: isMobile ? "10px" : "12px",
      minWidth: isMobile ? "150px" : "160px",
      flexShrink: 0,
      transform: isMobile ? "translateY(1px)" : "none",
    },
    headerButtons: {
      display: "flex",
      flexDirection: "column",
      gap: "10px",
      width: "100%",
    },
    headerButton: {
      width: "100%",
      minHeight: "52px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxSizing: "border-box",
    },
    titleSticker: {
      width: isMobile ? "132px" : "140px",
      height: isMobile ? "132px" : "140px",
      objectFit: "contain",
      cursor: "pointer",
      userSelect: "none",
      filter: darkMode
        ? "drop-shadow(0 8px 18px rgba(59, 130, 246, 0.22))"
        : "drop-shadow(0 8px 18px rgba(96, 165, 250, 0.18))",
    },
    card: {
      background: theme.cardBg,
      borderRadius: "18px",
      boxShadow: darkMode
        ? "0 10px 24px rgba(2, 6, 23, 0.28)"
        : "0 6px 20px rgba(148, 163, 184, 0.12)",
      border: `1px solid ${theme.border}`,
      padding: isMobile ? "14px" : "16px",
      marginBottom: "12px",
      position: "relative",
      overflow: "hidden",
      minWidth: 0,
      boxSizing: "border-box",
    },
    cardStars: {
      position: "absolute",
      top: "10px",
      right: "14px",
      fontSize: "12px",
      color: theme.starTint,
      letterSpacing: "4px",
      pointerEvents: "none",
      userSelect: "none",
    },
    input: {
      width: "100%",
      maxWidth: "100%",
      padding: "10px 12px",
      borderRadius: "12px",
      border: `1px solid ${theme.inputBorder}`,
      fontSize: "14px",
      boxSizing: "border-box",
      fontFamily: BODY_FONT,
      background: theme.inputBg,
      color: theme.inputText,
      minWidth: 0,
      display: "block",
    },
    textarea: {
      width: "100%",
      maxWidth: "100%",
      padding: "10px 12px",
      borderRadius: "12px",
      border: `1px solid ${theme.inputBorder}`,
      fontSize: "14px",
      minHeight: "90px",
      resize: "vertical",
      boxSizing: "border-box",
      fontFamily: BODY_FONT,
      background: theme.inputBg,
      color: theme.inputText,
      minWidth: 0,
      display: "block",
    },
    button: {
      padding: "10px 14px",
      borderRadius: "12px",
      border: `1px solid ${theme.buttonBorder}`,
      background: theme.buttonBg,
      color: theme.buttonText,
      cursor: "pointer",
      fontSize: "14px",
      fontFamily: BODY_FONT,
      fontWeight: 700,
      boxSizing: "border-box",
      minHeight: "44px",
      transition: "transform 0.08s ease, box-shadow 0.08s ease, background 0.12s ease",
      touchAction: "manipulation",
    },
    buttonPrimary: {
      padding: "10px 14px",
      borderRadius: "12px",
      border: `1px solid ${theme.buttonPrimaryBorder}`,
      background: theme.buttonPrimaryBg,
      color: theme.buttonPrimaryText,
      cursor: "pointer",
      fontSize: "14px",
      fontFamily: BODY_FONT,
      fontWeight: 700,
      boxShadow: darkMode
        ? "0 6px 16px rgba(59, 130, 246, 0.18)"
        : "0 6px 16px rgba(59, 130, 246, 0.22)",
      boxSizing: "border-box",
      minHeight: "44px",
      transition: "transform 0.08s ease, box-shadow 0.08s ease, background 0.12s ease",
      touchAction: "manipulation",
    },
    smallButton: {
      padding: "8px 12px",
      minHeight: "44px",
      borderRadius: "10px",
      border: `1px solid ${theme.border}`,
      background: theme.cardBgSoft,
      color: theme.buttonText,
      cursor: "pointer",
      fontSize: "13px",
      fontFamily: BODY_FONT,
      fontWeight: 700,
      boxSizing: "border-box",
      transition: "transform 0.08s ease, box-shadow 0.08s ease, background 0.12s ease",
      touchAction: "manipulation",
    },
    taskName: {
      fontWeight: 800,
      margin: 0,
      color: theme.text,
    },
    muted: {
      color: theme.muted,
      fontSize: "12px",
    },
    noteText: {
      color: theme.noteText,
      fontSize: "14px",
      whiteSpace: "pre-wrap",
      marginTop: "6px",
      background: theme.noteBg,
      border: `1px solid ${theme.noteBorder}`,
      borderRadius: "10px",
      padding: "10px",
      minWidth: 0,
      overflowWrap: "anywhere",
      boxSizing: "border-box",
    },
    stickerMenu: {
      position: "absolute",
      right: 0,
      top: "58px",
      width: isMobile ? "min(380px, calc(100vw - 24px))" : "min(380px, calc(100vw - 32px))",
      background: theme.panelBg,
      borderRadius: "16px",
      boxShadow: darkMode
        ? "0 16px 36px rgba(2, 6, 23, 0.35)"
        : "0 16px 36px rgba(148, 163, 184, 0.22)",
      padding: isMobile ? "12px" : "14px",
      zIndex: 10,
      border: `1px solid ${theme.border}`,
      boxSizing: "border-box",
      minWidth: 0,
      overflowX: "hidden",
    },
    stickerMessage: {
      marginTop: "8px",
      fontSize: "12px",
      color: theme.muted,
      lineHeight: 1.4,
      overflowWrap: "anywhere",
    },
    archiveTaskRow: {
      display: "grid",
      gap: "8px",
      minWidth: 0,
    },
    helperText: {
      fontSize: "12px",
      color: theme.muted,
      lineHeight: 1.45,
      overflowWrap: "anywhere",
    },
    galleryGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(74px, 1fr))",
      gap: "10px",
      marginTop: "10px",
    },
    galleryTile: {
      borderRadius: "14px",
      border: `1px solid ${theme.border}`,
      background: theme.cardBgSoft,
      padding: "8px",
      display: "grid",
      gap: "6px",
      justifyItems: "center",
      transition: "transform 0.18s ease, box-shadow 0.18s ease",
      minHeight: "84px",
    },
    galleryThumb: {
      width: "56px",
      height: "56px",
      objectFit: "contain",
      transition: "transform 0.18s ease",
      pointerEvents: "auto",
      userSelect: "none",
    },
    galleryExpandedOverlay: {
      position: "fixed",
      inset: 0,
      background: darkMode ? "rgba(2, 6, 23, 0.62)" : "rgba(15, 23, 42, 0.38)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9998,
      padding: "24px",
    },
    galleryExpandedCard: {
      background: theme.cardBgSoft,
      borderRadius: "20px",
      border: `1px solid ${theme.border}`,
      boxShadow: darkMode
        ? "0 20px 50px rgba(2, 6, 23, 0.45)"
        : "0 20px 50px rgba(15, 23, 42, 0.2)",
      padding: "18px",
      maxWidth: "min(92vw, 560px)",
      maxHeight: "90vh",
      display: "grid",
      gap: "10px",
      justifyItems: "center",
    },
    galleryExpandedImage: {
      maxWidth: "min(80vw, 512px)",
      maxHeight: "70vh",
      objectFit: "contain",
    },
    footerText: {
      fontSize: "14px",
      lineHeight: 1.65,
      color: theme.muted,
      overflowWrap: "anywhere",
    },
    infoPanel: {
      position: "absolute",
      right: 0,
      top: "48px",
      width: isMobile ? "min(400px, calc(100vw - 24px))" : "min(380px, calc(100vw - 32px))",
      background: theme.panelBg,
      borderRadius: "16px",
      boxShadow: darkMode
        ? "0 16px 36px rgba(2, 6, 23, 0.35)"
        : "0 16px 36px rgba(148, 163, 184, 0.22)",
      padding: isMobile ? "12px" : "14px",
      zIndex: 10,
      border: `1px solid ${theme.border}`,
      boxSizing: "border-box",
      minWidth: 0,
      overflowX: "hidden",
    },
    starPanel: {
      position: "absolute",
      right: 0,
      top: "34px",
      width: isMobile ? "min(320px, calc(100vw - 24px))" : "min(300px, calc(100vw - 32px))",
      background: theme.panelBg,
      borderRadius: "16px",
      boxShadow: darkMode
        ? "0 16px 36px rgba(2, 6, 23, 0.35)"
        : "0 16px 36px rgba(148, 163, 184, 0.22)",
      padding: isMobile ? "12px" : "14px",
      zIndex: 10,
      border: `1px solid ${theme.border}`,
      boxSizing: "border-box",
      minWidth: 0,
      overflowX: "hidden",
    },
    panelActionRow: {
      display: "grid",
      gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))",
      gap: "8px",
      marginBottom: "12px",
      width: "100%",
      minWidth: 0,
    },
    panelActionButton: {
      padding: "10px 8px",
      borderRadius: "12px",
      border: `1px solid ${theme.buttonBorder}`,
      background: theme.buttonBg,
      color: theme.buttonText,
      cursor: "pointer",
      fontSize: "12px",
      fontFamily: BODY_FONT,
      fontWeight: 700,
      whiteSpace: "normal",
      textAlign: "center",
      lineHeight: 1.15,
      overflowWrap: "anywhere",
      boxSizing: "border-box",
      minHeight: "44px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: "100%",
      maxWidth: "100%",
      transition: "transform 0.08s ease, box-shadow 0.08s ease, background 0.12s ease",
      touchAction: "manipulation",
    },
    detailsToggle: {
      padding: "8px 10px",
      minHeight: "44px",
      borderRadius: "10px",
      border: `1px solid ${theme.border}`,
      background: theme.cardBgSoft,
      color: theme.buttonText,
      cursor: "pointer",
      fontSize: "13px",
      fontFamily: BODY_FONT,
      fontWeight: 700,
      boxSizing: "border-box",
      transition: "transform 0.08s ease, box-shadow 0.08s ease, background 0.12s ease",
      touchAction: "manipulation",
    },
    footerBar: {
      marginTop: "18px",
      padding: "10px 14px",
      borderTop: `1px solid ${theme.footerBorder}`,
      display: "grid",
      gap: "6px",
      justifyItems: "center",
      color: theme.muted,
      fontSize: "12px",
    },
    footerBarText: {
      color: theme.muted,
      fontSize: "12px",
      lineHeight: 1.5,
      textAlign: "center",
    },
    footerLinkRow: {
      display: "flex",
      flexWrap: "wrap",
      gap: "12px",
      alignItems: "center",
      justifyContent: "center",
    },
    footerBarLink: {
      color: darkMode ? "#9ec9ff" : "#2563eb",
      textDecoration: "none",
      fontWeight: 700,
      fontSize: "12px",
    },
    footerDivider: {
      color: theme.muted,
      fontSize: "12px",
    },
    starActionRow: {
      display: "grid",
      gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))",
      gap: "8px",
      marginTop: "10px",
      width: "100%",
      minWidth: 0,
    },
    starActionButton: {
      padding: "10px 6px",
      borderRadius: "12px",
      border: `1px solid ${theme.buttonBorder}`,
      background: theme.buttonBg,
      color: theme.buttonText,
      cursor: "pointer",
      fontSize: "12px",
      fontFamily: BODY_FONT,
      fontWeight: 700,
      whiteSpace: "normal",
      textAlign: "center",
      lineHeight: 1.15,
      overflowWrap: "anywhere",
      boxSizing: "border-box",
      minHeight: "44px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: "100%",
      transition: "transform 0.08s ease, box-shadow 0.08s ease, background 0.12s ease",
      touchAction: "manipulation",
    },
    dangerSection: {
      marginTop: "12px",
      padding: "12px",
      borderRadius: "14px",
      border: `1px solid ${theme.dangerBorder}`,
      background: theme.dangerBg,
      display: "grid",
      gap: "8px",
      minWidth: 0,
      overflowX: "hidden",
    },
    dangerText: {
      fontSize: "12px",
      lineHeight: 1.5,
      color: theme.dangerText,
      overflowWrap: "anywhere",
    },
    dangerButton: {
      padding: "10px 14px",
      borderRadius: "12px",
      border: `1px solid ${theme.dangerBorder}`,
      background: darkMode ? "#512e35" : "#fff0f2",
      color: theme.dangerText,
      cursor: "pointer",
      fontSize: "13px",
      fontFamily: BODY_FONT,
      fontWeight: 800,
      width: "100%",
      boxSizing: "border-box",
      minHeight: "44px",
      transition: "transform 0.08s ease, box-shadow 0.08s ease, background 0.12s ease",
      touchAction: "manipulation",
    },
    archiveCompactCard: {
      background: theme.cardBgSoft,
      border: `1px solid ${theme.border}`,
      borderRadius: "14px",
      padding: "10px 12px",
      display: "grid",
      gap: "8px",
      boxShadow: darkMode
        ? "0 6px 14px rgba(2, 6, 23, 0.16)"
        : "0 3px 8px rgba(148, 163, 184, 0.08)",
      minWidth: 0,
      boxSizing: "border-box",
    },
    archiveCardHeader: {
      display: "flex",
      justifyContent: "space-between",
      gap: "10px",
      alignItems: "center",
      minWidth: 0,
    },
    archiveTitleRow: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      flexWrap: "wrap",
      minWidth: 0,
      flex: 1,
    },
    archiveTaskName: {
      color: theme.text,
      fontWeight: 800,
      fontSize: "14px",
      lineHeight: 1.3,
      overflowWrap: "anywhere",
    },
    archiveInlineNoteButton: {
      padding: "6px 10px",
      minHeight: "36px",
      borderRadius: "999px",
      border: `1px solid ${theme.border}`,
      background: "transparent",
      color: theme.muted,
      cursor: "pointer",
      fontSize: "11px",
      fontFamily: BODY_FONT,
      fontWeight: 600,
      lineHeight: 1.2,
      boxSizing: "border-box",
      transition: "transform 0.08s ease, box-shadow 0.08s ease, background 0.12s ease",
      touchAction: "manipulation",
    },
    archiveUndoButton: {
      padding: "8px 12px",
      minHeight: "44px",
      borderRadius: "10px",
      border: `1px solid ${theme.border}`,
      background: theme.cardBgSoft,
      color: theme.buttonText,
      cursor: "pointer",
      fontSize: "12px",
      fontFamily: BODY_FONT,
      fontWeight: 700,
      flexShrink: 0,
      boxSizing: "border-box",
      transition: "transform 0.08s ease, box-shadow 0.08s ease, background 0.12s ease",
      touchAction: "manipulation",
    },
    archiveFilterGrid: {
      display: "grid",
      gap: "10px",
      gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(180px, 1fr))",
      width: "100%",
      minWidth: 0,
    },
    archiveFilterCell: {
      minWidth: 0,
      width: "100%",
      boxSizing: "border-box",
    },
    archiveFilterAction: {
      display: "flex",
      alignItems: "end",
      minWidth: 0,
      width: "100%",
    },
    fullWidthButton: {
      width: "100%",
      maxWidth: "100%",
      boxSizing: "border-box",
    },
    controlsRow: {
      ...{
        display: "flex",
        flexWrap: "wrap",
        gap: "8px",
        marginBottom: "14px",
        position: "relative",
        alignItems: "center",
        justifyContent: isMobile ? "center" : "flex-start",
      },
    },
    taskHeaderRow: {
      display: "grid",
      gridTemplateColumns: "1fr",
      gap: "10px",
      minWidth: 0,
    },
    taskTitleRow: {
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: "10px",
      minWidth: 0,
    },
    taskActionRow: {
      display: "flex",
      flexWrap: "wrap",
      gap: "8px",
      justifyContent: isMobile ? "center" : "flex-start",
      minWidth: 0,
    },
  };

  function interactivePressStyle(baseStyle) {
    return {
      ...baseStyle,
    };
  }

  function starToggleStyle(isActive) {
    return {
      ...styles.smallButton,
      background: isActive ? theme.starActiveBg : styles.smallButton.background,
      border: `1px solid ${isActive ? theme.starActiveBorder : theme.border}`,
      color: isActive ? theme.starActiveText : styles.smallButton.color,
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

  return (
    <div style={styles.page}>
      {expandedGallerySticker && (
        <div
          style={styles.galleryExpandedOverlay}
          onClick={() => setExpandedGallerySticker(null)}
        >
          <div
            style={styles.galleryExpandedCard}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={expandedGallerySticker.src}
              alt="Expanded sticker preview"
              style={styles.galleryExpandedImage}
            />
            <button
              className="pressable"
              style={styles.button}
              onClick={() => setExpandedGallerySticker(null)}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {activeStickers.map((sticker) => (
        <img
          key={sticker.id}
          alt="sticker"
          src={sticker.src}
          style={{
            position: "fixed",
            left: sticker.x,
            top: sticker.y,
            width: 120,
            transform: `translate(-50%,0) rotate(${sticker.rotation}deg)`,
            pointerEvents: "none",
            animation: "stickerLaunch 1.8s ease-out forwards",
            zIndex: 9999,
          }}
        />
      ))}

      {starParticles.map((star) => (
        <div
          key={star.id}
          style={{
            position: "fixed",
            left: star.x,
            top: star.y,
            pointerEvents: "none",
            transform: "translate(-50%, -50%)",
            animation: "starFly 1.2s ease-out forwards",
            ["--dx"]: `${star.dx}px`,
            ["--dy"]: `${star.dy}px`,
            fontSize: `${star.size}px`,
            zIndex: 9999,
          }}
        >
          {star.symbol}
        </div>
      ))}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@400;600;700&family=Fredoka:wght@400;500;600;700&family=Nunito:wght@400;600;700;800&family=Quicksand:wght@400;500;600;700&display=swap');

        @keyframes stickerLaunch {
          0% { transform: translate(-50%,0) scale(0.9) rotate(0deg); opacity:1 }
          30% { transform: translate(-50%,-120px) rotate(8deg) }
          60% { transform: translate(-50%,-90px) rotate(-6deg) }
          100% { transform: translate(-50%,-200px) rotate(12deg); opacity:0 }
        }

        @keyframes starFly {
          0% { transform: translate(-50%, -50%); opacity:1 }
          100% { transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))); opacity:0 }
        }

        @keyframes pulseLite {
          0% { transform: scale(1); }
          50% { transform: scale(1.15); }
          100% { transform: scale(1); }
        }

        @keyframes taskCompleteOut {
          0% {
            opacity: 1;
            transform: translateX(0);
            max-height: 300px;
            margin-bottom: 12px;
          }
          100% {
            opacity: 0;
            transform: translateX(40px);
            max-height: 0;
            margin-bottom: 0;
          }
        }

        @keyframes mascotIdle {
          0% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-6px) rotate(-2deg); }
          100% { transform: translateY(0px) rotate(0deg); }
        }

        @keyframes galleryFadeIn {
          0% { opacity: 0; transform: translateY(4px); }
          100% { opacity: 1; transform: translateY(0); }
        }

        .pressable:active {
          transform: scale(0.96);
          box-shadow: inset 0 2px 4px rgba(0,0,0,0.2);
        }

        @media (max-width: 640px) {
          input[type="date"] {
            min-width: 0;
            width: 100%;
            max-width: 100%;
            box-sizing: border-box;
            display: block;
          }
        }
      `}</style>

      <div style={styles.wrapper}>
        <input
          ref={importInputRef}
          type="file"
          accept="application/json,.json"
          onChange={handleImportFile}
          style={{ display: "none" }}
        />

        <div style={styles.topBar}>
          <div style={styles.headerMain}>
            <div style={styles.titleWrap}>
              {titleSticker ? (
                <img
                  src={titleSticker}
                  alt="Tasky Puppy mascot"
                  style={{
                    ...styles.titleSticker,
                    animation: "mascotIdle 5s ease-in-out infinite",
                  }}
                  onClick={handleTitleStickerClick}
                  title="Click for a little reward boost. Works when Stickers are turned on."
                />
              ) : (
                <div
                  style={{
                    ...styles.titleSticker,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "72px",
                    animation: "mascotIdle 5s ease-in-out infinite",
                  }}
                  onClick={handleTitleStickerClick}
                  title="Click for a little reward boost. Works when Stickers are turned on."
                >
                  🐶
                </div>
              )}

              {!isMobile && (
                <h1
                  style={{
                    margin: 0,
                    fontSize: "34px",
                    color: theme.title,
                    fontFamily: TITLE_FONT,
                    fontWeight: 800,
                    letterSpacing: "0.3px",
                    whiteSpace: "nowrap",
                    transform: "translateY(-2px)",
                  }}
                >
                  Tasky Puppy ⭐
                </h1>
              )}
            </div>

            <div style={{ ...styles.headerRight, position: "relative" }}>
              <div style={{ position: "relative" }} ref={starPanelRef}>
                <div
                  style={{
                    ...styles.row,
                    justifyContent: "center",
                    fontWeight: 700,
                    animation: pulseStar ? "pulseLite 0.6s ease" : "none",
                    color: theme.title,
                    cursor: "pointer",
                    minHeight: "44px",
                  }}
                  onClick={toggleStarPanel}
                  title="Click to edit stars"
                >
                  <span>⭐</span>
                  <span>{displayStarCount}</span>
                </div>

                {showStarTools && (
                  <div style={styles.starPanel}>
                    <div style={{ fontWeight: 800, color: theme.title, marginBottom: "8px" }}>
                      Star Tools
                    </div>

                    <div style={styles.helperText}>
                      Displayed stars use the manual override when one is set. Otherwise they use
                      the archive-counted total.
                    </div>

                    <div style={{ ...styles.helperText, marginTop: "8px" }}>
                      Manual override:{" "}
                      <strong>{starCountManual === null ? "Off" : starCountManual}</strong>
                    </div>

                    <div style={styles.helperText}>
                      Calculated from archive: <strong>{starCountCalculated}</strong>
                    </div>

                    <div style={styles.helperText}>
                      Displayed total: <strong>{displayStarCount}</strong>
                    </div>

                    <div style={{ display: "grid", gap: "8px", marginTop: "10px", minWidth: 0 }}>
                      <input
                        style={styles.input}
                        type="number"
                        min="0"
                        value={editingStarValue}
                        onChange={(e) => setEditingStarValue(e.target.value)}
                        placeholder="Edit displayed stars"
                      />

                      <div style={styles.starActionRow}>
                        <button
                          className="pressable"
                          style={styles.starActionButton}
                          onClick={applyManualStarCount}
                        >
                          Save Stars
                        </button>

                        <button
                          className="pressable"
                          style={styles.starActionButton}
                          onClick={useCalculatedStarCount}
                        >
                          Use Counted
                        </button>

                        <button
                          className="pressable"
                          style={styles.starActionButton}
                          onClick={resetStarCount}
                        >
                          Reset to 0
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div style={styles.headerButtons}>
                <div style={{ position: "relative" }} ref={stickerPanelRef}>
                  <button
                    className="pressable"
                    onClick={toggleStickerPanel}
                    style={{
                      ...styles.button,
                      ...styles.headerButton,
                      color: stickersEnabled ? (darkMode ? "#a9d0ff" : "#2563eb") : theme.muted,
                    }}
                  >
                    ✨ Stickers
                  </button>

                  {showStickerSettings && (
                    <div style={styles.stickerMenu}>
                      <div
                        style={{
                          ...styles.row,
                          justifyContent: "space-between",
                          marginBottom: "10px",
                        }}
                      >
                        <span style={{ fontWeight: 700, color: theme.title }}>
                          Sticker Settings
                        </span>
                        <button
                          className="pressable"
                          onClick={() => setStickersEnabled(!stickersEnabled)}
                          style={stickersEnabled ? styles.buttonPrimary : styles.button}
                        >
                          {stickersEnabled ? "On" : "Off"}
                        </button>
                      </div>

                      <div style={styles.helperText}>
                        Built-in stickers load automatically from <code>src/assets/stickers</code>.
                      </div>

                      <div style={{ marginTop: "10px" }}>
                        <button
                          className="pressable"
                          style={{ ...styles.button, width: "100%" }}
                          onClick={() => setShowStickerGallery(!showStickerGallery)}
                        >
                          {showStickerGallery
                            ? `Hide Sticker Gallery (${galleryStickers.length})`
                            : `Sticker Gallery (${galleryStickers.length})`}
                        </button>
                      </div>

                      {showStickerGallery && (
                        <div style={{ marginTop: "10px", animation: "galleryFadeIn 0.18s ease" }}>
                          <div style={styles.helperText}>
                            Loaded stickers: {galleryStickers.length}. Hover for a gentle preview.
                            Click or tap a sticker to expand it.
                          </div>

                          {!hasUploadedGalleryStickers && (
                            <div style={{ ...styles.helperText, marginTop: "6px" }}>
                              Built-in
                            </div>
                          )}

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
                                  <img
                                    src={sticker.src}
                                    alt="Sticker preview"
                                    style={{
                                      ...styles.galleryThumb,
                                      transform: isHovered ? "scale(1.15)" : "scale(1)",
                                    }}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {stickersEnabled && (
                        <>
                          <div style={{ marginTop: "12px", ...styles.helperText }}>
                            Use your own stickers! Choose a folder for convenience, or pick image
                            files manually. Use PNG, JPEG, WEBP or GIF. Uploaded stickers must be
                            512×512 or smaller.
                          </div>

                          <div style={{ display: "grid", gap: "8px", marginTop: "8px", minWidth: 0 }}>
                            <label style={styles.helperText}>Choose a folder:</label>
                            <input
                              type="file"
                              multiple
                              webkitdirectory=""
                              directory=""
                              onChange={handleStickerFolder}
                              style={{ minWidth: 0 }}
                            />

                            <label style={styles.helperText}>
                              Or choose image files manually:
                            </label>
                            <input
                              type="file"
                              multiple
                              accept="image/*"
                              onChange={handleStickerFolder}
                              style={{ minWidth: 0 }}
                            />
                          </div>

                          {stickerMessage && (
                            <div style={styles.stickerMessage}>{stickerMessage}</div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>

                <button
                  className="pressable"
                  onClick={() => setDarkMode((prev) => !prev)}
                  style={{
                    ...(darkMode ? styles.buttonPrimary : styles.button),
                    ...styles.headerButton,
                  }}
                  title="Toggle dark mode"
                >
                  {darkMode ? "🌙 Dark" : "☀️ Light"}
                </button>
              </div>
            </div>
          </div>

          {isMobile && (
            <div style={styles.titleMobileRow}>
              <h1 style={styles.titleTextMobile}>Tasky Puppy ⭐</h1>
            </div>
          )}
        </div>

        <div style={styles.controlsRow}>
          <button
            className="pressable"
            style={autoSort ? styles.buttonPrimary : styles.button}
            onClick={() => setAutoSort(!autoSort)}
          >
            Auto Sort
          </button>

          <button
            className="pressable"
            style={nextTaskMode ? styles.buttonPrimary : styles.button}
            onClick={() => setNextTaskMode(!nextTaskMode)}
          >
            Next Task
          </button>

          <div style={{ position: "relative" }} ref={dataPanelRef}>
            <button
              className="pressable"
              style={showDataInfo ? styles.buttonPrimary : styles.button}
              onClick={toggleDataPanel}
            >
              Your Data
            </button>

            {showDataInfo && (
              <div style={styles.infoPanel}>
                <div style={{ fontWeight: 800, color: theme.title, marginBottom: "8px" }}>
                  Your Data
                </div>

                <div style={styles.panelActionRow}>
                  <button className="pressable" style={styles.panelActionButton} onClick={exportJSON}>
                    Export JSON
                  </button>

                  <button
                    className="pressable"
                    style={styles.panelActionButton}
                    onClick={() => importInputRef.current?.click()}
                  >
                    Import JSON
                  </button>

                  <button
                    className="pressable"
                    style={styles.panelActionButton}
                    onClick={restoreRecoveryBackup}
                  >
                    Emergency Restore
                  </button>
                </div>

                <div style={styles.footerText}>
                  Your personal data in this app is intended to be cloud-free. Please make
                  regular copies! Or else!
                </div>

                <div style={{ marginTop: "10px", display: "flex", justifyContent: isMobile ? "center" : "flex-start" }}>
                  <button
                    className="pressable"
                    style={styles.detailsToggle}
                    onClick={() => setShowDataDetails((prev) => !prev)}
                  >
                    {showDataDetails ? "Hide Details" : "Show Details"}
                  </button>
                </div>

                {showDataDetails && (
                  <>
                    <div style={{ ...styles.footerText, marginTop: "10px" }}>
                      On desktop, your data is stored locally in this browser on this device.
                      On mobile, it is also generally stored locally in the browser, but mobile
                      browsers can be less predictable if app or browser data is cleared, the
                      browser is reinstalled, private browsing is used, or the device changes.
                    </div>

                    <div style={{ ...styles.footerText, marginTop: "8px" }}>
                      This means your queue, archive, and progress do not automatically sync
                      between devices. Export backups regularly if you want to preserve your data
                      or move it somewhere else.
                    </div>

                    <div style={{ ...styles.footerText, marginTop: "8px" }}>
                      <strong>Emergency Restore</strong> is the app’s once-per-day local “oops”
                      backup. The first meaningful change you make each day saves a recovery
                      snapshot before that change, and that snapshot stays put for the rest of
                      the day.
                    </div>

                    <div style={{ ...styles.footerText, marginTop: "8px" }}>
                      That makes <strong>Emergency Restore</strong> best for undoing a messy
                      moment from today, using a backup saved locally in this browser on this
                      device.
                    </div>

                    <div style={{ ...styles.footerText, marginTop: "8px" }}>
                      <strong>Import JSON</strong> uses a backup file you picked yourself. It is
                      best for restoring an older save, moving your data to another device, or
                      merging progress from somewhere else.
                    </div>

                    <div style={{ ...styles.footerText, marginTop: "8px" }}>
                      In short: <strong>Emergency Restore</strong> is your local daily “oops”
                      button, while <strong>Import JSON</strong> is your long-term
                      moving-and-backup tool.
                    </div>

                    <div style={{ ...styles.footerText, marginTop: "8px" }}>
                      If you have this app open in multiple tabs or windows on the same browser
                      and same local address, changes should now update across them automatically.
                    </div>

                    <div style={styles.dangerSection}>
                      <div style={styles.dangerText}>
                        <strong>Advanced action:</strong> Need a full fresh start? This deletes
                        all local Tasky Puppy data from this browser on this device, including
                        your queue, archive, stars, emergency restore backup, and interface
                        preferences.
                      </div>

                      <button className="pressable" style={styles.dangerButton} onClick={deleteAllData}>
                        Delete All Data
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div style={{ marginBottom: "12px" }}>
          <input
            style={styles.input}
            placeholder="Search active tasks..."
            value={queueSearch}
            onChange={(e) => setQueueSearch(e.target.value)}
          />
        </div>

        <div style={styles.card}>
          <div style={styles.cardStars}>✦ ✦</div>
          <div style={{ display: "grid", gap: "12px" }}>
            <input
              style={styles.input}
              placeholder="Task name"
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
            />

            <textarea
              style={styles.textarea}
              placeholder="Notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />

            <button className="pressable" style={styles.buttonPrimary} onClick={addTask}>
              Add Task
            </button>
          </div>
        </div>

        <div>
          {sortedTasks.map((task, index) => {
            const isNextTask = nextTaskMode && index === 0;

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
                  animation: completingIds[task.id]
                    ? "taskCompleteOut 0.45s ease forwards"
                    : "none",
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
                <div style={styles.cardStars}>✦</div>

                <div style={styles.taskHeaderRow}>
                  <div style={styles.taskTitleRow}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: 0 }}>
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
                      <p style={{ ...styles.taskName, overflowWrap: "anywhere" }}>{task.name}</p>
                    </div>
                  </div>

                  <div style={styles.taskActionRow}>
                    <button
                      className="pressable"
                      onClick={() => toggleStar(task.id)}
                      style={starToggleStyle(task.star)}
                    >
                      ⭐ Star
                    </button>

                    <button
                      className="pressable"
                      onClick={() => toggleCritical(task.id)}
                      style={urgentToggleStyle(task.critical)}
                    >
                      ⚠️ Urgent
                    </button>

                    <button
                      className="pressable"
                      onClick={(e) => completeTask(task, e)}
                      style={styles.smallButton}
                    >
                      ✓ Done
                    </button>

                    <button
                      className="pressable"
                      onClick={() => startEdit(task)}
                      style={styles.smallButton}
                    >
                      Edit
                    </button>

                    <button
                      className="pressable"
                      onClick={() => deleteTask(task.id)}
                      style={styles.smallButton}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <p style={{ ...styles.muted, marginTop: "8px", marginBottom: 0 }}>
                  Created: {task.createdAt}
                </p>

                {editingId === task.id ? (
                  <div style={{ marginTop: "10px", display: "grid", gap: "8px" }}>
                    <input
                      style={styles.input}
                      value={editingTaskName}
                      onChange={(e) => setEditingTaskName(e.target.value)}
                      placeholder="Task title"
                    />

                    <textarea
                      style={styles.textarea}
                      value={editingNotes}
                      onChange={(e) => setEditingNotes(e.target.value)}
                      placeholder="Notes"
                    />

                    <div style={{ display: "flex", justifyContent: isMobile ? "center" : "flex-start" }}>
                      <button
                        className="pressable"
                        style={{ ...styles.buttonPrimary, width: isMobile ? "100%" : "fit-content" }}
                        onClick={() => saveNotes(task.id)}
                      >
                        Save Changes
                      </button>
                    </div>
                  </div>
                ) : (
                  task.notes && (
                    <div style={{ marginTop: "10px" }}>
                      <button
                        className="pressable"
                        style={{ ...styles.smallButton, marginBottom: "6px" }}
                        onClick={() => toggleNotes(task.id)}
                      >
                        {expandedNotes[task.id] ? "▾ Notes" : "▸ Notes"}
                      </button>

                      <div style={styles.noteText}>
                        {expandedNotes[task.id] ? task.notes : notePreview(task.notes)}
                      </div>
                    </div>
                  )
                )}
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

              <div
                style={{
                  display: "grid",
                  gap: "12px",
                  marginBottom: "12px",
                  minWidth: 0,
                }}
              >
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
                      style={styles.input}
                      value={archiveStartDate}
                      onChange={(e) => setArchiveStartDate(e.target.value)}
                    />
                  </div>

                  <div style={styles.archiveFilterCell}>
                    <div style={{ ...styles.muted, marginBottom: "4px" }}>End Date</div>
                    <input
                      type="date"
                      style={styles.input}
                      value={archiveEndDate}
                      onChange={(e) => setArchiveEndDate(e.target.value)}
                    />
                  </div>

                  <div style={styles.archiveFilterAction}>
                    <button
                      className="pressable"
                      style={{ ...styles.button, ...styles.fullWidthButton }}
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
                        const notesOpen = expandedArchiveNotes[archiveNoteKey];

                        return (
                          <div key={task.id} style={styles.archiveTaskRow}>
                            <div style={styles.archiveCompactCard}>
                              <div style={styles.archiveCardHeader}>
                                <div style={styles.archiveTitleRow}>
                                  <span style={styles.archiveTaskName}>{task.name}</span>

                                  {task.notes && (
                                    <button
                                      className="pressable"
                                      style={styles.archiveInlineNoteButton}
                                      onClick={() => toggleArchiveNotes(archiveNoteKey)}
                                    >
                                      {notesOpen ? "Hide notes" : "Notes"}
                                    </button>
                                  )}
                                </div>

                                <button
                                  className="pressable"
                                  style={styles.archiveUndoButton}
                                  onClick={() => undoFromArchive(task, entry.date)}
                                >
                                  Undo
                                </button>
                              </div>

                              {task.notes && notesOpen && (
                                <div style={{ ...styles.noteText, marginTop: 0 }}>
                                  {task.notes}
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
                  <div style={styles.helperText}>
                    No archive items match the current view.
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div style={styles.footerBar}>
          <span style={styles.footerBarText}>
            Just a little animal guy on the internet. This is what I think a task tracker
            should be. I promise all choices were made with intention!
          </span>

          <div style={styles.footerLinkRow}>
            <a
              href="https://twitter.com/dogbutwithfire"
              target="_blank"
              rel="noreferrer"
              style={styles.footerBarLink}
            >
              🐦 @dogbutwithfire
            </a>

            <span style={styles.footerDivider}>•</span>

            <a
              href="https://t.me/PlushArcanine"
              target="_blank"
              rel="noreferrer"
              style={styles.footerBarLink}
            >
              ✈️ @PlushArcanine
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}