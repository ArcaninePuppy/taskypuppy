
import React from "react";

export function NewTaskCard({
  styles,
  isMobile,
  taskName,
  setTaskName,
  notes,
  setNotes,
  newTaskChecklist,
  updateNewTaskChecklistItem,
  deleteNewTaskChecklistItem,
  addNewTaskChecklistItem,
  addTask,
}) {
  return (
    <div style={styles.card}>
      <div style={styles.cardStars}>✦ ✦ ✦</div>

      <div style={{ display: "grid", gap: "12px" }}>
        <input
          style={styles.input}
          maxLength={100}
          placeholder="Task name"
          value={taskName}
          onChange={(e) => setTaskName(e.target.value)}
        />

        <textarea
          style={styles.textarea}
          placeholder="Details / notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        <div style={{ display: "grid", gap: "8px" }}>
          {newTaskChecklist.length > 0 && (
            <div style={{ display: "grid", gap: "8px" }}>
              {newTaskChecklist.map((item) => (
                <div key={item.id} style={styles.checklistRow}>
                  <input
                    style={{ ...styles.input, ...styles.checklistTextInput }}
                    placeholder="Checklist item"
                    value={item.text}
                    onChange={(e) => updateNewTaskChecklistItem(item.id, e.target.value)}
                  />
                  <button
                    className="pressable"
                    style={styles.smallButton}
                    onClick={() => deleteNewTaskChecklistItem(item.id)}
                  >
                    {isMobile ? "❌" : "❌ Delete"}
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            className="pressable"
            style={styles.button}
            onClick={addNewTaskChecklistItem}
          >
            + Add Checklist Item (optional)
          </button>
        </div>

        <button
          className="pressable"
          style={styles.buttonPrimary}
          onClick={addTask}
        >
          Add Task
        </button>
      </div>
    </div>
  );
}

export function TaskCard(props) {
  const {
    task,
    index,
    nextTaskMode,
    expandedDetails,
    theme,
    darkMode,
    styles,
    priorityStyle,
    autoSort,
    handleDragStart,
    handleDrop,
    completingIds,
    isMobile,
    formatCompactDateTime,
    toggleFocus,
    focusToggleStyle,
    toggleCritical,
    urgentToggleStyle,
    completeTask,
    startEdit,
    deleteTask,
    editingId,
    editingTaskName,
    setEditingTaskName,
    editingNotes,
    setEditingNotes,
    editingChecklist,
    setEditingChecklist,
    updateEditingChecklistItem,
    deleteEditingChecklistItem,
    addChecklistItemToEditor,
    saveTaskChanges,
    setEditingId,
    setEditingNotes: _setEditingNotes2,
    setEditingChecklist: _setEditingChecklist2,
    toggleDetails,
    toggleChecklistItem,
    taskHasDetails,
  } = props;

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
            {isMobile ? "✏️" : "✏️ Edit"}
          </button>

          <button
            className="pressable"
            onClick={() => deleteTask(task.id)}
            style={{ ...styles.smallButton, ...styles.taskActionButton }}
          >
            {isMobile ? "❌" : "❌ Delete"}
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
              onChange={(e) => props.setEditingNotes(e.target.value)}
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
                    {isMobile ? "❌" : "❌ Delete"}
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
                props.setEditingNotes("");
                props.setEditingChecklist([]);
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
              overflowY: detailsOpen ? "auto" : "hidden",
              paddingRight: detailsOpen ? "6px" : undefined,
            }}
          >
            <div
              style={{
                ...styles.noteText,
                marginTop: "8px",
                display: "grid",
                gap: "10px",
                textAlign: "left",
                justifyItems: "stretch",
              }}
            >
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

              {(task.checklist || []).length > 0 && task.notes && (
                <hr
                  style={{
                    width: "100%",
                    opacity: 0.18,
                    border: "none",
                    borderTop: "1px solid currentColor",
                    margin: 0,
                  }}
                />
              )}

              {task.notes && <div>{task.notes}</div>}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ArchivePanel({
  styles,
  theme,
  isMobile,
  showArchive,
  setShowArchive,
  archiveSearch,
  setArchiveSearch,
  archiveStartDate,
  setArchiveStartDate,
  archiveEndDate,
  setArchiveEndDate,
  archiveEntries,
  expandedArchiveNotes,
  toggleArchiveNotes,
  taskHasDetails,
  undoFromArchive,
  deleteArchivedTask,
}) {
  return (
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

                            <div
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "8px",
                                justifyContent: "flex-start",
                                width: "fit-content",
                                flexShrink: 0,
                              }}
                            >
                              <button
                                className="pressable"
                                style={styles.archiveUndoButton}
                                onClick={() => undoFromArchive(task, entry.date)}
                              >
                                Undo
                              </button>

                              <button
                                className="pressable"
                                style={styles.smallButton}
                                onClick={() => deleteArchivedTask(task, entry.date)}
                              >
                                {isMobile ? "❌" : "❌ Delete"}
                              </button>
                            </div>
                          </div>

                          {hasDetails && detailsOpen && (
                            <div
                              style={{
                                ...styles.noteText,
                                marginTop: 0,
                                display: "grid",
                                gap: "8px",
                                textAlign: "left",
                                justifyItems: "stretch",
                              }}
                            >
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

                              {(task.checklist || []).length > 0 && task.notes && (
                                <hr
                                  style={{
                                    width: "100%",
                                    opacity: 0.18,
                                    border: "none",
                                    borderTop: "1px solid currentColor",
                                    margin: 0,
                                  }}
                                />
                              )}

                              {task.notes && <div>{task.notes}</div>}
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
  );
}
