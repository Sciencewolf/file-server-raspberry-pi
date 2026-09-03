document.addEventListener("DOMContentLoaded", () => {
    const $ = id => document.getElementById(id);

    const uploadForm = $("upload-form");
    const uploadInput = $("upload-input");
    const uploadBtn = $("upload-btn");
    const uploadBtnText = $("upload-btn-text");
    const removeFileBtn = $("remove-file");
    const dropZone = $("drop-zone");
    const filePreview = $("file-preview");
    const fileName = $("file-name");
    const fileSize = $("file-size");

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

    function formatFileSize(bytes) {
        if (!bytes) return "0 Bytes";

        const units = ["Bytes", "KB", "MB", "GB", "TB"];
        const index = Math.floor(Math.log(bytes) / Math.log(1024));
        const value = parseFloat((bytes / 1024 ** index).toFixed(2));

        return `${value} ${units[index]}`;
    }

    async function parseResponse(response) {
        try {
            return await response.json();
        } catch {
            return {};
        }
    }

    async function fetchJson(url, options = {}) {
        const response = await fetch(url, {
            cache: "no-store",
            ...options
        });

        const data = await parseResponse(response);

        if (!response.ok) {
            throw new Error(data.error || data.info || data.message || `Request failed with status ${response.status}`);
        }

        return data;
    }

    async function refreshFilesIfVisible() {
        if (!fileList.classList.contains("hidden")) {
            await loadFiles();
        }
    }

    function showSelectedFile(file) {
        if (!file) {
            clearSelectedFile();
            return;
        }

        fileName.textContent = file.name;
        fileSize.textContent = formatFileSize(file.size);
        filePreview.classList.remove("hidden");
        uploadBtn.classList.remove("hidden");
    }

    function clearSelectedFile() {
        uploadInput.value = "";
        fileName.textContent = "";
        fileSize.textContent = "";
        filePreview.classList.add("hidden");
        uploadBtn.classList.add("hidden");
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

    function setConnectionState(online) {
        connectionStatus.classList.toggle("online", online);
        connectionStatus.classList.toggle("offline", !online);
        offlineOverlay.classList.toggle("hidden", online);
        statusText.textContent = online ? "Online" : "Offline";
    }

    async function checkConnection() {
        try {
            await fetchJson("/connection");
            setConnectionState(true);
        } catch {
            setConnectionState(false);
        }
    }

    async function downloadFile(filename, button) {
        try {
            button.disabled = true;

            const response = await fetch(`/get/${encodeURIComponent(filename)}`, {
                method: "GET",
                cache: "no-store"
            });

            if (!response.ok) {
                let message = `Download failed with status ${response.status}`;

                try {
                    const data = await response.json();
                    message = data.error || data.info || data.message || message;
                } catch {}

                throw new Error(message);
            }

            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            const downloadLink = document.createElement("a");

            downloadLink.href = blobUrl;
            downloadLink.download = filename;
            downloadLink.style.display = "none";

            document.body.appendChild(downloadLink);
            downloadLink.click();
            downloadLink.remove();

            setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);

            showToast(`${filename} download started.`);
        } catch (error) {
            console.error("[DOWNLOAD] Failed:", filename, error);
            showToast(error.message || "Could not download file.", "error");
        } finally {
            button.disabled = false;
        }
    }

    async function renameFile(filename) {
        const extension = getExtension(filename);
        const currentName = getFilenameWithoutExtension(filename);
        const enteredName = prompt("Rename file", currentName);

        if (enteredName === null || !enteredName.trim()) return;

        const newFilename = extension ? `${enteredName.trim()}.${extension}` : enteredName.trim();

        try {
            const data = await fetchJson(
                `/rename/${encodeURIComponent(filename)}?val=${encodeURIComponent(newFilename)}`
            );

            showToast(data.info || "File renamed successfully.");
            await loadFiles();
        } catch (error) {
            console.error("Rename error:", error);
            showToast(error.message || "Could not rename file.", "error");
        }
    }

    async function deleteFile(filename, button) {
        const confirmed = confirm(`Are you sure you want to delete '${filename}'?`);

        if (!confirmed) return;

        try {
            button.disabled = true;

            const data = await fetchJson(`/delete/${encodeURIComponent(filename)}`, {
                method: "DELETE"
            });

            showToast(data.info || "File deleted successfully.");
            await loadFiles();
        } catch (error) {
            console.error("[DELETE] Failed:", filename, error);
            showToast(error.message || "Could not delete file.", "error");
        } finally {
            button.disabled = false;
        }
    }

    function createActionButton(icon, className, label, onClick) {
        const button = document.createElement("button");

        button.type = "button";
        button.className = `file-action ${className}`;
        button.innerHTML = icon;
        button.title = label;
        button.setAttribute("aria-label", label);

        button.addEventListener("click", () => onClick(button));

        return button;
    }

    function renderFiles(data) {
        const files = Array.isArray(data) ? data : Array.isArray(data?.files) ? data.files : [];

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

        files.forEach(file => {
            const filename = typeof file === "string" ? file : file?.name;

            if (!filename) return;

            const item = document.createElement("div");
            const name = document.createElement("span");
            const actions = document.createElement("div");
            const preview = document.createElement("a");

            item.className = "file-list-item";

            name.className = "file-list-name";
            name.textContent = filename;

            actions.className = "file-list-actions";

            const downloadBtn = createActionButton(icons.download, "download", "Download", button => {
                downloadFile(filename, button);
            });

            const renameBtn = createActionButton(icons.rename, "rename", "Rename", () => {
                renameFile(filename);
            });

            preview.className = "file-preview-link";
            preview.innerHTML = icons.preview;
            preview.href = `/data/${encodeURIComponent(filename)}`;
            preview.target = "_blank";
            preview.rel = "noopener noreferrer";
            preview.title = "Preview";
            preview.setAttribute("aria-label", "Preview");

            const deleteBtn = createActionButton(icons.delete, "delete", "Delete", button => {
                deleteFile(filename, button);
            });

            actions.append(downloadBtn, renameBtn, preview, deleteBtn);
            item.append(name, actions);
            fileList.appendChild(item);
        });
    }

    async function loadFiles() {
        try {
            allFilesBtn.disabled = true;
            allFilesBtn.textContent = "Loading...";

            const data = await fetchJson("/all");

            renderFiles(data);

            fileList.classList.remove("hidden");
            allFilesBtn.textContent = "Hide files";
        } catch (error) {
            console.error("File manager error:", error);
            showToast(error.message || "Could not load files.", "error");

            fileList.classList.add("hidden");
            allFilesBtn.textContent = "View files";
        } finally {
            allFilesBtn.disabled = false;
        }
    }

    uploadInput.addEventListener("change", () => {
        showSelectedFile(uploadInput.files[0]);
    });

    removeFileBtn.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        clearSelectedFile();
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

    dropZone.addEventListener("drop", event => {
        const file = event.dataTransfer.files?.[0];

        if (!file) return;

        try {
            const dataTransfer = new DataTransfer();

            dataTransfer.items.add(file);
            uploadInput.files = dataTransfer.files;

            showSelectedFile(file);
        } catch (error) {
            console.error("Could not assign dropped file:", error);
            showToast("Could not select dropped file.", "error");
        }
    });

    uploadForm.addEventListener("submit", async event => {
        event.preventDefault();

        const file = uploadInput.files[0];

        if (!file) {
            showToast("Please select a file first.", "error");
            return;
        }

        const formData = new FormData();
        formData.append("file", file);

        try {
            uploadBtn.disabled = true;
            uploadBtnText.textContent = "Uploading...";

            const data = await fetchJson("/upload", {
                method: "POST",
                body: formData
            });

            showToast(data.info || `${file.name} uploaded successfully.`);

            clearSelectedFile();
            await refreshFilesIfVisible();
        } catch (error) {
            console.error("Upload error:", error);
            showToast(error.message || "Upload failed.", "error");
        } finally {
            uploadBtn.disabled = false;
            uploadBtnText.textContent = "Upload file ↑";
        }
    });

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

        try {
            createFileBtn.disabled = true;
            createFileBtn.textContent = "Creating...";

            const data = await fetchJson(
                `/create?fname=${encodeURIComponent(filename)}&ext=${encodeURIComponent(extension)}`,
                {
                    method: "POST",
                    body: content
                }
            );

            showToast(data.info || `${filename}.${extension} created successfully.`);

            fileNameInput.value = "";
            fileExtensionInput.value = "";
            newFileTextarea.value = "";
            newFileCheckbox.checked = false;
            newFileWrapper.classList.add("hidden");

            await refreshFilesIfVisible();
        } catch (error) {
            console.error("Create file error:", error);
            showToast(error.message || "Could not create the file.", "error");
        } finally {
            createFileBtn.disabled = false;
            createFileBtn.textContent = "Create file";
        }
    });

    allFilesBtn.addEventListener("click", async () => {
        if (!fileList.classList.contains("hidden")) {
            fileList.classList.add("hidden");
            allFilesBtn.textContent = "View files";
            return;
        }

        await loadFiles();
    });

    checkConnection();
    setInterval(checkConnection, 20_000);
});