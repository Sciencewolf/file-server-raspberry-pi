document.addEventListener("DOMContentLoaded", () => {

    /* =====================================================
       ELEMENTS
    ===================================================== */

    const uploadForm =
        document.getElementById("upload-form");

    const uploadInput =
        document.getElementById("upload-input");

    const uploadBtn =
        document.getElementById("upload-btn");

    const uploadBtnText =
        document.getElementById("upload-btn-text");

    const removeFileBtn =
        document.getElementById("remove-file");

    const dropZone =
        document.getElementById("drop-zone");

    const filePreview =
        document.getElementById("file-preview");

    const fileName =
        document.getElementById("file-name");

    const fileSize =
        document.getElementById("file-size");

    const connectionStatus =
        document.getElementById("connection-status");

    const statusText =
        document.getElementById("status-text");

    const offlineOverlay =
        document.getElementById("offline-overlay");

    const newFileCheckbox =
        document.getElementById("checkbox-new-file");

    const newFileWrapper =
        document.getElementById("wrapper-new-file");

    const fileNameInput =
        document.getElementById("fname-input");

    const fileExtensionInput =
        document.getElementById("file-ext-input");

    const clearFilenameBtn =
        document.getElementById("btn-clear-filename");

    const newFileTextarea =
        document.getElementById("textarea-new-file");

    const createFileBtn =
        document.getElementById("btn-send-new-file");

    const clearTextareaBtn =
        document.getElementById("btn-clear-textarea");

    const allFilesBtn =
        document.getElementById("all-files-btn");

    const fileList =
        document.getElementById("see-all");


    /* =====================================================
       TOAST
    ===================================================== */

    function showToast(message, type = "success") {

        let background;

        if (type === "success") {
            background = "#22c55e";
        } else if (type === "error") {
            background = "#ef4444";
        } else {
            background = "#6366f1";
        }

        Toastify({
            text: message,
            duration: 3000,
            gravity: "top",
            position: "right",
            stopOnFocus: true,

            style: {
                background: background,
                borderRadius: "10px",
                boxShadow: "none"
            }

        }).showToast();
    }


    /* =====================================================
       FILE SIZE
    ===================================================== */

    function formatFileSize(bytes) {

        if (bytes === 0) {
            return "0 Bytes";
        }

        const units = [
            "Bytes",
            "KB",
            "MB",
            "GB",
            "TB"
        ];

        const index =
            Math.floor(
                Math.log(bytes) / Math.log(1024)
            );

        return (
            parseFloat(
                (
                    bytes /
                    Math.pow(1024, index)
                ).toFixed(2)
            )
            + " "
            + units[index]
        );
    }


    /* =====================================================
       SELECTED FILE
    ===================================================== */

    function showSelectedFile(file) {

        if (!file) {
            return;
        }

        fileName.textContent =
            file.name;

        fileSize.textContent =
            formatFileSize(file.size);

        filePreview.classList.remove(
            "hidden"
        );

        uploadBtn.classList.remove(
            "hidden"
        );
    }


    /* =====================================================
       CLEAR SELECTED FILE
    ===================================================== */

    function clearSelectedFile() {

        /*
         * This actually resets the
         * browser file input.
         */

        uploadInput.value = "";

        filePreview.classList.add(
            "hidden"
        );

        uploadBtn.classList.add(
            "hidden"
        );

        fileName.textContent = "";

        fileSize.textContent = "";
    }


    /* =====================================================
       FILE INPUT
    ===================================================== */

    uploadInput.addEventListener(
        "change",
        () => {

            const file =
                uploadInput.files[0];

            if (!file) {

                clearSelectedFile();

                return;
            }

            showSelectedFile(file);
        }
    );


    /* =====================================================
       REMOVE SELECTED FILE
    ===================================================== */

    removeFileBtn.addEventListener(
        "click",
        event => {

            event.preventDefault();

            event.stopPropagation();

            clearSelectedFile();
        }
    );


    /* =====================================================
       DRAG & DROP
    ===================================================== */

    [
        "dragenter",
        "dragover"
    ].forEach(eventName => {

        dropZone.addEventListener(
            eventName,
            event => {

                event.preventDefault();

                dropZone.classList.add(
                    "dragover"
                );
            }
        );

    });


    [
        "dragleave",
        "drop"
    ].forEach(eventName => {

        dropZone.addEventListener(
            eventName,
            event => {

                event.preventDefault();

                dropZone.classList.remove(
                    "dragover"
                );
            }
        );

    });


    dropZone.addEventListener(
        "drop",
        event => {

            const files =
                event.dataTransfer.files;

            if (
                !files ||
                files.length === 0
            ) {
                return;
            }

            try {

                const dataTransfer =
                    new DataTransfer();

                dataTransfer.items.add(
                    files[0]
                );

                uploadInput.files =
                    dataTransfer.files;

                showSelectedFile(
                    files[0]
                );

            } catch (error) {

                console.error(
                    "Could not assign dropped file:",
                    error
                );

                showToast(
                    "Could not select dropped file.",
                    "error"
                );
            }
        }
    );


    /* =====================================================
       UPLOAD
    ===================================================== */

    uploadForm.addEventListener(
        "submit",
        async event => {

            event.preventDefault();

            const file =
                uploadInput.files[0];

            if (!file) {

                showToast(
                    "Please select a file first.",
                    "error"
                );

                return;
            }


            const formData =
                new FormData();

            formData.append(
                "file",
                file
            );


            try {

                uploadBtn.disabled = true;

                uploadBtnText.textContent =
                    "Uploading...";


                const response =
                    await fetch(
                        "/upload",
                        {
                            method: "POST",
                            body: formData
                        }
                    );


                let data = {};

                try {
                    data =
                        await response.json();
                } catch {
                    data = {};
                }


                if (!response.ok) {

                    throw new Error(
                        data.info ||
                        `Upload failed: ${response.status}`
                    );
                }


                showToast(
                    data.info ||
                    `${file.name} uploaded successfully.`
                );


                /*
                 * Reset the selected file
                 * after successful upload.
                 */

                clearSelectedFile();


                /*
                 * Refresh file list if it
                 * is currently visible.
                 */

                if (
                    !fileList.classList.contains(
                        "hidden"
                    )
                ) {
                    await loadFiles();
                }


            } catch (error) {

                console.error(
                    "Upload error:",
                    error
                );

                showToast(
                    error.message ||
                    "Upload failed.",
                    "error"
                );

            } finally {

                uploadBtn.disabled = false;

                uploadBtnText.textContent =
                    "Upload file ↑";
            }

        }
    );


    /* =====================================================
       CREATE NEW FILE TOGGLE
    ===================================================== */

    newFileCheckbox.addEventListener(
        "change",
        () => {

            if (
                newFileCheckbox.checked
            ) {

                newFileWrapper.classList.remove(
                    "hidden"
                );

            } else {

                newFileWrapper.classList.add(
                    "hidden"
                );
            }
        }
    );


    /* =====================================================
       CLEAR FILENAME
    ===================================================== */

    clearFilenameBtn.addEventListener(
        "click",
        () => {

            fileNameInput.value = "";

            fileExtensionInput.value = "";

            fileNameInput.focus();
        }
    );


    /* =====================================================
       CLEAR TEXTAREA
    ===================================================== */

    clearTextareaBtn.addEventListener(
        "click",
        () => {

            newFileTextarea.value = "";

            newFileTextarea.focus();
        }
    );


    /* =====================================================
       CREATE NEW FILE
    ===================================================== */

    createFileBtn.addEventListener(
        "click",
        async () => {

            const filename =
                fileNameInput.value.trim();

            const extension =
                fileExtensionInput.value
                    .trim()
                    .replace(".", "");

            const content =
                newFileTextarea.value;


            if (!filename) {

                showToast(
                    "Please enter a filename.",
                    "error"
                );

                fileNameInput.focus();

                return;
            }


            if (!extension) {

                showToast(
                    "Please enter a file extension.",
                    "error"
                );

                fileExtensionInput.focus();

                return;
            }


            const fullFilename =
                `${filename}.${extension}`;


            try {

                createFileBtn.disabled = true;

                createFileBtn.textContent =
                    "Creating...";


                /*
                 * IMPORTANT:
                 *
                 * Your Flask backend uses /create,
                 * not /create-file.
                 */

                const response =
                    await fetch(
                        `/create?fname=${encodeURIComponent(filename)}&ext=${encodeURIComponent(extension)}`,
                        {
                            method: "POST",
                            body: content
                        }
                    );


                let data = {};

                try {
                    data =
                        await response.json();
                } catch {
                    data = {};
                }


                if (!response.ok) {

                    throw new Error(
                        data.info ||
                        `Create file failed: ${response.status}`
                    );
                }


                showToast(
                    data.info ||
                    `${fullFilename} created successfully.`
                );


                fileNameInput.value = "";

                fileExtensionInput.value = "";

                newFileTextarea.value = "";


                newFileCheckbox.checked =
                    false;

                newFileWrapper.classList.add(
                    "hidden"
                );


                /*
                 * Refresh file list.
                 */

                if (
                    !fileList.classList.contains(
                        "hidden"
                    )
                ) {
                    await loadFiles();
                }


            } catch (error) {

                console.error(
                    "Create file error:",
                    error
                );

                showToast(
                    error.message ||
                    "Could not create the file.",
                    "error"
                );

            } finally {

                createFileBtn.disabled =
                    false;

                createFileBtn.textContent =
                    "Create file";
            }
        }
    );


    /* =====================================================
       CONNECTION STATUS
    ===================================================== */

    async function checkConnection() {

        try {

            const response =
                await fetch(
                    "/connection",
                    {
                        method: "GET",
                        cache: "no-store"
                    }
                );


            if (!response.ok) {
                throw new Error(
                    "Server unavailable"
                );
            }


            setOnline();

        } catch (error) {

            setOffline();
        }
    }


    function setOnline() {

        connectionStatus.classList.remove(
            "offline"
        );

        connectionStatus.classList.add(
            "online"
        );

        statusText.textContent =
            "Online";


        offlineOverlay.classList.add(
            "hidden"
        );
    }


    function setOffline() {

        connectionStatus.classList.remove(
            "online"
        );

        connectionStatus.classList.add(
            "offline"
        );

        statusText.textContent =
            "Offline";


        offlineOverlay.classList.remove(
            "hidden"
        );
    }


    /*
     * Check immediately.
     */

    checkConnection();


    /*
     * Check every 5 seconds.
     */

    setInterval(
        checkConnection,
        5000
    );


    /* =====================================================
       FILE MANAGER
    ===================================================== */

    allFilesBtn.addEventListener(
        "click",
        async () => {

            const isHidden =
                fileList.classList.contains(
                    "hidden"
                );


            if (!isHidden) {

                fileList.classList.add(
                    "hidden"
                );

                allFilesBtn.textContent =
                    "View files";

                return;
            }


            await loadFiles();
        }
    );


    /* =====================================================
       LOAD FILES
    ===================================================== */

    async function loadFiles() {

        try {

            allFilesBtn.disabled = true;

            allFilesBtn.textContent =
                "Loading...";


            /*
             * IMPORTANT:
             *
             * Your Flask backend uses /all.
             * NOT /files.
             */

            const response =
                await fetch(
                    "/all",
                    {
                        cache: "no-store"
                    }
                );


            if (!response.ok) {

                throw new Error(
                    `Failed to load files: ${response.status}`
                );
            }


            const data =
                await response.json();


            renderFiles(data);


            fileList.classList.remove(
                "hidden"
            );


            allFilesBtn.textContent =
                "Hide files";


        } catch (error) {

            console.error(
                "File manager error:",
                error
            );


            showToast(
                "Could not load files.",
                "error"
            );


            fileList.classList.add(
                "hidden"
            );


            allFilesBtn.textContent =
                "View files";


        } finally {

            allFilesBtn.disabled =
                false;
        }
    }


    /* =====================================================
       RENDER FILES
    ===================================================== */

    function renderFiles(data) {

        fileList.innerHTML = "";


        let files = data;


        /*
         * Support:
         *
         * ["file1.txt"]
         *
         * and:
         *
         * { files: [...] }
         */

        if (
            data &&
            !Array.isArray(data) &&
            Array.isArray(data.files)
        ) {

            files =
                data.files;
        }


        if (!Array.isArray(files)) {
            files = [];
        }


        if (files.length === 0) {

            const empty =
                document.createElement(
                    "div"
                );

            empty.className =
                "file-list-item";


            const text =
                document.createElement(
                    "span"
                );

            text.className =
                "file-list-name";

            text.textContent =
                "No files found.";


            empty.appendChild(text);

            fileList.appendChild(
                empty
            );

            return;
        }


        files.forEach(file => {

            const filename =
                typeof file === "string"
                    ? file
                    : file.name;


            if (!filename) {
                return;
            }


            /* ---------------------------------------------
               ITEM
            --------------------------------------------- */

            const item =
                document.createElement(
                    "div"
                );

            item.className =
                "file-list-item";


            /* ---------------------------------------------
               NAME
            --------------------------------------------- */

            const name =
                document.createElement(
                    "span"
                );

            name.className =
                "file-list-name";

            name.textContent =
                filename;


            /* ---------------------------------------------
               ACTIONS
            --------------------------------------------- */

            const actions =
                document.createElement(
                    "div"
                );

            actions.className =
                "file-list-actions";


            /* ---------------------------------------------
               DOWNLOAD
            --------------------------------------------- */

            const download =
                document.createElement(
                    "button"
                );

            download.type =
                "button";

            download.className =
                "file-action download";

            download.textContent =
                "Download";


            download.addEventListener(
                "click",
                () => {

                    /*
                     * Backend endpoint:
                     * /get/<filename>
                     */

                    window.location.href =
                        `/get/${encodeURIComponent(filename)}`;
                }
            );


            /* ---------------------------------------------
               RENAME
            --------------------------------------------- */

            const rename =
                document.createElement(
                    "button"
                );

            rename.type =
                "button";

            rename.className =
                "file-action rename";

            rename.textContent =
                "Rename";


            rename.addEventListener(
                "click",
                async () => {

                    const currentExtension =
                        getExtension(filename);


                    const currentName =
                        getFilenameWithoutExtension(
                            filename
                        );


                    const newName =
                        prompt(
                            "Rename file",
                            currentName
                        );


                    if (
                        newName === null ||
                        !newName.trim()
                    ) {
                        return;
                    }


                    const trimmedName =
                        newName.trim();


                    const newFilename =
                        currentExtension
                            ? `${trimmedName}.${currentExtension}`
                            : trimmedName;


                    try {

                        const response =
                            await fetch(
                                `/rename/${encodeURIComponent(filename)}?val=${encodeURIComponent(newFilename)}`
                            );


                        const data =
                            await response.json();


                        if (!response.ok) {

                            throw new Error(
                                data.info ||
                                "Rename failed."
                            );
                        }


                        showToast(
                            data.info ||
                            "File renamed successfully."
                        );


                        await loadFiles();


                    } catch (error) {

                        console.error(
                            "Rename error:",
                            error
                        );

                        showToast(
                            error.message ||
                            "Could not rename file.",
                            "error"
                        );
                    }
                }
            );


            /* ---------------------------------------------
               PREVIEW
            --------------------------------------------- */

            const preview =
                document.createElement(
                    "a"
                );

            preview.className =
                "file-preview-link";

            preview.textContent =
                "Preview";

            preview.href =
                `/data/${encodeURIComponent(filename)}`;

            preview.target =
                "_blank";

            preview.rel =
                "noopener noreferrer";


            /* ---------------------------------------------
               DELETE
            --------------------------------------------- */

            const deleteBtn =
                document.createElement(
                    "button"
                );

            deleteBtn.type =
                "button";

            deleteBtn.className =
                "file-action delete";

            deleteBtn.textContent =
                "Delete";


            deleteBtn.addEventListener(
                "click",
                async () => {

                    const confirmed =
                        confirm(
                            `Are you sure you want to delete '${filename}'?`
                        );


                    if (!confirmed) {
                        return;
                    }


                    try {

                        const response =
                            await fetch(
                                `/delete/${encodeURIComponent(filename)}`
                            );


                        const data =
                            await response.json();


                        if (!response.ok) {

                            throw new Error(
                                data.info ||
                                "Delete failed."
                            );
                        }


                        showToast(
                            data.info ||
                            "File deleted successfully."
                        );


                        await loadFiles();


                    } catch (error) {

                        console.error(
                            "Delete error:",
                            error
                        );

                        showToast(
                            error.message ||
                            "Could not delete file.",
                            "error"
                        );
                    }
                }
            );


            /* ---------------------------------------------
               APPEND
            --------------------------------------------- */

            actions.appendChild(
                download
            );

            actions.appendChild(
                rename
            );

            actions.appendChild(
                preview
            );

            actions.appendChild(
                deleteBtn
            );


            item.appendChild(
                name
            );

            item.appendChild(
                actions
            );


            fileList.appendChild(
                item
            );
        });
    }


    /* =====================================================
       FILENAME HELPERS
    ===================================================== */

    function getExtension(filename) {

        const lastDot =
            filename.lastIndexOf(".");


        if (
            lastDot <= 0 ||
            lastDot === filename.length - 1
        ) {
            return "";
        }


        return filename.substring(
            lastDot + 1
        );
    }


    function getFilenameWithoutExtension(
        filename
    ) {

        const lastDot =
            filename.lastIndexOf(".");


        if (lastDot <= 0) {
            return filename;
        }


        return filename.substring(
            0,
            lastDot
        );
    }

});