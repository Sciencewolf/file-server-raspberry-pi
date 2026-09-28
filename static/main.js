document.addEventListener("DOMContentLoaded", () => {
    const $ = id => document.getElementById(id);

    // --- Config ---------------------------------------------------------------

    const API = {
        health: "/api/health",
        files: "/api/files",
        file: relPath => `/api/files/${encodePath(relPath)}`
    };

    const FILE_POLL_MS = 3_000;
    const CONNECTION_POLL_MS = 20_000;
    const CONNECTION_TIMEOUT_MS = 5_000;

    // --- DOM ------------------------------------------------------------------

    const uploadForm = $("upload-form");
    const uploadInput = $("upload-input");
    const folderInput = $("folder-input");
    const chooseFilesBtn = $("choose-files-btn");
    const chooseFolderBtn = $("choose-folder-btn");
    const uploadBtn = $("upload-btn");
    const uploadBtnText = $("upload-btn-text");
    const dropZone = $("drop-zone");

    const filePreview = $("file-preview");
    const filePreviewSummary = $("file-preview-summary");
    const filePreviewList = $("file-preview-list");
    const removeAllFilesBtn = $("remove-all-files");

    const connectionStatus = $("connection-status");
    const statusText = $("status-text");
    const offlineOverlay = $("offline-overlay");

    const newFileCheckbox = $("checkbox-new-file");
    const newFileWrapper = $("wrapper-new-file");
    const fileNameInput = $("fname-input");
    const fileExtensionInput = $("file-ext-input");
    const clearFilenameBtn = $("btn-clear-filename");
    const newFileTextarea = $("textarea-new-file");
    const createFileBtn = $("btn-send-new-file");
    const clearTextareaBtn = $("btn-clear-textarea");

    const allFilesBtn = $("all-files-btn");
    const fileList = $("see-all");

    // --- State ----------------------------------------------------------------

    let selectedFiles = [];

    const expandedFolders = new Set(); // survives re-renders during polling
    let lastTreeJson = null;           // skip re-render when nothing changed
    let isLoadingFiles = false;
    let pollTimer = null;

    const icons = {
        download: `
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M12 3v12"></path>
                <path d="m7 10 5 5 5-5"></path>
                <path d="M5 21h14"></path>
            </svg>
        `,
        rename: `
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M12 20h9"></path>
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"></path>
            </svg>
        `,
        preview: `
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M2.062 12.348a1 1 0 0 1 0-.696C3.423 7.64 7.22 5 12 5c4.78 0 8.577 2.64 9.938 6.652a1 1 0 0 1 0 .696C20.577 16.36 16.78 19 12 19c-4.78 0-8.577-2.64-9.938-6.652"></path>
                <circle cx="12" cy="12" r="3"></circle>
            </svg>
        `,
        delete: `
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M3 6h18"></path>
                <path d="M8 6V4h8v2"></path>
                <path d="M19 6l-1 14H6L5 6"></path>
                <path d="M10 11v5"></path>
                <path d="M14 11v5"></path>
            </svg>
        `
    };

    // --- Helpers --------------------------------------------------------------

    function showToast(message, type = "success") {
        const colors = {
            success: "#22c55e",
            error: "#ef4444",
            info: "#6366f1"
        };

        Toastify({
            text: message,
            duration: 3000,
            gravity: "top",
            position: "right",
            stopOnFocus: true,
            style: {
                background: colors[type] || colors.info,
                borderRadius: "10px",
                boxShadow: "none"
            }
        }).showToast();
    }

    function plural(count, word = "file") {
        return `${count} ${word}${count === 1 ? "" : "s"}`;
    }

    function formatFileSize(bytes) {
        if (!bytes) return "0 Bytes";

        const units = ["Bytes", "KB", "MB", "GB", "TB"];
        const index = Math.floor(Math.log(bytes) / Math.log(1024));
        const value = parseFloat((bytes / 1024 ** index).toFixed(2));

        return `${value} ${units[index]}`;
    }

    function encodePath(relPath) {
        return relPath.split("/").map(encodeURIComponent).join("/");
    }

    function getExtension(filename) {
        const lastDot = filename.lastIndexOf(".");
        if (lastDot <= 0 || lastDot === filename.length - 1) return "";
        return filename.slice(lastDot + 1);
    }

    function getFilenameWithoutExtension(filename) {
        const lastDot = filename.lastIndexOf(".");
        if (lastDot <= 0) return filename;
        return filename.slice(0, lastDot);
    }

    // --- HTTP -----------------------------------------------------------------

    class ApiError extends Error {
        constructor(message, status, requestId) {
            super(message);
            this.name = "ApiError";
            this.status = status;
            this.requestId = requestId;
        }
    }

    async function parseResponse(response) {
        if (response.status === 204) return {};
        try {
            return await response.json();
        } catch {
            return {};
        }
    }

    async function request(url, options = {}) {
        const response = await fetch(url, { cache: "no-store", ...options });
        const data = await parseResponse(response);

        if (!response.ok) {
            throw new ApiError(
                data.error || `Request failed with status ${response.status}`,
                response.status,
                data.request_id || response.headers.get("X-Request-ID")
            );
        }

        return { status: response.status, data };
    }

    function errorMessage(error, fallback) {
        const message = error?.message || fallback;
        return error?.requestId ? `${message} (ref: ${error.requestId})` : message;
    }

    async function fileExists(relPath) {
        const response = await fetch(API.file(relPath), { method: "HEAD", cache: "no-store" });
        return response.ok;
    }

    // --- Upload selection -----------------------------------------------------

    function fileKey(entry) {
        return `${entry.relativePath}__${entry.file.size}__${entry.file.lastModified}`;
    }

    function addFiles(newEntries) {
        const existingKeys = new Set(selectedFiles.map(fileKey));

        newEntries.forEach(entry => {
            if (!entry || !entry.file) return;

            const key = fileKey(entry);
            if (existingKeys.has(key)) return;

            existingKeys.add(key);
            selectedFiles.push(entry);
        });

        renderFilePreview();
    }

    function removeFileAt(index) {
        selectedFiles.splice(index, 1);
        renderFilePreview();
    }

    function clearSelectedFiles() {
        selectedFiles = [];
        uploadInput.value = "";
        folderInput.value = "";
        renderFilePreview();
    }

    function renderFilePreview() {
        filePreviewList.replaceChildren();

        if (!selectedFiles.length) {
            filePreview.classList.add("hidden");
            uploadBtn.classList.add("hidden");
            return;
        }

        let totalSize = 0;

        selectedFiles.forEach((entry, index) => {
            totalSize += entry.file.size;

            const item = document.createElement("div");
            const info = document.createElement("div");
            const name = document.createElement("strong");
            const meta = document.createElement("span");
            const removeBtn = document.createElement("button");

            item.className = "file-preview-item";
            info.className = "file-preview-item-info";

            name.textContent = entry.relativePath;
            meta.textContent = formatFileSize(entry.file.size);

            removeBtn.type = "button";
            removeBtn.className = "remove-item-btn";
            removeBtn.textContent = "✕";
            removeBtn.title = "Remove";
            removeBtn.setAttribute("aria-label", `Remove ${entry.relativePath}`);
            removeBtn.addEventListener("click", () => removeFileAt(index));

            info.append(name, meta);
            item.append(info, removeBtn);
            filePreviewList.appendChild(item);
        });

        filePreviewSummary.textContent =
            `${plural(selectedFiles.length)} selected (${formatFileSize(totalSize)})`;

        filePreview.classList.remove("hidden");
        uploadBtn.classList.remove("hidden");
    }

    function traverseFileTree(entry, basePath = "") {
        return new Promise(resolve => {
            if (!entry) {
                resolve([]);
                return;
            }

            if (entry.isFile) {
                entry.file(
                    file => resolve([{ file, relativePath: basePath + entry.name }]),
                    () => resolve([])
                );
                return;
            }

            if (entry.isDirectory) {
                const reader = entry.createReader();
                let allEntries = [];

                const readBatch = () => {
                    reader.readEntries(async entries => {
                        if (!entries.length) {
                            const results = await Promise.all(
                                allEntries.map(child => traverseFileTree(child, `${basePath}${entry.name}/`))
                            );

                            resolve(results.flat());
                            return;
                        }

                        allEntries = allEntries.concat(entries);
                        readBatch();
                    }, () => resolve([]));
                };

                readBatch();
                return;
            }

            resolve([]);
        });
    }

    function entriesFromInput(input) {
        return Array.from(input.files).map(file => ({
            file,
            relativePath: file.webkitRelativePath || file.name
        }));
    }

    chooseFilesBtn.addEventListener("click", () => uploadInput.click());
    chooseFolderBtn.addEventListener("click", () => folderInput.click());

    dropZone.addEventListener("click", event => {
        if (event.target.closest("button")) return;
        uploadInput.click();
    });

    uploadInput.addEventListener("change", () => {
        addFiles(entriesFromInput(uploadInput));
        uploadInput.value = "";
    });

    folderInput.addEventListener("change", () => {
        addFiles(entriesFromInput(folderInput));
        folderInput.value = "";
    });

    removeAllFilesBtn.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        clearSelectedFiles();
    });

    ["dragenter", "dragover"].forEach(eventName => {
        dropZone.addEventListener(eventName, event => {
            event.preventDefault();
            dropZone.classList.add("dragover");
        });
    });

    ["dragleave", "drop"].forEach(eventName => {
        dropZone.addEventListener(eventName, event => {
            event.preventDefault();
            dropZone.classList.remove("dragover");
        });
    });

    dropZone.addEventListener("drop", async event => {
        const items = event.dataTransfer.items;

        try {
            let newEntries;

            if (items && items.length && items[0].webkitGetAsEntry) {
                const entries = Array.from(items)
                    .map(item => item.webkitGetAsEntry())
                    .filter(Boolean);

                const results = await Promise.all(entries.map(entry => traverseFileTree(entry)));
                newEntries = results.flat();
            } else {
                newEntries = Array.from(event.dataTransfer.files).map(file => ({
                    file,
                    relativePath: file.name
                }));
            }

            addFiles(newEntries);
        } catch (error) {
            console.error("Could not read dropped files/folder:", error);
            showToast("Could not read dropped files.", "error");
        }
    });

    // --- Upload: POST /api/files ------------------------------------------------

    uploadForm.addEventListener("submit", async event => {
        event.preventDefault();

        if (!selectedFiles.length) {
            showToast("Please select at least one file.", "error");
            return;
        }

        const formData = new FormData();

        selectedFiles.forEach(entry => {
            formData.append("files", entry.file);
            formData.append("paths", entry.relativePath);
        });

        try {
            uploadBtn.disabled = true;
            uploadBtnText.textContent = `Uploading ${plural(selectedFiles.length)}...`;

            const { status, data } = await request(API.files, {
                method: "POST",
                body: formData
            });

            const uploaded = data.uploaded?.length ?? 0;
            const failed = data.failed ?? [];

            if (status === 207) {
                // Partial success: keep only the failed files selected, so they can be retried
                const failedPaths = new Set(failed.map(f => f.path));
                selectedFiles = selectedFiles.filter(entry => failedPaths.has(entry.relativePath));
                renderFilePreview();

                console.warn("Upload partially failed:", failed);
                showToast(`${plural(uploaded)} uploaded, ${failed.length} failed.`, "error");
            } else {
                clearSelectedFiles();
                showToast(`${plural(uploaded)} uploaded successfully.`);
            }

            await refreshFilesIfVisible();
        } catch (error) {
            console.error("Upload error:", error);
            showToast(errorMessage(error, "Upload failed."), "error");
        } finally {
            uploadBtn.disabled = false;
            uploadBtnText.textContent = "Upload files ↑";
        }
    });

    // --- Create file: PUT /api/files/<path> -------------------------------------

    newFileCheckbox.addEventListener("change", () => {
        newFileWrapper.classList.toggle("hidden", !newFileCheckbox.checked);
    });

    clearFilenameBtn.addEventListener("click", () => {
        fileNameInput.value = "";
        fileExtensionInput.value = "";
        fileNameInput.focus();
    });

    clearTextareaBtn.addEventListener("click", () => {
        newFileTextarea.value = "";
        newFileTextarea.focus();
    });

    createFileBtn.addEventListener("click", async () => {
        const filename = fileNameInput.value.trim();
        const extension = fileExtensionInput.value.trim().replace(/^\./, "");
        const content = newFileTextarea.value;

        if (!filename) {
            showToast("Please enter a filename.", "error");
            fileNameInput.focus();
            return;
        }

        if (!extension) {
            showToast("Please enter a file extension.", "error");
            fileExtensionInput.focus();
            return;
        }

        const relPath = `${filename}.${extension}`;

        try {
            createFileBtn.disabled = true;
            createFileBtn.textContent = "Creating...";

            // PUT overwrites by design, so ask first if the file already exists
            if (await fileExists(relPath) && !confirm(`'${relPath}' already exists. Overwrite it?`)) {
                return;
            }

            const { status, data } = await request(API.file(relPath), {
                method: "PUT",
                headers: { "Content-Type": "text/plain; charset=utf-8" },
                body: content
            });

            const savedPath = data.path || relPath;
            showToast(status === 201 ? `'${savedPath}' created.` : `'${savedPath}' overwritten.`);

            fileNameInput.value = "";
            fileExtensionInput.value = "";
            newFileTextarea.value = "";
            newFileCheckbox.checked = false;
            newFileWrapper.classList.add("hidden");

            await refreshFilesIfVisible();
        } catch (error) {
            console.error("Create file error:", error);
            showToast(errorMessage(error, "Could not create the file."), "error");
        } finally {
            createFileBtn.disabled = false;
            createFileBtn.textContent = "Create file";
        }
    });

    // --- File actions -----------------------------------------------------------

    // GET /api/files/<path>?download=1 - native browser download (streams to disk,
    // no Blob in memory, so large files and zipped folders work too)
    function downloadItem(item) {
        const downloadName = item.type === "folder" ? `${item.name}.zip` : item.name;
        const link = document.createElement("a");

        link.href = `${API.file(item.path)}?download=1`;
        link.download = downloadName;
        link.hidden = true;

        document.body.appendChild(link);
        link.click();
        link.remove();

        showToast(`${downloadName} download started.`, "info");
    }

    // PATCH /api/files/<path>  {"name": "..."}
    async function renameItem(item) {
        const isFolder = item.type === "folder";
        const extension = isFolder ? "" : getExtension(item.name);
        const currentName = isFolder ? item.name : getFilenameWithoutExtension(item.name);

        const entered = prompt("Rename", currentName)?.trim();
        if (!entered || entered === currentName) return;

        const newName = extension ? `${entered}.${extension}` : entered;

        try {
            const { data } = await request(API.file(item.path), {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newName })
            });

            if (isFolder && data.path) {
                moveExpandedState(item.path, data.path);
            }

            showToast(`Renamed to '${data.path || newName}'.`);
            await refreshFiles({ force: true });
        } catch (error) {
            console.error("Rename error:", error);
            showToast(errorMessage(error, "Could not rename."), "error");
        }
    }

    // DELETE /api/files/<path>
    async function deleteItem(item, button) {
        const isFolder = item.type === "folder";
        const label = isFolder ? "folder (and everything inside it)" : "file";

        if (!confirm(`Are you sure you want to delete this ${label}:\n'${item.path}'?`)) return;

        try {
            button.disabled = true;

            await request(API.file(item.path), { method: "DELETE" });

            if (isFolder) {
                moveExpandedState(item.path, null);
            }

            showToast(`'${item.path}' deleted.`);
            await refreshFiles({ force: true });
        } catch (error) {
            console.error("Delete error:", item.path, error);
            showToast(errorMessage(error, "Could not delete."), "error");
        } finally {
            button.disabled = false;
        }
    }

    // Keeps folders open after a rename; newPrefix = null removes them (delete)
    function moveExpandedState(oldPrefix, newPrefix) {
        for (const path of [...expandedFolders]) {
            if (path === oldPrefix || path.startsWith(`${oldPrefix}/`)) {
                expandedFolders.delete(path);
                if (newPrefix) {
                    expandedFolders.add(newPrefix + path.slice(oldPrefix.length));
                }
            }
        }
    }

    // --- File tree rendering ----------------------------------------------------

    function createActionButton(icon, className, label, onClick) {
        const button = document.createElement("button");

        button.type = "button";
        button.className = `file-action ${className}`;
        button.innerHTML = icon; // static SVG only, never user data
        button.title = label;
        button.setAttribute("aria-label", label);

        button.addEventListener("click", event => {
            event.stopPropagation();
            onClick(button);
        });

        return button;
    }

    function createPreviewLink(item) {
        const preview = document.createElement("a");

        preview.className = "file-preview-link";
        preview.innerHTML = icons.preview;
        preview.href = API.file(item.path);
        preview.target = "_blank";
        preview.rel = "noopener noreferrer";
        preview.title = "Preview";
        preview.setAttribute("aria-label", "Preview");
        preview.addEventListener("click", event => event.stopPropagation());

        return preview;
    }

    function renderTree(items, container, depth = 0) {
        items.forEach(item => {
            const isFolder = item.type === "folder";

            const row = document.createElement("div");
            const nameWrap = document.createElement("div");
            const name = document.createElement("span");
            const actions = document.createElement("div");

            row.className = "file-list-item";
            row.style.paddingLeft = `${14 + depth * 20}px`;

            nameWrap.className = "file-list-name-wrap";
            name.className = "file-list-name";
            name.textContent = item.name;

            actions.className = "file-list-actions";

            let toggleIcon = null;

            if (isFolder) {
                toggleIcon = document.createElement("span");
                toggleIcon.className = "folder-toggle";

                const folderIcon = document.createElement("span");
                folderIcon.className = "folder-icon";
                folderIcon.textContent = "📁";

                nameWrap.append(toggleIcon, folderIcon, name);
                row.classList.add("folder-row");
            } else {
                const fileIcon = document.createElement("span");
                fileIcon.className = "file-icon";
                fileIcon.textContent = "📄";

                nameWrap.append(fileIcon, name);
            }

            actions.append(
                createActionButton(icons.download, "download", isFolder ? "Download ZIP" : "Download",
                    () => downloadItem(item)),
                createActionButton(icons.rename, "rename", "Rename",
                    () => renameItem(item))
            );

            if (!isFolder) {
                actions.appendChild(createPreviewLink(item));
            }

            actions.appendChild(
                createActionButton(icons.delete, "delete", "Delete",
                    button => deleteItem(item, button))
            );

            row.append(nameWrap, actions);
            container.appendChild(row);

            if (isFolder) {
                const expanded = expandedFolders.has(item.path);
                const childContainer = document.createElement("div");

                childContainer.className = "folder-children";
                childContainer.classList.toggle("hidden", !expanded);
                toggleIcon.textContent = expanded ? "▾" : "▸";
                row.setAttribute("aria-expanded", String(expanded));

                renderTree(item.children || [], childContainer, depth + 1);
                container.appendChild(childContainer);

                row.addEventListener("click", event => {
                    if (event.target.closest("button") || event.target.closest("a")) return;

                    const nowHidden = childContainer.classList.toggle("hidden");

                    if (nowHidden) {
                        expandedFolders.delete(item.path);
                    } else {
                        expandedFolders.add(item.path);
                    }

                    toggleIcon.textContent = nowHidden ? "▸" : "▾";
                    row.setAttribute("aria-expanded", String(!nowHidden));
                });
            }
        });
    }

    function renderFiles(files) {
        fileList.replaceChildren();

        if (!files.length) {
            const empty = document.createElement("div");
            const text = document.createElement("span");

            empty.className = "file-list-item";
            text.className = "file-list-name";
            text.textContent = "No files found.";

            empty.appendChild(text);
            fileList.appendChild(empty);
            return;
        }

        renderTree(files, fileList);
    }

    // --- File list loading & polling: GET /api/files ----------------------------

    function isFileListVisible() {
        return !fileList.classList.contains("hidden");
    }

    async function refreshFiles({ force = false } = {}) {
        if (isLoadingFiles) return;
        isLoadingFiles = true;

        try {
            const { data } = await request(API.files);
            const files = Array.isArray(data.files) ? data.files : [];
            const json = JSON.stringify(files);

            if (force || json !== lastTreeJson) {
                lastTreeJson = json;
                renderFiles(files);
            }
        } finally {
            isLoadingFiles = false;
        }
    }

    async function refreshFilesIfVisible() {
        if (!isFileListVisible()) return;

        try {
            await refreshFiles({ force: true });
        } catch (error) {
            console.warn("File list refresh failed:", error);
        }
    }

    // setTimeout chain instead of setInterval: requests never overlap,
    // and there is only ever one active timer
    function schedulePoll() {
        clearTimeout(pollTimer);

        pollTimer = setTimeout(async () => {
            if (!isFileListVisible()) return;

            if (!document.hidden) {
                try {
                    await refreshFiles();
                } catch (error) {
                    console.warn("File list poll failed:", error);
                }
            }

            schedulePoll();
        }, FILE_POLL_MS);
    }

    async function showFileList() {
        try {
            allFilesBtn.disabled = true;
            allFilesBtn.textContent = "Loading...";

            await refreshFiles({ force: true });

            fileList.classList.remove("hidden");
            allFilesBtn.textContent = "Hide files";
            schedulePoll();
        } catch (error) {
            console.error("File manager error:", error);
            showToast(errorMessage(error, "Could not load files."), "error");
            hideFileList();
        } finally {
            allFilesBtn.disabled = false;
        }
    }

    function hideFileList() {
        fileList.classList.add("hidden");
        allFilesBtn.textContent = "View files";
        clearTimeout(pollTimer);
        pollTimer = null;
    }

    allFilesBtn.addEventListener("click", () => {
        if (isFileListVisible()) {
            hideFileList();
        } else {
            showFileList();
        }
    });

    // --- Connection status: GET /api/health -------------------------------------

    function setConnectionState(online) {
        connectionStatus.classList.toggle("online", online);
        connectionStatus.classList.toggle("offline", !online);
        offlineOverlay.classList.toggle("hidden", online);
        statusText.textContent = online ? "Online" : "Offline";
    }

    async function checkConnection() {
        try {
            await request(API.health, { signal: AbortSignal.timeout(CONNECTION_TIMEOUT_MS) });
            setConnectionState(true);
        } catch {
            setConnectionState(false);
        }
    }

    window.addEventListener("online", checkConnection);
    window.addEventListener("offline", () => setConnectionState(false));

    checkConnection();
    setInterval(checkConnection, CONNECTION_POLL_MS);
});