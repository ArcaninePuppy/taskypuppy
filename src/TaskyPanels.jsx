
import React, { useState } from "react";

export function DataPanel({
  styles,
  theme,
  showDataDetails,
  setShowDataDetails,
  exportJSON,
  importInputRef,
  restoreRecoveryBackup,
  deleteAllData,
}) {
  return (
    <div style={styles.infoPanel}>
      <div style={{ fontWeight: 800, color: theme.title, marginBottom: "8px" }}>
        Your Data
      </div>

      <div style={styles.panelActionRow}>
        <button
          className="pressable"
          style={styles.panelActionButton}
          onClick={exportJSON}
        >
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
        Tasky Puppy keeps your data local here, so make backups now and then.
      </div>

      <div style={{ marginTop: "10px", display: "flex", justifyContent: "center" }}>
        <button
          className="pressable"
          style={styles.detailsToggle}
          onClick={() => setShowDataDetails((prev) => !prev)}
        >
          {showDataDetails ? "Hide Details" : "Show Details"}
        </button>
      </div>

      {showDataDetails && (
        <div style={styles.infoPanelScrollArea}>
          <div style={{ ...styles.footerText, marginTop: "10px" }}>
            Your queue, archive, and stars are stored locally in this browser on this device.
          </div>

          <div style={{ ...styles.footerText, marginTop: "8px" }}>
            Data does not automatically sync between devices, so export backups if you want to move or preserve it.
          </div>

          <div style={{ ...styles.footerText, marginTop: "8px" }}>
            <strong>Emergency Restore</strong> is a local once-per-day backup made before your first meaningful change of the day.
          </div>

          <div style={{ ...styles.footerText, marginTop: "8px" }}>
            Use <strong>Emergency Restore</strong> for a same-device “oops” recovery from today.
          </div>

          <div style={{ ...styles.footerText, marginTop: "8px" }}>
            Use <strong>Import JSON</strong> to restore an older backup, move data to another device, or merge progress.
          </div>

          <div style={styles.dangerSection}>
            <div style={styles.dangerText}>
              <strong>Advanced action:</strong> This permanently deletes your local queue, archive, stars, backup, and interface preferences from this browser on this device.
            </div>

            <button
              className="pressable"
              style={styles.dangerButton}
              onClick={deleteAllData}
            >
              Delete All Data
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function StickerPanel({
  styles,
  theme,
  darkMode,
  stickersEnabled,
  setStickersEnabled,
  defaultStickerPack,
  uploadedStickers,
  includedStickersEnabled,
  setIncludedStickersEnabled,
  customStickersEnabled,
  setCustomStickersEnabled,
  showStickerGallery,
  setShowStickerGallery,
  galleryStickers,
  activeDefaultGalleryStickers,
  hiddenDefaultGalleryStickers,
  customGalleryStickers,
  hoveredGallerySticker,
  setHoveredGallerySticker,
  setExpandedGallerySticker,
  handleStickerUpload,
  stickerMessage,
  removeCustomSticker,
  hideDefaultSticker,
  restoreDefaultSticker,
  hideAllDefaultStickers,
  restoreAllDefaultStickers,
  resetStickerSettings,
}) {
  const [showHiddenIncluded, setShowHiddenIncluded] = useState(false);

  function tileStyle(isHovered) {
    return {
      ...styles.galleryTile,
      boxShadow: isHovered
        ? darkMode
          ? "0 8px 18px rgba(59, 130, 246, 0.18)"
          : "0 8px 18px rgba(96, 165, 250, 0.2)"
        : darkMode
          ? "0 2px 8px rgba(2, 6, 23, 0.18)"
          : "0 2px 8px rgba(148, 163, 184, 0.08)",
      transform: isHovered ? "translateY(-2px)" : "translateY(0)",
    };
  }

  function renderStickerTile(sticker, actionLabel, actionHandler) {
    const isHovered = hoveredGallerySticker === sticker.id;
    return (
      <div
        key={sticker.id}
        style={tileStyle(isHovered)}
        onMouseEnter={() => setHoveredGallerySticker(sticker.id)}
        onMouseLeave={() => setHoveredGallerySticker(null)}
        onClick={() => setExpandedGallerySticker(sticker)}
        onTouchStart={() => setExpandedGallerySticker(sticker)}
      >
        {actionHandler && (
          <button
            className="pressable"
            style={{
              ...styles.galleryDeleteButton,
              minWidth: "unset",
              width: "auto",
              padding: "4px 8px",
              borderRadius: "999px",
              fontSize: "11px",
            }}
            onClick={(e) => {
              e.stopPropagation();
              actionHandler();
            }}
            title={actionLabel}
          >
            {actionLabel}
          </button>
        )}
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
  }

  return (
    <div style={styles.stickerMenu}>
      <div style={{ ...styles.row, justifyContent: "space-between", marginBottom: "10px" }}>
        <span style={{ fontWeight: 700, color: theme.title }}>Sticker Manager</span>
        <button
          className="pressable"
          onClick={() => setStickersEnabled(!stickersEnabled)}
          style={stickersEnabled ? styles.buttonPrimary : styles.button}
        >
          {stickersEnabled ? "On" : "Off"}
        </button>
      </div>

      <div style={styles.helperText}>
        Included stickers: {defaultStickerPack.length}. Custom stickers: {uploadedStickers.length}.
      </div>

      <div style={{ display: "grid", gap: "8px", marginTop: "10px" }}>
        <div style={{ display: "grid", gap: "6px" }}>
          <div style={{ ...styles.helperText, fontWeight: 700, color: theme.title }}>Sticker Sources</div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center" }}>
            <button
              className="pressable"
              onClick={() => setIncludedStickersEnabled((prev) => !prev)}
              style={includedStickersEnabled ? styles.buttonPrimary : styles.button}
            >
              {includedStickersEnabled ? "Included On" : "Included Off"}
            </button>
            <button
              className="pressable"
              onClick={() => setCustomStickersEnabled((prev) => !prev)}
              style={customStickersEnabled ? styles.buttonPrimary : styles.button}
            >
              {customStickersEnabled ? "Custom On" : "Custom Off"}
            </button>
          </div>
        </div>

        <div style={styles.stickerManagerActions}>
          <button
            className="pressable"
            style={{ ...styles.button, width: "100%" }}
            onClick={() => setShowStickerGallery(!showStickerGallery)}
          >
            {showStickerGallery
              ? `Hide Sticker Gallery (${galleryStickers.length})`
              : `Sticker Gallery (${galleryStickers.length})`}
          </button>

          {stickersEnabled && (
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={handleStickerUpload}
              style={styles.stickerFileInput}
            />
          )}
        </div>
      </div>

      {stickerMessage && <div style={styles.stickerMessage}>{stickerMessage}</div>}

      {showStickerGallery && (
        <div style={{ marginTop: "10px", animation: "galleryFadeIn 0.18s ease" }}>
          <div style={styles.helperText}>
            Tap a sticker to preview it. Hide included stickers you do not want, or remove custom stickers.
          </div>

          <div style={{ marginTop: "12px" }}>
            <div style={{ fontWeight: 700, color: theme.title, marginBottom: "8px" }}>
              Active Included Stickers ({activeDefaultGalleryStickers.length})
            </div>
            {activeDefaultGalleryStickers.length > 0 ? (
              <div style={styles.galleryGrid}>
                {activeDefaultGalleryStickers.map((sticker) =>
                  renderStickerTile(sticker, "Hide", () => hideDefaultSticker(sticker.id))
                )}
              </div>
            ) : (
              <div style={styles.helperText}>No included stickers are currently active.</div>
            )}
          </div>

          <div style={{ marginTop: "12px" }}>
            <div style={{ fontWeight: 700, color: theme.title, marginBottom: "8px" }}>
              Active Custom Stickers ({customGalleryStickers.length})
            </div>
            {customGalleryStickers.length > 0 ? (
              <div style={styles.galleryGrid}>
                {customGalleryStickers.map((sticker) =>
                  renderStickerTile(sticker, "Remove", () => removeCustomSticker(sticker.src))
                )}
              </div>
            ) : (
              <div style={styles.helperText}>No custom stickers loaded yet.</div>
            )}
          </div>

          <div style={{ marginTop: "12px", display: "grid", gap: "8px" }}>
            <button
              className="pressable"
              style={{ ...styles.button, width: "100%" }}
              onClick={hideAllDefaultStickers}
            >
              Hide All Included Stickers
            </button>

            <button
              className="pressable"
              style={{ ...styles.button, width: "100%" }}
              onClick={() => setShowHiddenIncluded((prev) => !prev)}
            >
              {showHiddenIncluded
                ? `Hide Hidden Included Stickers (${hiddenDefaultGalleryStickers.length})`
                : `Hidden Included Stickers (${hiddenDefaultGalleryStickers.length})`}
            </button>
          </div>

          {showHiddenIncluded && (
            <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid rgba(148, 163, 184, 0.18)" }}>
              <div style={{ fontWeight: 700, color: theme.title, marginBottom: "8px" }}>
                Hidden Included Stickers
              </div>

              {hiddenDefaultGalleryStickers.length > 0 ? (
                <div style={styles.galleryGrid}>
                  {hiddenDefaultGalleryStickers.map((sticker) =>
                    renderStickerTile(sticker, "Restore", () => restoreDefaultSticker(sticker.id))
                  )}
                </div>
              ) : (
                <div style={styles.helperText}>No included stickers are hidden right now.</div>
              )}

              <div style={{ marginTop: "12px", display: "grid", gap: "8px" }}>
                <button
                  className="pressable"
                  style={{ ...styles.button, width: "100%" }}
                  onClick={restoreAllDefaultStickers}
                >
                  Restore All Included Stickers
                </button>

                <button
                  className="pressable"
                  style={{ ...styles.button, width: "100%" }}
                  onClick={resetStickerSettings}
                >
                  Reset Sticker Settings
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
export function StarToolsPanel({
  theme,
  styles,
  darkMode,
  starCountManual,
  starCountCalculated,
  displayStarCount,
  editingStarValue,
  setEditingStarValue,
  applyManualStarCount,
  useCalculatedStarCount,
  resetStarCount,
}) {
  return (
    <div style={styles.starPanel}>
      <div style={{ fontWeight: 800, color: theme.title, marginBottom: "8px" }}>
        Star Tools
      </div>

      <div style={styles.helperText}>
        Displayed stars use the manual override when one is set. Otherwise they use the archive-counted total.
      </div>

      <div style={{ ...styles.helperText, marginTop: "8px" }}>
        Manual override: <strong>{starCountManual === null ? "Off" : starCountManual}</strong>
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
  );
}
