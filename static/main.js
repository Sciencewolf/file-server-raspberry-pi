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
        if (!fileList.classList.contains("hidden")) await loadFiles();
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
        const originalText = button.textContent;

        try {
            button.disabled = true;
            button.textContent = "Downloading...";

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
            button.textContent = originalText;
        }
    }

    async function renameFile(filename) {
        const extension = getExtension(filename);
        const currentName = getFilenameWithoutExtension(filename);
        const enteredName = prompt("Rename file", currentName);

        if (enteredName === null || !enteredName.trim()) return;

        const newFilename = extension ? `${enteredName.trim()}.${extension}` : enteredName.trim();

        try {
            const data = await fetchJson(`/rename/${encodeURIComponent(filename)}?val=${encodeURIComponent(newFilename)}`);

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

        const originalText = button.textContent;

        try {
            button.disabled = true;
            button.textContent = "Deleting...";

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
            button.textContent = originalText;
        }
    }

    function createActionButton(text, className, onClick) {
        const button = document.createElement("button");

        button.type = "button";
        button.className = `file-action ${className}`;
        button.textContent = text;

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

            const downloadBtn = createActionButton("Download", "download", button => {
                downloadFile(filename, button);
            });

            const renameBtn = createActionButton("Rename", "rename", () => {
                renameFile(filename);
            });

            preview.className = "file-preview-link";
            preview.textContent = "Preview";
            preview.href = `/data/${encodeURIComponent(filename)}`;
            preview.target = "_blank";
            preview.rel = "noopener noreferrer";

            const deleteBtn = createActionButton("Delete", "delete", button => {
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

            const data = await fetchJson(`/create?fname=${encodeURIComponent(filename)}&ext=${encodeURIComponent(extension)}`, {
                method: "POST",
                body: content
            });

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